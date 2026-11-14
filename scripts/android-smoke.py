"""Exercise a non-debuggable release payload through Android accessibility, offline."""
import json,os,pathlib,re,subprocess,time,xml.etree.ElementTree as ET
out=pathlib.Path('test-results/emulator');out.mkdir(parents=True,exist_ok=True)
package=os.environ.get('SEEDS_ANDROID_PACKAGE','com.seedsbits.game')
def adb(*args,check=True):
 return subprocess.run(['adb',*args],check=check,capture_output=True,text=True).stdout

capture_id=0
capture_retries=[]
navigation_scrolls=[]
def snapshot():
 global capture_id
 # Android 35 UiAutomation can lose its Binder connection after process restart.
 # Retry acquisition only; never retry or bypass a game-state assertion.
 for attempt in range(6):
  capture_id+=1
  name=f"/sdcard/seeds-ui-{capture_id}.xml"
  try:
   dump=subprocess.run(['adb','shell','uiautomator','dump',name],capture_output=True,text=True,timeout=25)
   if dump.returncode:raise RuntimeError(f"uiautomator exit {dump.returncode}: {dump.stderr}")
   raw=adb('shell','cat',name)
   tree=ET.fromstring(raw)
   (out/'last-ui.xml').write_text(raw)
   return tree
  except (RuntimeError,subprocess.SubprocessError,ET.ParseError) as error:
   capture_retries.append(str(error))
   if attempt==5:raise
   time.sleep(2)
 raise AssertionError('No accessibility snapshot')
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
def reveal_label(choices):
 # WebView accessibility bounds can lag a touch scroll. Native keyboard focus
 # reveals the control without guessing a stale scrolled position; then tap it.
 for attempt in range(32):
  root=snapshot()
  web=next(n for n in root.iter('node') if n.get('class')=='android.webkit.WebView')
  left,top,right,bottom=map(int,re.findall(r'\d+',web.get('bounds','')))
  for n in root.iter('node'):
   if label(n) not in choices or n.get('focused')!='true':continue
   l,t,r,b=map(int,re.findall(r'\d+',n.get('bounds','')))
   x,y=(l+r)//2,(t+b)//2
   if not(r>l and b>t and left<x<right and top<y<bottom):continue
   time.sleep(.3)
   confirmed=next((v for v in snapshot().iter('node') if label(v) in choices and v.get('focused')=='true' and v.get('bounds')==n.get('bounds')),None)
   if confirmed is not None:
    navigation_scrolls.append({'target':choices,'input':'hardware TAB reveals focus; stable bounds acquired twice before touch tap','tabCount':attempt,'bounds':n.get('bounds')})
    screenshot('navigation-'+str(len(navigation_scrolls))+'.png')
    return confirmed
  adb('shell','input','keyevent','61');time.sleep(.15)
 raise AssertionError('Control not reachable by native focus traversal: '+repr(choices))
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
def hint_button(count):
 for _ in range(10):
  for node in snapshot().iter('node'):
   if label(node) in {f'Подсказка · {count}',f'Подсказка, осталось {count}'}:return node
  time.sleep(1)
 raise AssertionError('Native monetization hint count missing: '+str(count))
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
 tap(wait_label(['Пропустить']))
 found=wait_cells(28);checks['tutorialSkipAndClassic']=True
 a,b=pair(found);tap(a);tap(b);wait_cells(26);checks['removePair']=True
 tap(wait_label(['Отмена']));found=wait_cells(28);checks['undo']=True
 a,b=pair(found);tap(a);tap(b);wait_cells(26);time.sleep(1)
 # The counter exists only after native initialize() resolves successfully.
 hint_button(3);checks['nativeMonetizationBridgeInitialized']=True
 remaining_cells=26
 for remaining in (2,1,0):
  tap(hint_button(remaining+1));hint_button(remaining)
  tap(hint_button(remaining));hint_button(remaining)
  a,b=pair(cells());tap(a);tap(b);remaining_cells-=2;wait_cells(remaining_cells)
 checks['freeHintAccountingAndStickyRepeat']=True
 tap(hint_button(0))
 watch=wait_label(['Смотреть рекламу · +3 подсказки','Смотреть видео'])
 if watch.get('enabled')=='false':
  wait_label(['Сейчас видео недоступно','Видео загружается…'])
  tap(wait_label(['Не сейчас']))
 else:
  tap(watch);wait_label(['Реклама сейчас недоступна. Попробуйте позже.'])
 hint_button(0)
 checks['offlineRewardedReturnsWithoutGrant']=True
 screenshot('portrait.png')
 recording=subprocess.Popen(['adb','shell','screenrecord','--time-limit','20','/sdcard/seeds-lifecycle.mp4'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(.5)
  adb('shell','input','keyevent','4');wait_label(['Продолжить','Продолжить игру']);checks['nativeBackOpensMenu']=True
  tap(wait_label(['Продолжить','Продолжить игру']));wait_cells(remaining_cells)
  adb('shell','input','keyevent','3');time.sleep(.6)
  adb('shell','am','start','-n',package+'/.MainActivity');wait_cells(remaining_cells);checks['homeAndResumePreserveBoard']=True
 finally:
  adb('shell','pkill','-INT','screenrecord',check=False);recording.wait(timeout=25)
  adb('pull','/sdcard/seeds-lifecycle.mp4',str(out/'lifecycle.mp4'),check=False)
 adb('shell','am','force-stop',package);launch();tap(wait_label(['Продолжить','Продолжить игру','Играть']));wait_cells(remaining_cells);checks['saveSurvivesProcessStop']=True
 hint_button(0);checks['hintBalanceSurvivesProcessStop']=True
 adb('shell','settings','put','system','accelerometer_rotation','0')
 adb('shell','settings','put','system','user_rotation','1');time.sleep(2);wait_cells(remaining_cells);screenshot('landscape.png');checks['rotationPreservesBoard']=True
 adb('shell','settings','put','system','user_rotation','0');time.sleep(2)
 tap(wait_label(['Открыть меню']));tap(reveal_label(['Настройки']));tap(reveal_label(['Конфиденциальность']));wait_label(['О данных']);wait_label(['Назад','← Назад']);checks['privacyAccessibleOffline']=True
 screenshot('privacy.png')
finally:
 (out/'acceptance.json').write_text(json.dumps({'environment':'Android 35 emulator; release payload temporarily signed with CI-only smoke certificate; offline; no real ads exercised','checks':checks,'accessibilityAcquisitionRetries':capture_retries,'navigationScrolls':navigation_scrolls},indent=2)+'\n')
 (out/'logcat.txt').write_text(adb('logcat','-d','-t','500',check=False))
