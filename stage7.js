/* Órbita — cronômetro de sessões, pausas, alertas e histórico no mesmo documento sincronizado. */
(function(){
"use strict";
const C=window.OrbitaCore,T=window.OrbitaStage3?.inspect,V=window.OrbitaStage4?.inspect;
if(!C||!T)throw Error("Órbita: ciclos de estudo indisponíveis");
const root=C.state;
const timing=root.timing&&typeof root.timing==="object"?root.timing:(root.timing={});
if(!timing.records||typeof timing.records!=="object"||Array.isArray(timing.records))timing.records={};
if(!timing.settings||typeof timing.settings!=="object")timing.settings={};
const defaults={mode:"continuous",goalMin:90,blockMin:25,restMin:5,pauseMinutes:10,repeatPause:true,finishSound:"orbita",pauseSound:"digital",volume:65,visual:true,desktopNotifications:false,loopFinish:true,loopPause:true,alarmIdleMinutes:15,inactivityWarningMinutes:60};
for(const [k,v] of Object.entries(defaults))if(timing.settings[k]===undefined)timing.settings[k]=v;
if(!timing.active||typeof timing.active!=="object")timing.active=null;
const E=C.esc,A=C.attr, $=id=>document.getElementById(id);
const clock=()=>Date.now();
const titleBase=document.title;
let audioContext=null,previousTitle="",flashTimeout=0,lastUndo=null,alarmAudio=null,alarmSource=null,alarmGain=null,demoAlarm=null,activityAt=clock(),inactivityPrompt=false,alarmTimeout=null;
const uploadBusy={finish:false,pause:false},presetSound="./assets/orbita-alarm.wav";
const iconLink=document.querySelector('link[rel="icon"]'),originalIcon=iconLink?.getAttribute("href")||"./assets/orbita.svg";
const alarmIcon="data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#201535"/><path d="M17 45c5-5 6-10 6-19 0-13 18-13 18 0 0 9 1 14 6 19H17zm10 6h10" stroke="#fff" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" fill="none"/><circle cx="48" cy="15" r="9" fill="#f05f73"/></svg>');
const fmtMs=ms=>{const secs=Math.max(0,Math.floor(ms/1000));return String(Math.floor(secs/3600)).padStart(2,"0")+":"+String(Math.floor(secs%3600/60)).padStart(2,"0")+":"+String(secs%60).padStart(2,"0");};
const duration=ms=>{const min=Math.round(Math.max(0,ms)/60000);return Math.floor(min/60)+"h"+String(min%60).padStart(2,"0");};
const record=id=>timing.records[id]||null;
const session=id=>T.session(id);
const validTime=n=>Number.isFinite(n)&&n>0&&n<=clock();
function activeRecord(){return timing.active?record(timing.active.sessionId):null;}
function studyMs(r,at=clock()){return Math.max(0,Number(r.studyMs)||0)+(timing.active?.sessionId===r.sessionId&&timing.active.phase==="running"?Math.max(0,at-timing.active.since):0);}
function pauseMs(r,at=clock()){return Math.max(0,Number(r.pauseMs)||0)+(timing.active?.sessionId===r.sessionId&&timing.active.phase==="paused"?Math.max(0,at-timing.active.since):0);}
function settings(){
 if(!timing.settings||typeof timing.settings!=="object")timing.settings={};
 for(const [key,value] of Object.entries(defaults))if(timing.settings[key]===undefined)timing.settings[key]=value;
 return timing.settings;
}
function persist(){C.save();}
function audioUnlock(){try{const AudioCtx=window.AudioContext||window.webkitAudioContext;if(AudioCtx){audioContext=audioContext||new AudioCtx();audioContext.resume?.().catch(()=>{});}}catch{}}
function tone(kind){
 if(kind==="none"||settings().volume===0)return;
 if(kind==="orbita"){try{const a=new Audio(presetSound);a.volume=Math.max(0,Math.min(1,Number(settings().volume)/100));a.play()?.catch(()=>{});}catch{}return;}
 const data=settings()[kind==="__pause"?"pauseUpload":"finishUpload"];
 if(kind==="custom"&&data){
  try{const audio=new Audio(data);audio.volume=Math.max(0,Math.min(1,Number(settings().volume)/100));audio.play().catch(()=>{});}catch{}return;
 }
 try{
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx)return;
  audioContext=audioContext||new AudioCtx();
  audioContext.resume?.().catch(()=>{});
  const now=audioContext.currentTime;
  const freqs=kind==="digital"?[784,784,784]:kind==="soft"?[440,554]:[523,659,784];
  freqs.forEach((freq,i)=>{
   const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),start=now+i*.18;
   oscillator.type=kind==="digital"?"square":"sine";
   oscillator.frequency.value=freq;
   gain.gain.setValueAtTime(.0001,start);
   gain.gain.exponentialRampToValueAtTime(Math.max(.001,Number(settings().volume)/100*.12),start+.025);
   gain.gain.exponentialRampToValueAtTime(.0001,start+.16);
   oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(start);oscillator.stop(start+.18);
  });
 }catch{}
}
// Alarme persistente e independente da navegação: não ocupa espaço quando inativo.
function stopAlarmAudio(){
 if(alarmAudio){try{alarmAudio.pause();alarmAudio.currentTime=0;}catch{}alarmAudio=null;}
 if(alarmSource){try{alarmSource.stop();alarmSource.disconnect();}catch{}alarmSource=null;}
 if(alarmGain){try{alarmGain.disconnect();}catch{}alarmGain=null;}
}
function alarmIdleLimit(){return Math.max(0,Number(settings().alarmIdleMinutes)||0)*60000;}
function stopAlarmTimeout(){if(alarmTimeout!==null){clearTimeout(alarmTimeout);alarmTimeout=null;}}
function autoSilenceAlarm(){
 const a=activeAlarm(),limit=alarmIdleLimit();
 if(!a||a.silenced||!limit)return false;
 const reference=Math.max(Number(a.raisedAt)||0,Number(a.lastInteractionAt)||0);
 if(clock()-reference<limit)return false;
 stopAlarmAudio();stopAlarmTimeout();a.silenced=true;a.autoSilenced=true;
 if(!a.demo)persist();
 renderAlarm();return true;
}
function scheduleAlarmTimeout(){
 stopAlarmTimeout();
 const a=activeAlarm(),limit=alarmIdleLimit();
 if(!a||a.silenced||!limit)return;
 const reference=Math.max(Number(a.raisedAt)||clock(),Number(a.lastInteractionAt)||0);
 alarmTimeout=setTimeout(()=>{alarmTimeout=null;if(!autoSilenceAlarm())scheduleAlarmTimeout();},Math.max(0,limit-(clock()-reference))+10);
}
function noteActivity(){
 activityAt=clock();inactivityPrompt=false;
 const a=activeAlarm();
 if(a&&!a.silenced){a.lastInteractionAt=activityAt;if(!a.demo)persist();scheduleAlarmTimeout();}
}
function alarmSound(which){
 const key=which==="pause"?"pauseSound":"finishSound";
 const selected=settings()[key];
 const loop=which==="pause"?settings().loopPause:settings().loopFinish;
 if(selected==="none"||Number(settings().volume)===0)return;
 stopAlarmAudio();
 if(selected==="custom"||selected==="orbita"){
  const data=selected==="orbita"?presetSound:settings()[which==="pause"?"pauseUpload":"finishUpload"];
  if(!data)return;
  try{
   const audio=new Audio(data);
   // Não utilizar loop nativo infinito quando há limite de inatividade:
   // assim, mesmo que o navegador suspenda temporariamente timers, o áudio
   // para no fim do ciclo em vez de tocar durante horas.
   const bounded=alarmIdleLimit()>0;
   audio.loop=!!loop&&!bounded;
   if(loop&&bounded)audio.addEventListener("ended",()=>{
    if(alarmAudio!==audio)return;
    const active=activeAlarm(),limit=alarmIdleLimit();
    if(!active||active.silenced||!limit||clock()-Math.max(Number(active.raisedAt)||0,Number(active.lastInteractionAt)||0)>=limit){autoSilenceAlarm();return;}
    try{audio.currentTime=0;audio.play()?.catch(()=>{});}catch{}
   });
   audio.volume=Math.max(0,Math.min(1,Number(settings().volume)/100));
   alarmAudio=audio;
   const playing=audio.play();
   if(playing?.catch)playing.catch(()=>{if(timing.alarm&&!timing.alarm.silenced)C.notify("O navegador bloqueou o som automático. Toque em Reproduzir som no aviso.");});
  }catch{C.notify("Não foi possível reproduzir o arquivo de áudio. Confira o formato.");}
  return;
 }
 if(!loop){tone(selected);return;}
 try{
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return;
  audioContext=audioContext||new AC();
  const rate=audioContext.sampleRate||22050,seconds=2.4;
  const buffer=audioContext.createBuffer(1,Math.round(rate*seconds),rate);
  const samples=buffer.getChannelData(0);
  const notes=selected==="digital"?[[0,784,.2],[.35,784,.2],[.7,784,.2]]:selected==="soft"?[[0,440,.29],[.35,554,.38]]:[[0,523,.3],[.34,659,.3],[.68,784,.45]];
  for(const [begin,freq,len] of notes){
   const start=Math.round(begin*rate),limit=Math.min(samples.length,Math.round((begin+len)*rate));
   for(let i=start;i<limit;i++){
    const elapsed=(i-start)/rate,decay=Math.pow(Math.max(0,1-elapsed/len),2),attack=Math.min(1,elapsed*85);
    const wave=selected==="digital"?Math.sign(Math.sin(2*Math.PI*freq*elapsed)):Math.sin(2*Math.PI*freq*elapsed);
    samples[i]+=wave*attack*decay*.45;
   }
  }
  alarmSource=audioContext.createBufferSource();
  alarmSource.buffer=buffer;alarmSource.loop=true;
  alarmGain=audioContext.createGain();
  alarmGain.gain.value=Math.max(0,Math.min(1,Number(settings().volume)/100))*.5;
  alarmSource.connect(alarmGain);alarmGain.connect(audioContext.destination);
  const source=alarmSource;
  source.start();
  if(alarmIdleLimit()>0){
   // Prazo de segurança no próprio motor de áudio, inclusive se a aba
   // suspender os timers JavaScript em segundo plano.
   source.onended=()=>{
    if(alarmSource!==source)return;
    alarmSource=null;
    if(autoSilenceAlarm())return;
    if(activeAlarm()?.silenced===false)alarmSound(which);
   };
   source.stop(audioContext.currentTime+alarmIdleLimit()/1000);
  }
  audioContext.resume?.().catch(()=>{if(timing.alarm&&!timing.alarm.silenced)C.notify("Toque em Reproduzir som para autorizar o alarme.");});
 }catch{stopAlarmAudio();tone(selected);}
}
function visualAlert(){
 if(!settings().visual||C.state.settings?.motion===false||window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)return;
 document.body.classList.remove("s7-completion");
 void document.body.offsetWidth;
 document.body.classList.add("s7-completion");
 clearTimeout(flashTimeout);flashTimeout=setTimeout(()=>document.body.classList.remove("s7-completion"),2200);
}
function activeAlarm(){return timing.alarm||demoAlarm;}
function updateTabIndicator(){
 const a=activeAlarm();
 if(a){
  document.title=(a.demo?"🔔 TESTE DE ALARME":a.which==="pause"?"🔔 PAUSA LONGA":"🔔 TEMPO CONCLUÍDO")+" — Órbita";
  if(iconLink&&iconLink.getAttribute("href")!==alarmIcon)iconLink.setAttribute("href",alarmIcon);
 }else{
  document.title=timing.active?(timing.active.phase==="paused"?"Ⅱ PAUSADO":"● EM ESTUDO")+" — Órbita":titleBase;
  if(iconLink&&iconLink.getAttribute("href")!==originalIcon)iconLink.setAttribute("href",originalIcon);
 }
}
function notificationTitle(which){return which==="test"?"Órbita · Teste de alarme":which==="pause"?"Órbita · Pausa prolongada":which==="block"?"Órbita · Bloco concluído":"Órbita · Tempo de estudo concluído";}
async function systemNotification(which,message){
 const N=window.Notification;
 if(!settings().desktopNotifications||!N||N.permission!=="granted")return false;
 const title=notificationTitle(which);
 const options={body:message,icon:"./assets/icon-192.png",badge:"./assets/icon-192.png",tag:"orbita-timer-"+which,renotify:true,requireInteraction:which==="finish"||which==="test",data:{which}};
 const direct=()=>{try{const n=new N(title,options);n.onclick=()=>{window.focus?.();C.go?.("inicio");n.close();};return true;}catch{return false;}};
 try{
  if(typeof navigator!=="undefined"&&navigator.serviceWorker?.getRegistration){
   const reg=await navigator.serviceWorker.getRegistration("./");
   if(reg?.active&&typeof reg.showNotification==="function"){
    try{await reg.showNotification(title,options);return true;}catch{return direct();}
   }
  }
  return direct();
 }catch{return direct();}
}
function renderAlarm(){
 const host=$("s7-alarm-host");
 if(!host)return;
 const a=activeAlarm(),active=timing.active;
 if(!a||(!a.demo&&(!active||a.sessionId!==active.sessionId))){
  host.hidden=true;host.innerHTML="";updateTabIndicator();return;
 }
 const isPause=a.which==="pause",demo=!!a.demo;
 const title=demo?"Teste de alarme":isPause?(a.message?.startsWith("Sua pausa de ")?"Pausa programada concluída":"Pausa prolongada"):"Meta de estudo atingida";
 const x=!demo?session(a.sessionId):null,name=demo?"Órbita":x?.discipline||"Sessão de estudo";
 const silence=a.silenced?'<button class="btn small ghost" data-s7="alarmReplay">▶ Reproduzir som</button>':'<button class="btn small ghost" data-s7="alarmSilence">Silenciar alarme</button>';
 const actions=demo?'<button class="btn small primary" data-s7="alarmDismiss">Encerrar teste</button>':isPause?
  '<button class="btn small primary" data-s7="alarmResume">Retomar estudo</button><button class="btn small ghost" data-s7="alarmCorrect">Corrigir horário</button><button class="btn small ghost" data-s7="alarmDismiss">Continuar pausado</button>':
  '<button class="btn small primary" data-s7="alarmContinue">Continuar estudando</button><button class="btn small ghost" data-s7="alarmFinish">Finalizar sessão</button>';
 host.hidden=false;
 host.innerHTML='<section class="s7-alarm-card '+(isPause?"s7-alarm-pause":"s7-alarm-finish")+'" role="alertdialog" aria-label="'+A(title)+'" aria-describedby="s7-alarm-desc">'+
 '<div class="s7-alarm-header"><span class="s7-alarm-symbol" aria-hidden="true">'+(isPause?"◷":"◉")+'</span><div><small>'+E(name)+'</small><h2>'+E(title)+'</h2></div><button type="button" class="s7-alarm-close" data-s7="alarmDismiss" aria-label="Dispensar aviso">×</button></div>'+
 '<p id="s7-alarm-desc">'+E(a.message)+'</p><div class="s7-alarm-actions">'+silence+actions+'</div>'+
 (a.silenced?'<small class="s7-alarm-note">'+(a.autoSilenced?"Som desligado automaticamente por inatividade. O cronômetro não foi alterado.":"Som silenciado.")+'</small>':"")+'</section>';
 updateTabIndicator();
}
function dismissAlarm(){
 stopAlarmAudio();stopAlarmTimeout();
 if(demoAlarm)demoAlarm=null;
 else if(timing.alarm){timing.alarm=null;persist();}
 renderAlarm();
}
function silenceAlarm(){
 const a=activeAlarm();if(!a)return;
 stopAlarmAudio();stopAlarmTimeout();a.silenced=true;if(!a.demo)persist();renderAlarm();
}
function replayAlarm(){
 const a=activeAlarm();if(!a)return;
 audioUnlock();a.silenced=false;a.autoSilenced=false;a.lastInteractionAt=clock();if(!a.demo)persist();renderAlarm();alarmSound(a.which);scheduleAlarmTimeout();
}
function showDemoAlarm(which="test"){
 if(timing.alarm){C.notify("Há um alarme real em andamento. Resolva-o antes de testar.");return;}
 audioUnlock();stopAlarmAudio();
 demoAlarm={demo:true,which:which==="pause"?"pause":"test",message:which==="pause"?"Exemplo de pausa prolongada.":"Teste de som e notificação. Nenhuma sessão será alterada.",silenced:false,raisedAt:clock()};
 renderAlarm();alarmSound(demoAlarm.which);scheduleAlarmTimeout();
 if(!settings().desktopNotifications||window.Notification?.permission!=="granted"){
  C.notify("Aviso ativado no Órbita. Ative as notificações do dispositivo para receber também no Windows ou Android.");
 }else void systemNotification("test","Teste do alarme do Órbita.").then(ok=>{
  if(!ok)C.notify("O navegador não conseguiu entregar a notificação do dispositivo.");
 });
}
function alertUser(message,which){
 if(which==="block"){
  C.notify(message);tone(settings().finishSound==="custom"?"bell":settings().finishSound);
  void systemNotification(which,message);return;
 }
 if(!timing.active)return;
 if(timing.alarm&&timing.alarm.sessionId===timing.active.sessionId&&timing.alarm.which===which)return;
 demoAlarm=null;stopAlarmAudio();
 timing.alarm={sessionId:timing.active.sessionId,which,message,raisedAt:clock(),silenced:false,lastInteractionAt:0};
 persist();renderAlarm();
 if(which==="finish")visualAlert();
 alarmSound(which);scheduleAlarmTimeout();
 void systemNotification(which,message);
}
function makeRecord(x){
 return timing.records[x.id]|| (timing.records[x.id]={sessionId:x.id,startedAt:new Date().toISOString(),studyMs:0,pauseMs:0,pauses:[],corrections:[],lastBlockAlert:0,goalNotified:false,mode:settings().mode,goalMin:Number(x.plannedMin)||Number(settings().goalMin)||90,finishedAt:null});
}
function start(id){
 const x=session(id);
 if(!x||x.archived||x.status==="done")throw Error("Escolha uma sessão pendente ou em andamento.");
 if(x.date!==C.today())throw Error("O cronômetro só inicia sessões da data atual. Selecione o dia de hoje.");
 if(V?.isClosed?.(x.date))throw Error("Este dia já foi finalizado.");
 if(timing.active)throw Error("Já existe uma sessão ativa. Finalize-a antes de iniciar outra.");
 audioUnlock();
 const beforeStatus=x.status;
 T.setSessionStatus(id,"progress",x.actualMin,x.actualTime||"");
 const r=makeRecord(x);
 if(r.originalStatus===undefined)r.originalStatus=beforeStatus;
 r.finishedAt=null;
 timing.active={sessionId:id,phase:"running",since:clock(),alertIndex:0};
 persist();C.render();tick();
}
function timedPauseModal(){
 if(timing.active?.phase!=="running")return C.notify("Inicie ou retome o estudo para programar uma pausa.");
 C.openModal("Pausa com timer",'<form id="s7-timed-pause-form" class="section-stack"><p class="note">O estudo será pausado; o alarme avisará ao final. Retome quando estiver pronto.</p><div class="field"><label>Minutos de descanso</label><input name="minutes" type="number" inputmode="numeric" min="1" max="240" value="5" required></div><div class="field"><label>Motivo (opcional)</label><input name="reason" maxlength="180" placeholder="Ex.: descanso mental"></div><div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button type="submit" class="btn primary">Iniciar pausa</button></div></form>');
}
function startTimedPause(minutes,reason){
 const min=Number(minutes);
 if(!Number.isInteger(min)||min<1||min>240)throw Error("Defina de 1 a 240 minutos.");
 if(timing.active?.phase!=="running")throw Error("Nenhuma sessão em estudo.");
 pause("scheduled");
 const p=activeRecord()?.pauses?.at(-1);
 if(!p)throw Error("Não foi possível iniciar a pausa.");
 p.plannedMinutes=min;p.reason=String(reason||"").trim().slice(0,180);p.restNotified=false;
 persist();C.closeModal();C.render();tick();
}
function pause(kind="rest"){
 const a=timing.active,r=activeRecord();
 if(!a||!r||a.phase!=="running")throw Error("Não há estudo em andamento.");
 const at=clock();r.studyMs=studyMs(r,at);
 r.pauses.push({startedAt:at,endedAt:null,kind,corrected:false});
 timing.active={sessionId:a.sessionId,phase:"paused",since:at,alertIndex:0};
 persist();C.render();tick();
}
function resume(){
 const a=timing.active,r=activeRecord();
 if(!a||!r||a.phase!=="paused")throw Error("Não há pausa para retomar.");
 audioUnlock();
 const at=clock();r.pauseMs=pauseMs(r,at);
 if(r.pauses.length&&r.pauses.at(-1).endedAt===null)r.pauses.at(-1).endedAt=at;
 timing.active={sessionId:a.sessionId,phase:"running",since:at,alertIndex:0};
 if(timing.alarm?.which==="pause")dismissAlarm();
 persist();C.render();tick();
}
function changePause(kind){
 if(timing.active?.phase!=="paused")return;
 const p=activeRecord()?.pauses?.at(-1);
 if(p&&p.endedAt===null){p.kind=kind;persist();C.render();}
}
function correction(timestamp){
 const a=timing.active,r=activeRecord(),at=Number(timestamp),now=clock();
 if(!a||!r||!Number.isFinite(at)||at<a.since||at>now)throw Error("Escolha um horário entre a última mudança e o momento atual.");
 if(a.phase==="paused"){
  r.pauseMs+=at-a.since;
  const p=r.pauses.at(-1);
  if(p&&p.endedAt===null){p.endedAt=at;p.corrected=true;}
  r.corrections.push({type:"resume",registeredAt:now,effectiveAt:at,previousExpectedAt:now});
  timing.active={sessionId:a.sessionId,phase:"running",since:at,alertIndex:0};
 }else{
  r.studyMs+=at-a.since;
  r.pauses.push({startedAt:at,endedAt:null,kind:"other",corrected:true});
  r.corrections.push({type:"pause",registeredAt:now,effectiveAt:at,previousExpectedAt:now});
  timing.active={sessionId:a.sessionId,phase:"paused",since:at,alertIndex:0};
 }
 if(timing.alarm?.which==="pause"&&timing.active?.phase==="running")dismissAlarm();
 persist();C.closeModal();C.render();tick();C.notify("Horário corrigido. A alteração ficou registrada no histórico.");
}
function finish(done){
 const a=timing.active,r=activeRecord(),x=a&&session(a.sessionId);
 if(!a||!r||!x)throw Error("Sessão ativa não encontrada.");
 if(V?.isClosed?.(x.date))throw Error("O dia já está fechado.");
 const at=clock(),studied=studyMs(r,at),paused=pauseMs(r,at);
 if(studied<1000&&!window.confirm("Menos de um segundo de estudo registrado. Encerrar mesmo assim?"))return;
 // A etapa do ciclo somente avança após conclusão confirmada.
 T.setSessionStatus(x.id,done?"done":"progress",studied?Math.max(1,Math.round(studied/60000)):null,x.actualTime||"");
 r.studyMs=studied;r.pauseMs=paused;
 if(a.phase==="paused"&&r.pauses.at(-1)?.endedAt===null)r.pauses.at(-1).endedAt=at;
 r.finishedAt=new Date(at).toISOString();r.status=done?"done":"partial";r.recordedActualMin=x.actualMin;
 timing.active=null;
 if(timing.alarm)dismissAlarm();
 persist();C.render();tick();C.notify(done?"Sessão concluída e tempo registrado.":"Tempo parcial salvo; a etapa do ciclo não avançou.");
}
function correctRestMinutes(minutes,seconds=0){
 const a=timing.active,r=activeRecord();
 if(!a||!r||a.phase!=="paused")throw Error("É necessário estar com o cronômetro pausado.");
 const restMs=Math.round(Number(minutes)*60000+Number(seconds)*1000),at=clock(),elapsed=at-a.since;
 if(!Number.isFinite(restMs)||restMs<0||!Number.isInteger(Number(minutes))||!Number.isInteger(Number(seconds))||Number(seconds)<0||Number(seconds)>59||restMs>elapsed)throw Error("O descanso real não pode ultrapassar o tempo da pausa.");
 const studyAdded=elapsed-restMs,p=r.pauses?.at(-1);
 if(!p||p.endedAt!==null)throw Error("Não foi possível localizar a pausa atual.");
 r.pauseMs=(Number(r.pauseMs)||0)+restMs;
 r.studyMs=(Number(r.studyMs)||0)+studyAdded;
 p.endedAt=a.since+restMs;p.corrected=true;p.actualRestMs=restMs;
 r.corrections.push({type:"simplified_rest",registeredAt:at,originalPauseMs:elapsed,actualRestMs:restMs,studyAddedMs:studyAdded});
 timing.active={sessionId:a.sessionId,phase:"running",since:at,alertIndex:0};
 if(timing.alarm?.which==="pause")dismissAlarm();
 persist();C.closeModal();C.render();tick();C.notify("Pausa corrigida: "+duration(restMs)+" de descanso e "+duration(studyAdded)+" transferidos para estudo.");
}
function allocationMs(minutes,seconds,label){
 const min=Number(minutes),sec=Number(seconds);
 if(!Number.isInteger(min)||min<0||!Number.isInteger(sec)||sec<0||sec>59)throw Error("Confira minutos e segundos de "+label+".");
 return min*60000+sec*1000;
}
function allocationRemaining(elapsed,study,rest){
 if(study<0||rest<0||study+rest>elapsed)throw Error("Estudo e descanso não podem ultrapassar o período registrado.");
 return elapsed-study-rest;
}
function reallocateCurrent(studyMinutes,studySeconds,restMinutes,restSeconds,nextPhase){
 const a=timing.active,r=activeRecord(),at=clock();
 if(!a||!r)throw Error("Não há cronômetro ativo.");
 const x=session(a.sessionId);
 if(!x||V?.isClosed?.(x.date)||root.evolution?.closed?.[x.date])throw Error("O dia já foi finalizado.");
 if(!["running","paused"].includes(nextPhase))throw Error("Escolha se o cronômetro continuará estudando ou pausado.");
 const elapsed=Math.max(0,at-a.since),studying=allocationMs(studyMinutes,studySeconds,"estudo"),resting=allocationMs(restMinutes,restSeconds,"descanso");
 const ignored=allocationRemaining(elapsed,studying,resting);
 const p=a.phase==="paused"?r.pauses?.at(-1):null;
 if(a.phase==="paused"&&(!p||p.endedAt!==null))throw Error("A pausa atual não foi encontrada.");
 snapshotUndo([a.sessionId]);
 if(a.phase==="paused"){
  if(resting===0)r.pauses.pop();
  else{p.endedAt=p.startedAt+resting;p.corrected=true;p.allocationOnly=true;}
 }else if(resting>0){
  const start=a.since+studying;
  r.pauses.push({startedAt:start,endedAt:start+resting,kind:"rest",corrected:true,allocationOnly:true});
 }
 r.studyMs=(Number(r.studyMs)||0)+studying;
 r.pauseMs=(Number(r.pauseMs)||0)+resting;
 r.unaccountedMs=(Number(r.unaccountedMs)||0)+ignored;
 r.corrections||(r.corrections=[]);
 r.corrections.push({type:"time_reallocated",registeredAt:at,phaseBefore:a.phase,phaseAfter:nextPhase,elapsedMs:elapsed,studyMs:studying,restMs:resting,unaccountedMs:ignored});
 if(nextPhase==="paused")r.pauses.push({startedAt:at,endedAt:null,kind:"rest",corrected:true});
 timing.active={sessionId:a.sessionId,phase:nextPhase,since:at,alertIndex:0};
 if(timing.alarm)dismissAlarm();
 persist();C.closeModal();C.render();tick();
 C.notify("Período corrigido. Estudo: "+fmtMs(studying)+"; descanso: "+fmtMs(resting)+"; desconsiderado: "+fmtMs(ignored)+".");
}
// Corrige os totais de toda a sessão, não apenas o último segmento.
function correctSessionTotals(studyMinutes,restMinutes,nextPhase){
 const a=timing.active,r=activeRecord(),at=clock();
 if(!a||!r)throw Error("Não há cronômetro ativo.");
 const x=session(a.sessionId);
 if(!x||V?.isClosed?.(x.date)||root.evolution?.closed?.[x.date])throw Error("Este dia já está finalizado.");
 if(!["running","paused"].includes(nextPhase))throw Error("Escolha como continuar o cronômetro.");
 const study=Number(studyMinutes),rest=Number(restMinutes);
 if(!Number.isInteger(study)||study<0||!Number.isInteger(rest)||rest<0)throw Error("Informe apenas minutos inteiros, sem valores negativos.");
 const beforeStudy=studyMs(r,at),beforeRest=pauseMs(r,at),beforeIgnored=Math.max(0,Number(r.unaccountedMs)||0);
 const beforeTotal=beforeStudy+beforeRest+beforeIgnored;
 const newTotal=(study+rest)*60000;
 // A interface arredonda os minutos: até 59s de diferença são tolerados.
 if(newTotal>beforeTotal+59999)throw Error("Os minutos informados ultrapassam o tempo total desta sessão.");
 if(study>10080||rest>10080)throw Error("O máximo permitido é 10.080 minutos por categoria.");
 const latest=a.phase==="paused"?r.pauses?.at(-1):null;
 if(a.phase==="paused"&&(!latest||latest.endedAt!==null))throw Error("Não foi possível localizar a pausa atual.");
 snapshotUndo([a.sessionId]);
 // Conserva os registros originais das pausas para auditoria; a correção manual
 // altera os totais oficiais, sem inventar intervalos retrospectivos.
 if(latest){latest.endedAt=at;latest.closedByTotalCorrection=true;}
 r.studyMs=study*60000;
 r.pauseMs=rest*60000;
 r.unaccountedMs=Math.max(0,beforeTotal-newTotal);
 r.corrections||(r.corrections=[]);
 r.corrections.push({type:"session_totals_corrected",registeredAt:at,before:{studyMs:beforeStudy,pauseMs:beforeRest,unaccountedMs:beforeIgnored},after:{studyMs:r.studyMs,pauseMs:r.pauseMs,unaccountedMs:r.unaccountedMs},phaseBefore:a.phase,phaseAfter:nextPhase});
 if(nextPhase==="paused")r.pauses.push({startedAt:at,endedAt:null,kind:latest?.kind||"rest",corrected:true});
 timing.active={sessionId:a.sessionId,phase:nextPhase,since:at,alertIndex:0};
 if(timing.alarm)dismissAlarm();
 persist();C.closeModal();C.render();tick();
 C.notify("Totais corrigidos: "+study+" min estudados, "+rest+" min de descanso. O restante foi desconsiderado.");
}
function correctModal(){
 const a=timing.active,r=activeRecord();if(!a||!r)return;
 const at=clock(),totalStudy=studyMs(r,at),totalRest=pauseMs(r,at),ignored=Math.max(0,Number(r.unaccountedMs)||0);
 const tracked=totalStudy+totalRest+ignored;
 const maxMinutes=Math.max(1,Math.ceil(tracked/60000));
 const localIso=d=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
 const inputTime=new Date(at-60000),message=a.phase==="paused"?"Retomei o estudo antes de clicar no botão":"Parei de estudar antes de clicar em Pausar";
 C.openModal("Corrigir tempo do cronômetro",'<div class="section-stack">'+
 '<form id="s7-correct-totals" class="section-stack">'+
 '<p class="note">Corrija os <strong>totais de toda a sessão</strong>, não apenas a pausa atual. Mesmo que você tenha acabado de pausar, pode corrigir horas de estudo acumuladas.</p>'+
 '<div class="s7-total-original"><span>Estudo contado: <strong>'+E(duration(totalStudy))+'</strong></span><span>Descanso contado: <strong>'+E(duration(totalRest))+'</strong></span></div>'+
 '<input type="hidden" name="trackedMinutes" value="'+(tracked/60000)+'">'+
 '<div class="form-grid">'+
 '<div class="field"><label>Quanto você realmente estudou?</label><div class="s7-total-input"><input name="studyMinutes" type="number" inputmode="numeric" min="0" max="'+maxMinutes+'" step="1" value="'+Math.round(totalStudy/60000)+'" required><span>minutos</span></div></div>'+
 '<div class="field"><label>Quanto tempo descansou?</label><div class="s7-total-input"><input name="restMinutes" type="number" inputmode="numeric" min="0" max="'+maxMinutes+'" step="1" value="'+Math.round(totalRest/60000)+'" required><span>minutos</span></div></div></div>'+
 '<div class="s7-allocation-preview" role="status" aria-live="polite">Tempo desconsiderado: <strong data-s7-total-left>'+Math.max(0,Math.round((tracked-totalStudy-totalRest)/60000))+' min</strong></div>'+
 '<div class="field"><label>Após salvar, continuar</label><select name="nextPhase"><option value="running" '+(a.phase==="running"?"selected":"")+'>Estudando</option><option value="paused" '+(a.phase==="paused"?"selected":"")+'>Pausado</option></select></div>'+
 '<p class="note">Os totais corrigidos serão usados no estudo e no histórico. A correção fica registrada e pode ser desfeita em até 60 segundos.</p>'+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button type="submit" class="btn primary">Salvar correção</button></div></form>'+
 '<details><summary>Correção avançada por data e horário</summary><form id="s7-correction-form" class="section-stack"><p class="note">'+E(message)+'. Informe quando a mudança realmente aconteceu.</p><div class="field"><label>Horário verdadeiro</label><input name="moment" type="datetime-local" required min="'+A(localIso(new Date(a.since)))+'" max="'+A(localIso(new Date(at)))+'" value="'+A(localIso(inputTime.getTime()<a.since?new Date(a.since):inputTime))+'"></div><button type="submit" class="btn primary">Corrigir horário</button></form></details></div>');
}
function updateTotalsPreview(form){
 if(!form||form.getAttribute?.("id")!=="s7-correct-totals")return;
 const data=new FormData(form),target=form.querySelector?.("[data-s7-total-left]");
 if(!target)return;
 const study=Number(data.get("studyMinutes")),rest=Number(data.get("restMinutes")),tracked=Number(data.get("trackedMinutes"));
 if(!Number.isInteger(study)||!Number.isInteger(rest)||study<0||rest<0||study+rest>tracked+0.9999833){target.textContent="Confira os valores";return;}
 target.textContent=Math.max(0,Math.round(tracked-study-rest))+" min";
}

function askFinish(done){
 const a=timing.active;if(!a)return;
 if(!window.confirm(done?"Concluir a sessão e avançar o ciclo, quando aplicável?":"Encerrar e salvar o tempo parcial sem avançar o ciclo?"))return;
 finish(done);
}

// Gerenciamento reversível: o planejamento nunca é apagado ao descartar a cronometragem.
const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
function editableRecord(id,live=false){
 const x=session(id),r=record(id);
 if(!x||!r||x.archived)throw Error("Registro de cronometragem não encontrado.");
 if(V?.isClosed?.(x.date)||root.evolution?.closed?.[x.date])throw Error("Dia finalizado: não é possível modificar o histórico.");
 if(!live&&timing.active?.sessionId===id)throw Error("Encerre o cronômetro como parcial antes de editar seu histórico. Você pode zerar ou descartar enquanto ele está em andamento.");
 return {x,r};
}
function snapshotUndo(ids){
 const at=clock();
 lastUndo={at,ids:[...ids],entries:ids.map(id=>{
  const r=record(id),x=session(id),saved=copy(r);
  if(saved&&timing.active?.sessionId===id){
   saved.studyMs=studyMs(r,at);saved.pauseMs=pauseMs(r,at);
   if(timing.active.phase==="paused"&&saved.pauses?.at(-1)?.endedAt===null)saved.pauses.at(-1).endedAt=at;
  }
  return {id,record:saved,actualMin:x?.actualMin??null};
 }),active:timing.active&&ids.includes(timing.active.sessionId)?copy(timing.active):null};
}
function undo(){
 if(!lastUndo||clock()-lastUndo.at>60000)throw Error("Não há alteração recente que possa ser desfeita.");
 if(lastUndo.ids.some(id=>!session(id)||V?.isClosed?.(session(id).date)))throw Error("Não é possível restaurar dados de um dia finalizado.");
 for(const item of lastUndo.entries){
  if(item.record)timing.records[item.id]=copy(item.record);
  else delete timing.records[item.id];
  session(item.id).actualMin=item.actualMin;
 }
 if(lastUndo.active){
  const a=lastUndo.active;
  timing.active={...a,since:clock(),alertIndex:0};
  if(a.phase==="paused")timing.records[a.sessionId]?.pauses?.push({startedAt:clock(),endedAt:null,kind:"other",corrected:true});
 }else if(timing.active&&lastUndo.ids.includes(timing.active.sessionId))timing.active=null;
 lastUndo=null;
 persist();C.closeModal();C.render();tick();C.notify("Última alteração desfeita.");
}
function lastUndoAvailable(id){return lastUndo?.ids?.includes(id)&&clock()-lastUndo.at<=60000;}
function trackTimeMatches(x,r){
 const reported=Number(x.actualMin);
 if(x.actualMin==null)return false;
 const recorded=r.recordedActualMin;
 return (recorded!=null&&reported===Number(recorded))||reported===Math.max(1,Math.round(studyMs(r)/60000));
}
function cancelAccidentalPause(){
 const a=timing.active,r=activeRecord();
 if(!a||!r||a.phase!=="paused")throw Error("Não há uma pausa ativa.");
 if(!window.confirm("A pausa foi acionada por engano e você continuou estudando? O intervalo da pausa atual será convertido em estudo efetivo."))return;
 snapshotUndo([a.sessionId]);
 const at=clock(),time=Math.max(0,at-a.since);
 r.studyMs+=time;
 if(r.pauses.at(-1)?.endedAt===null)r.pauses.pop();
 noteEdit(r,"accidental_pause_cancelled",{durationMs:time});
 timing.active={sessionId:a.sessionId,phase:"running",since:at,alertIndex:0};
 persist();C.closeModal();C.render();tick();C.notify("Pausa acidental desfeita; intervalo contado como estudo conforme sua confirmação.");
}
function resetCurrentPause(){
 const a=timing.active,r=activeRecord();
 if(!a||!r||a.phase!=="paused")throw Error("Não há pausa ativa para zerar.");
 if(!window.confirm("Zerar somente o contador da pausa atual? O intervalo descartado não será convertido em estudo."))return;
 snapshotUndo([a.sessionId]);
 const at=clock();
 if(r.pauses.at(-1)?.endedAt===null)r.pauses.at(-1).startedAt=at;
 noteEdit(r,"active_pause_reset",{discardedMs:Math.max(0,at-a.since)});
 timing.active={sessionId:a.sessionId,phase:"paused",since:at,alertIndex:0};
 persist();C.closeModal();C.render();tick();C.notify("Contador da pausa atual zerado, sem acrescentar tempo de estudo.");
}
function resetTimer(id){
 const {x,r}=editableRecord(id,true);
 if(!window.confirm("Zerar todos os tempos e pausas desta cronometragem? A sessão planejada e a sua conclusão serão preservadas. Você poderá desfazer em até 60 segundos."))return;
 snapshotUndo([id]);
 if(trackTimeMatches(x,r))x.actualMin=null;
 const keptMode=r.mode,keptGoal=r.goalMin,originalStatus=r.originalStatus;
 timing.records[id]={sessionId:id,startedAt:new Date().toISOString(),studyMs:0,pauseMs:0,pauses:[],corrections:[],goalMin:keptGoal,mode:keptMode,originalStatus,lastBlockAlert:0,goalNotified:false,finishedAt:null,resetAt:new Date().toISOString()};
 if(timing.active?.sessionId===id)timing.active={sessionId:id,phase:"running",since:clock(),alertIndex:0};
 if(timing.alarm?.sessionId===id)dismissAlarm();
 persist();C.closeModal();C.render();tick();C.notify("Cronômetro zerado. Use ⋯ para desfazer.");
}
function discardTimer(id){
 const {x,r}=editableRecord(id,true);
 if(!window.confirm("Descartar toda a cronometragem, incluindo pausas e correções? A sessão de estudo continuará cadastrada. A conclusão será preservada."))return;
 snapshotUndo([id]);
 if(trackTimeMatches(x,r))x.actualMin=null;
 delete timing.records[id];
 if(timing.active?.sessionId===id)timing.active=null;
 if(timing.alarm?.sessionId===id)dismissAlarm();
 if(x.status==="progress"&&r.originalStatus==="pending"&&x.actualMin==null)T.setSessionStatus(x.id,"pending",null,x.actualTime||"");
 persist();C.closeModal();C.render();tick();C.notify("Cronometragem descartada. É possível desfazer pelo menu da sessão por 60 segundos.");
}
const pauseNames={rest:"Descanso",preparation:"Preparação de flashcards",scheduled:"Intervalo programado",other:"Interrupção"};
function pauseDuration(p){return Math.max(0,(Number(p.endedAt)||Number(p.startedAt))-Number(p.startedAt));}
function allPauseMs(r){return (r.pauses||[]).reduce((total,p)=>total+pauseDuration(p),0);}
function noteEdit(r,type,details){r.corrections||(r.corrections=[]);r.corrections.push({type,registeredAt:clock(),...details});}
function updateActual(x,r){x.actualMin=r.studyMs>0?Math.max(1,Math.round(r.studyMs/60000)):null;r.recordedActualMin=x.actualMin;}
function syncManualRecord(id,minutes){
 const r=record(id),x=session(id);
 if(!r||!x||timing.active?.sessionId===id||V?.isClosed?.(x.date))return;
 const valid=minutes==null||Number.isFinite(Number(minutes))&&Number(minutes)>=0&&Number(minutes)<=1440;
 if(!valid)return;
 const newMs=minutes==null?0:Math.round(Number(minutes)*60000);
 if(r.studyMs===newMs)return;
 noteEdit(r,"manual_time_adjustment",{beforeMs:r.studyMs,afterMs:newMs});
 r.studyMs=newMs;r.recordedActualMin=minutes;
 lastUndo=null;
}
function editTotalsModal(id){
 const {x,r}=editableRecord(id);
 C.openModal("Editar tempo de estudo",'<form id="s7-edit-totals" class="section-stack">'+
 '<input name="id" type="hidden" value="'+A(id)+'"><p class="note">'+E(x.discipline)+' · duração efetivamente estudada e tempo total pausado. Alterar pausas não acrescenta estudo automaticamente.</p>'+
 '<div class="form-grid"><div class="field"><label>Tempo estudado (minutos)</label><input name="study" type="number" min="0" max="1440" step="0.01" required value="'+(studyMs(r)/60000).toFixed(2)+'"></div>'+
 '<div class="field"><label>Tempo pausado (minutos)</label><input name="paused" type="number" min="0" max="1440" step="0.01" required value="'+(pauseMs(r)/60000).toFixed(2)+'"></div></div>'+
 '<p class="note">As pausas detalhadas somam '+E(duration(allPauseMs(r)))+'. Para reduzir o total abaixo disso, edite ou remova primeiro as pausas correspondentes.</p>'+
 '<div class="field"><label>Motivo da correção (opcional)</label><input name="reason" maxlength="180" placeholder="Ex.: esqueci de retomar o cronômetro"></div>'+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-s7="manage" data-id="'+A(id)+'">Voltar</button><button class="btn primary" type="submit">Salvar tempos</button></div></form>');
}
function editTotals(id,newStudy,newPause,reason=""){
 const {x,r}=editableRecord(id);
 const valid=n=>Number.isFinite(n)&&n>=0&&n<=1440;
 if(!valid(newStudy)||!valid(newPause))throw Error("Informe tempos válidos entre 0 e 1440 minutos.");
 const study=Math.round(newStudy*60000),paused=Math.round(newPause*60000);
 if(paused+1000<allPauseMs(r))throw Error("O tempo total é menor que as pausas detalhadas. Corrija primeiro o histórico de pausas.");
 snapshotUndo([id]);
 const old={studyMs:r.studyMs,pauseMs:r.pauseMs};
 r.studyMs=study;r.pauseMs=paused;
 noteEdit(r,"totals_edited",{before:old,after:{studyMs:study,pauseMs:paused},reason:String(reason||"").slice(0,180)});
 updateActual(x,r);
 persist();C.closeModal();C.render();C.notify("Tempos corrigidos. A sessão e sua conclusão foram preservadas.");
}
function pausesModal(id){
 const {r,x}=editableRecord(id);
 const list=(r.pauses||[]).map((p,i)=>{
  const stillOpen=p.endedAt===null;
  return '<div class="s7-pause-line"><div><strong>'+E((i+1)+"ª pausa · "+(pauseNames[p.kind]||"Pausa"))+'</strong><small>'+E(duration(stillOpen?clock()-p.startedAt:pauseDuration(p)))+' · '+(stillOpen?"Em andamento":"Registrada")+'</small></div>'+
   (stillOpen?'<span class="note">Retome antes de editar</span>':'<div class="row"><button type="button" class="btn small ghost" data-s7="editPause" data-id="'+A(id)+'" data-index="'+i+'">Editar</button><button type="button" class="btn small danger" data-s7="deletePause" data-id="'+A(id)+'" data-index="'+i+'">Excluir</button></div>')+'</div>';
 }).join("");
 C.openModal("Gerenciar pausas",'<div class="section-stack"><p class="note">'+E(x.discipline)+' · '+E(duration(pauseMs(r)))+' no total. Excluir pausas reduz o tempo pausado, mas não aumenta o tempo estudado.</p>'+
 (list||'<p class="note">Nenhuma pausa registrada.</p>')+
 '<div class="modal-footer"><button class="btn ghost" data-s7="manage" data-id="'+A(id)+'">Voltar</button>'+
 '<button class="btn danger" data-s7="clearPauses" data-id="'+A(id)+'" '+(r.pauses?.some(p=>p.endedAt===null)?"disabled":"")+'>Zerar pausas</button></div></div>');
}
function editPauseModal(id,index){
 const {r}=editableRecord(id);
 const p=r.pauses?.[index];
 if(!p||p.endedAt===null)throw Error("Retome o cronômetro antes de editar esta pausa.");
 const local=date=>{const d=new Date(date);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
 C.openModal("Editar pausa "+(index+1),'<form id="s7-edit-pause" class="section-stack"><input type="hidden" name="id" value="'+A(id)+'"><input type="hidden" name="index" value="'+index+'">'+
 '<div class="field"><label>Categoria</label><select name="kind">'+Object.entries(pauseNames).map(([key,title])=>'<option value="'+key+'" '+(key===p.kind?"selected":"")+'>'+E(title)+'</option>').join("")+'</select></div>'+
 '<div class="form-grid"><div class="field"><label>Início da pausa</label><input name="start" type="datetime-local" required value="'+A(local(p.startedAt))+'"></div>'+
 '<div class="field"><label>Fim da pausa</label><input name="end" type="datetime-local" required value="'+A(local(p.endedAt))+'"></div></div>'+
 '<p class="note">Ajuste os horários reais. Intervalos sobrepostos não são permitidos.</p>'+
 '<div class="modal-footer"><button class="btn ghost" type="button" data-s7="pauses" data-id="'+A(id)+'">Voltar</button><button type="submit" class="btn primary">Salvar pausa</button></div></form>');
}
function editPause(id,index,start,end,kind){
 const {r}=editableRecord(id),p=r.pauses?.[index];
 if(!p||p.endedAt===null)throw Error("Pausa não encontrada ou ainda aberta.");
 if(!Object.hasOwn(pauseNames,kind))throw Error("Categoria inválida.");
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end||end>clock()||(r.finishedAt&&end>new Date(r.finishedAt).getTime()))throw Error("Informe horários válidos dentro do período da sessão.");
 if(start<new Date(r.startedAt).getTime())throw Error("A pausa não pode começar antes da sessão.");
 if(r.pauses.some((other,i)=>i!==index&&start<(other.endedAt??clock())&&end>other.startedAt))throw Error("Os horários não podem se sobrepor a outra pausa.");
 const delta=(end-start)-pauseDuration(p),newPause=r.pauseMs+delta;
 if(newPause<0||newPause>24*3600000)throw Error("A alteração geraria um tempo de pausa inválido.");
 snapshotUndo([id]);
 const before=copy(p);p.startedAt=start;p.endedAt=end;p.kind=kind;p.corrected=true;
 r.pauseMs=newPause;noteEdit(r,"pause_edited",{index,before,after:copy(p)});
 persist();pausesModal(id);C.render();C.notify("Pausa corrigida.");
}
function deletePause(id,index){
 const {r}=editableRecord(id),p=r.pauses?.[index];
 if(!p||p.endedAt===null)throw Error("Pausa não encontrada ou ainda aberta.");
 if(!window.confirm("Excluir esta pausa? O período será removido dos totais, sem ser convertido em estudo."))return;
 snapshotUndo([id]);
 const removed=r.pauses.splice(index,1)[0];
 r.pauseMs=Math.max(0,r.pauseMs-pauseDuration(removed));
 noteEdit(r,"pause_deleted",{index,durationMs:pauseDuration(removed)});
 persist();pausesModal(id);C.render();C.notify("Pausa excluída sem acrescentar tempo estudado.");
}
function clearPauses(id){
 const {r}=editableRecord(id);
 if(!window.confirm("Zerar todas as pausas e seus motivos? Isso não altera o tempo estudado."))return;
 snapshotUndo([id]);
 r.pauseMs=0;r.pauses=[];r.corrections=(r.corrections||[]).filter(e=>!["pause_edited","pause_deleted"].includes(e.type));noteEdit(r,"pauses_cleared",{});
 persist();C.closeModal();C.render();C.notify("Histórico de pausas zerado; estudo preservado.");
}
function choicesFor(id){
 const x=session(id);
 return (T.model.sessions||[]).filter(y=>y.id!==id&&!y.archived&&y.date===x?.date&&!record(y.id)&&y.status!=="done"&&y.actualMin==null&&!V?.isClosed?.(y.date));
}
function moveModal(id,split=false){
 const {r,x}=editableRecord(id);
 const options=choicesFor(id);
 if(!options.length)throw Error("Não há outra sessão aberta e sem registro de tempo nesta data.");
 const studied=studyMs(r),max=Math.floor(studied/60000)-1;
 if(split&&max<1)throw Error("São necessários pelo menos dois minutos de estudo para dividir entre sessões.");
 const title=split?"Dividir tempo entre sessões":"Transferir cronometragem";
 C.openModal(title,'<form id="s7-move-record" class="section-stack"><input type="hidden" name="id" value="'+A(id)+'"><input type="hidden" name="operation" value="'+(split?"split":"transfer")+'">'+
 '<p class="note">'+E(x.discipline)+' · '+E(duration(studied))+' estudados. Escolha outra sessão do mesmo dia, sem tempo registrado. A conclusão das matérias não será alterada automaticamente.</p>'+
 '<div class="field"><label>Sessão de destino</label><select name="target" required>'+options.map(y=>'<option value="'+A(y.id)+'">'+E(y.discipline||"Estudo")+' · '+E(y.kind||"Sessão")+'</option>').join("")+'</select></div>'+
 (split?'<div class="field"><label>Minutos de estudo transferidos</label><input name="minutes" type="number" min="1" max="'+max+'" step="1" required value="'+Math.max(1,Math.floor(max/2))+'"></div><p class="note">As pausas ficam na sessão original; só o tempo estudado é dividido.</p>':'<p class="note">Todas as pausas e correções acompanham o registro transferido.</p>')+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-s7="manage" data-id="'+A(id)+'">Voltar</button><button type="submit" class="btn primary">'+(split?"Dividir":"Transferir")+'</button></div></form>');
}
function moveRecord(id,targetId,split,minutes=0){
 const {r,x}=editableRecord(id),target=choicesFor(id).find(y=>y.id===targetId);
 if(!target)throw Error("Selecione uma sessão válida na mesma data e sem tempo registrado.");
 const amount=Math.round(minutes*60000);
 if(split&&(!Number.isInteger(minutes)||minutes<1||amount>=r.studyMs-1000))throw Error("A divisão precisa deixar tempo positivo na sessão original.");
 if(!window.confirm(split?"Dividir o tempo estudado entre as duas sessões, sem duplicar pausas?":"Transferir o registro completo para a outra sessão?"))return;
 snapshotUndo([id,targetId]);
 if(split){
  r.studyMs-=amount;updateActual(x,r);
  timing.records[targetId]={sessionId:targetId,startedAt:r.startedAt,finishedAt:new Date().toISOString(),studyMs:amount,pauseMs:0,pauses:[],corrections:[{type:"split_from",sourceId:id,registeredAt:clock()}],mode:r.mode,goalMin:target.plannedMin||settings().goalMin,goalNotified:false,lastBlockAlert:0,status:"partial"};
  updateActual(target,timing.records[targetId]);
  noteEdit(r,"time_split",{to:targetId,studyMs:amount});
 }else{
  const matched=trackTimeMatches(x,r);
  delete timing.records[id];r.sessionId=targetId;r.status="partial";
  noteEdit(r,"transferred",{from:id,to:targetId});
  timing.records[targetId]=r;
  if(matched)x.actualMin=null;
  updateActual(target,r);
 }
 persist();C.closeModal();C.render();C.notify(split?"Tempo dividido sem duplicação.":"Cronometragem transferida para a outra sessão.");
}
function manageModal(id){
 const x=session(id),r=record(id);
 if(!x||V?.isClosed?.(x.date))throw Error("Sessão inexistente ou dia finalizado.");
 const undoButton=lastUndoAvailable(id)?'<button class="btn small" data-s7="undo">↶ Desfazer última alteração</button>':"";
 if(!r){
  if(!undoButton)throw Error("Esta sessão não possui cronometragem.");
  return C.openModal("Gerenciar cronometragem",'<div class="section-stack"><p>O registro foi descartado.</p><div class="row">'+undoButton+'</div></div>');
 }
 const active=timing.active?.sessionId===id;
 const controls='<button class="btn small ghost" data-s7="editTotals" data-id="'+A(id)+'" '+(active?"disabled":"")+'>Editar tempos</button>'+
 '<button class="btn small ghost" data-s7="pauses" data-id="'+A(id)+'" '+(active?"disabled":"")+'>Gerenciar pausas</button>'+
 '<button class="btn small ghost" data-s7="transfer" data-id="'+A(id)+'" '+(active?"disabled":"")+'>Transferir para outra sessão</button>'+
 '<button class="btn small ghost" data-s7="split" data-id="'+A(id)+'" '+(active?"disabled":"")+'>Dividir tempo entre sessões</button>'+
 (active&&timing.active.phase==="paused"?'<button class="btn small ghost" data-s7="cancelAccidentalPause">Desfazer pausa acidental</button><button class="btn small ghost" data-s7="resetCurrentPause">Zerar apenas a pausa atual</button>':"")+
 '<button class="btn small ghost" data-s7="reset" data-id="'+A(id)+'">Zerar cronometragem</button>'+
 '<button class="btn small danger" data-s7="discard" data-id="'+A(id)+'">Descartar cronometragem</button>';
 C.openModal("Gerenciar cronometragem",'<div class="section-stack"><p class="note">'+E(x.discipline)+' · estudo '+E(duration(studyMs(r)))+' · pausas '+E(duration(pauseMs(r)))+'</p>'+
 (active?'<p class="note">Para editar o histórico, encerre primeiro como parcial. Zerar e descartar estão disponíveis durante a contagem.</p>':"")+
 '<div class="s7-menu-actions">'+controls+'</div>'+undoButton+
 '<p class="note">O planejamento e a conclusão não são excluídos ao apagar tempos. Os dias finalizados permanecem protegidos.</p></div>');
}

function metrics(filter){
 const entries=Object.values(timing.records).filter(r=>{
  const x=session(r.sessionId);return x&&(!filter||(!filter.from||x.date>=filter.from)&&(!filter.to||x.date<=filter.to));
 });
 const study=entries.reduce((n,r)=>n+studyMs(r),0),paused=entries.reduce((n,r)=>n+pauseMs(r),0);
 const prep=entries.reduce((n,r)=>n+(r.pauses||[]).filter(p=>p.kind==="preparation").reduce((v,p)=>v+Math.max(0,(p.endedAt||((timing.active?.sessionId===r.sessionId&&timing.active?.phase==="paused")?clock():p.startedAt))-p.startedAt),0),0);
 return {count:entries.length,studyMs:study,pauseMs:paused,preparationMs:prep,ratio:study+paused?Math.round(100*study/(study+paused)):null};
}
function ring(){
 const a=timing.active,r=activeRecord();
 if(!a||!r)return "";
 const goal=Math.max(1,Number(r.goalMin)||90)*60000;
 const studied=studyMs(r),paused=pauseMs(r),percent=Math.min(100,Math.max(0,studied/goal*100));
 const stateLabel=a.phase==="paused"?"Pausado":"Em estudo";
 const subtitle=a.phase==="paused"?"Contagem de estudo interrompida.":"Tempo efetivo em andamento.";
 return '<section class="card s7-timer '+(a.phase==="paused"?"s7-paused":"s7-running")+'"><div class="s7-head"><div><div class="overline">CRONÔMETRO DA SESSÃO</div><h2>'+E(stateLabel)+'</h2><p>'+E(subtitle)+'</p></div><span class="status">'+E(session(a.sessionId)?.discipline||"Estudo")+'</span></div>'+
 '<div class="s7-main"><div class="s7-circle" id="s7-circle" style="--s7-progress:'+percent+'%"><div class="s7-circle-inner"><small>'+(a.phase==="paused"?"PAUSA ATUAL":"TEMPO RESTANTE")+'</small><strong data-s7-el="clock">'+fmtMs(a.phase==="paused"?clock()-a.since:Math.max(0,goal-studied))+'</strong><span>'+E(duration(studied))+' estudados · meta '+E(duration(goal))+'</span></div></div>'+
 '<div class="s7-controls"><div class="s7-quick"><span>Estudado: <strong data-s7-el="study">'+fmtMs(studied)+'</strong></span><span>Pausas: <strong data-s7-el="pause">'+fmtMs(paused)+'</strong></span>'+(Number(r.unaccountedMs)>0?'<span>Desconsiderado: <strong>'+fmtMs(r.unaccountedMs)+'</strong></span>':"")+'</div>'+(a.phase==="paused"&&r.pauses.at(-1)?.plannedMinutes?'<small class="note">Pausa programada · <span data-s7-el="pauseLeft">'+fmtMs(Math.max(0,r.pauses.at(-1).plannedMinutes*60000-(clock()-a.since)))+'</span> restantes'+(r.pauses.at(-1).reason?' · '+E(r.pauses.at(-1).reason):"")+'</small>':"")+
 (a.phase==="running"?'<button class="btn primary" data-s7="pause" data-kind="rest">Ⅱ Pausar estudo</button><button class="btn small ghost" data-s7="correct">Corrigir tempo do cronômetro</button>'+(lastUndoAvailable(a.sessionId)?'<button class="btn small ghost" data-s7="undo">↶ Desfazer última correção</button>':"")+'<button class="btn ghost" data-s7="pause" data-kind="preparation">Preparar flashcards</button><button class="btn small ghost" data-s7="timedPause">◷ Pausa com timer</button>'+(r.mode!=="continuous"?'<button class="btn ghost" data-s7="pause" data-kind="scheduled">Pausa programada</button>':""):
 '<button class="btn primary" data-s7="resume">▶ Retomar estudo</button><div class="field"><label>Motivo da pausa</label><select id="s7-current-kind"><option value="rest" '+(r.pauses.at(-1)?.kind==="rest"?"selected":"")+'>Descanso</option><option value="preparation" '+(r.pauses.at(-1)?.kind==="preparation"?"selected":"")+'>Preparação de material / flashcards</option><option value="scheduled" '+(r.pauses.at(-1)?.kind==="scheduled"?"selected":"")+'>Pausa programada</option><option value="other" '+(r.pauses.at(-1)?.kind==="other"?"selected":"")+'>Interrupção</option></select></div>')+
 '<button class="btn ghost small" data-s7="correct">Corrigir tempo do cronômetro</button>'+(lastUndoAvailable(a.sessionId)?'<button class="btn small ghost" data-s7="undo">↶ Desfazer última correção</button>':"")+'<div class="row"><button class="btn small ghost" data-s7="partial">Encerrar parcial</button><button class="btn small" data-s7="finish">Finalizar como concluído</button></div></div></div>'+
 (r.mode!=="continuous"?'<p class="note">Modo '+E(r.mode==="pomodoro"?"Pomodoro":"personalizado")+' · Blocos sugeridos de '+E(String(r.mode==="pomodoro"?25:settings().blockMin))+' min e descanso de '+E(String(r.mode==="pomodoro"?5:settings().restMin))+' min. Pausas programadas não são penalizadas.</p>':"")+
 '<p class="note">O estudo e as pausas podem ser corrigidos em minutos e segundos. Tempo desconsiderado não conta como estudo.</p></section>';
}
function homeButtons(id){
 const x=session(id);
 if(!x||x.status==="done"||V?.isClosed?.(x.date)||x.date!==C.today())return "";
 if(timing.active?.sessionId===id)return '<span class="s7-inline-state '+(timing.active.phase==="paused"?"s7-muted":"")+'">'+(timing.active.phase==="paused"?"Ⅱ PAUSADO":"● EM ESTUDO")+'</span>';
 return '<button class="btn small ghost" data-s7="start" data-id="'+A(id)+'" '+(timing.active?"disabled title=\"Outra sessão ativa\"":"")+'>◷ Cronometrar</button>';
}
function historyHtml(){
 const rows=Object.values(timing.records).map(r=>({r,x:session(r.sessionId)})).filter(row=>row.x)
  .sort((a,b)=>(b.x.date||"").localeCompare(a.x.date||"")||(b.r.startedAt||"").localeCompare(a.r.startedAt||"")).slice(0,10);
 if(!rows.length)return '<p class="note">Ainda não há sessões cronometradas.</p>';
 return '<div class="s7-history"><strong>Histórico recente das sessões</strong>'+
 rows.map(({r,x})=>{
  const prep=(r.pauses||[]).filter(p=>p.kind==="preparation").reduce((n,p)=>n+Math.max(0,(p.endedAt||(timing.active?.sessionId===r.sessionId&&timing.active.phase==="paused"?clock():p.startedAt))-p.startedAt),0);
  return '<div class="s7-history-row"><div><strong>'+E(x.discipline||"Estudo")+'</strong><small>'+E(x.date||"")+' · '+E(x.status==="done"?"Concluída":"Parcial/em andamento")+'</small></div>'+
   '<div><span>Estudo '+E(duration(studyMs(r)))+'</span><span>Pausado '+E(duration(pauseMs(r)))+'</span>'+(Number(r.unaccountedMs)>0?'<span>Desconsiderado '+E(duration(r.unaccountedMs))+'</span>':"")+'<small>Preparação '+E(duration(prep))+' · '+(r.pauses||[]).length+' pausa(s) registradas</small></div></div>';
 }).join("")+'</div>';
}

function removeDeletedSession(id){
 if(timing.active?.sessionId===id)throw Error("Encerre ou descarte o cronômetro antes de excluir a sessão.");
 if(record(id)){delete timing.records[id];lastUndo=null;}
 if(timing.alarm?.sessionId===id)dismissAlarm();
}
function sessionMenu(id){
 const x=session(id),r=record(id);
 const mayUndo=lastUndoAvailable(id);
 if(!x||(!r&&!mayUndo)||V?.isClosed?.(x.date))return "";
 return '<button class="btn small ghost s7-manage-trigger" aria-label="Gerenciar cronometragem" title="Gerenciar cronometragem" data-s7="manage" data-id="'+A(id)+'">⋯</button>';
}

function decorate(route,html){
 if(route==="inicio"){
  html=html.replace(/(<button class="btn small [^"]*" data-s3="quickDone" data-id="([^"]+)")/g,(full,head,id)=>homeButtons(id)+head);
  // Menu de ações contextual, sem controles espalhados na página.
  html=html.replace(/(<button class="btn small ghost" data-s3="recordSession" data-id="([^"]+)">Registrar<\/button>)/g,(whole,button,id)=>button+sessionMenu(id));
  // Cronômetro dentro do próprio quadro de estudos (nunca no topo global).
  if(timing.active&&session(timing.active.sessionId)?.date===C.state.date){
   const marker='<div class="study-daily-summary">';
   const pos=html.indexOf(marker),end=pos>=0?html.indexOf("</div>",pos+marker.length):-1;
   if(end>=0)html=html.slice(0,end+6)+ring()+html.slice(end+6);
  }
  return html;
 }
 if(route==="estudos"||route==="evolucao"||route==="perfil"){
  const m=metrics(),week=metrics({from:C.addDays(C.today(),-6),to:C.today()}),ratio=m.ratio===null?"—":m.ratio+"%";
  return html+'<section class="card s7-stats"><div class="card-head"><h2>Tempo de concentração e pausas</h2><span class="note">Registros do cronômetro</span></div><div class="s7-stat-grid"><div><small>Estudo efetivo</small><strong>'+E(duration(m.studyMs))+'</strong></div><div><small>Tempo pausado</small><strong>'+E(duration(m.pauseMs))+'</strong></div><div><small>Preparação de material</small><strong>'+E(duration(m.preparationMs))+'</strong></div><div><small>Parcela em estudo</small><strong>'+E(ratio)+'</strong></div></div><p class="note">A quantidade de pausas, isoladamente, não indica baixa produtividade. O orientador considera duração e contexto; tempo de estudo não prova aprendizagem.</p><p class="note">Últimos 7 dias: '+E(duration(week.studyMs))+' estudados e '+E(duration(week.pauseMs))+' em pausas.</p>'+historyHtml()+'</section>';
 }
 if(route==="configuracoes")return html+settingsPanel();
 return html;
}
function option(value,label,selected){return '<option value="'+A(value)+'" '+(selected===value?"selected":"")+'>'+E(label)+'</option>';}
function soundOptions(value){return option("orbita","Alarme Órbita · som incluído",value)+option("bell","Sino de conclusão",value)+option("digital","Alarme digital",value)+option("soft","Aviso suave",value)+option("custom","Meu áudio",value)+option("none","Silencioso",value);}

function s7Switch(id,enabled,title){
 return '<label class="s7-switch" for="'+A(id)+'"><input id="'+A(id)+'" type="checkbox" aria-label="'+A(title)+'" '+(enabled?"checked":"")+'><span class="s7-switch-track" aria-hidden="true"></span></label>';
}
function s7SettingRow(title,control,hint="",extra=""){
 return '<div class="setting-row s7-setting-row '+extra+'"><div class="s7-setting-copy"><strong>'+E(title)+'</strong>'+(hint?'<small>'+E(hint)+'</small>':"")+'</div><div class="s7-setting-control">'+control+'</div></div>';
}
function s7AudioPicker(which,name){
 const id="s7-upload-"+which,saveName=settings()[which==="finish"?"finishUploadName":"pauseUploadName"];
 return '<div class="s7-audio-picker"><input class="s7-file-input" id="'+id+'" type="file" aria-label="Escolher '+A(name)+'" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac">'+
 '<label class="s7-file-action" for="'+id+'"><span aria-hidden="true">＋</span> Escolher áudio</label>'+
 '<span class="s7-file-status" role="status" id="s7-upload-status-'+which+'">'+E(saveName||"Nenhum arquivo enviado")+'</span></div>';
}
function settingsPanel(){
 const q=settings(),number=(id,value,min,max,suffix)=>'<div class="s7-numeric"><input id="s7-setting-'+id+'" type="number" inputmode="numeric" min="'+min+'" max="'+max+'" value="'+Number(value)+'" aria-label="'+A(id)+'">'+(suffix?'<span>'+E(suffix)+'</span>':"")+'</div>';
 return '<section class="card s7-settings" aria-label="Preferências do cronômetro">'+
 '<div class="card-head"><div><h2>Cronômetro e alarmes</h2><p class="s7-settings-intro">Ajuste o ritmo de estudo e os avisos.</p></div></div>'+
 '<div class="s7-settings-grid">'+
 '<section class="s7-setting-group" aria-labelledby="s7-study-heading">'+
 '<header class="s7-group-head"><span class="s7-group-icon" aria-hidden="true">◷</span><div><h3 id="s7-study-heading">Ritmo de estudo</h3><p>Contagem e intervalos</p></div></header>'+
 s7SettingRow("Método",'<select id="s7-setting-mode" aria-label="Método de estudo">'+option("continuous","Contínuo",q.mode)+option("pomodoro","Pomodoro (25/5)",q.mode)+option("custom","Personalizado",q.mode)+'</select>')+
 s7SettingRow("Meta padrão",number("goalMin",q.goalMin,1,720,"min"))+
 s7SettingRow("Bloco personalizado",number("blockMin",q.blockMin,1,180,"min"))+
 s7SettingRow("Descanso personalizado",number("restMin",q.restMin,1,90,"min"))+
 s7SettingRow("Avisar pausa prolongada",number("pauseMinutes",q.pauseMinutes,0,240,"min"),"0 para desativar")+
 s7SettingRow("Verificar possível esquecimento",'<select id="s7-setting-inactivityWarningMinutes" aria-label="Aviso de possível esquecimento">'+[["0","Desativado"],["30","30 minutos"],["60","1 hora (padrão)"],["120","2 horas"]].map(([v,t])=>option(v,t,String(q.inactivityWarningMinutes))).join("")+'</select>',"Aviso discreto: não pausa nem encerra o estudo")+
 s7SettingRow("Repetir lembrete",s7Switch("s7-setting-repeatPause",q.repeatPause,"Repetir lembrete de pausa"))+
 '</section>'+
 '<section class="s7-setting-group" aria-labelledby="s7-sound-heading">'+
 '<header class="s7-group-head"><span class="s7-group-icon" aria-hidden="true">♫</span><div><h3 id="s7-sound-heading">Sons e efeitos</h3><p>Escolha como será avisado</p></div></header>'+
 s7SettingRow("Som de conclusão",'<select id="s7-setting-finishSound" aria-label="Som de conclusão">'+soundOptions(q.finishSound)+'</select>')+
 s7SettingRow("Som de pausa",'<select id="s7-setting-pauseSound" aria-label="Som de pausa">'+soundOptions(q.pauseSound)+'</select>')+
 s7SettingRow("Repetir som de conclusão",s7Switch("s7-setting-loopFinish",q.loopFinish,"Repetir som de conclusão"))+
 s7SettingRow("Repetir som de pausa",s7Switch("s7-setting-loopPause",q.loopPause,"Repetir som de pausa"))+
 s7SettingRow("Desligar som por inatividade",'<select id="s7-setting-alarmIdleMinutes" aria-label="Tempo até desligar alarme">'+[["0","Não desligar automaticamente"],["5","5 minutos"],["10","10 minutos"],["15","15 minutos (padrão)"],["30","30 minutos"]].map(([v,t])=>option(v,t,String(q.alarmIdleMinutes))).join("")+'</select>',"O som é silenciado; a sessão e a pausa continuam")+
 s7SettingRow("Áudio próprio · conclusão",s7AudioPicker("finish","áudio de conclusão"),"Recorte e compressão automáticos","s7-setting-row-file")+
 s7SettingRow("Áudio próprio · pausa",s7AudioPicker("pause","áudio de pausa"),"Até 5 segundos de áudio salvo","s7-setting-row-file")+
 s7SettingRow("Volume",'<div class="s7-volume"><span aria-hidden="true">♪</span><input id="s7-setting-volume" aria-label="Volume do alarme" type="range" min="0" max="100" value="'+Number(q.volume)+'"></div>')+
 s7SettingRow("Efeito visual ao concluir",s7Switch("s7-setting-visual",q.visual,"Efeito visual ao concluir"))+
 '</section>'+
 '<section class="s7-setting-group s7-setting-group-wide" aria-labelledby="s7-notification-heading">'+
 '<header class="s7-group-head"><span class="s7-group-icon" aria-hidden="true">◎</span><div><h3 id="s7-notification-heading">Notificações</h3><p>Windows, Android e avisos no Órbita</p></div></header>'+
 '<div class="s7-notification-grid">'+
 s7SettingRow("Notificações do dispositivo",'<button type="button" class="btn small '+(q.desktopNotifications?"ghost":"primary")+'" data-s7="notification">'+(q.desktopNotifications?"Desativar":"Ativar notificações")+'</button>',"Requer permissão do navegador")+
 s7SettingRow("Testar alarmes",'<div class="s7-test-actions"><button type="button" class="btn small ghost" data-s7="testNotification">Testar conclusão</button><button type="button" class="btn small ghost" data-s7="testPauseNotification">Testar pausa</button></div>')+
 '</div></section>'+
 '</div></section>';
}
function tick(){
 autoSilenceAlarm();
 const a=timing.active,r=activeRecord();
 if(!a||!r){updateTabIndicator();return;}
 const x=session(a.sessionId),studied=studyMs(r),paused=pauseMs(r),goal=Math.max(1,Number(r.goalMin)||90)*60000;
 updateTabIndicator();
 const el=$('s7-circle');
 if(el)el.style.setProperty("--s7-progress",Math.min(100,studied/goal*100)+"%");
 const clockEl=document.querySelector('[data-s7-el="clock"]');
 if(clockEl)clockEl.textContent=fmtMs(a.phase==="paused"?clock()-a.since:Math.max(0,goal-studied));
 const sEl=document.querySelector('[data-s7-el="study"]'),pEl=document.querySelector('[data-s7-el="pause"]');
 if(sEl)sEl.textContent=fmtMs(studied);
 if(pEl)pEl.textContent=fmtMs(paused);
 const pauseLeft=document.querySelector('[data-s7-el="pauseLeft"]'),currentPause=r.pauses.at(-1);
 if(pauseLeft&&a.phase==="paused"&&currentPause?.plannedMinutes)pauseLeft.textContent=fmtMs(Math.max(0,currentPause.plannedMinutes*60000-(clock()-a.since)));
 if(!r.goalNotified&&studied>=goal){r.goalNotified=true;persist();alertUser("Você alcançou a meta de estudo. Pode continuar ou finalizar a sessão.","finish");}
 if(a.phase==="running"&&!inactivityPrompt&&Number(settings().inactivityWarningMinutes)>0&&clock()-activityAt>=Number(settings().inactivityWarningMinutes)*60000){
  inactivityPrompt=true;C.notify("O cronômetro continua estudando. Se esqueceu de pausar, use Corrigir tempo do cronômetro. Nenhum tempo foi alterado.");
 }
 if(a.phase==="running"&&!r.overtimeWarned&&studied>=goal+120*60000){r.overtimeWarned=true;persist();C.notify("O cronômetro está ativo há muito tempo. Se esqueceu de pausar, utilize Corrigir horário.");}
 if(a.phase==="paused"){
  const pp=r.pauses.at(-1);
  const threshold=Number(settings().pauseMinutes)*60000;
  if(threshold>0&&!pp?.plannedMinutes){
   const n=Math.floor(Math.max(0,clock()-a.since)/threshold);
   if(n>=1&&n>a.alertIndex&&(settings().repeatPause||a.alertIndex===0)){
    a.alertIndex=n;persist();alertUser("O estudo continua pausado. Se você já retomou, corrija o horário no cronômetro.","pause");
   }
  }
  const restThreshold=pp?.plannedMinutes|| (r.mode==="pomodoro"?5:r.mode==="custom"?Number(settings().restMin):0);
  if(pp?.kind==="scheduled"&&restThreshold>0&&!pp.restNotified&&clock()-a.since>=restThreshold*60000){
   pp.restNotified=true;persist();alertUser(pp.plannedMinutes?"Sua pausa de "+pp.plannedMinutes+" minuto(s) terminou. Retome quando estiver pronto.":"Sua pausa programada terminou. Retome quando estiver pronto.","pause");
  }
 }else if(r.mode!=="continuous"){
  const step=(r.mode==="pomodoro"?25:Number(settings().blockMin))*60000;
  const blocks=step>0?Math.floor(studied/step):0;
  if(blocks>r.lastBlockAlert&&studied<goal){r.lastBlockAlert=blocks;persist();alertUser("Bloco de concentração concluído. Você pode fazer uma pausa programada.","block");}
 }
}
// Compactação local. WAV PCM mono 11.025 kHz/16 bits; até 5 segundos ≈ 108 KB.
function compactWav(decoded){
 const rate=11025,seconds=Math.min(5,decoded.duration);
 if(!Number.isFinite(seconds)||seconds<=0||!decoded.numberOfChannels||!decoded.length)throw Error("Não foi possível encontrar áudio válido neste arquivo.");
 const count=Math.max(1,Math.min(rate*5,Math.floor(seconds*rate)));
 const bytes=new Uint8Array(44+count*2),view=new DataView(bytes.buffer);
 const ascii=(at,word)=>{for(let i=0;i<word.length;i++)view.setUint8(at+i,word.charCodeAt(i));};
 ascii(0,"RIFF");view.setUint32(4,bytes.length-8,true);ascii(8,"WAVE");ascii(12,"fmt ");
 view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
 view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);
 view.setUint16(34,16,true);ascii(36,"data");view.setUint32(40,count*2,true);
 const channels=Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i));
 for(let i=0;i<count;i++){
  const at=Math.min(decoded.length-1,i*decoded.sampleRate/rate),left=Math.floor(at),right=Math.min(decoded.length-1,left+1),fraction=at-left;
  let v=0;for(const ch of channels)v+=ch[left]*(1-fraction)+ch[right]*fraction;
  v=Math.max(-1,Math.min(1,v/channels.length));
  const t=i/rate,duration=count/rate,fade=Math.min(1,t/.006,Math.max(0,(duration-t)/.045));
  view.setInt16(44+i*2,Math.round(v*fade*32767),true);
 }
 let binary="";
 for(let i=0;i<bytes.length;i+=4096)binary+=String.fromCharCode(...bytes.subarray(i,i+4096));
 return {value:"data:audio/wav;base64,"+btoa(binary),bytes:bytes.length,seconds:count/rate};
}
async function upload(which,file){
 if(!file)return;
 if(uploadBusy[which])throw Error("Já existe um áudio sendo processado para este aviso.");
 if(file.size===0||file.size>40*1024*1024)throw Error("Selecione um áudio de até 40 MB. O Órbita irá reduzi-lo automaticamente.");
 if(file.type&&!file.type.startsWith("audio/")&&!/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name))throw Error("Selecione um arquivo de áudio válido.");
 const AC=window.AudioContext||window.webkitAudioContext;
 if(!AC)throw Error("Este navegador não oferece compactação de áudio.");
 uploadBusy[which]=true;
 const status=$("s7-upload-status-"+which);
 if(status)status.textContent="Preparando áudio...";
 try{
  audioContext=audioContext||new AC();
  const buffer=await file.arrayBuffer();
  let decoded;
  try{decoded=await audioContext.decodeAudioData(buffer);}catch{throw Error("Não foi possível decodificar este áudio. Tente MP3 ou WAV.");}
  const result=compactWav(decoded);
  if(result.bytes>120*1024||result.value.length>170000)throw Error("O áudio não coube no limite de armazenamento.");
  const q=settings(),prefix=which==="finish"?"finish":"pause",name=String(file.name||"Áudio personalizado").slice(0,100);
  const keys=[prefix+"Upload",prefix+"Sound",prefix+"UploadName",prefix+"UploadSeconds",prefix+"UploadBytes"];
  const prior=Object.fromEntries(keys.map(key=>[key,q[key]]));
  q[prefix+"Upload"]=result.value;q[prefix+"Sound"]="custom";
  q[prefix+"UploadName"]=name;q[prefix+"UploadSeconds"]=Number(result.seconds.toFixed(1));q[prefix+"UploadBytes"]=result.bytes;
  if(C.save()===false){for(const key of keys){if(prior[key]===undefined)delete q[key];else q[key]=prior[key];}throw Error("Não foi possível salvar. Verifique o armazenamento do navegador.");}
  C.render();
  C.notify('Áudio "'+name+'" salvo. '+result.seconds.toFixed(1)+' s · '+Math.round(result.bytes/1024)+' KB.');
 }finally{
  uploadBusy[which]=false;
  const current=$("s7-upload-status-"+which);
  if(current&&current.textContent==="Preparando áudio...")current.textContent="Selecione outro arquivo para tentar novamente.";
 }
}
const numeric={goalMin:[1,720],blockMin:[1,180],restMin:[1,90],pauseMinutes:[0,240],volume:[0,100],alarmIdleMinutes:[0,30],inactivityWarningMinutes:[0,120]};
const strings={mode:["continuous","pomodoro","custom"],finishSound:["orbita","bell","digital","soft","custom","none"],pauseSound:["orbita","bell","digital","soft","custom","none"]};
// Evita dupla contabilização se a pessoa tentar concluir/registrar a sessão com o timer ainda aberto.
document.addEventListener("click",e=>{
 const b=e.target.closest?.('[data-s3="quickDone"],[data-s3="recordSession"]');
 if(!b||!timing.active||b.dataset.id!==timing.active.sessionId)return;
 e.preventDefault();e.stopImmediatePropagation();
 C.notify("Encerre o cronômetro para registrar ou concluir esta sessão.");
},true);
document.addEventListener("click",e=>{
 const b=e.target.closest?.("[data-s7]");if(!b)return;
 e.preventDefault();
 try{
  const act=b.dataset.s7;
  if(act==="start")start(b.dataset.id);
  else if(act==="timedPause")timedPauseModal();
  else if(act==="pause")pause(b.dataset.kind||"rest");
  else if(act==="resume")resume();
  else if(act==="finish")askFinish(true);
  else if(act==="partial")askFinish(false);
  else if(act==="correct")correctModal();
  else if(act==="manage")manageModal(b.dataset.id);
  else if(act==="editTotals")editTotalsModal(b.dataset.id);
  else if(act==="pauses")pausesModal(b.dataset.id);
  else if(act==="editPause")editPauseModal(b.dataset.id,Number(b.dataset.index));
  else if(act==="deletePause")deletePause(b.dataset.id,Number(b.dataset.index));
  else if(act==="clearPauses")clearPauses(b.dataset.id);
  else if(act==="reset")resetTimer(b.dataset.id);
  else if(act==="discard")discardTimer(b.dataset.id);
  else if(act==="transfer")moveModal(b.dataset.id,false);
  else if(act==="split")moveModal(b.dataset.id,true);
  else if(act==="undo")undo();
  else if(act==="cancelAccidentalPause")cancelAccidentalPause();
  else if(act==="resetCurrentPause")resetCurrentPause();
  else if(act==="alarmSilence")silenceAlarm();
  else if(act==="alarmReplay")replayAlarm();
  else if(act==="alarmDismiss"||act==="alarmContinue")dismissAlarm();
  else if(act==="alarmResume"){if(timing.active?.phase==="paused")resume();else dismissAlarm();}
  else if(act==="alarmCorrect")correctModal();
  else if(act==="alarmFinish")askFinish(true);
  else if(act==="notification"){
   if(settings().desktopNotifications){settings().desktopNotifications=false;persist();C.render();C.notify("Notificações do dispositivo desativadas.");}
   else if(!window.Notification||!window.isSecureContext)C.notify("Notificações do dispositivo indisponíveis neste navegador.");
   else Promise.resolve(window.Notification.requestPermission()).then(p=>{
    settings().desktopNotifications=p==="granted";persist();C.render();
    C.notify(p==="granted"?"Notificações do dispositivo ativadas.":"Permissão não concedida. Verifique as configurações do navegador.");
   }).catch(()=>C.notify("Não foi possível solicitar permissão de notificações."));
  }
  else if(act==="testNotification")showDemoAlarm("test");
  else if(act==="testPauseNotification")showDemoAlarm("pause");
 }catch(err){C.notify(err.message||"Não foi possível controlar o cronômetro.");console.error(err);}
});
document.addEventListener("submit",e=>{
 // Um input name="id" pode sobrescrever form.id como propriedade nomeada do DOM.
 const id=e.target?.getAttribute?.("id")||e.target?.id;
 if(!["s7-correction-form","s7-correct-rest","s7-reallocate-form","s7-correct-totals","s7-timed-pause-form","s7-edit-totals","s7-edit-pause","s7-move-record"].includes(id))return;
 e.preventDefault();
 const data=new FormData(e.target);
 try{
  if(id==="s7-correction-form")correction(new Date(data.get("moment")).getTime());
  else if(id==="s7-correct-rest")correctRestMinutes(data.get("minutes"),data.get("seconds"));
  else if(id==="s7-reallocate-form")reallocateCurrent(data.get("studyMin"),data.get("studySec"),data.get("restMin"),data.get("restSec"),String(data.get("nextPhase")||"running"));
  else if(id==="s7-correct-totals")correctSessionTotals(data.get("studyMinutes"),data.get("restMinutes"),String(data.get("nextPhase")||"running"));
   else if(id==="s7-timed-pause-form")startTimedPause(data.get("minutes"),data.get("reason"));
  else if(id==="s7-edit-totals")editTotals(String(data.get("id")),Number(data.get("study")),Number(data.get("paused")),String(data.get("reason")||""));
  else if(id==="s7-edit-pause")editPause(String(data.get("id")),Number(data.get("index")),new Date(data.get("start")).getTime(),new Date(data.get("end")).getTime(),String(data.get("kind")));
  else if(id==="s7-move-record")moveRecord(String(data.get("id")),String(data.get("target")),data.get("operation")==="split",Number(data.get("minutes")));
 }catch(err){C.notify(err.message||"Confira os valores informados.");}
});
document.addEventListener("input",e=>{if(e.target?.closest?.("#s7-correct-totals"))updateTotalsPreview(e.target.closest("#s7-correct-totals"));});
for(const type of ["pointerdown","keydown","touchstart"]){document.addEventListener(type,noteActivity,{passive:true});}
document.addEventListener("change",e=>{
 const el=e.target;if(!el)return;
 if(el.id==="s7-current-kind"){changePause(el.value);return;}
 if(el.id==="s7-upload-finish"||el.id==="s7-upload-pause"){
  const which=el.id==="s7-upload-finish"?"finish":"pause",file=el.files?.[0];
  el.value=""; // Permite selecionar o mesmo arquivo várias vezes.
  if(file)upload(which,file).catch(err=>{C.notify(err.message);const status=$("s7-upload-status-"+which);if(status)status.textContent=err.message;});
  return;
 }
 if(!el.id?.startsWith("s7-setting-"))return;
 const key=el.id.slice("s7-setting-".length);
 if(key in numeric){
  const n=Number(el.value),[min,max]=numeric[key];
  if(!Number.isFinite(n)||n<min||n>max)return C.notify("Valor inválido.");
  if(key==="alarmIdleMinutes"&&![0,5,10,15,30].includes(n)||key==="inactivityWarningMinutes"&&![0,30,60,120].includes(n))return C.notify("Escolha um dos intervalos disponíveis.");
  settings()[key]=n;
  if(key==="alarmIdleMinutes"){if(!autoSilenceAlarm())scheduleAlarmTimeout();}
  if(key==="inactivityWarningMinutes")inactivityPrompt=false;
 }else if(key in strings){
  if(!strings[key].includes(el.value))return;
  settings()[key]=el.value;
 }else if(["visual","repeatPause","loopFinish","loopPause"].includes(key))settings()[key]=el.checked;
 else return;
 persist();C.render();
});
document.addEventListener("visibilitychange",()=>{tick();});
window.addEventListener("focus",tick);
setInterval(tick,1000);
window.OrbitaStage7={decorate,inspect:{get model(){return timing},tick,alertUser,silenceAlarm,dismissAlarm,replayAlarm,renderAlarm,showDemoAlarm,compactWav,upload,metrics,studyMs,pauseMs,start,pause,resume,correction,correctRestMinutes,reallocateCurrent,correctSessionTotals,correctModal,autoSilenceAlarm,noteActivity,finish,resetTimer,discardTimer,cancelAccidentalPause,resetCurrentPause,syncManualRecord,removeDeletedSession,get activeSessionId(){return timing.active?.sessionId||null},editTotals,editPause,deletePause,clearPauses,moveRecord,undo,sessionMenu,hasActiveForDate:date=>timing.active&&session(timing.active.sessionId)?.date===date,fmtMs}};
C.render();renderAlarm();if(timing.alarm&&!timing.alarm.silenced&&!autoSilenceAlarm()){alarmSound(timing.alarm.which);scheduleAlarmTimeout();}tick();
})();