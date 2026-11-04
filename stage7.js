/* Órbita — cronômetro de sessões, pausas, alertas e histórico no mesmo documento sincronizado. */
(function(){
"use strict";
const C=window.OrbitaCore,T=window.OrbitaStage3?.inspect,V=window.OrbitaStage4?.inspect;
if(!C||!T)throw Error("Órbita: ciclos de estudo indisponíveis");
const root=C.state;
const timing=root.timing&&typeof root.timing==="object"?root.timing:(root.timing={});
if(!timing.records||typeof timing.records!=="object"||Array.isArray(timing.records))timing.records={};
if(!timing.settings||typeof timing.settings!=="object")timing.settings={};
const defaults={mode:"continuous",goalMin:90,blockMin:25,restMin:5,pauseMinutes:10,repeatPause:true,finishSound:"bell",pauseSound:"digital",volume:65,visual:true,desktopNotifications:false};
for(const [k,v] of Object.entries(defaults))if(timing.settings[k]===undefined)timing.settings[k]=v;
if(!timing.active||typeof timing.active!=="object")timing.active=null;
const E=C.esc,A=C.attr, $=id=>document.getElementById(id);
const clock=()=>Date.now();
const titleBase=document.title;
let audioContext=null,previousTitle="",flashTimeout=0,lastUndo=null;
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
function sound(which){
 const selected=settings()[which==="finish"?"finishSound":"pauseSound"];
 if(selected!=="none"){
  if(selected==="custom"){
   const data=settings()[which==="finish"?"finishUpload":"pauseUpload"];
   if(!data)return;
   try{const audio=new Audio(data);audio.volume=Number(settings().volume)/100;audio.play().catch(()=>{});}catch{}
  }else tone(selected);
 }
}
function visualAlert(){
 if(!settings().visual||C.state.settings?.motion===false||window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)return;
 document.body.classList.remove("s7-completion");
 void document.body.offsetWidth;
 document.body.classList.add("s7-completion");
 clearTimeout(flashTimeout);flashTimeout=setTimeout(()=>document.body.classList.remove("s7-completion"),2200);
}
function alertUser(message,which){
 C.notify(message);
 if(which==="finish")visualAlert();
 sound(which);
 if(settings().desktopNotifications&&document.hidden&&"Notification" in window&&Notification.permission==="granted"){
  try{new Notification("Órbita — "+(which==="finish"?"Meta alcançada":"Pausa prolongada"),{body:message,tag:"orbita-study-"+which});}catch{}
 }
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
 persist();C.render();tick();C.notify(done?"Sessão concluída e tempo registrado.":"Tempo parcial salvo; a etapa do ciclo não avançou.");
}
function correctModal(){
 const a=timing.active;if(!a)return;
 const inputTime=new Date(clock()-60000);
 const localIso=d=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
 const message=a.phase==="paused"?"Retomei o estudo antes de clicar no botão":"Parei de estudar antes de clicar em Pausar";
 C.openModal("Corrigir horário do cronômetro",'<form id="s7-correction-form" class="section-stack"><p class="note">'+E(message)+'. Informe quando a mudança realmente aconteceu. A correção fica registrada.</p><div class="field"><label>Horário verdadeiro</label><input name="moment" type="datetime-local" required min="'+A(localIso(new Date(a.since)))+'" max="'+A(localIso(new Date()))+'" value="'+A(localIso(inputTime.getTime()<a.since?new Date(a.since):inputTime))+'"></div><div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button type="submit" class="btn primary">Corrigir tempo</button></div></form>');
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
function resetTimer(id){
 const {x,r}=editableRecord(id,true);
 if(!window.confirm("Zerar todos os tempos e pausas desta cronometragem? A sessão planejada e a sua conclusão serão preservadas. Você poderá desfazer em até 60 segundos."))return;
 snapshotUndo([id]);
 if(trackTimeMatches(x,r))x.actualMin=null;
 const keptMode=r.mode,keptGoal=r.goalMin;
 timing.records[id]={sessionId:id,startedAt:new Date().toISOString(),studyMs:0,pauseMs:0,pauses:[],corrections:[],goalMin:keptGoal,mode:keptMode,lastBlockAlert:0,goalNotified:false,finishedAt:null,resetAt:new Date().toISOString()};
 if(timing.active?.sessionId===id)timing.active={sessionId:id,phase:"running",since:clock(),alertIndex:0};
 persist();C.closeModal();C.render();tick();C.notify("Cronômetro zerado. Use ⋯ para desfazer.");
}
function discardTimer(id){
 const {x,r}=editableRecord(id,true);
 if(!window.confirm("Descartar toda a cronometragem, incluindo pausas e correções? A sessão de estudo continuará cadastrada. A conclusão será preservada."))return;
 snapshotUndo([id]);
 if(trackTimeMatches(x,r))x.actualMin=null;
 delete timing.records[id];
 if(timing.active?.sessionId===id)timing.active=null;
 if(x.status==="progress"&&r.originalStatus==="pending"&&x.actualMin==null)T.setSessionStatus(x.id,"pending",null,x.actualTime||"");
 persist();C.closeModal();C.render();tick();C.notify("Cronometragem descartada. É possível desfazer pelo menu da sessão por 60 segundos.");
}
const pauseNames={rest:"Descanso",preparation:"Preparação de flashcards",scheduled:"Intervalo programado",other:"Interrupção"};
function pauseDuration(p){return Math.max(0,(Number(p.endedAt)||Number(p.startedAt))-Number(p.startedAt));}
function allPauseMs(r){return (r.pauses||[]).reduce((total,p)=>total+pauseDuration(p),0);}
function noteEdit(r,type,details){r.corrections||(r.corrections=[]);r.corrections.push({type,registeredAt:clock(),...details});}
function updateActual(x,r){x.actualMin=r.studyMs>0?Math.max(1,Math.round(r.studyMs/60000)):null;r.recordedActualMin=x.actualMin;}
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
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end||end>clock())throw Error("Informe horários válidos para início e fim.");
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
  delete timing.records[id];r.sessionId=targetId;
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
 '<div class="s7-controls"><div class="s7-quick"><span>Estudado: <strong data-s7-el="study">'+fmtMs(studied)+'</strong></span><span>Pausas: <strong data-s7-el="pause">'+fmtMs(paused)+'</strong></span></div>'+
 (a.phase==="running"?'<button class="btn primary" data-s7="pause" data-kind="rest">Ⅱ Pausar estudo</button><button class="btn ghost" data-s7="pause" data-kind="preparation">Preparar flashcards</button>'+(r.mode!=="continuous"?'<button class="btn ghost" data-s7="pause" data-kind="scheduled">Pausa programada</button>':""):
 '<button class="btn primary" data-s7="resume">▶ Retomar estudo</button><div class="field"><label>Motivo da pausa</label><select id="s7-current-kind"><option value="rest" '+(r.pauses.at(-1)?.kind==="rest"?"selected":"")+'>Descanso</option><option value="preparation" '+(r.pauses.at(-1)?.kind==="preparation"?"selected":"")+'>Preparação de material / flashcards</option><option value="scheduled" '+(r.pauses.at(-1)?.kind==="scheduled"?"selected":"")+'>Pausa programada</option><option value="other" '+(r.pauses.at(-1)?.kind==="other"?"selected":"")+'>Interrupção</option></select></div>')+
 '<button class="btn ghost small" data-s7="correct">Corrigir horário esquecido</button><div class="row"><button class="btn small ghost" data-s7="partial">Encerrar parcial</button><button class="btn small" data-s7="finish">Finalizar como concluído</button></div></div></div>'+
 (r.mode!=="continuous"?'<p class="note">Modo '+E(r.mode==="pomodoro"?"Pomodoro":"personalizado")+' · Blocos sugeridos de '+E(String(r.mode==="pomodoro"?25:settings().blockMin))+' min e descanso de '+E(String(r.mode==="pomodoro"?5:settings().restMin))+' min. Pausas programadas não são penalizadas.</p>':"")+
 '<p class="note">O estudo só é contado enquanto o cronômetro estiver ativo. Ajuste manualmente se esquecer de pausar ou retomar.</p></section>';
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
   '<div><span>Estudo '+E(duration(studyMs(r)))+'</span><span>Pausado '+E(duration(pauseMs(r)))+'</span><small>Preparação '+E(duration(prep))+' · '+(r.pauses||[]).length+' pausa(s) registradas</small></div></div>';
 }).join("")+'</div>';
}

function removeDeletedSession(id){
 if(timing.active?.sessionId===id)throw Error("Encerre ou descarte o cronômetro antes de excluir a sessão.");
 if(record(id)){delete timing.records[id];lastUndo=null;}
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
function soundOptions(value){return option("bell","Sino de conclusão",value)+option("digital","Alarme digital",value)+option("soft","Aviso suave",value)+option("custom","Áudio enviado pelo usuário",value)+option("none","Silencioso",value);}
function settingsPanel(){
 const q=settings();
 return '<section class="card s7-settings"><div class="card-head"><h2>◷ Cronômetro e notificações</h2><span class="note">Preferências salvas com a conta</span></div>'+
 '<div class="setting-row"><div><strong>Método de estudo</strong><small>Contínuo, Pomodoro ou blocos personalizados</small></div><select id="s7-setting-mode">'+option("continuous","Contínuo — pausas livres",q.mode)+option("pomodoro","Pomodoro (25/5)",q.mode)+option("custom","Blocos personalizados",q.mode)+'</select></div>'+
 '<div class="setting-row"><div><strong>Meta padrão</strong><small>Usada quando a sessão não tiver duração planejada</small></div><input id="s7-setting-goalMin" type="number" min="1" max="720" value="'+Number(q.goalMin)+'" aria-label="Meta padrão em minutos"></div>'+
 '<div class="setting-row"><div><strong>Bloco personalizado</strong><small>Minutos de estudo antes da sugestão de descanso</small></div><input id="s7-setting-blockMin" type="number" min="1" max="180" value="'+Number(q.blockMin)+'"></div>'+
 '<div class="setting-row"><div><strong>Descanso personalizado</strong><small>Minutos sugeridos na pausa programada</small></div><input id="s7-setting-restMin" type="number" min="1" max="90" value="'+Number(q.restMin)+'"></div>'+
 '<div class="setting-row"><div><strong>Lembrete de pausa prolongada</strong><small>Minutos antes do primeiro alerta (0 desativa)</small></div><input id="s7-setting-pauseMinutes" type="number" min="0" max="240" value="'+Number(q.pauseMinutes)+'"></div>'+
 '<div class="setting-row"><div><strong>Repetir lembrete de pausa</strong><small>Repete a cada intervalo configurado, enquanto estiver pausado</small></div><input id="s7-setting-repeatPause" type="checkbox" '+(q.repeatPause?"checked":"")+'></div>'+
 '<div class="setting-row"><div><strong>Som de conclusão</strong></div><select id="s7-setting-finishSound">'+soundOptions(q.finishSound)+'</select></div>'+
 '<div class="setting-row"><div><strong>Som de pausa prolongada</strong></div><select id="s7-setting-pauseSound">'+soundOptions(q.pauseSound)+'</select></div>'+
 '<div class="setting-row"><div><strong>Enviar som de conclusão</strong><small>MP3, OGG ou WAV; até 120 KB (sincronizado no documento)</small></div><input id="s7-upload-finish" type="file" accept="audio/mpeg,audio/ogg,audio/wav,audio/mp3"></div>'+
 '<div class="setting-row"><div><strong>Enviar som de lembrete</strong><small>MP3, OGG ou WAV; até 120 KB</small></div><input id="s7-upload-pause" type="file" accept="audio/mpeg,audio/ogg,audio/wav,audio/mp3"></div>'+
 '<div class="setting-row"><div><strong>Volume</strong></div><input id="s7-setting-volume" type="range" min="0" max="100" value="'+Number(q.volume)+'"></div>'+
 '<div class="setting-row"><div><strong>Brilho ao alcançar a meta</strong></div><input id="s7-setting-visual" type="checkbox" '+(q.visual?"checked":"")+'></div>'+
 '<div class="setting-row"><div><strong>Notificação do dispositivo</strong><small>Depende de permissão, navegador e sistema operacional</small></div><button class="btn small" data-s7="notification">Solicitar permissão</button></div>'+
 '<p class="note">Sons em segundo plano e com o navegador fechado não são garantidos pelo sistema operacional. Preferências são locais até a sincronização da conta.</p></section>';
}
function tick(){
 const a=timing.active,r=activeRecord();
 if(!a||!r){
  if(document.title!==titleBase&&document.title.startsWith("Ⅱ PAUSADO")||document.title.startsWith("● EM ESTUDO"))document.title=titleBase;
  return;
 }
 const x=session(a.sessionId),studied=studyMs(r),paused=pauseMs(r),goal=Math.max(1,Number(r.goalMin)||90)*60000;
 document.title=(a.phase==="paused"?"Ⅱ PAUSADO":"● EM ESTUDO")+" — Órbita";
 const el=$('s7-circle');
 if(el)el.style.setProperty("--s7-progress",Math.min(100,studied/goal*100)+"%");
 const clockEl=document.querySelector('[data-s7-el="clock"]');
 if(clockEl)clockEl.textContent=fmtMs(a.phase==="paused"?clock()-a.since:Math.max(0,goal-studied));
 const sEl=document.querySelector('[data-s7-el="study"]'),pEl=document.querySelector('[data-s7-el="pause"]');
 if(sEl)sEl.textContent=fmtMs(studied);
 if(pEl)pEl.textContent=fmtMs(paused);
 if(!r.goalNotified&&studied>=goal){r.goalNotified=true;persist();alertUser("Você alcançou a meta de estudo. Pode continuar ou finalizar a sessão.","finish");}
 if(a.phase==="running"&&!r.overtimeWarned&&studied>=goal+120*60000){r.overtimeWarned=true;persist();C.notify("O cronômetro está ativo há muito tempo. Se esqueceu de pausar, utilize Corrigir horário.");}
 if(a.phase==="paused"){
  const threshold=Number(settings().pauseMinutes)*60000;
  if(threshold>0){
   const n=Math.floor(Math.max(0,clock()-a.since)/threshold);
   if(n>=1&&n>a.alertIndex&&(settings().repeatPause||a.alertIndex===0)){
    a.alertIndex=n;persist();alertUser("O estudo continua pausado. Se você já retomou, corrija o horário no cronômetro.","pause");
   }
  }
  const pp=r.pauses.at(-1);
  const restThreshold=r.mode==="pomodoro"?5:r.mode==="custom"?Number(settings().restMin):0;
  if(pp?.kind==="scheduled"&&restThreshold>0&&!pp.restNotified&&clock()-a.since>=restThreshold*60000){
   pp.restNotified=true;persist();alertUser("Sua pausa programada terminou. Retome quando estiver pronto.","pause");
  }
 }else if(r.mode!=="continuous"){
  const step=(r.mode==="pomodoro"?25:Number(settings().blockMin))*60000;
  const blocks=step>0?Math.floor(studied/step):0;
  if(blocks>r.lastBlockAlert&&studied<goal){r.lastBlockAlert=blocks;persist();alertUser("Bloco de concentração concluído. Você pode fazer uma pausa programada.","finish");}
 }
}
async function upload(which,file){
 if(!file)return;
 if(file.size>120*1024||file.size===0||!["audio/mpeg","audio/ogg","audio/wav","audio/x-wav","audio/mp3"].includes(file.type))throw Error("Escolha MP3, OGG ou WAV com até 120 KB.");
 const reader=new FileReader();
 const value=await new Promise((resolve,reject)=>{reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error("Falha ao ler arquivo."));reader.readAsDataURL(file);});
 if(value.length>170000)throw Error("O áudio ultrapassa o tamanho aceito.");
 settings()[which==="finish"?"finishUpload":"pauseUpload"]=value;
 settings()[which==="finish"?"finishSound":"pauseSound"]="custom";
 persist();C.render();C.notify("Som salvo nas preferências.");
}
const numeric={goalMin:[1,720],blockMin:[1,180],restMin:[1,90],pauseMinutes:[0,240],volume:[0,100]};
const strings={mode:["continuous","pomodoro","custom"],finishSound:["bell","digital","soft","custom","none"],pauseSound:["bell","digital","soft","custom","none"]};
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
  else if(act==="notification"){
   if(!("Notification" in window)||!window.isSecureContext)C.notify("Notificações do dispositivo indisponíveis neste navegador.");
   else Notification.requestPermission().then(p=>{settings().desktopNotifications=p==="granted";persist();C.notify(p==="granted"?"Permissão de notificação ativada.":"Permissão não concedida.");});
  }
 }catch(err){C.notify(err.message||"Não foi possível controlar o cronômetro.");console.error(err);}
});
document.addEventListener("submit",e=>{
 const id=e.target?.id;
 if(!["s7-correction-form","s7-edit-totals","s7-edit-pause","s7-move-record"].includes(id))return;
 e.preventDefault();
 const data=new FormData(e.target);
 try{
  if(id==="s7-correction-form")correction(new Date(data.get("moment")).getTime());
  else if(id==="s7-edit-totals")editTotals(String(data.get("id")),Number(data.get("study")),Number(data.get("paused")),String(data.get("reason")||""));
  else if(id==="s7-edit-pause")editPause(String(data.get("id")),Number(data.get("index")),new Date(data.get("start")).getTime(),new Date(data.get("end")).getTime(),String(data.get("kind")));
  else if(id==="s7-move-record")moveRecord(String(data.get("id")),String(data.get("target")),data.get("operation")==="split",Number(data.get("minutes")));
 }catch(err){C.notify(err.message||"Confira os valores informados.");}
});
document.addEventListener("change",e=>{
 const el=e.target;if(!el)return;
 if(el.id==="s7-current-kind"){changePause(el.value);return;}
 if(el.id==="s7-upload-finish"||el.id==="s7-upload-pause"){
  upload(el.id==="s7-upload-finish"?"finish":"pause",el.files?.[0]).catch(err=>C.notify(err.message));return;
 }
 if(!el.id?.startsWith("s7-setting-"))return;
 const key=el.id.slice("s7-setting-".length);
 if(key in numeric){
  const n=Number(el.value),[min,max]=numeric[key];
  if(!Number.isFinite(n)||n<min||n>max)return C.notify("Valor inválido.");
  settings()[key]=n;
 }else if(key in strings){
  if(!strings[key].includes(el.value))return;
  settings()[key]=el.value;
 }else if(["visual","repeatPause"].includes(key))settings()[key]=el.checked;
 else return;
 persist();C.render();
});
document.addEventListener("visibilitychange",tick);
window.addEventListener("focus",tick);
setInterval(tick,1000);
window.OrbitaStage7={decorate,inspect:{get model(){return timing},metrics,studyMs,pauseMs,start,pause,resume,correction,finish,resetTimer,discardTimer,removeDeletedSession,get activeSessionId(){return timing.active?.sessionId||null},editTotals,editPause,deletePause,clearPauses,moveRecord,undo,sessionMenu,hasActiveForDate:date=>timing.active&&session(timing.active.sessionId)?.date===date,fmtMs}};
C.render();tick();
})();