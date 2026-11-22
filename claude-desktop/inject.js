const fs=require('fs'),path=require('path');
const [app,shims]=process.argv.slice(2);const B=path.join(app,'.vite/build');
const nodeShim=fs.readFileSync(path.join(shims,'node-shim.js'),'utf8').replace('/*FZSTD*/',()=>fs.readFileSync(path.join(__dirname,'tools/node_modules/fzstd/lib/index.js'),'utf8').replace(/^"use strict";/,''));
const preShim=fs.readFileSync(path.join(shims,'preload-shim.js'),'utf8');
function prepend(f,code){let s=fs.readFileSync(f,'utf8');if(s.includes('__ccNodeShim')||s.includes('__ccEIMW_'))return;
 const m=s.match(/^(#![^\n]*\n)?\s*(["']use strict["'];?)?/);const head=m?m[0]:'';fs.writeFileSync(f,head+'\n'+code+'\n'+s.slice(head.length));}
fs.writeFileSync(path.join(B,'cc-node-shim.js'),nodeShim);
fs.copyFileSync(path.join(shims,'main-shim.js'),path.join(B,'cc-main.js'));
const pj=path.join(app,'package.json');const p=JSON.parse(fs.readFileSync(pj));p.main='.vite/build/cc-main.js';fs.writeFileSync(pj,JSON.stringify(p,null,2));
let np=0,nn=0;
for(const n of fs.readdirSync(B)){const f=path.join(B,n);const st=fs.statSync(f);
 if(st.isDirectory()){(function walk(d){for(const x of fs.readdirSync(d)){const g=path.join(d,x);if(fs.statSync(g).isDirectory())walk(g);else if(/\.(c|m)?js$/.test(x)){prepend(g,nodeShim);nn++}}})(f);continue;}
 if(!/\.js$/.test(n)||/^(index|launcher|cc-)/.test(n))continue;
 const s=fs.readFileSync(f,'utf8');if(/contextBridge|ipcRenderer/.test(s)){prepend(f,preShim);np++}}
console.log({preloads:np,workerFiles:nn});

let fixed=0;for(const n of fs.readdirSync(B)){if(!/^index.*\.js$/.test(n))continue;const f=path.join(B,n);let s=fs.readFileSync(f,'utf8');const k=s.indexOf('Bundle binary path is outside');if(k<0||s.includes('__ccFixBin'))continue;
 const re=/await (\w+)\.default\.access\((\w+\.default\.join\(\w+, \w+\)), (\w+)\.constants\.X_OK\)/g;re.lastIndex=k;const m=re.exec(s);if(!m)throw new Error('fixBin anchor not found');
 s=s.slice(0,m.index)+'await (globalThis.__ccFixBin&&globalThis.__ccFixBin('+m[2]+')), '+s.slice(m.index);fs.writeFileSync(f,s);fixed++}
if(!fixed)throw new Error('fixBin hook not inserted');console.log({fixBinHook:fixed});

let wsFix=0;for(const n of fs.readdirSync(B)){if(!/\.js$/.test(n))continue;const f=path.join(B,n);let s=fs.readFileSync(f,'utf8');if(!s.includes('net.WebSocket transport'))continue;
 const s2=s.replace(/(function \w+\(\) \{\s*return )(\w+\(\w+\);\s*\}\s*var \w+ = "claude-bridge-ws")/g,(m,a,b)=>`${a}!!require("electron").net.WebSocket && ${b}`);if(s2!==s){fs.writeFileSync(f,s2);wsFix++}}
if(!wsFix)throw new Error('ws fallback patch not applied');console.log({wsFix});

for(const n of fs.readdirSync(B)){if(!/\.js$/.test(n))continue;const f=path.join(B,n);let s=fs.readFileSync(f,'utf8');if(!s.includes('Git command failed: git'))continue;
 const s2=s.replace(/(Git command failed: git [^`]*`, \{ )code: (\w+)\.result\?\.code,/,(m,a,b)=>`${a}ccMsg: String(${b}&&${b}.stack||${b}).slice(0,500), code: ${b}.result?.code,`);if(s2!==s)fs.writeFileSync(f,s2);}

// claude-swift: sustituto JS (addon Swift exige macOS 13+) y computer use sin el suelo de macOS 14
fs.copyFileSync(path.join(process.argv[3],'claude-swift.js'),path.join(process.argv[2],'node_modules/@ant/claude-swift/js/index.js'));
let cuFix=0;for(const n of fs.readdirSync(B)){if(!/\.js$/.test(n))continue;const f=path.join(B,n);let s=fs.readFileSync(f,'utf8');const m=/isMacosBelowComputerUseFloor: \(\) => (\w+)/.exec(s);if(!m)continue;
 const re=new RegExp(`(function ${m[1]}\\(\\) \\{\\s*return )process\\.platform === "darwin" && \\w+\\(\\)\\.major < 14;`);const s2=s.replace(re,'$1false;');if(s2!==s){fs.writeFileSync(f,s2);cuFix++}}
if(!cuFix)throw new Error('computer-use floor patch not applied');console.log({cuFix});
