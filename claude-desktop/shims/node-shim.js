;(function(){if(globalThis.__ccNodeShim)return;globalThis.__ccNodeShim=1;
var gb=typeof process!=="undefined"&&process.getBuiltinModule;if(!gb)return;
var PEM=/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;
try{var tls=gb("node:tls");
if(!tls.getCACertificates){tls.getCACertificates=function(t){t=t||"default";
 if(t==="default"||t==="bundled")return tls.rootCertificates.slice();
 if(t==="extra"){try{var f=process.env.NODE_EXTRA_CA_CERTS;return f?(gb("node:fs").readFileSync(f,"utf8").match(PEM)||[]):[]}catch(e){return[]}}
 if(t==="system"){try{return gb("node:child_process").execFileSync("/usr/bin/security",["find-certificate","-a","-p","/System/Library/Keychains/SystemRootCertificates.keychain","/Library/Keychains/System.keychain"],{encoding:"utf8",maxBuffer:67108864}).match(PEM)||[]}catch(e){return[]}}
 return[]};}
if(!tls.setDefaultCACertificates){tls.setDefaultCACertificates=function(certs){var ca=Array.from(certs);if(!tls.__ccOrigCSC)tls.__ccOrigCSC=tls.createSecureContext;var o=tls.__ccOrigCSC;tls.createSecureContext=function(opts){opts=opts||{};if(!opts.ca)opts=Object.assign({},opts,{ca:ca});return o(opts)}};}
}catch(e){}
if(typeof URL!=="undefined"&&!URL.parse){URL.parse=function(u,b){try{return new URL(u,b)}catch(e){return null}}}

try{var zl=gb("node:zlib");if(!zl.createZstdDecompress){
 var FZ=(function(){var module={exports:{}},exports=module.exports;/*FZSTD*/;return module.exports})();
 zl.createZstdDecompress=function(){var T=gb("node:stream").Transform,t;var d=new FZ.Decompress(function(c){t.push(Buffer.from(c))});
  t=new T({transform:function(c,e,cb){try{d.push(new Uint8Array(c.buffer,c.byteOffset,c.length));cb()}catch(x){cb(x)}},flush:function(cb){try{d.push(new Uint8Array(0),true);cb()}catch(x){cb(x)}}});return t};
 zl.zstdDecompressSync=function(b){return Buffer.from(FZ.decompress(new Uint8Array(b.buffer,b.byteOffset,b.length)))};
}}catch(e){}
try{var fs_=gb("node:fs"),fsp=gb("node:fs/promises"),pth=gb("node:path");
 var rx=function(seg){return new RegExp("^"+seg.replace(/[.+^${}()|[\]\\]/g,"\\$&").replace(/\*/g,"[^/]*").replace(/\?/g,"[^/]")+"$")};
 var globSync=function(pat,o){o=o||{};var cwd=o.cwd||process.cwd();var abs=pth.isAbsolute(pat);var parts=pat.split("/");var cur=[abs?"/":""];
  for(var i=abs?1:0;i<parts.length;i++){var seg=parts[i];if(!seg)continue;var nx=[];
   for(var j=0;j<cur.length;j++){var base=cur[j];var dir=pth.resolve(cwd,base||".");
    if(!/[*?[]/.test(seg)){var c=base?pth.join(base,seg):seg;try{fs_.lstatSync(pth.resolve(cwd,c));nx.push(c)}catch(e){}continue}
    var r=rx(seg);try{fs_.readdirSync(dir).forEach(function(n){if(r.test(n)&&(n[0]!=="."||seg[0]==="."))nx.push(base?pth.join(base,n):n)})}catch(e){}}
   cur=nx}
  return cur.filter(Boolean)};
 if(!fs_.globSync)fs_.globSync=function(p,o){return [].concat(p).flatMap(function(x){return globSync(x,o)})};
 if(!fsp.glob)fsp.glob=async function*(p,o){var r=fs_.globSync(p,o);for(var i=0;i<r.length;i++)yield r[i]};
 if(!fs_.glob)fs_.glob=function(p,o,cb){if(typeof o==="function"){cb=o;o={}}try{cb(null,fs_.globSync(p,o))}catch(e){cb(e)}};
}catch(e){}
globalThis.__ccFixBin=function(bin){try{var cp=gb("node:child_process"),fs2=gb("node:fs"),p2=gb("node:path");
 var D="/Applications/Claude.app/Contents/Frameworks/cc-compat";if(!fs2.existsSync(D+"/libcxxCompat.dylib"))return;
 var L=cp.execFileSync("/usr/bin/otool",["-L",bin],{encoding:"utf8"});if(L.indexOf("/usr/lib/libc++.1.dylib")<0)return;
 cp.execFileSync("/usr/bin/install_name_tool",["-change","/usr/lib/libc++.1.dylib",D+"/libcxxCompat.dylib","-change","/usr/lib/libSystem.B.dylib",D+"/libSystemCompat.dylib","-change","/usr/lib/libicucore.A.dylib",D+"/libicuCompat.dylib",bin],{stdio:"ignore"});
 var tgt=bin,d=p2.dirname(bin);while(d!=="/"){if(/\.app$/.test(d)){tgt=d;break}d=p2.dirname(d)}
 cp.execFileSync("/usr/bin/codesign",["--force","--deep","--sign","-",tgt],{stdio:"ignore"});
 try{cp.execFileSync("/usr/bin/xattr",["-cr",tgt],{stdio:"ignore"})}catch(e){}
}catch(e){try{console.error("[cc-compat] fixBin failed",e)}catch(_){}}};
})();
