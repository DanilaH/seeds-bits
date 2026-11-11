"""Independent native UX observations on disposable offline Android 35; no production data."""
import json,pathlib,re,subprocess,time,xml.etree.ElementTree as ET
out=pathlib.Path('test-results/android-ux-20261111');out.mkdir(parents=True,exist_ok=True)
package='com.seedsbits.game'
records=[]
def adb(*args,check=True):
 return subprocess.run(['adb',*args],check=check,capture_output=True,text=True).stdout
def tree():
 for n in range(5):
  try:
   result=subprocess.run(['adb','shell','uiautomator','dump','/sdcard/ux-native.xml'],capture_output=True,text=True,timeout=25)
   if result.returncode:raise RuntimeError(result.stderr)
   raw=adb('shell','cat','/sdcard/ux-native.xml');root=ET.fromstring(raw);return raw,root
  except (RuntimeError,subprocess.SubprocessError,ET.ParseError):
   if n==4:raise
   time.sleep(1)
def label(n):return n.get('content-desc') or n.get('text','')
def bounds(n):return list(map(int,re.findall(r'\d+',n.get('bounds',''))))
def find(choices):
 for _ in range(6):
  _,t=tree()
  for n in t.iter('node'):
   b=bounds(n)
   if label(n) in choices and len(b)==4 and b[2]>b[0] and b[3]>b[1]:return n
  time.sleep(.4)
 raise AssertionError('Visible label missing: '+repr(choices))
def tap(choices):
 n=find(choices);a,b,c,d=bounds(n);adb('shell','input','tap',str((a+c)//2),str((b+d)//2));time.sleep(.3)
def capture(name):
 raw,t=tree();(out/(name+'.xml')).write_text(raw)
 with (out/(name+'.png')).open('wb') as f:subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
 nodes=[{'label':label(n),'class':n.get('class'),'bounds':n.get('bounds'),'clickable':n.get('clickable'),'enabled':n.get('enabled')} for n in t.iter('node') if label(n)]
 (out/(name+'.json')).write_text(json.dumps(nodes,ensure_ascii=False,indent=2))
 return nodes
def launch():
 adb('shell','am','force-stop',package);adb('shell','am','start','-n',package+'/.MainActivity');time.sleep(2)
 assert adb('shell','pidof',package).strip()
def play():tap(['Продолжить','Начать классику','Начать игру','Играть'])
def back():adb('shell','input','keyevent','4');time.sleep(.3)
def run(name,fn):
 try:fn();records.append({'case':name,'status':'completed'})
 except Exception as e:
  records.append({'case':name,'status':'blocked','error':str(e)})
  try:capture(name+'-failure')
  except Exception:pass
 (out/'summary.json').write_text(json.dumps({'scope':'Android 35; actual release payload; temporary CI signer; offline; system font scale, native Back and permission UI','releaseRun':42626758548,'cases':records},ensure_ascii=False,indent=2))
def normal():
 adb('shell','settings','put','system','font_scale','1.0');launch();capture('01-home-font100');play();capture('02-game-font100');back();capture('03-back-from-game');tap(['Настройки']);capture('04-settings-font100');back();capture('05-back-from-settings')
def books():
 launch();tap(['Тетради']);capture('06-native-books');adb('shell','input','swipe','650','1370','650','440','350');capture('07-native-books-scroll')
def calendar():
 launch();tap(['Другие дни']);capture('08-native-calendar');back();capture('09-back-from-calendar')
def fontscale():
 adb('shell','settings','put','system','font_scale','1.5');launch();capture('10-home-font150');play();capture('11-game-font150');back();tap(['Настройки']);capture('12-settings-font150')
def timepicker():
 launch();tap(['Настройки']);_,t=tree();matches=[n for n in t.iter('node') if 'EditText' in n.get('class','') and len(bounds(n))==4]
 if not matches:raise AssertionError('No native time input exposed')
 a,b,c,d=bounds(matches[0]);adb('shell','input','tap',str((a+c)//2),str((b+d)//2));time.sleep(.4);capture('13-system-time-picker');back()
def landscape():
 adb('shell','settings','put','system','accelerometer_rotation','0');adb('shell','settings','put','system','user_rotation','1');time.sleep(1);launch();capture('14-home-landscape-font150');play();capture('15-game-landscape-font150');back();tap(['Настройки']);capture('16-settings-landscape-font150')
def permission():
 adb('shell','settings','put','system','user_rotation','0');adb('shell','settings','put','system','font_scale','1.0');time.sleep(1);launch();tap(['Настройки']);tap(['Разрешить уведомления']);capture('17-system-notification-permission');tap(["Don't allow",'Не разрешать','Не разрешать уведомления']);capture('18-notification-denied')
run('normal-and-native-back',normal)
run('book-scroll',books)
run('calendar-and-back',calendar)
run('system-font-scale-150',fontscale)
run('native-time-picker',timepicker)
run('landscape-with-large-font',landscape)
run('notification-permission-denial',permission)
print(json.dumps(records,ensure_ascii=False))
