"""Sign a CI-produced preview APK using the private Library key record. Never commit the record."""
import argparse,base64,json,os,pathlib,subprocess,tempfile
p=argparse.ArgumentParser()
p.add_argument('--input',required=True);p.add_argument('--output',required=True)
p.add_argument('--key-record',required=True);p.add_argument('--apksigner',required=True)
a=p.parse_args()
record=json.loads(pathlib.Path(a.key_record).read_text())
if record.get('package')!='com.seedsbits.game.preview':raise ValueError('Wrong key record')
with tempfile.TemporaryDirectory(prefix='seeds-sign-') as folder:
 key=pathlib.Path(folder)/'key.p12';key.write_bytes(base64.b64decode(record['pkcs12_base64']));key.chmod(0o600)
 env={**os.environ,'SEEDS_SIGN_PASSWORD':record['password']}
 subprocess.run(['java','-jar',a.apksigner,'sign','--ks',str(key),'--ks-key-alias',record['alias'],'--ks-pass','env:SEEDS_SIGN_PASSWORD','--key-pass','env:SEEDS_SIGN_PASSWORD','--out',a.output,a.input],env=env,check=True)
 subprocess.run(['java','-jar',a.apksigner,'verify','--verbose','--print-certs',a.output],check=True)
