from pathlib import Path
import sys,zipfile
root=Path('/tmp/seeds051-audit-apk');root.mkdir(exist_ok=True)
with zipfile.ZipFile(sys.argv[1]) as z:
 for name in z.namelist():
  if name.startswith('assets/public/') and not name.endswith('/'):
   dest=root/name[len('assets/public/'):]
   dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(z.read(name))
print(root)
