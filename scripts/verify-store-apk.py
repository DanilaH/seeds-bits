"""Inspect a locally signed store APK. Needs androguard, cryptography and Pillow."""
import argparse,hashlib,io,json,pathlib,subprocess,zipfile
from loguru import logger
logger.disable('androguard')
from androguard.core.apk import APK
from androguard.core.axml import AXMLPrinter
from androguard.core.dex import DEX
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from PIL import Image,ImageChops
p=argparse.ArgumentParser();p.add_argument('--apk',required=True);p.add_argument('--apksigner',required=True);p.add_argument('--report',default='docs/releases/1.0.0-apk.json');args=p.parse_args()
file=pathlib.Path(args.apk);a=APK(str(file));ns='{http://schemas.android.com/apk/res/android}'
pkg=a.get_package();app=a.get_android_manifest_xml().find('application');res=a.get_android_resources()
assert pkg=='com.seedsbits.game' and a.get_app_name()=='Семечки'
assert a.get_androidversion_name()==json.loads(pathlib.Path('package.json').read_text())['version']
assert int(a.get_androidversion_code())>=1000001
assert app.get(ns+'debuggable') in [None,'false'] and app.get(ns+'testOnly') in [None,'false']
assert app.get(ns+'allowBackup')=='false' and app.get(ns+'usesCleartextTraffic')=='false'
assert app.get(ns+'name')=='com.seedsbits.game.SeedsApplication'
expected_permissions={'android.permission.INTERNET','android.permission.ACCESS_NETWORK_STATE','android.permission.VIBRATE','com.google.android.gms.permission.AD_ID','com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE','com.seedsbits.game.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'}
assert set(a.get_permissions())<=expected_permissions,a.get_permissions()
keys=['appmetrica_api_key','yandex_banner_id','yandex_interstitial_id','yandex_rewarded_id']
values={key:(res.get_string(pkg,key) or ['', ''])[1] for key in keys}
assert all(values.values())
assert all(str(values[key]).startswith('R-M-') for key in keys[1:])
assert len(set(values[key] for key in keys[1:]))==3
mode=str(res.get_resolved_res_configs(res.get_res_id_by_key(pkg,'bool','ads_test_mode'))[0][1]);assert mode=='false'
cert=x509.load_pem_x509_certificate(pathlib.Path('store/seeds-release-certificate.pem').read_bytes()).fingerprint(hashes.SHA256()).hex()
sig=subprocess.run(['java','-jar',args.apksigner,'verify','--verbose','--print-certs',str(file)],capture_output=True,text=True,check=True).stdout
assert 'Signer #1 certificate SHA-256 digest: '+cert in sig
for version in ['v2','v3']:assert f'Verified using {version} scheme (APK Signature Scheme {version}): true' in sig
assets={};icons=[]
with zipfile.ZipFile(file) as z:
 config=json.loads(z.read('assets/capacitor.config.json'));assert config['appId']==pkg and config['appName']=='Семечки' and not config.get('server',{}).get('url')
 local=[p for p in pathlib.Path('dist').rglob('*') if p.is_file()]
 for f in local:
  path=f.relative_to('dist').as_posix();assets[path]=f.read_bytes()==z.read('assets/public/'+path)
 assert all(assets.values()) and len(assets)==10
 assert {n.removeprefix('assets/public/') for n in z.namelist() if n.startswith('assets/public/assets/') and not n.endswith('/')}=={p for p in assets if p.startswith('assets/')}
 assert all(b'__SEEDS_ADS_TEST__' not in z.read('assets/public/'+p) for p in assets if p.endswith('.js'))
 for key in ['ic_launcher','ic_launcher_round']:
  rid=res.get_res_id_by_key(pkg,'mipmap',key)
  for config,name in res.get_resolved_res_configs(rid):
   name=str(name)
   if not name.endswith('.png'):continue
   image=Image.open(io.BytesIO(z.read(name))).convert('RGBA');size=image.width
   expected=Image.open(f'native/android/branding/icon-{size}.png').convert('RGBA')
   assert image.size==expected.size and ImageChops.difference(image.convert('RGB'),expected.convert('RGB')).getbbox() is None and image.getchannel('A').tobytes()==expected.getchannel('A').tobytes(),name
   icons.append({'name':key,'resource':name,'size':size})
 assert len(icons)==10,icons
 mark=res.get_resolved_res_configs(res.get_res_id_by_key(pkg,'drawable','seed_mark'))[0][1]
 assert AXMLPrinter(z.read(str(mark))).get_xml_obj().tag=='bitmap'
 for key,filename in [('launcher_art','launcher-art.webp'),('adaptive_art','adaptive-art.webp')]:
  resource=res.get_resolved_res_configs(res.get_res_id_by_key(pkg,'drawable',key))[0][1]
  actual=Image.open(io.BytesIO(z.read(str(resource)))).convert('RGB')
  expected=Image.open('native/android/branding/'+filename).convert('RGB')
  assert actual.size==expected.size and ImageChops.difference(actual,expected).getbbox() is None,key
 dex=b''.join(a.get_all_dex());classes={name:needle in dex for name,needle in {'bridge':b'Lcom/seedsbits/game/SeedsMonetizationPlugin;','application':b'Lcom/seedsbits/game/SeedsApplication;','yandex':b'Lcom/yandex/mobile/ads/banner/BannerAdView;','appmetrica':b'Lio/appmetrica/analytics/AppMetrica;'}.items()};assert all(classes.values())
 plugin=next(c for payload in a.get_all_dex() for c in DEX(payload).get_classes() if c.get_name()=='Lcom/seedsbits/game/SeedsMonetizationPlugin;')
 methods={m.get_name() for m in plugin.get_methods()}
 assert {'initialize','pending','acknowledge','persistState','preload','show','banner','report'}<=methods,methods
 assert b'Lcom/getcapacitor/PluginMethod;' in dex and b'Lcom/getcapacitor/annotation/CapacitorPlugin;' in dex
r={'file':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'bytes':file.stat().st_size,'package':pkg,'name':a.get_app_name(),'versionName':a.get_androidversion_name(),'versionCode':a.get_androidversion_code(),'minSdk':a.get_min_sdk_version(),'targetSdk':a.get_target_sdk_version(),'debuggable':False,'testOnly':False,'allowBackup':False,'usesCleartextTraffic':False,'adsTestMode':False,'distinctLiveAdUnits':True,'configuredClientFields':{key:bool(value) for key,value in values.items()},'certificateSha256':cert,'signatureVerified':{'v2':True,'v3':True},'permissions':a.get_permissions(),'cleanWebAssets':assets,'extraStaleAssets':False,'launcherIcons':icons,'launcherArtworkVerified':True,'packagedClasses':classes}
path=pathlib.Path(args.report);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(json.dumps(r,ensure_ascii=False,indent=2))
