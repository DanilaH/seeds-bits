"""Build small review artifacts from reproducible full research outputs."""
import argparse
import json
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('--input',type=Path,default=Path(__file__).resolve().parent)
parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parent)
args=parser.parse_args()
args.output.mkdir(parents=True,exist_ok=True)
def read(name): return json.loads((args.input/name).read_text())
def write(name,obj): (args.output/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')

matched=read('baseline-matched.json')
fields={}
matches=[]
for match in matched['matches']:
    matches.append({k:v for k,v in match.items() if k!='fields'} | {'seeds':[f['seed'] for f in match['fields']]})
    for field in match['fields']:
        clean={k:v for k,v in field.items() if k not in ['proofReplay','greedyReplay']}
        clean['greedyRoute']=field['greedyReplay']['route']
        fields[field['seed']]=clean
write('matched-fixtures.json',{'sourceRef':matched['sourceRef'],'definitions':matched['definitions'],'matches':matches,'fields':[fields[k] for k in sorted(fields)]})

policy=read('policy-results.json')
write('policy-summary.json',{
    'design':policy['design'],'summary':policy['summary'],
    'reproduceFullRows':'node policy-control.mjs creates policy-results.json with all 300 boards and 900 outcomes',
    'rows':[{'level':r['level'],'seed':r['seed'],'boardSha256':r['boardSha256'],'openingPairs':r['openingPairs'],
             'outcomes':{p:v['outcome'] for p,v in r['outcomes'].items()}} for r in policy['rows']]
})

feasibility=read('feasibility-results.json')
small={k:v for k,v in feasibility.items() if k not in ['kernels','attempts','examples','referenceFamilies']}
small['kernels']={k:v for k,v in feasibility['kernels'].items() if k!='original'}
small['kernels']['originalCount']=len(feasibility['kernels']['original'])
small['attemptCount']=len(feasibility['attempts'])
small['referenceFieldsReplayed']=len(feasibility['referenceFamilies'])
small['examples']=[{'id':e['id'],'target':e['target'],'boardSha256':e['boardSha256'],'proofSha256':e['proofSha256']} for e in feasibility['examples']]
small['reproduceFullAttempts']='node feasibility-run.mjs creates feasibility-results.json with all attempts, kernels and route metrics'
write('feasibility-summary.json',small)
