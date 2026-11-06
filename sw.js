/* Órbita service worker: arquivos do app em cache; nunca intercepta dados da API Supabase. */
const CACHE="orbita-app-20261106-routines-v2";
const CORE=["./","./index.html","./boot.js","./boot.js?v=20261106-routines-v2","./config.js","./app.js","./stage2.js","./stage2.js?v=20261106-routines-v2","./stage3.js","./stage4.js","./stage5.js","./stage6.js","./stage7.js","./stage7.css","./stage7.css?v=20261104-settings-layout-v3","./styles.css","./styles.css?v=20261104-profile-goals-mobile","./stage2.css","./stage2.css?v=20261104-organize-light-mobile","./stage3.css","./stage3.css?v=20261103-session-focus","./stage4.css","./stage5.css","./stage6.css","./manifest.webmanifest","./assets/orbita.svg","./assets/orbita-alarm.wav","./assets/icon-192.png","./assets/icon-512.png"];
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
 const allowed=/\.(?:html|js|css|webmanifest|svg|png|wav)$/.test(url.pathname)||url.pathname.endsWith("/orbita/");
 if(!allowed)return;
 event.respondWith(caches.match(req).then(cached=>{
  const online=fetch(req).then(response=>{
   if(response.ok&&response.type==="basic"){const cp=response.clone();caches.open(CACHE).then(cache=>cache.put(req,cp));}
   return response;
  }).catch(()=>cached||Response.error());
  // HTML, JS e CSS precisam usar a versão mais recente enquanto online.
  // Nunca manter CSS antigo junto com uma interface JS nova.
  // Offline continua utilizando a cópia da versão instalada.
  const isAppCode=/\.(?:html|js|css|webmanifest)$/.test(url.pathname)||url.pathname.endsWith("/orbita/");
  return isAppCode?online:(cached||online);
 }));
});
self.addEventListener("message",event=>{if(event.data?.type==="SKIP_WAITING")self.skipWaiting();});

/* Exibe avisos do dispositivo enquanto o aplicativo está em execução.
   Para entregar novos avisos com o site fechado, Web Push precisará de inscrição
   do dispositivo e serviço backend de agendamento. */
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const destination=new URL("./#inicio",self.registration.scope).href;
 event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(async windows=>{
  const existing=windows.find(c=>c.url.startsWith(self.registration.scope));
  if(existing){await existing.focus();try{await existing.navigate(destination);}catch{}return;}
  if(clients.openWindow)await clients.openWindow(destination);
 }));
});
