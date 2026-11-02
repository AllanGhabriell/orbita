/* Órbita service worker: arquivos do app em cache; nunca intercepta dados da API Supabase. */
const CACHE="orbita-app-v5-20261102b";
const CORE=["./","./index.html","./boot.js","./app.js","./stage2.js","./stage3.js","./stage4.js","./stage5.js","./styles.css","./stage2.css","./stage3.css","./stage4.css","./stage5.css","./manifest.webmanifest","./assets/orbita.svg","./assets/icon-192.png","./assets/icon-512.png"];
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
  return cached||online;
 }));
});
self.addEventListener("message",event=>{if(event.data?.type==="SKIP_WAITING")self.skipWaiting();});
