import sys
sys.dont_write_bytecode=True
import importlib.util,json
from pathlib import Path
s=importlib.util.spec_from_file_location('help_report','scripts/report-help-experiment.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
anchor=1794500000000
assign=lambda install,qa=False:{'name':'experiment_assignment','data':{'install':install,'experiment':'e','variant':'candidate','cohort':'new','anchor':anchor,'qa':qa}}
events=[assign('one'),assign('churned'),assign('tester',True),{'name':'ad_revenue_status','occurred_at':anchor+1000,'data':{'install':'one','experiment':'e','impression_id':'missing','valid':False}}]
money=[{'payload':{'dataset':'manual-ilrd-v1','install':'one','experiment':'e','impression_id':'valid'},'revenue':'0.12','currency':'RUB','occurred_at':anchor+2000,'precision':'estimated'}]
r=m.report(events,money+money,anchor+168*m.HOUR);g=r['groups'][0]
assert g['mature_r7']==2 and g['mature_d7']==0 and g['measured_r7']['RUB']=='0.06'
assert g['unknown_impressions']==1 and g['money_coverage']==0.5 and g['true_r7'] is None
assert r['excluded_qa_rows']==1 and g['valid_monetary_callbacks']==1
assert m.report(events,money,anchor+167*m.HOUR)['groups'][0]['mature_r7']==0
assert m.report(events,money,anchor+192*m.HOUR)['groups'][0]['mature_d7']==2
bad=[{**money[0],'revenue':'NaN'}];assert m.report(events,bad,anchor+192*m.HOUR)['invalid_money_rows']==1
conflict=[money[0],{**money[0],'revenue':'0.13'}];assert 'conflicting_impression_amount' in m.report(events,conflict,anchor+192*m.HOUR)['join_errors']
Path('test-results/help').mkdir(parents=True,exist_ok=True)
Path('test-results/help/report-synthetic-example.json').write_text(json.dumps(r,indent=2)+'\n')
print('PASS: original-user denominator, churn, 168/192-hour maturity, QA exclusion, decimal sum, unknown ILRD, dedup and conflicting money')
