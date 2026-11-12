"""Verify an installable preview against its CI payload and the prior preview.

Requires androguard 4.1.x and cryptography. Never prints signing material.
"""
import argparse, base64, hashlib, json, pathlib, subprocess, zipfile
from loguru import logger
logger.disable("androguard")
from androguard.core.apk import APK
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.serialization.pkcs12 import load_key_and_certificates

p=argparse.ArgumentParser()
for name in ["apk","unsigned","baseline","key-record","apksigner","report"]:
    p.add_argument("--"+name,required=True)
p.add_argument("--repo",default=".")
p.add_argument("--version-code",type=int,required=True)
a=p.parse_args();repo=pathlib.Path(a.repo);file=pathlib.Path(a.apk)
key=json.loads(pathlib.Path(a.key_record).read_text())
_,certificate,_=load_key_and_certificates(base64.b64decode(key["pkcs12_base64"]),key["password"].encode())
certificate_sha=certificate.fingerprint(hashes.SHA256()).hex()
package="com.seedsbits.game.preview"
assert key["package"]==package

def verify_signature(path):
    text=subprocess.run(["java","-jar",a.apksigner,"verify","--verbose","--print-certs",str(path)],check=True,text=True,capture_output=True).stdout
    assert "certificate SHA-256 digest: "+certificate_sha in text
    assert "Number of signers: 1" in text
    for v in ["v2","v3"]:
        assert f"Verified using {v} scheme (APK Signature Scheme {v}): true" in text
    return True

signatures=verify_signature(file) and verify_signature(a.baseline)
apk=APK(str(file));baseline=APK(a.baseline)
assert apk.get_package()==baseline.get_package()==package
assert apk.get_app_name()=="Семечки · тест"
assert apk.get_androidversion_name()==json.loads((repo/"package.json").read_text())["version"]
assert int(apk.get_androidversion_code())==a.version_code>int(baseline.get_androidversion_code())
ns="{http://schemas.android.com/apk/res/android}"
app=apk.get_android_manifest_xml().find("application")
for flag in ["debuggable","testOnly"]:assert app.get(ns+flag) in [None,"false"]
assert app.get(ns+"allowBackup")=="false"
assert app.get(ns+"usesCleartextTraffic") in [None,"false"] and int(apk.get_target_sdk_version())>=28
resources=apk.get_android_resources()
services={k:(resources.get_string(package,k) or [None,""])[1] for k in ["appmetrica_api_key","analytics_channel","yandex_banner_id","yandex_interstitial_id","yandex_rewarded_id"]}
assert services["appmetrica_api_key"]=="" and services["analytics_channel"]=="preview"
test_mode=str(resources.get_resolved_res_configs(resources.get_res_id_by_key(package,"bool","ads_test_mode"))[0][1])
assert test_mode=="true"
assert not any(str(services[k]).startswith("R-M-") for k in ["yandex_banner_id","yandex_interstitial_id","yandex_rewarded_id"])

with zipfile.ZipFile(file) as signed, zipfile.ZipFile(a.unsigned) as unsigned:
    original=[n for n in unsigned.namelist() if not n.endswith("/")]
    assert all(signed.read(n)==unsigned.read(n) for n in original)
    config=json.loads(signed.read("assets/capacitor.config.json"))
    assert config["appId"]==package and config["appName"]=="Семечки · тест"
    assert not config.get("server",{}).get("url")
    assets={f.relative_to(repo/"dist").as_posix():f for f in (repo/"dist").rglob("*") if f.is_file()}
    assert assets
    assert all(f.read_bytes()==signed.read("assets/public/"+name) for name,f in assets.items())
    assert {n.removeprefix("assets/public/") for n in signed.namelist() if n.startswith("assets/public/assets/") and not n.endswith("/")}=={n for n in assets if n.startswith("assets/")}
    for name in assets:
        if name.endswith(".js"):
            data=signed.read("assets/public/"+name)
            assert b"__SEEDS_ADS_TEST__" not in data and b"__SEEDS_ENGAGEMENT_TEST__" not in data
    dex=b"".join(apk.get_all_dex())
    bridges={name:("Lcom/seedsbits/game/preview/"+name+";").encode() in dex for name in ["SeedsFeedbackPlugin","SeedsMonetizationPlugin","SeedsEngagementPlugin","SeedsApplication"]}
    assert all(bridges.values())

report={"source_kind":"Signed exact CI release payload, aligned locally; static inspection, no physical installation claim", "package":package,"name":apk.get_app_name(),"version_name":apk.get_androidversion_name(),"version_code":a.version_code,"bytes":file.stat().st_size,"sha256":hashlib.sha256(file.read_bytes()).hexdigest(),"certificate_sha256":certificate_sha,"v2_v3_signatures_verified":signatures,"baseline_version_code":int(baseline.get_androidversion_code()),"upgrade_package_and_certificate_match":True,"unsigned_entries_unchanged":len(original),"web_assets_match_local_dist":sorted(assets),"no_stale_asset_files":True,"no_development_hooks":True,"native_bridges":bridges,"analytics_disabled":True,"ads_test_mode":True,"physical_installation_tested":False}
out=pathlib.Path(a.report);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print(json.dumps({k:report[k] for k in ["version_name","version_code","bytes","v2_v3_signatures_verified","upgrade_package_and_certificate_match","analytics_disabled","ads_test_mode"]},ensure_ascii=False))
