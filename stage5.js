/* ÓRBITA — Etapa 5: configuração pública Supabase, Auth Google, backups e sincronização segura. */
(function(){
"use strict";
const C=window.OrbitaCore,Storage=window.OrbitaStorage;
if(!C||!Storage)throw Error("Órbita: inicialização incompleta");
const META="orbita:cloud-meta-v1";
const VERSION=1;
const E=C.esc,A=C.attr;
const $=id=>document.getElementById(id);
let client=null,user=null,cloudVersion=0,mode="unconfigured",busy=false,initialized=false,saveTimer=null,networkTimer=null,lastError="",conflict=null;
let cfg=null;
function readConfig(){
 // Configuração publica do próprio Órbita; não depende de formulário/localStorage.
 const config=window.ORBITA_SUPABASE;
 return config?.url&&config?.key?config:null;
}
function currentDoc(){return JSON.parse(JSON.stringify(C.state));}
function stringify(doc){
 // JSONB do PostgreSQL normaliza a ordem das propriedades; comparar por ordem
 // de inserção gera conflitos falsos depois de login ou recarga da nuvem.
 function normalize(value){
  if(Array.isArray(value))return value.map(normalize);
  if(value&&typeof value==="object"){
   const obj={};
   for(const k of Object.keys(value).sort())obj[k]=normalize(value[k]);
   return obj;
  }
  return value;
 }
 return JSON.stringify(normalize(doc));
}
function checksum(doc){
 const str=stringify(doc);let hash=2166136261;
 for(let i=0;i<str.length;i++){hash^=str.charCodeAt(i);hash=Math.imul(hash,16777619);}
 return str.length.toString(36)+"-"+(hash>>>0).toString(36);
}
function cloudMeta(){
 try{return JSON.parse(localStorage.getItem(META)||"null")||{};}catch{return {};}
}
function setCloudMeta(value){localStorage.setItem(META,JSON.stringify(value));}
function boundMeta(){const meta=cloudMeta();return user&&meta.userId===user.id?meta:null;}
function setLastSync(doc,version){cloudVersion=version;setCloudMeta({userId:user.id,version,hash:checksum(doc),at:new Date().toISOString()});if(checksum(currentDoc())===checksum(doc))Storage.markSynced?.();}
function meaningful(doc){
 return !!(doc?.goals?.length||doc?.planner?.entries?.length||doc?.planner?.blocks?.length||
 doc?.studies?.cycles?.length||doc?.studies?.sessions?.length||Object.keys(doc?.evolution?.closed||{}).length);
}
function textError(error){
 if(!navigator.onLine)return "Você está offline. Os dados continuam neste dispositivo.";
 const msg=String(error?.message||error||"Falha desconhecida");
 if(/permission|42501|403/i.test(msg))return "Acesso negado pelo Supabase. Verifique o SQL e a sessão.";
 if(/function.*not found|PGRST202|404/i.test(msg))return "A função orbita_commit não foi encontrada. Execute o SQL da migração.";
 if(/dia finalizado|finalizados|23514|snapshot/i.test(msg))return "O banco protege dias encerrados. O documento enviado contém alterações incompatíveis com o histórico. Exporte um backup e utilize a cópia da nuvem.";
 return msg.length>210?msg.slice(0,210)+"…":msg;
}
function status(newMode,error=""){
 mode=newMode;lastError=error?textError(error):"";
 const text={unconfigured:"Não configurado",loading:"Conectando",guest:"Uso local",offline:"Offline · dados locais",ready:"Sincronização ativa",syncing:"Enviando alterações",conflict:"Conflito de versões",error:"Atenção à sincronização",signedout:"Conecte sua conta"}[mode]||mode;
 const node=$("s5-status");if(node)node.textContent=text;
 const p=$("s5-error");if(p){p.textContent=lastError;p.hidden=!lastError;}
 const controls=$("s5-conflict-actions");if(controls)controls.hidden=mode!=="conflict";
}
function notify(message){C.notify(message);}
function isConfigured(config){
 if(!config||typeof config!=="object")return false;
 try{const url=new URL(String(config.url));return url.protocol==="https:"&&/\.supabase\.co$/.test(url.hostname)&&/^sb_publishable_[A-Za-z0-9_-]+$|^eyJ[A-Za-z0-9_.-]+$/.test(String(config.key||""))&&!String(config.key).startsWith("sb_secret_");}catch{return false;}
}
async function create(){
 cfg=readConfig();
 if(!isConfigured(cfg)){status("unconfigured");return;}
 status("loading");
 try{
  const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.87.3/+esm");
  client=createClient(cfg.url,cfg.key,{auth:{flowType:"pkce",detectSessionInUrl:true,autoRefreshToken:true,persistSession:true}});
  client.auth.onAuthStateChange((event,session)=>{
   // Evitar fazer consultas assíncronas dentro do callback do SDK.
   queueMicrotask(()=>{onSession(session,event).catch(err=>status("error",err));});
  });
  const {data,error}=await client.auth.getSession();
  if(error)throw error;
  await onSession(data?.session,"initial");
  initialized=true;
 }catch(err){status(navigator.onLine?"error":"offline",err);}
 C.render();
}
async function onSession(session,event){
 const next=session?.user||null;
 if(!next){
  user=null;cloudVersion=0;
  status(isConfigured(readConfig())?"signedout":"guest");
  C.render();return;
 }
 if(user?.id===next.id&&["loading","ready","syncing"].includes(mode))return;
 user=next;
 status("loading");
 await initialReconcile();
 C.render();
}
async function fetchRemote(){
 if(!client||!user)throw Error("Conecte sua conta Google.");
 const {data,error}=await client.from("orbita_documents").select("version,content").eq("user_id",user.id).maybeSingle();
 if(error)throw error;
 return data?{version:Number(data.version),document:data.content}:{version:0,document:null};
}
function isValidDoc(doc){return doc&&typeof doc==="object"&&!Array.isArray(doc)&&doc.schema===VERSION&&Array.isArray(doc.goals)&&doc.firstAccess&&doc.settings;}
function mergeClosures(preferred,other){
 const merged=JSON.parse(JSON.stringify(preferred));
 const primary=merged.evolution?.closed||{},secondary=other?.evolution?.closed||{};
 merged.evolution=merged.evolution||{};
 merged.evolution.closed=merged.evolution.closed||{};
 for(const [date,snapshot] of Object.entries(secondary)){
  if(date in primary&&stringify(primary[date])!==stringify(snapshot))
   throw Error("O mesmo dia foi finalizado com registros diferentes nos dispositivos: "+date+". Exporte os dois backups para conferir.");
  if(!(date in primary))merged.evolution.closed[date]=snapshot;
 }
 merged.planner=merged.planner||{version:2,entries:[],blocks:[],records:{},overrides:{},dayPauses:{},closedDays:[]};
 merged.planner.closedDays=Array.from(new Set([...(merged.planner.closedDays||[]),...(other?.planner?.closedDays||[]),...Object.keys(merged.evolution.closed)])).sort();
 if(other?.firstAccess&&(!merged.firstAccess||other.firstAccess<merged.firstAccess))merged.firstAccess=other.firstAccess;
 return merged;
}
function checkFrozenCompatibility(local,remote){
 const left=local?.evolution?.closed||{},right=remote?.evolution?.closed||{};
 for(const [date,record] of Object.entries(right)){
  if(!(date in left)||stringify(left[date])!==stringify(record))return false;
 }
 return true;
}
async function importState(doc,version=0){
 if(!isValidDoc(doc))throw Error("Documento de nuvem inválido. Nenhum dado foi substituído.");
 await Storage.replaceDocument(doc);
 if(user)setLastSync(doc,version);
 window.location.reload();
}
async function initialReconcile(){
 let remote;
 try{remote=await fetchRemote();}catch(err){status(navigator.onLine?"error":"offline",err);return;}
 const local=currentDoc(),meta=boundMeta(),localHash=checksum(local);
 cloudVersion=remote.version;
 if(!remote.document){
  // Não há dados na nuvem; nunca importar dados de outra conta sem confirmação.
  if(meta&&meta.version>0){conflict={remote,local};status("conflict");return;}
  mode="ready";await push(local);return;
 }
 if(!isValidDoc(remote.document)){status("error","O documento na nuvem tem estrutura inválida.");return;}
 const remoteHash=checksum(remote.document);
 if(localHash===remoteHash){setLastSync(local,remote.version);status("ready");return;}
 if(!meaningful(local)){
  await importState(remote.document,remote.version);return;
 }
 if(meta&&meta.version===remote.version&&meta.hash===remoteHash){
  // Servidor está na mesma revisão confirmada; só o dispositivo mudou.
  cloudVersion=remote.version;status("ready");await push(local);return;
 }
 if(meta&&meta.hash===localHash){
  // Nenhuma alteração local depois do último sync: baixar revisão mais recente.
  await importState(remote.document,remote.version);return;
 }
 conflict={remote,local};
 status("conflict");
}
function scheduleSync(){
 if(mode!=="ready"||!client||!user)return;
 clearTimeout(saveTimer);
 saveTimer=setTimeout(()=>push(currentDoc()).catch(err=>status(navigator.onLine?"error":"offline",err)),1300);
}
Storage.onUserSave=()=>scheduleSync();
async function push(doc){
 if(busy||!user||!client||mode==="conflict")return;
 busy=true;status("syncing");
 try{
  const {data,error}=await client.rpc("orbita_commit",{p_expected_version:cloudVersion,p_document:doc});
  if(error)throw error;
  if(data?.status==="conflict"){
   const remote=await fetchRemote();
   conflict={remote,local:currentDoc()};
   status("conflict");return;
  }
  if(data?.status!=="ok")throw Error("Resposta desconhecida de sincronização.");
  setLastSync(doc,Number(data.version));
  status("ready");
  if(checksum(currentDoc())!==checksum(doc))scheduleSync();
 }catch(err){status(navigator.onLine?"error":"offline",err);}
 finally{busy=false;}
}
async function syncNow(){
 if(!user)return notify("Entre com Google antes de sincronizar.");
 if(mode==="conflict")return notify("Resolva o conflito antes de sincronizar.");
 if(mode==="syncing")return;
 if(mode==="error"||mode==="offline"){
  await initialReconcile();
  if(mode!=="ready")return;
 }
 await push(currentDoc());
 notify(mode==="ready"?"Sincronização concluída.":"Verifique o status da conexão.");
}
async function signIn(){
 if(!client)return notify("Primeiro configure a URL e a chave pública do Supabase.");
 try{
  const redirectTo=window.location.origin+window.location.pathname;
  const {error}=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo}});
  if(error)throw error;
 }catch(err){status("error",err);}
}
async function signOut(){
 if(!client)return;
 if(mode==="syncing")return notify("Aguarde o término da sincronização.");
 if(["conflict","error","offline"].includes(mode)){
  if(!window.confirm("A sincronização não está confirmada. Exporte um backup antes de continuar. Sair mesmo assim apagará os dados locais deste dispositivo."))return;
  exportBackup();
 }
 if(user&&mode==="ready"){
  clearTimeout(saveTimer);
  if(checksum(currentDoc())!==boundMeta()?.hash)await push(currentDoc());
  if(mode!=="ready")return notify("Não foi possível confirmar a sincronização. Exporte um backup antes de sair.");
 }
 if(!window.confirm("Sair da conta e limpar os dados deste navegador? Os dados sincronizados continuarão na nuvem."))return;
 // Evita que dados de uma conta apareçam para o próximo visitante do dispositivo.
 await Storage.persistNow();
 const {error}=await client.auth.signOut();
 if(error){status("error",error);return;}
 await Storage.clearDocument();
 localStorage.removeItem(META);
 window.location.reload();
}
function exportBackup(){
 const doc=currentDoc();
 const backup={format:"orbita-backup",version:1,exportedAt:new Date().toISOString(),content:doc};
 const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
 const href=URL.createObjectURL(blob);
 const link=document.createElement("a");link.href=href;link.download="orbita-backup-"+C.today()+".json";document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),4000);
 notify("Backup preparado. Guarde o arquivo com segurança.");
}
async function receiveBackup(file){
 if(!file)return;
 if(file.size>6000000)throw Error("O backup excede o limite de 6 MB.");
 const input=JSON.parse(await file.text());
 if(input.format!=="orbita-backup"||input.version!==1||!isValidDoc(input.content))throw Error("Este arquivo não é um backup Órbita compatível.");
 const local=currentDoc(),incoming=input.content;
 // Nenhum backup antigo pode apagar ou modificar dias já encerrados no dispositivo.
 if(!checkFrozenCompatibility(incoming,local))throw Error("O backup removeria ou alteraria dias finalizados. Importe uma cópia que preserve esse histórico.");
 if(!window.confirm("Substituir seus dados locais por este backup? Exporte uma cópia atual antes de continuar."))return;
 if(user&&mode==="ready"){
  // A gravação remota é verificada pelo CAS e pela proteção do banco.
  const existing=await fetchRemote();
  if(existing.version!==cloudVersion){conflict={remote:existing,local:incoming};status("conflict");throw Error("A nuvem mudou. Resolva o conflito antes de importar.");}
  const {data,error}=await client.rpc("orbita_commit",{p_expected_version:cloudVersion,p_document:incoming});
  if(error)throw error;
  if(data?.status!=="ok"){conflict={remote:await fetchRemote(),local:incoming};status("conflict");throw Error("Conflito de versões durante a importação.");}
  setLastSync(incoming,Number(data.version));
 }else if(user){
  throw Error("Para importar conectado, restabeleça a sincronização ou saia após exportar um backup.");
 }
 await importState(incoming,user?cloudVersion:0);
}
async function chooseRemote(){
 if(!conflict?.remote?.document)return notify("Nenhum documento disponível na nuvem.");
 if(!window.confirm("Usar a nuvem como base? Dias já finalizados neste dispositivo serão preservados. Outras edições locais podem ser perdidas; faça um backup antes."))return;
 const latest=await fetchRemote();
 if(latest.version!==conflict.remote.version){conflict.remote=latest;status("conflict");return notify("A nuvem mudou; confira novamente.");}
 const merged=mergeClosures(latest.document,currentDoc());
 if(checksum(merged)!==checksum(latest.document)){
  const {data,error}=await client.rpc("orbita_commit",{p_expected_version:latest.version,p_document:merged});
  if(error)throw error;
  if(data?.status!=="ok"){conflict.remote=await fetchRemote();status("conflict");return;}
  await importState(merged,Number(data.version));
 }else await importState(latest.document,latest.version);
}
async function chooseLocal(){
 if(!conflict||!user)return;
 if(!window.confirm("Enviar seus dados locais em substituição à nuvem? O servidor recusará alterações em dias finalizados. Exporte um backup da nuvem antes."))return;
 const remote=await fetchRemote();
 if(remote.version!==conflict.remote.version){conflict.remote=remote;status("conflict");return notify("A nuvem mudou novamente. Revise o conflito.");}
 const doc=mergeClosures(currentDoc(),remote.document);
 const {data,error}=await client.rpc("orbita_commit",{p_expected_version:remote.version,p_document:doc});
 if(error){status("conflict",error);return;}
 if(data?.status!=="ok"){conflict.remote=await fetchRemote();status("conflict");return;}
 setLastSync(doc,Number(data.version));conflict=null;status("ready");
 if(checksum(currentDoc())!==checksum(doc))await importState(doc,Number(data.version));
 else C.render();
 notify("Dados locais sincronizados.");
}
function settingsPanel(){
 const label=user?.user_metadata?.name||user?.email||"";
 return '<section class="card s5-panel"><div class="card-head"><h2>Dados e sincronização</h2><span class="status" id="s5-status">'+E({ready:"Sincronização ativa",syncing:"Enviando alterações",conflict:"Conflito de versões",loading:"Conectando",offline:"Offline",error:"Atenção",signedout:"Não conectado",unconfigured:"Não configurado"}[mode]||mode)+'</span></div>'+
 '<p class="note" id="s5-error" '+(!lastError?'hidden':'')+'>'+E(lastError)+'</p>'+
 (user?'<div class="s5-user"><div><strong>'+E(label)+'</strong><small>Dados privados da conta Google. O login do navegador é separado do banco local.</small></div></div><div class="row"><button class="btn primary" data-s5="sync">Sincronizar agora</button><button class="btn small" data-s5="logout">Sair da conta</button></div>':
 (client?'<div class="row"><button class="btn primary" data-s5="login">Continuar com Google</button><span class="note">Sem login, seus dados permanecem neste aparelho.</span></div>':'<p class="note">A conexão com o banco já está configurada no Órbita. Se o login não aparecer, confira sua conexão com a internet e atualize a página.</p>'))+
 '<div class="s5-conflict" id="s5-conflict-actions" '+(mode!=="conflict"?"hidden":"")+'><strong>Há duas versões dos seus dados.</strong><p class="note">Nada será sobrescrito automaticamente. Primeiro exporte um backup, depois escolha qual cópia utilizar. A proteção de dias finalizados é aplicada pelo banco.</p><div class="row"><button class="btn" data-s5="chooseRemote">Usar nuvem</button><button class="btn" data-s5="chooseLocal">Usar dispositivo</button></div></div>'+
 '<div class="row" style="margin-top:12px"><button class="btn" data-s5="export">Exportar backup JSON</button><button class="btn" data-s5="import">Importar backup JSON</button><input id="s5-import-file" type="file" accept=".json,application/json" hidden></div>'+
 '<p class="note">Armazenamento offline: '+(Storage.supportsIndexedDB?"IndexedDB com cópia compatível no navegador.":"armazenamento local de compatibilidade.")+' Se limpar dados do navegador, poderá perder registros ainda não sincronizados. Faça backups periódicos.</p></section>';
}
function decorate(route,base){
 if(route==="configuracoes")return base+settingsPanel();
 if(route==="perfil")return base+'<section class="card"><div class="card-head"><h2>Conta e backups</h2></div><p class="note">'+E(user?"Conectado a "+(user.email||"Google"):"Use os dados localmente ou conecte sua conta Google nas Preferências.")+'</p><button class="btn small" data-s5="openSettings">Gerenciar conta e backups</button></section>';
 return base;
}
async function handleAction(type){
 switch(type){
 case "login":await signIn();break;
 case "logout":await signOut();break;
 case "sync":await syncNow();break;
 case "export":exportBackup();break;
 case "import":$("s5-import-file")?.click();break;
 case "chooseRemote":await chooseRemote();break;
 case "chooseLocal":await chooseLocal();break;
 case "openSettings":C.go("configuracoes");break;
 }
}
document.addEventListener("click",event=>{
 const target=event.target.closest("[data-s5]");if(!target)return;
 event.preventDefault();handleAction(target.dataset.s5).catch(err=>status("error",err));
});
document.addEventListener("change",event=>{
 if(event.target?.id!=="s5-import-file")return;
 receiveBackup(event.target.files?.[0]).catch(err=>{status(mode==="conflict"?"conflict":"error",err);notify(textError(err));});
});
window.addEventListener("online",()=>{if(user&&mode!=="conflict"){clearTimeout(networkTimer);networkTimer=setTimeout(()=>initialReconcile().catch(err=>status("error",err)),600);}});
window.OrbitaStage5={decorate,inspect:{checksum,isConfigured,meaningful,checkFrozenCompatibility,get mode(){return mode},get version(){return cloudVersion},get user(){return user},get client(){return client},mergeClosures}};
C.render();
create();
})();