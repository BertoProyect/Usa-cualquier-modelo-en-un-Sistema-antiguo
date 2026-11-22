;(function(){try{var el=require("electron"),cb=el.contextBridge,wf=el.webFrame;if(!cb||cb.executeInMainWorld)return;
var sink=null,n=0,pend=new Map();
cb.executeInMainWorld=function(o){var func=o&&o.func,args=(o&&o.args)||[];
 if(typeof func!=="function")throw new TypeError("executeInMainWorld: func must be a function");
 if(!process.contextIsolated)return func.apply(null,args);
 if(!sink){sink="__ccEIMW_"+Math.random().toString(36).slice(2);cb.exposeInMainWorld(sink,{a:function(id){return pend.get(id).args},d:function(id,ok,v){var p=pend.get(id);if(p){p.ok=ok;p.v=v}}});}
 var id=++n;pend.set(id,{args:args});
 var code="(function(){var b=window["+JSON.stringify(sink)+"];try{b.d("+id+",true,("+func.toString()+").apply(null,b.a("+id+")))}catch(e){b.d("+id+",false,String(e&&e.stack||e))}})()";
 var pr=wf.executeJavaScript(code);if(pr&&pr.catch)pr.catch(function(){});
 var p=pend.get(id);pend.delete(id);
 if(!("ok" in p))throw new Error("executeInMainWorld shim: main world did not run synchronously");
 if(!p.ok)throw new Error(p.v);return p.v};
}catch(e){}})();
