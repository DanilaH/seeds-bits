import {spawn} from 'node:child_process';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173'],{stdio:'ignore'});
try {
  let ready=false;
  for(let i=0;i<80;i++) {
    try {if((await fetch('http://127.0.0.1:5173')).ok){ready=true;break;}} catch{}
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  if(!ready)throw Error('Audit preview did not start');
  await import('./independent-quiet-audit.mjs');
} finally {server.kill('SIGTERM');}
