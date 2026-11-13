"""Upgrade a previously built pre-release payload to the current release with one CI-only certificate.
Both APKs are release/non-debuggable. Persistence is exercised through the UI.
Production APK certificate identity is verified separately on the delivered bytes.
"""
import json,os,pathlib,re,subprocess,sys,time,xml.etree.ElementTree as ET
out=pathlib.Path('test-results/emulator-upgrade');out.mkdir(parents=True,exist_ok=True)
pkg='com.seedsbits.game';phase=sys.argv[1]
def adb(*args):return subprocess.run(['adb',*args],check=True,capture_output=True,text=True).stdout
def ui():
 for attempt in range(5):
  try:
   subprocess.run(['adb','shell','uiautomator','dump','/sdcard/seeds-upgrade.xml'],check=True,capture_output=True,timeout=25)
   raw=adb('shell','cat','/sdcard/seeds-upgrade.xml');(out/f'{phase}-last-ui.xml').write_text(raw);return ET.fromstring(raw)
  except (subprocess.SubprocessError,ET.ParseError):
   if attempt==4:raise
   time.sleep(1)
def label(n):return n.get('content-desc') or n.get('text','')
def button(part,exact=False):
 for _ in range(10):
  for n in ui().iter('node'):
   name=label(n)
   if (name==part if exact else part in name) and (n.get('clickable')=='true' or name==part):return n
  time.sleep(1)
 raise AssertionError('Control missing: '+part)
def hint_count(expected):
 # Both released UIs expose the exact balance; never match a numeric substring.
 choices={f'Подсказка · {expected}',f'Подсказка, осталось {expected}'}
 for _ in range(10):
  for node in ui().iter('node'):
   if label(node) in choices:return node
  time.sleep(1)
 raise AssertionError('Exact hint balance missing: '+str(expected))
def tap(n):
 b=list(map(int,re.findall(r'\d+',n.get('bounds',''))));assert len(b)==4
 adb('shell','input','tap',str((b[0]+b[2])//2),str((b[1]+b[3])//2));time.sleep(.3)
def cells():
 found={}
 for n in ui().iter('node'):
  m=re.fullmatch(r'([1-9]), строка (\d+), столбец (\d+)',label(n))
  if m:
   v,r,c=map(int,m.groups());found[(r-1)*9+c-1]=(v,n)
 return found
def count(expected):
 for _ in range(8):
  found=cells()
  if len(found)==expected:return found
  time.sleep(.4)
 raise AssertionError(f'Expected {expected} cells, got {len(found)}')
def pair(found):
 for a,(v,an) in found.items():
  for b,(w,bn) in found.items():
   if b<=a or not(v==w or v+w==10):continue
   dr=b//9-a//9;dc=b%9-a%9
   if dr==0 or dc==0 or abs(dr)==abs(dc):
    step=(1 if dc>0 else -1) if dr==0 else 9 if dc==0 else 9+(1 if dc>0 else -1)
    clear=not any(i in found for i in range(a+step,b,step))
   else:clear=False
   if clear or not any(i in found for i in range(a+1,b)):tap(an);tap(bn);return
 raise AssertionError('No legal visible pair')
def resume():tap(button('Продолжить'))
def screenshot(name):
 with (out/name).open('wb') as f:subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
def book():
 tap(button('Открыть меню',True));tap(button('Тетради'));tap(button('Задача 1',True))
def classic():tap(button('Открыть меню',True));tap(button('Классика'))
adb('shell','svc','wifi','disable');adb('shell','svc','data','disable')
adb('shell','settings','put','global','http_proxy','127.0.0.1:9')
adb('shell','am','start','-n',pkg+'/.MainActivity');time.sleep(3)
try:
 if phase=='before':
  tap(button('Пропустить',True));pair(count(28));count(26)
  tap(hint_count(3));hint_count(2)
  book();initial=len(cells());pair(cells());count(initial-2)
  classic();count(26)
  tap(button('Открыть меню',True));tap(button('Настройки',True));tap(button('Тёмная тема',True));tap(button('Закрыть меню',True));count(26)
  screenshot('before.png')
  (out/'baseline.json').write_text(json.dumps({'classicDigits':26,'classicHintBudget':2,'bookDigits':initial-2,'baselineSource':os.environ.get('SEEDS_UPGRADE_BASELINE_SOURCE','86d950b970a69e5dec3ebc269075143a1c28f94a'),'baselineVersion':os.environ.get('SEEDS_UPGRADE_BASELINE_VERSION','1.0.0 (1000010)'),'signature':'same temporary CI-only key for both APKs'}))
  adb('shell','am','force-stop',pkg)
 else:
  before=json.loads((out/'baseline.json').read_text());resume();count(before['classicDigits']);hint_count(2)
  screenshot('after.png')
  from PIL import Image
  old=Image.open(out/'before.png').convert('RGB');new=Image.open(out/'after.png').convert('RGB')
  assert sum(old.getpixel((old.width//2,old.height//2)))<420,'Baseline dark theme not active'
  assert sum(new.getpixel((new.width//2,new.height//2)))<420,'Dark theme not retained'
  tap(button('Отмена',True));count(28)
  book();count(before['bookDigits']);classic();count(28)
  (out/'acceptance.json').write_text(json.dumps({'passed':True,'classicBoard':True,'classicUndoHistory':True,'hintBudget':True,'notebookBoard':True,'darkTheme':True,'scope':os.environ.get('SEEDS_UPGRADE_BASELINE_KIND','rebuilt pre-release source')+' → new release payload, offline Android 35, same temporary CI certificate; not a physical-device production-certificate install'},indent=2))
finally:
 (out/f'{phase}-logcat.txt').write_text(adb('logcat','-d','-t','300'))
