/* Órbita: bootstrap offline-first, sem dependência de servidor no primeiro uso. */
(async function(){
"use strict";
const KEY="orbita:stage1:v1",DB="orbita-offline-v1",STORE="documents";
let database=null;
function openDb(){
 return new Promise((resolve,reject)=>{
  if(!("indexedDB" in window))return reject(Error("IndexedDB indisponível"));
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
 });
}
function writeDoc(value){
 if(!database)return Promise.resolve(false);
 return new Promise(resolve=>{
  try{const tx=database.transaction(STORE,"readwrite");tx.objectStore(STORE).put({value,at:Date.now()},"current");tx.objectStore(STORE).put({at:Date.now(),checksum:value.length},"pending");tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);}catch{resolve(false);}
 });
}
function readDoc(){
 if(!database)return Promise.resolve(null);
 return new Promise(resolve=>{
  try{const req=database.transaction(STORE,"readonly").objectStore(STORE).get("current");req.onsuccess=()=>resolve(req.result?.value||null);req.onerror=()=>resolve(null);}catch{resolve(null);}
 });
}
function deleteDoc(){
 if(!database)return Promise.resolve(false);
 return new Promise(resolve=>{
  try{const tx=database.transaction(STORE,"readwrite");tx.objectStore(STORE).delete("current");tx.objectStore(STORE).delete("pending");tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);}catch{resolve(false);}
 });
}
function markSynced(){
 if(!database)return Promise.resolve(false);
 return new Promise(resolve=>{
  try{const tx=database.transaction(STORE,"readwrite");tx.objectStore(STORE).delete("pending");tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);}catch{resolve(false);}
 });
}
const storage={
 get supportsIndexedDB(){return !!database;},
 markSynced,
 get currentKey(){return KEY;},
 async replaceDocument(doc){
  const serialized=JSON.stringify(doc);
  localStorage.setItem(KEY,serialized);
  await writeDoc(serialized);
 },
 async clearDocument(){
  localStorage.removeItem(KEY);
  await deleteDoc();
 },
 onSave(json){
  writeDoc(json);
  if(typeof storage.onUserSave==="function")storage.onUserSave(json);
 },
 onUserSave:null,
 async persistNow(){const s=localStorage.getItem(KEY);if(s)await writeDoc(s);}
};
window.OrbitaStorage=storage;
try{
 database=await openDb();
 const existing=localStorage.getItem(KEY),idb=await readDoc();
 if(!existing&&idb)localStorage.setItem(KEY,idb); // resgate de configuração, não cria dados exemplo
 if(existing&&!idb)await writeDoc(existing);
}catch(err){console.warn("Órbita: usando armazenamento local de compatibilidade.",err);}
function load(src){
 return new Promise((resolve,reject)=>{
  const script=document.createElement("script");script.src=src;script.onload=resolve;script.onerror=()=>reject(Error("Não foi possível carregar "+src));document.head.appendChild(script);
 });
}
for(const file of ["config.js","app.js","stage2.js","stage3.js","stage4.js","stage5.js","stage6.js","stage7.js","stage8.js"]){
 try{await load("./"+file+(file==="stage2.js"?"?v=20261106-routines-v2":file==="stage4.js"?"?v=20261111-batch-close-v1":file==="stage7.js"?"?v=20261106-timed-pause-v1":file==="stage8.js"?"?v=20261111-reminders-layout-v2":file==="app.js"?"?v=20261111-reminders-layout-v2":""));}catch(err){
  console.error(err);
  const view=document.getElementById("view");if(view)view.textContent="Não foi possível carregar o aplicativo. Verifique a conexão e atualize a página.";
  return;
 }
}
if("serviceWorker" in navigator&&location.protocol==="https:"){
 navigator.serviceWorker.register("./sw.js",{scope:"./"}).catch(err=>console.warn("PWA indisponível:",err));
}
})();