#!/usr/bin/env bash
# CI host dependency only. Keep the inherited network route when elevating apt.
set -euo pipefail
mkdir -p test-results/ci-packages
if command -v tesseract >/dev/null && tesseract --list-langs 2>/dev/null | grep -Fxq rus; then
  echo 'Russian OCR is already installed.'
  exit 0
fi
for seeds_protocol in http https all; do
  seeds_upper="${seeds_protocol^^}_PROXY"
  seeds_lower="${seeds_protocol}_proxy"
  if [[ ! -v "$seeds_lower" && -v "$seeds_upper" ]]; then
    export "$seeds_lower=${!seeds_upper}"
  fi
done
if [[ ! -v no_proxy && -v NO_PROXY ]]; then export no_proxy="$NO_PROXY"; fi
seeds_preserve='HTTP_PROXY,HTTPS_PROXY,ALL_PROXY,NO_PROXY,http_proxy,https_proxy,all_proxy,no_proxy,SSL_CERT_FILE,SSL_CERT_DIR,CURL_CA_BUNDLE,REQUESTS_CA_BUNDLE'
python3 - <<'PY'
import json,os,pathlib,subprocess
names=['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','SSL_CERT_FILE']
preserve='HTTP_PROXY,HTTPS_PROXY,ALL_PROXY,NO_PROXY,http_proxy,https_proxy,all_proxy,no_proxy,SSL_CERT_FILE,SSL_CERT_DIR,CURL_CA_BUNDLE,REQUESTS_CA_BUNDLE'
meta='import json,os;print(json.dumps({k:bool(os.environ.get(k)) for k in '+repr(names)+'}))'
root=subprocess.run(['sudo','--preserve-env='+preserve,'python3','-c',meta],capture_output=True,text=True,check=True)
# No credential/proxy values or raw curl diagnostics are logged.
probe=subprocess.run(['sudo','--preserve-env='+preserve,'curl','--connect-timeout','10','--max-time','20','--silent','--show-error','--output','/dev/null','--write-out','%{http_code}','https://security.ubuntu.com/ubuntu/dists/noble-security/InRelease'],capture_output=True,text=True)
data={'runnerEnvironment':{k:bool(os.environ.get(k)) for k in names},'elevatedEnvironment':json.loads(root.stdout),'aptHttpsProbe':{'exit':probe.returncode,'status':probe.stdout[-3:]},'scope':'Dependency setup before any app installation or emulator launch'}
pathlib.Path('test-results/ci-packages/network.json').write_text(json.dumps(data,indent=2)+'\n')
print(json.dumps(data),flush=True)
if probe.returncode or probe.stdout[-3:]!='200':
    raise SystemExit('Ubuntu repository is unreachable on the inherited route; app has not been started.')
PY
timeout 240 sudo --preserve-env="$seeds_preserve" apt-get -o Acquire::Retries=1 -o Acquire::http::Timeout=20 -o Acquire::https::Timeout=20 update
timeout 240 sudo --preserve-env="$seeds_preserve" apt-get -o Acquire::Retries=1 -o Acquire::http::Timeout=20 -o Acquire::https::Timeout=20 install --no-install-recommends -y tesseract-ocr-rus
tesseract --list-langs | grep -Fx rus
