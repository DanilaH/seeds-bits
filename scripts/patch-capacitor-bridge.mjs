import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
// Local correctness patch for the installed 8.5.3 Android bridge. Keep the
// modern origin-scoped transport; bind its current document before dispatch.
// Upstream report: https://github.com/ionic-team/capacitor/issues/8616
const root=new URL('../node_modules/@capacitor/android/',import.meta.url);
const version=JSON.parse(readFileSync(new URL('package.json',root),'utf8')).version;
if(version!=='8.5.3')throw Error('Review the Capacitor reply-proxy patch before changing Android dependency version');
const path=new URL('capacitor/src/main/java/com/getcapacitor/MessageHandler.java',root);
const before='                    postMessage(message.getData());\n                    javaScriptReplyProxy = replyProxy;';
const after='                    javaScriptReplyProxy = replyProxy;\n                    postMessage(message.getData());';
const source=readFileSync(path,'utf8');
const original=source.includes(after)?source.replace(after,before):source;
if(createHash('sha256').update(original).digest('hex')!=='5fa05c9148c4e24958f72b2d81747b416a73356693a8cb99249c557fdc9dec1a')
 throw Error('Unexpected Capacitor MessageHandler source; review rather than silently patch an unknown bridge');
if(!original.includes(before))throw Error('Capacitor reply-proxy patch precondition missing');
const patched=original.replace(before,after);
if(source!==patched)writeFileSync(path,patched);
console.log('Capacitor Android8.5.3: current reply proxy bound before plugin dispatch');
