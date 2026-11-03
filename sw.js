/* Órbita service worker: arquivos do app em cache; nunca intercepta dados da API Supabase. */
const CACHE="orbita-app-study-week-library-v4-20261103";
const CORE=["./","./index.html","./boot.js","./config.js","./app.js","./stage2.js","./stage3.js","./stage4.js","./stage5.js","./stage6.js","./styles.css","./stage2.css","./stage3.css","./stage4.css","./stage5.css","./stage6.css","./manifest.webmanifest","./assets/orbita.svg","./assets/icon-192.png","./assets/icon-512.png"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(x=>x.startsWith("orbita-app-")&&x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 const req=event.request;
 if(req.method!=="GET")return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin)return; // Nunca armazenar tokens, resposta Auth ou REST.
 if(!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 const allowed=/\.(?:html|js|css|webmanifest|svg|png)$/.test(url.pathname)||url.pathname.endsWith("/orbita/");
 if(!allowed)return;
 event.respondWith(caches.match(req).then(cached=>{
  const online=fetch(req).then(response=>{
   if(response.ok&&response.type==="basic"){const cp=response.clone();caches.open(CACHE).then(cache=>cache.put(req,cp));}
   return response;
  }).catch(()=>cached||Response.error());
  // Login e bootstrap sempre usam a versão atual enquanto online.
  // Offline continua utilizando a cópia do cache.
  const currentCode=/\/(?:app|boot|config|stage[2-6])\.js$/.test(url.pathname);
  return currentCode?online:(cached||online);
 }));
});
self.addEventListener("message",event=>{if(event.data?.type==="SKIP_WAITING")self.skipWaiting();});
