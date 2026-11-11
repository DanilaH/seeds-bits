#!/usr/bin/env bash
# CI only. Block the emulator's host-side network before Android or an app starts.
set -euo pipefail
seeds_avd="${1:-seeds_product}"
seeds_runner="$(id -un)"
sudo groupadd -f seeds_offline
seeds_group="$(getent group seeds_offline | cut -d: -f3)"
sudo iptables -I OUTPUT 1 -m owner --gid-owner "$seeds_group" ! -d 127.0.0.0/8 -j REJECT
sudo ip6tables -I OUTPUT 1 -m owner --gid-owner "$seeds_group" ! -d ::1/128 -j REJECT
mkdir -p test-results/offline-guard
if sudo -u "$seeds_runner" -g seeds_offline curl --noproxy '*' --connect-timeout 3 --max-time 5 -sS https://example.com -o /dev/null; then
  echo 'Emulator network guard failed: outbound request succeeded' >&2
  exit 1
fi
sudo chmod 666 /dev/kvm
sudo -u "$seeds_runner" -g seeds_offline "$ANDROID_HOME/emulator/emulator" -avd "$seeds_avd" -no-window -no-audio -no-snapshot -no-boot-anim -gpu swiftshader_indirect -memory 3072 -cores 2 > /tmp/seeds-offline-emulator.log 2>&1 &
adb wait-for-device
seeds_ready=false
for seeds_attempt in $(seq 1 120); do
  if [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1 ] && adb shell service check phone | grep -q ': found'; then
    seeds_ready=true
    break
  fi
  sleep 2
done
test "$seeds_ready" = true
# Keep the launcher cold-start ANR out of app UX acquisition; never dismiss an app ANR.
adb shell am force-stop com.google.android.apps.nexuslauncher
adb shell input keyevent 82
adb shell wm size 780x1688
adb shell wm density 320
adb shell svc wifi disable
adb shell svc data disable
adb shell settings put global http_proxy 127.0.0.1:9
SEEDS_OFFLINE_GID="$seeds_group" python3 - <<'PY'
import json,os,pathlib,subprocess
gid=int(os.environ['SEEDS_OFFLINE_GID'])
rows=subprocess.check_output(['ps','-eo','pid,egid,comm'],text=True).splitlines()[1:]
qemu=[r.split() for r in rows if 'qemu-system' in r]
assert qemu and all(int(r[1])==gid for r in qemu),qemu
p=pathlib.Path('test-results/offline-guard')
(p/'guard.json').write_text(json.dumps({'hostOwnerFirewallIPv4':True,'hostOwnerFirewallIPv6':True,'outboundProbeRejected':True,'emulatorProcessGroupVerified':True,'androidWifiAndDataDisabled':True,'androidProxyLoopbackClosedPort':True,'scope':'No app has been installed or started yet'},indent=2))
PY
sudo iptables -nvL OUTPUT > test-results/offline-guard/ipv4.txt
sudo ip6tables -nvL OUTPUT > test-results/offline-guard/ipv6.txt
