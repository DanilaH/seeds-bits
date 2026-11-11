"""Actual release UI: permission grant/denial, native Back, font scale and time picker."""
import csv,io,json,os,pathlib,re,subprocess,tempfile,time,xml.etree.ElementTree as ET
out=pathlib.Path('test-results/ux111-native');out.mkdir(parents=True,exist_ok=True)
pkg='com.seedsbits.game';checks={};serial=0
def adb(*args,check=True):return subprocess.run(['adb',*args],check=check,capture_output=True,text=True).stdout
def ui():
 global serial
 for attempt in range(5):
  serial+=1;path=f'/sdcard/seeds-ux111-{serial}.xml'
  try:
   result=subprocess.run(['adb','shell','uiautomator','dump',path],capture_output=True,text=True,timeout=25)
   if result.returncode or 'UI hierchary dumped to' not in result.stdout:raise RuntimeError('Accessibility snapshot not produced')
   raw=adb('shell','cat',path);return raw,ET.fromstring(raw)
  except (RuntimeError,subprocess.SubprocessError,ET.ParseError):
   if attempt==4:raise
   time.sleep(.4)
def label(n):return n.get('content-desc') or n.get('text','')
def rect(n):return list(map(int,re.findall(r'\d+',n.get('bounds',''))))
def find(names,prefix=False,attempts=4):
 for _ in range(attempts):
  _,root=ui()
  for n in root.iter('node'):
   b=rect(n);name=label(n)
   if (name in names or (prefix and any(name.startswith(s) for s in names))) and len(b)==4 and b[2]>b[0] and b[3]>b[1]:return n
  time.sleep(.4)
 raise AssertionError('Visible control missing: '+repr(names))
def tap(names,prefix=False):
 n=find(names,prefix);a,b,c,d=rect(n);adb('shell','input','tap',str((a+c)//2),str((b+d)//2));time.sleep(.5)
def capture(name):
 raw,_=ui();(out/(name+'.xml')).write_text(raw)
 with (out/(name+'.png')).open('wb') as f:subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
def launch():
 adb('shell','am','force-stop',pkg)
 result=adb('shell','am','start','-n',pkg+'/.MainActivity');assert 'Error' not in result,result
 time.sleep(2);assert adb('shell','pidof',pkg,check=False).strip(),'App process absent after launch'
def back():adb('shell','input','keyevent','4');time.sleep(.5)
def words(name):
 # Preserve the original PNG evidence and pass identical RGB pixels through a
 # built-in OCR format, avoiding host libpng development dependencies.
 with tempfile.TemporaryDirectory(prefix='seeds-ocr-') as folder:
  source=out/(name+'.png')
  if os.environ.get('SEEDS_OCR_PNM')=='1':
   from PIL import Image
   source=pathlib.Path(folder)/'capture.ppm'
   with Image.open(out/(name+'.png')) as image:image.convert('RGB').save(source,format='PPM')
  result=subprocess.run(['tesseract',str(source),'stdout','-l','rus','tsv'],capture_output=True,text=True,check=True)
 return [row for row in csv.DictReader(io.StringIO(result.stdout),delimiter='\t') if row['text'].strip() and float(row['conf'])>=50]
def settings():
 if float(adb('shell','settings','get','system','font_scale').strip())>1:
  # On this emulator WebView may expose stale virtual-node bounds after text
  # zoom. Locate the visible word in an actual screenshot for a real touch.
  for attempt in range(8):
   name='font150-settings-visible-'+str(serial);capture(name)
   for row in words(name):
    if row['text'].strip().lower()=='настройки':
     x=int(row['left'])+int(row['width'])//2;y=int(row['top'])+int(row['height'])//2
     print('Visible settings text touch:',x,y,flush=True)
     adb('shell','input','tap',str(x),str(y));time.sleep(.5);find(['Тёмная тема']);return
   adb('shell','input','swipe','600','1400','600','480','450');time.sleep(1)
  raise AssertionError('Settings not visible after menu scrolling')
 try:find(['Настройки'],attempts=1)
 except AssertionError:adb('shell','input','swipe','600','1400','600','480','450');time.sleep(1)
 tap(['Настройки']);find(['Тёмная тема'])
def fresh():
 adb('shell','pm','clear',pkg);adb('shell','pm','clear-permission-flags',pkg,'android.permission.POST_NOTIFICATIONS','user-set','user-fixed',check=False)
 # Wait for package-data clearing and the initial WebView render on a cold AVD.
 time.sleep(.8);launch();find(['Пропустить'],attempts=10);tap(['Пропустить']);tap(['Открыть меню']);settings()
def permission(choice):
 fresh();capture(choice+'-before')
 log=(out/(choice+'-permission-trace.txt')).open('w')
 logger=subprocess.Popen(['adb','logcat','-v','threadtime','SeedsNotifications:V','AndroidRuntime:E','ActivityTaskManager:I','*:S'],stdout=log,stderr=subprocess.STDOUT)
 try:
  tap(['Разрешить уведомления'])
  with (out/(choice+'-immediate.png')).open('wb') as f:subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
  find(['Allow','Разрешить']);capture(choice+'-system-dialog')
 except Exception:
  time.sleep(22);capture(choice+'-timeout');back();capture(choice+'-back-after-timeout')
  raise
 finally:
  logger.terminate();logger.wait(timeout=5);log.close()
 # The successful branch now has direct system-dialog evidence.
 tap(['Allow','Разрешить'] if choice=='grant' else ["Don't allow",'Don’t allow','Не разрешать','Не разрешать уведомления'])
 if choice=='grant':find(['Напоминание включено.'])
 else:find(['Уведомления отключены в Android. Разрешите их в системных настройках, затем включите напоминание.'])
 capture(choice+'-result');back();find(['семечки']);capture(choice+'-back-home')
 checks[choice+'SystemPermissionAndBack']=True
 if choice=='grant':
  launch();settings();find(['Напоминание включено.']);checks['grantedPreferenceSurvivesRelaunch']=True
def large_text():
 adb('shell','settings','put','system','font_scale','1.5');launch();tap(['Начать классику','Продолжить','Играть']);capture('font150-portrait-game');back();capture('font150-menu-before-scroll');settings();capture('font150-portrait-settings')
 adb('shell','input','swipe','650','1400','650','420','400');capture('font150-settings-scroll')
 assert any(row['text'].lower()=='настройки' and int(row['top'])<260 for row in words('font150-settings-scroll')),'Settings heading disappeared visually after scrolling'
 tap(['Назад']);find(['Прогресс']);capture('font150-back-menu');checks['largeTextSettingsAndBack']=True
 adb('shell','settings','put','system','accelerometer_rotation','0');adb('shell','settings','put','system','user_rotation','1');time.sleep(1)
 launch();tap(['Начать классику','Продолжить','Играть']);capture('font150-landscape-game')
 hint=find(['Подсказка'],prefix=True);b=rect(hint)
 assert b[2]-b[0]>240,'Large text actions did not switch to full sidebar width'
 checks['largeTextLandscapeActions']=True
 adb('shell','input','swipe','1540','530','1540','300','400');capture('font150-landscape-actions-scroll')
 find(['Добавить']);checks['largeTextLandscapeActionsScroll']=True
 adb('shell','settings','put','system','user_rotation','0');adb('shell','settings','put','system','font_scale','1.0');time.sleep(1)
def narrow_text():
 # Exercise actual WebView text zoom on a 320 CSS-pixel screen. Browser CSS
 # font overrides alone do not reproduce Android's font scaling semantics.
 try:
  adb('shell','wm','size','640x1136');adb('shell','settings','put','system','font_scale','2.0');time.sleep(1)
  launch();tap(['Начать классику','Продолжить','Играть']);capture('font200-narrow-game')
  from PIL import Image
  with Image.open(out/'font200-narrow-game.png') as source:
   image=source.convert('RGB');width,height=image.size;pixels=image.load();lines=[]
   for y in range(60,height-60):
    count=sum(max(abs(c-t) for c,t in zip(pixels[x,y],(216,225,220)))<=6 for x in range(20,width-20))
    if count>width*.6 and (not lines or y>lines[-1]+3):lines.append(y)
  assert len(lines)>=2,'No complete grid row visible with narrow Android text zoom'
  top,bottom=lines[:2]
  # Read a single numeric line, with a margin beyond both grid boundaries.
  # The full PNG stays unchanged; map OCR boxes back into its coordinates.
  crop_top=max(0,top-12);crop_bottom=min(height,bottom+12)
  with tempfile.TemporaryDirectory(prefix='seeds-digit-ocr-') as folder:
   strip=pathlib.Path(folder)/'row.ppm'
   with Image.open(out/'font200-narrow-game.png') as image:
    image.convert('RGB').crop((20,crop_top,width-20,crop_bottom)).save(strip,format='PPM')
   result=subprocess.run(['tesseract',str(strip),'stdout','-l','eng','--psm','7','-c','tessedit_char_whitelist=123456789','tsv'],capture_output=True,text=True,check=True)
  (out/'font200-narrow-row-ocr.tsv').write_text(result.stdout)
  glyphs=[r for r in csv.DictReader(io.StringIO(result.stdout),delimiter='\t') if r['text'].strip() and float(r['conf'])>=50]
  assert ''.join(r['text'] for r in glyphs)=='123456789','First-row digits were not all recognized'
  for r in glyphs:r['top']=int(r['top'])+crop_top;r['left']=int(r['left'])+20
  assert all(int(r['top'])>=top-1 and int(r['top'])+int(r['height'])<=bottom+1 for r in glyphs),'Rendered digits cross the first grid row'
  (out/'font200-narrow-geometry.json').write_text(json.dumps({'rowTop':top,'rowBottom':bottom,'cropTop':crop_top,'cropBottom':crop_bottom,'glyphs':glyphs},ensure_ascii=False,indent=2))
  checks['narrowAndroidTextZoomStaysInsideRows']=True
 finally:
  adb('shell','wm','size','780x1688');adb('shell','settings','put','system','font_scale','1.0');time.sleep(1)
def picker():
 launch();settings();tap(['12:30']);find(['SET','Set','ГОТОВО','Готово']);capture('native-time-picker');back();find(['Тёмная тема']);checks['nativeTimePickerAndCancel']=True
errors={}
startup_log=(out/'startup-and-lifecycle.txt').open('w')
startup_logger=subprocess.Popen(['adb','logcat','-v','threadtime','*:W','AndroidRuntime:V','ActivityTaskManager:I','SeedsNotifications:V','lmkd:V'],stdout=startup_log,stderr=subprocess.STDOUT)
try:
 for name,case in [('deny',lambda:permission('deny')),('grant',lambda:permission('grant')),('large-text',large_text),('narrow-text',narrow_text),('picker',picker)]:
  try:case()
  except Exception as error:
   errors[name]=str(error);capture(name+'-failure')
   adb('shell','settings','put','system','user_rotation','0');adb('shell','settings','put','system','font_scale','1.0');time.sleep(1)
finally:
 startup_logger.terminate();startup_logger.wait(timeout=5);startup_log.close()
 (out/'summary.json').write_text(json.dumps({'checks':checks,'errors':errors,'scope':'Android 35, actual release, offline, disposable signer'},ensure_ascii=False,indent=2))
 (out/'logcat.txt').write_text(adb('logcat','-d','-t','600',check=False))
 try:capture('last-state')
 except Exception:pass
if errors:raise AssertionError(json.dumps(errors,ensure_ascii=False))
