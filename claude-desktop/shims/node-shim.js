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
try{if(!gb("node:sqlite")){var SQ=(function(){
 var cp=gb("node:child_process"),fs3=gb("node:fs");var BIN=fs3.existsSync("/usr/bin/sqlite3")?"/usr/bin/sqlite3":"sqlite3";
 function lit(v){if(v===null||v===undefined)return"NULL";if(typeof v==="bigint")return v.toString();if(typeof v==="number"){if(!isFinite(v))return"NULL";return String(v)}if(typeof v==="boolean")return v?"1":"0";
  if(v instanceof Uint8Array||(typeof Buffer!=="undefined"&&Buffer.isBuffer(v))){return"X'"+Buffer.from(v.buffer?Buffer.from(v.buffer,v.byteOffset,v.byteLength):v).toString("hex")+"'"}
  return"'"+String(v).replace(/'/g,"''")+"'"}
 function bind(sql,args){var named=null,pos=args;if(args.length&&args[0]&&typeof args[0]==="object"&&!(args[0] instanceof Uint8Array)&&!Array.isArray(args[0])){named=args[0];pos=args.slice(1)}
  var out="",i=0,n=0;while(i<sql.length){var c=sql[i];
   if(c==="'"||c==='"'||c==="`"){var j=i+1;while(j<sql.length){if(sql[j]===c){if(sql[j+1]===c){j+=2;continue}break}j++}out+=sql.slice(i,j+1);i=j+1;continue}
   if(c==="-"&&sql[i+1]==="-"){var e=sql.indexOf("\n",i);e=e<0?sql.length:e;out+=sql.slice(i,e);i=e;continue}
   if(c==="?"){var m=/^\?(\d*)/.exec(sql.slice(i));if(m[1]){out+=lit(pos[+m[1]-1]);n=Math.max(n,+m[1])}else{out+=lit(pos[n++])}i+=m[0].length;continue}
   if((c===":"||c==="@"||c==="$")&&/[A-Za-z_]/.test(sql[i+1]||"")){var m2=/^[:@$]([A-Za-z_][A-Za-z0-9_]*)/.exec(sql.slice(i));var k=m2[1],val=named?(k in named?named[k]:named[m2[0]]):undefined;out+=lit(val);i+=m2[0].length;continue}
   out+=c;i++}return out}
 function parse(txt){var rows=[],row=[],i=0,L=txt.length;
  while(i<L){var c=txt[i];
   if(c==="'"){var j=i+1,v="";while(j<L){if(txt[j]==="'"){if(txt[j+1]==="'"){v+="'";j+=2;continue}break}v+=txt[j++]}row.push(v);i=j+1}
   else if((c==="X"||c==="x")&&txt[i+1]==="'"){var e=txt.indexOf("'",i+2);row.push(new Uint8Array(Buffer.from(txt.slice(i+2,e),"hex")));i=e+1}
   else if(txt.substr(i,4)==="NULL"){row.push(null);i+=4}
   else if(c===","){i++}
   else if(c==="\n"){rows.push(row);row=[];i++}
   else if(c==="\r"){i++}
   else{var m=/^[-+0-9.eE]+|^Inf|^-Inf/.exec(txt.slice(i,i+40));if(!m){i++;continue}var s=m[0];row.push(s==="Inf"?Infinity:s==="-Inf"?-Infinity:Number(s));i+=s.length}}
  if(row.length)rows.push(row);return rows}
 function DatabaseSync(file,opts){if(!(this instanceof DatabaseSync))throw new TypeError("Class constructor DatabaseSync cannot be invoked without 'new'");this.file=String(file&&file.pathname||file);this.ro=!!(opts&&(opts.readOnly||opts.readonly));this.isOpen=true;
  if(!fs3.existsSync(this.file)&&this.ro){var er=new Error("unable to open database file");er.code="ERR_SQLITE_ERROR";throw er}}
 DatabaseSync.prototype._run=function(script){var a=["-batch","-bail"];if(this.ro&&!fs3.existsSync(this.file+"-wal"))a.push("-readonly");a.push(this.file);
  try{return cp.execFileSync(BIN,a,{input:".mode quote\n.headers on\n"+script+"\n",encoding:"utf8",maxBuffer:512*1024*1024,stdio:["pipe","pipe","pipe"]})}
  catch(e){var er=new Error(String(e.stderr||e.message).replace(/^Error: (near line \d+: )?/,"").trim());er.code="ERR_SQLITE_ERROR";throw er}};
 DatabaseSync.prototype.exec=function(sql){this._run(String(sql).replace(/;?\s*$/,";"));};
 DatabaseSync.prototype.close=function(){this.isOpen=false};DatabaseSync.prototype.open=function(){this.isOpen=true};
 DatabaseSync.prototype.prepare=function(sql){var db=this;sql=String(sql).replace(/;?\s*$/,"");
  var st={sourceSQL:sql,setReadBigInts:function(){return st},setReturnArrays:function(b){st._arr=!!b;return st},setAllowBareNamedParameters:function(){return st},
   all:function(){var r=parse(db._run(bind(sql,[].slice.call(arguments))+";"));if(!r.length)return[];var h=r[0];return r.slice(1).map(function(x){if(st._arr)return x;var o={};for(var k=0;k<h.length;k++)o[h[k]]=x[k];return o})},
   get:function(){return st.all.apply(st,arguments)[0]},
   iterate:function(){return st.all.apply(st,arguments)[Symbol.iterator]()},
   run:function(){var r=parse(db._run(bind(sql,[].slice.call(arguments))+";\nSELECT changes() AS changes, last_insert_rowid() AS lastInsertRowid;"));var x=r[r.length-1]||[0,0];return{changes:x[0],lastInsertRowid:x[1]}},
   columns:function(){return[]}};return st};
 return{DatabaseSync:DatabaseSync,constants:{}}})();
 process.getBuiltinModule=(function(o){return function(id){if(id==="node:sqlite"||id==="sqlite")return SQ;return o.apply(this,arguments)}})(process.getBuiltinModule);
 try{var Mod=gb("node:module");var oload=Mod._load;Mod._load=function(r){if(r==="node:sqlite")return SQ;return oload.apply(this,arguments)}}catch(e){}
}}catch(e){}
globalThis.__ccFixBin=function(bin){try{var cp=gb("node:child_process"),fs2=gb("node:fs"),p2=gb("node:path");
 var D="/Applications/Claude.app/Contents/Frameworks/cc-compat";if(!fs2.existsSync(D+"/libcxxCompat.dylib"))return;
 var L=cp.execFileSync("/usr/bin/otool",["-L",bin],{encoding:"utf8"});if(L.indexOf("/usr/lib/libc++.1.dylib")<0)return;
 cp.execFileSync("/usr/bin/install_name_tool",["-change","/usr/lib/libc++.1.dylib",D+"/libcxxCompat.dylib","-change","/usr/lib/libSystem.B.dylib",D+"/libSystemCompat.dylib","-change","/usr/lib/libicucore.A.dylib",D+"/libicuCompat.dylib",bin],{stdio:"ignore"});
 var tgt=bin,d=p2.dirname(bin);while(d!=="/"){if(/\.app$/.test(d)){tgt=d;break}d=p2.dirname(d)}
 cp.execFileSync("/usr/bin/codesign",["--force","--deep","--sign","-",tgt],{stdio:"ignore"});
 try{cp.execFileSync("/usr/bin/xattr",["-cr",tgt],{stdio:"ignore"})}catch(e){}
}catch(e){try{console.error("[cc-compat] fixBin failed",e)}catch(_){}}};
})();
