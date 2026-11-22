const fs=require('fs'),path=require('path'),esbuild=require('esbuild-wasm');
const root=process.argv[2];let ok=0,fail=0,skip=0;
(async()=>{await esbuild.initialize({});
const files=[];(function walk(d){for(const n of fs.readdirSync(d)){const p=path.join(d,n);const s=fs.lstatSync(p);if(s.isDirectory())walk(p);else if(/\.(c|m)?js$/.test(n))files.push(p);}})(root);
for(const p of files){const src=fs.readFileSync(p,'utf8');
 try{const r=await esbuild.transform(src,{loader:'js',target:['node20.18','chrome128'],legalComments:'none'});
 if(r.code!==src){fs.writeFileSync(p,r.code);ok++}else skip++;}catch(e){fail++;console.log('FAIL',p,String(e.message).split('\n').slice(0,3).join(' | ').slice(0,300));}}
console.log({ok,fail,skip});process.exit(0)})();
