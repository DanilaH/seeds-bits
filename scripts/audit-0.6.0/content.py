import json,time,random
from pathlib import Path
start=time.time();original=json.loads(Path('src/notebook.json').read_text());extra=json.loads(Path('src/notebook-extra.json').read_text())
items=[(p['id'],p['board'],[(q['a'],q['b']) for q in p['solution']]) for p in original]
items += [(f'book-v1-{i+25}',list(map(int,b)),list(zip(s[::3],s[1::3]))) for i,(b,s) in enumerate(extra)]
def legal(b,a,c):
 if a==c or min(a,c)<0 or max(a,c)>=len(b) or not b[a] or not b[c] or not(b[a]==b[c] or b[a]+b[c]==10):return False
 lo,hi=sorted((a,c))
 if not any(b[lo+1:hi]):return True
 y,x=divmod(a,9);Y,X=divmod(c,9);dy,dx=Y-y,X-x
 if dx and dy and abs(dx)!=abs(dy):return False
 step=max(abs(dx),abs(dy));sx=(dx>0)-(dx<0);sy=(dy>0)-(dy<0)
 return all(not b[(y+k*sy)*9+x+k*sx] for k in range(1,step))
def remove(b,a,c):
 b=b.copy();b[a]=b[c]=0
 return [v for i in range(0,len(b),9) if any(b[i:i+9]) for v in b[i:i+9]]
fail=[];moves=0;metrics=[];partial=[]
for id,b,solution in items:
 initial=b.copy();snapshots=[]
 for n,(a,c) in enumerate(solution):
  if not legal(b,a,c):fail.append([id,n,a,c]);break
  snapshots.append({'board':b.copy(),'scroll':0,'moves':n,'additions':0});b=remove(b,a,c);moves+=1
 if any(b):fail.append([id,'not empty'])
 metrics.append({'id':id,'digits':sum(bool(x) for x in initial),'cells':len(initial),'moves':len(solution)})
 if int(id[8:])%24==0:
  count=min(100,len(snapshots)-1);partial.append((id,{'rules':1,'current':snapshots[count],'history':snapshots[:count]}))
# Plausible late-game retained histories: one unfinished task per volume, on known legal paths.
p={'version':3,'active':partial[-1][0],'sessions':dict(partial),'done':[],'seen':[],'hints':{}}
Path('/tmp/audit060-partial-save-fixture.json').write_text(json.dumps(p,separators=(',',':')))
report={'puzzles':len(items),'movesIndependentlyValidated':moves,'failures':fail,'elapsedSeconds':round(time.time()-start,2),'unfinished100VolumeBytes':len(json.dumps(p,separators=(',',':'))),'lastVolume':metrics[-24:]}
Path('docs/audit-0.6.0/content.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='lastVolume'}))
assert not fail
