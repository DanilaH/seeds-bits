"""Offline export audit. No network, imputed money, FX conversion or winner declaration."""
import argparse,csv,json
from collections import defaultdict
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
HOUR=3600000

def obj(v):
    if isinstance(v,dict): return v
    try: return json.loads(v or '{}')
    except (ValueError,TypeError): return {}
def stamp(v):
    if isinstance(v,str) and not v.replace('.','',1).isdigit(): return int(datetime.fromisoformat(v.replace('Z','+00:00')).timestamp()*1000)
    n=float(v or 0)
    return int(n*1000 if n<100000000000 else n)
def truth(v): return v is True or str(v).lower() in ('true','1')
def rows(path):
    if str(path).endswith('.csv'):
        with open(path,newline='',encoding='utf-8-sig') as f:return list(csv.DictReader(f))
    value=json.loads(Path(path).read_text());return value if isinstance(value,list) else value['rows']
def event(row):
    data=obj(row.get('data',row.get('event_json',{})))
    return row.get('name',row.get('event_name','')),data,stamp(row.get('occurred_at',row.get('event_timestamp',data.get('occurred_at',0))))
def report(events,revenue,as_of,canonical='manual-ilrd-v1'):
    parsed=[event(r) for r in events];events=[];seen=set()
    for e in parsed:
        eid=e[1].get('event_id')
        if eid and eid in seen:continue
        if eid:seen.add(eid)
        events.append(e)
    assignments={}; exclusions=0; errors=[]
    for name,data,when in events:
        if name!='experiment_assignment':continue
        if truth(data.get('qa')) or truth(data.get('ads_test',data.get('test'))) or data.get('build_channel')=='preview':exclusions+=1;continue
        if not all(data.get(k) is not None for k in ('install','experiment','variant','anchor','cohort')):errors.append('assignment_missing_join');continue
        key=(data['install'],data['experiment'])
        a={**data,'anchor':int(data['anchor'])}
        if key in assignments and any(assignments[key].get(k)!=a.get(k) for k in ('variant','anchor','cohort')):errors.append('conflicting_assignment');continue
        assignments[key]=a
    money={}; ignored=0; invalid=0; precision=defaultdict(int)
    for row in revenue:
        payload=obj(row.get('payload',row.get('ad_revenue_payload',{})))
        if payload.get('dataset')!=canonical:ignored+=1;continue
        if truth(payload.get('qa')):continue
        key=(payload.get('install'),payload.get('experiment'))
        if key not in assignments:errors.append('money_without_assignment');continue
        iid=payload.get('impression_id'); currency=row.get('currency',row.get('ad_revenue_currency'))
        if not iid or not currency:invalid+=1;continue
        try:
            amount=Decimal(str(row.get('revenue',row.get('ad_revenue'))))
            if not amount.is_finite() or amount<0:raise InvalidOperation
        except (InvalidOperation,ValueError):invalid+=1;continue
        when=stamp(row.get('occurred_at',row.get('ad_revenue_timestamp',0)))
        item=(key,currency,amount,when,payload.get('format',row.get('ad_revenue_type',row.get('ad_type','unknown'))))
        if iid in money:
            if money[iid]!=item:errors.append('conflicting_impression_amount')
            continue
        money[iid]=item;precision[row.get('precision',row.get('ad_revenue_precision','unknown'))]+=1
    groups={}
    for key,a in assignments.items():
        groupkey=(a['experiment'],a['variant'],a['cohort'])
        g=groups.setdefault(groupkey,{'assigned':0,'mature_r7':0,'mature_d7':0,'d1':0,'d7':0,'valid_monetary_callbacks':0,'impressions_with_id':set(),'invalid_impressions':set(),'native_impression_events':0,'totals':defaultdict(Decimal),'formats':{},'funnel':{},'result_routes':{},'first_short_task_users':set(),'active_days':0,'completed_games':0})
        g['assigned']+=1;anchor=a['anchor']
        if as_of<anchor+168*HOUR:continue
        g['mature_r7']+=1
        activities=[when for name,d,when in events if (d.get('install'),d.get('experiment'))==key and name in ('game_open','game_start','first_pair')]
        g['active_days']+=len({int((t-anchor)//(24*HOUR)) for t in activities if anchor<=t<anchor+168*HOUR})
        if any(anchor+24*HOUR<=t<anchor+48*HOUR for t in activities):g['d1']+=1
        if as_of>=anchor+192*HOUR:
            g['mature_d7']+=1
            if any(anchor+168*HOUR<=t<anchor+192*HOUR for t in activities):g['d7']+=1
        for name,d,when in events:
            if (d.get('install'),d.get('experiment'))!=key or not anchor<=when<anchor+168*HOUR:continue
            if name=='game_complete':g['completed_games']+=1
            if name.startswith('assist_') or name in ('hint_reward_granted','hint_used'):
                product=d.get('product','hint_pack_3' if name.startswith('hint_') else 'unknown')
                stage=name+(':'+str(d.get('outcome')) if name=='assist_followup' else '')
                f=g['funnel'].setdefault(product,{}).setdefault(stage,{'events':0,'installs':set()})
                f['events']+=1;f['installs'].add(key[0])
            if name=='result_transition':
                route=g['result_routes'].setdefault(d.get('route','unknown'),{'choices':0,'results':defaultdict(int)})
                if d.get('phase')=='choice':
                    route['choices']+=1
                    if truth(d.get('first_short_task')):g['first_short_task_users'].add(key[0])
                elif d.get('phase')=='result':route['results'][d.get('reason','unknown')]+=1
            if name=='ad_impression':
                g['native_impression_events']+=1
                fmt=g['formats'].setdefault(d.get('format','unknown'),{'native_impression_callbacks':0,'valid_monetary_callbacks':0,'measured_revenue':defaultdict(Decimal)})
                fmt['native_impression_callbacks']+=1
            if name=='ad_revenue_status' and d.get('impression_id'):
                g['impressions_with_id'].add(d['impression_id'])
                if not truth(d.get('valid')):g['invalid_impressions'].add(d['impression_id'])
        for iid,(unit,currency,amount,when,format_name) in money.items():
            if unit==key and anchor<=when<anchor+168*HOUR:
                fmt=g['formats'].setdefault(format_name,{'native_impression_callbacks':0,'valid_monetary_callbacks':0,'measured_revenue':defaultdict(Decimal)})
                fmt['valid_monetary_callbacks']+=1;fmt['measured_revenue'][currency]+=amount
                g['totals'][currency]+=amount;g['valid_monetary_callbacks']+=1;g['impressions_with_id'].add(iid);g['invalid_impressions'].discard(iid)
    result=[]
    for (experiment,variant,cohort),g in sorted(groups.items()):
        count=g['mature_r7'];ids=len(g.pop('impressions_with_id'));unknown=len(g.pop('invalid_impressions'));totals=g.pop('totals')
        g['first_short_task_users']=len(g['first_short_task_users'])
        g['active_days_per_assigned_r7']=g['active_days']/count if count else None
        g['completed_games_per_assigned_r7']=g['completed_games']/count if count else None
        for product,stages in g['funnel'].items():
            for stage,f in stages.items():f['installs']=len(f['installs']);f['share_of_assigned_r7']=f['installs']/count if count else None
        for fmt in g['formats'].values():fmt['measured_revenue']={c:str(v) for c,v in fmt['measured_revenue'].items()}
        result.append({'experiment':experiment,'variant':variant,'cohort':cohort,**g,'impressions_with_id':ids,'unknown_impressions':unknown,
          'money_coverage':g['valid_monetary_callbacks']/ids if ids else None,
          'measured_revenue':{c:str(v) for c,v in totals.items()},
          'measured_r7':{c:str(v/Decimal(count)) for c,v in totals.items()} if count else None,
          'd1_rate':g['d1']/count if count else None,'d7_rate':g['d7']/g['mature_d7'] if g['mature_d7'] else None,
          'true_r7':None,'observation_completeness':'not attested by SDK enqueue/export alone'})
    return {'canonical_dataset':canonical,'as_of':as_of,'groups':result,'excluded_qa_rows':exclusions,'ignored_other_money_sources':ignored,'invalid_money_rows':invalid,'precision':dict(precision),'join_errors':sorted(set(errors)),
      'funnel_window':'[anchor, anchor+168h), only mature_r7 assigned installs; stable event_id dedup',
      'decision':'NOT_READY_FOR_COMMERCIAL_CONCLUSION','limits':['No paid rollout authorized.','Validate dashboard canonical source and export join on a physical paid trace.','Missing/invalid ILRD remains unknown; no inferred zero or FX totals.','No MDE, baseline variance, full observation attestation or causal winner in this technical audit.']}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--events',required=True);p.add_argument('--revenue',required=True);p.add_argument('--as-of',required=True);p.add_argument('--canonical',default='manual-ilrd-v1');p.add_argument('--output',required=True);a=p.parse_args()
    Path(a.output).write_text(json.dumps(report(rows(a.events),rows(a.revenue),stamp(a.as_of),a.canonical),indent=2,ensure_ascii=False)+'\n')
