"""Actual release UI: permission grant/denial, native Back, font scale and time picker."""
import json,pathlib,re,subprocess,time,xml.etree.ElementTree as ET
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
 adb('shell','am','force-stop',pkg);adb('shell','am','start','-n',pkg+'/.MainActivity');time.sleep(2)
def back():adb('shell','input','keyevent','4');time.sleep(.5)
def settings():
 # WebView can expose pre-reflow bounds just after Android font-scale changes.
 # Scroll the menu footer into view before using its current accessibility bounds.
 adb('shell','input','swipe','600','1400','600','480','450');time.sleep(1)
 capture('menu-before-settings-tap')
 n=find(['Настройки']);print('Settings tap bounds:',n.get('bounds'),flush=True)
 tap(['Настройки']);find(['Тёмная тема'])
def fresh():
 adb('shell','pm','clear',pkg);adb('shell','pm','clear-permission-flags',pkg,'android.permission.POST_NOTIFICATIONS','user-set','user-fixed',check=False)
 launch();tap(['Пропустить']);tap(['Открыть меню']);settings()
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
 tap(['Назад']);find(['семечки']);checks['largeTextSettingsAndBack']=True
 adb('shell','settings','put','system','accelerometer_rotation','0');adb('shell','settings','put','system','user_rotation','1');time.sleep(1)
 launch();tap(['Начать классику','Продолжить','Играть']);capture('font150-landscape-game')
 hint=find(['Подсказка'],prefix=True);b=rect(hint)
 assert b[2]-b[0]>240,'Large text actions did not switch to full sidebar width'
 checks['largeTextLandscapeActions']=True
 adb('shell','settings','put','system','user_rotation','0');adb('shell','settings','put','system','font_scale','1.0');time.sleep(1)
def picker():
 launch();settings();tap(['12:30']);find(['SET','Set','ГОТОВО','Готово']);capture('native-time-picker');back();find(['Тёмная тема']);checks['nativeTimePickerAndCancel']=True
errors={}
try:
 for name,case in [('deny',lambda:permission('deny')),('grant',lambda:permission('grant')),('large-text',large_text),('picker',picker)]:
  try:case()
  except Exception as error:
   errors[name]=str(error);capture(name+'-failure')
   adb('shell','settings','put','system','user_rotation','0');adb('shell','settings','put','system','font_scale','1.0');time.sleep(1)
finally:
 (out/'summary.json').write_text(json.dumps({'checks':checks,'errors':errors,'scope':'Android 35, actual release, offline, disposable signer'},ensure_ascii=False,indent=2))
 (out/'logcat.txt').write_text(adb('logcat','-d','-t','600',check=False))
 try:capture('last-state')
 except Exception:pass
if errors:raise AssertionError(json.dumps(errors,ensure_ascii=False))
