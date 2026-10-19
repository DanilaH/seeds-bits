"""Run locally with an authorised adb-connected phone. Keeps the old app and a local backup.
Usage: python migrate-debug-save.py --backup seeds-old-save.xml
Requires both the OLD debug app and the NEW test app installed. Close both first.
"""
import argparse,pathlib,subprocess,xml.etree.ElementTree as ET
p=argparse.ArgumentParser();p.add_argument('--backup',required=True);a=p.parse_args()
old='com.seedsbits.game';new='com.seedsbits.game.preview'
backup=pathlib.Path(a.backup)
if backup.exists():raise SystemExit('Backup path already exists; choose a new path.')
def adb(*args,input=None):return subprocess.run(['adb',*args],input=input,check=True,capture_output=True).stdout
# A single authorised device is required by adb; it rejects ambiguous selection.
for package in [old,new]:adb('shell','am','force-stop',package)
raw=adb('exec-out','run-as',old,'cat','shared_prefs/CapacitorStorage.xml')
root=ET.fromstring(raw)
if not any(e.get('name')=='seeds-bits.progress.v2' for e in root):raise SystemExit('No progress bundle found; no data written.')
backup.write_bytes(raw)
# Preserve a pre-existing new-install save too, without overwriting its backup.
try:
 existing=adb('exec-out','run-as',new,'cat','shared_prefs/CapacitorStorage.xml')
 extra=backup.with_suffix('.new-install.xml')
 if extra.exists():raise SystemExit('New-install backup already exists.')
 extra.write_bytes(existing)
except subprocess.CalledProcessError:pass
adb('shell','run-as',new,'mkdir','-p','shared_prefs')
adb('shell',f'run-as {new} sh -c "cat > shared_prefs/CapacitorStorage.xml"',input=raw)
verified=adb('exec-out','run-as',new,'cat','shared_prefs/CapacitorStorage.xml')
if ET.tostring(ET.fromstring(verified))!=ET.tostring(root):raise SystemExit('Verification failed. Original app and local backup are untouched.')
print('Copied and verified. Original app retained. Open Семечки · тест. Backup:',backup)
