import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const out='test-results/markets-android';fs.mkdirSync(out,{recursive:true});
const report={source:process.env.GITHUB_SHA,scope:'Guest DNS precondition before installing/launching demo APK; not SDK fill',host:'yandex.ru',attempts:0,ready:false};
const start=performance.now();
for(let attempt=0;attempt<12;attempt++){
 report.attempts++;
 let output='';
 try{output=execFileSync('adb',['shell','ping','-c','1','-W','1',report.host],{encoding:'utf8',timeout:7000,stdio:['ignore','pipe','pipe']});}
 catch(error){output=String(error.stdout??'')+String(error.stderr??'');}
 // ICMP may be unsupported by the virtual router. The resolved-address header
 // proves DNS only; the unchanged native test still requires actual SDK paint.
 if(/PING\s+[^\n(]+\([0-9a-f:.]+\)/i.test(output)){report.ready=true;break;}
 await new Promise(resolve=>setTimeout(resolve,1000));
}
report.elapsedMs=performance.now()-start;
fs.writeFileSync(out+'/network-preflight.json',JSON.stringify(report,null,2));
if(!report.ready)throw Error('ENVIRONMENT_DNS_UNAVAILABLE: guest did not resolve the public test host');
console.log('DEMO_NETWORK_PRECONDITION',JSON.stringify(report));
