"""Exercise a non-debuggable release payload through Android accessibility, offline."""
import json,pathlib,re,subprocess,time,xml.etree.ElementTree as ET
out=pathlib.Path('test-results/emulator');out.mkdir(parents=True,exist_ok=True)
package='com.seedsbits.game'
def adb(*args,check=True):
 return subprocess.run(['adb',*args],check=check,capture_output=True,text=True).stdout

def snapshot():
 adb('shell','uiautomator','dump','/sdcard/seeds-ui.xml')
 raw=adb('shell','cat','/sdcard/seeds-ui.xml')
 (out/'last-ui.xml').write_text(raw)
 return ET.fromstring(raw)
def center(node):
 p=list(map(int,re.findall(r'\d+',node.get('bounds',''))));assert len(p)==4
 return ((p[0]+p[2])//2,(p[1]+p[3])//2)
def tap(node):
 x,y=center(node);adb('shell','input','tap',str(x),str(y))
def label(node):return node.get('content-desc') or node.get('text','')
def wait_label(choices):
 for _ in range(12):
  root=snapshot()
  for node in root.iter('node'):
   if label(node) in choices:return node
  time.sleep(1)
 raise AssertionError('Accessible label missing: '+repr(choices))
def cells():
 result={}
 for node in snapshot().iter('node'):
  m=re.match(r'^([1-9]), строка (\d+), столбец (\d+)$',label(node))
  if m:
   value,row,col=map(int,m.groups());result[(row-1)*9+col-1]=(value,node)
 return result
def wait_cells(count):
 for _ in range(10):
  found=cells()
  if len(found)==count:return found
  time.sleep(1)
 raise AssertionError(f'Expected {count} cells, got {len(found)}')
def pair(found):
 for a,(x,an) in found.items():
  for b,(y,bn) in found.items():
   if b<=a or not(x==y or x+y==10):continue
   dr=abs(a//9-b//9);dc=abs(a%9-b%9)
   if b-a==1 or (dr<=1 and dc<=1):return an,bn
 raise AssertionError('No adjacent starting pair')
def launch():
 adb('shell','am','start','-n',package+'/.MainActivity')
 time.sleep(3)
 assert adb('shell','pidof',package).strip(),'App process missing'
def screenshot(name):
 with (out/name).open('wb') as f:subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
checks={}
try:
 # No live ad impressions or analytics traffic from the emulator acceptance run.
 adb('shell','svc','wifi','disable');adb('shell','svc','data','disable')
 adb('shell','settings','put','global','airplane_mode_on','1')
 adb('shell','settings','put','global','http_proxy','127.0.0.1:9')
 launch();checks['launchOffline']=True
 tap(wait_label(['Пропустить']));tap(wait_label(['Играть','Продолжить игру']))
 found=wait_cells(28);checks['tutorialSkipAndClassic']=True
 a,b=pair(found);tap(a);tap(b);wait_cells(26);checks['removePair']=True
 tap(wait_label(['Отмена']));found=wait_cells(28);checks['undo']=True
 a,b=pair(found);tap(a);tap(b);wait_cells(26);time.sleep(1)
 screenshot('portrait.png')
 adb('shell','am','force-stop',package);launch();tap(wait_label(['Продолжить игру','Играть']));wait_cells(26);checks['saveSurvivesProcessStop']=True
 adb('shell','settings','put','system','accelerometer_rotation','0')
 adb('shell','settings','put','system','user_rotation','1');time.sleep(2);wait_cells(26);screenshot('landscape.png');checks['rotationPreservesBoard']=True
 adb('shell','settings','put','system','user_rotation','0');time.sleep(2)
 tap(wait_label(['Открыть меню']));tap(wait_label(['Настройки']));tap(wait_label(['Конфиденциальность']));wait_label(['Назад']);checks['privacyAccessibleOffline']=True
 screenshot('privacy.png')
finally:
 (out/'acceptance.json').write_text(json.dumps({'environment':'Android 35 emulator; release payload temporarily signed with CI-only smoke certificate; offline; no real ads exercised','checks':checks},indent=2)+'\n')
 (out/'logcat.txt').write_text(adb('logcat','-d','-t','500',check=False))
