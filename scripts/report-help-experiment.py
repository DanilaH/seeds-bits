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
    events=[event(r) for r in events]
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
        item=(key,currency,amount,when)
        if iid in money:
            if money[iid]!=item:errors.append('conflicting_impression_amount')
            continue
        money[iid]=item;precision[row.get('precision',row.get('ad_revenue_precision','unknown'))]+=1
    groups={}
    for key,a in assignments.items():
        groupkey=(a['experiment'],a['variant'],a['cohort'])
        g=groups.setdefault(groupkey,{'assigned':0,'mature_r7':0,'mature_d7':0,'d1':0,'d7':0,'valid_monetary_callbacks':0,'impressions_with_id':set(),'invalid_impressions':set(),'native_impression_events':0,'totals':defaultdict(Decimal)})
        g['assigned']+=1;anchor=a['anchor']
        if as_of<anchor+168*HOUR:continue
        g['mature_r7']+=1
        activities=[when for name,d,when in events if (d.get('install'),d.get('experiment'))==key and name in ('game_open','game_start','first_pair')]
        if any(anchor+24*HOUR<=t<anchor+48*HOUR for t in activities):g['d1']+=1
        if as_of>=anchor+192*HOUR:
            g['mature_d7']+=1
            if any(anchor+168*HOUR<=t<anchor+192*HOUR for t in activities):g['d7']+=1
        for name,d,when in events:
            if (d.get('install'),d.get('experiment'))!=key or not anchor<=when<anchor+168*HOUR:continue
            if name=='ad_impression':g['native_impression_events']+=1
            if name=='ad_revenue_status' and d.get('impression_id'):
                g['impressions_with_id'].add(d['impression_id'])
                if not truth(d.get('valid')):g['invalid_impressions'].add(d['impression_id'])
        for iid,(unit,currency,amount,when) in money.items():
            if unit==key and anchor<=when<anchor+168*HOUR:
                g['totals'][currency]+=amount;g['valid_monetary_callbacks']+=1;g['impressions_with_id'].add(iid);g['invalid_impressions'].discard(iid)
    result=[]
    for (experiment,variant,cohort),g in sorted(groups.items()):
        count=g['mature_r7'];ids=len(g.pop('impressions_with_id'));unknown=len(g.pop('invalid_impressions'));totals=g.pop('totals')
        result.append({'experiment':experiment,'variant':variant,'cohort':cohort,**g,'impressions_with_id':ids,'unknown_impressions':unknown,
          'money_coverage':g['valid_monetary_callbacks']/ids if ids else None,
          'measured_revenue':{c:str(v) for c,v in totals.items()},
          'measured_r7':{c:str(v/Decimal(count)) for c,v in totals.items()} if count else None,
          'd1_rate':g['d1']/count if count else None,'d7_rate':g['d7']/g['mature_d7'] if g['mature_d7'] else None,
          'true_r7':None,'observation_completeness':'not attested by SDK enqueue/export alone'})
    return {'canonical_dataset':canonical,'as_of':as_of,'groups':result,'excluded_qa_rows':exclusions,'ignored_other_money_sources':ignored,'invalid_money_rows':invalid,'precision':dict(precision),'join_errors':sorted(set(errors)),
      'decision':'NOT_READY_FOR_COMMERCIAL_CONCLUSION','limits':['No paid rollout authorized.','Validate dashboard canonical source and export join on a physical paid trace.','Missing/invalid ILRD remains unknown; no inferred zero or FX totals.','No MDE, baseline variance, full observation attestation or causal winner in this technical audit.']}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--events',required=True);p.add_argument('--revenue',required=True);p.add_argument('--as-of',required=True);p.add_argument('--canonical',default='manual-ilrd-v1');p.add_argument('--output',required=True);a=p.parse_args()
    Path(a.output).write_text(json.dumps(report(rows(a.events),rows(a.revenue),stamp(a.as_of),a.canonical),indent=2,ensure_ascii=False)+'\n')
