/* ÓRBITA — Etapa 4: fechamento definitivo no aplicativo, análises e orientador.
 * Nenhuma IA externa: recomendações determinísticas baseadas em registros reais.
 * SQL, login e política de imutabilidade no servidor são responsabilidades da Etapa 5. */
(function(){
"use strict";
const C=window.OrbitaCore,S2=window.OrbitaStage2?.inspect,S3=window.OrbitaStage3?.inspect;
if(!C||!S2||!S3)throw Error("Órbita: carregue as etapas 1–3 antes da evolução");
const state=C.state,p=S2.model,studies=S3.model;
const E=C.esc,A=C.attr,fmt=C.dateLabel,add=C.addDays,iso=C.iso,parse=C.parse,today=C.today;
const $=id=>document.getElementById(id);
const ev=state.evolution||(state.evolution={version:4,closed:{},visitedDays:{},settings:{reminders:true,strictness:"firm",weekStart:0},lastStatsView:"",lastReminderDismissed:"",milestones:[]});
ev.closed||={};ev.visitedDays||={};ev.settings||={reminders:true,strictness:"firm"};ev.milestones||=[];
if(ev.settings.mentorEnabled===undefined)ev.settings.mentorEnabled=true;
if(ev.settings.mentorNotices===undefined)ev.settings.mentorNotices=true;
ev.mentor||={lastViewed:"",lastReadSignature:"",dismissedSignature:"",snoozeUntil:"",lastDelivery:""};
let mentorOptionsOpen=false;
if(!ev.visitedDays[today()]){ev.visitedDays[today()]=true;C.save();}
const clone=x=>JSON.parse(JSON.stringify(x));
const now=()=>new Date().toISOString();
const isClosed=date=>!!ev.closed[date]||p.closedDays.includes(date);
const minutes=value=>C.hoursLabel(Number(value||0)/60);
const dateOnly=x=>String(x||"").slice(0,10);
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(parse(d).valueOf())&&iso(parse(d))===d;
const first=()=>state.firstAccess||today();
const weekdays=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const beforeNow=date=>date<=today();
const periodStart=(kind,date)=>{
 if(kind==="day")return date;
 if(kind==="week")return C.firstDayOfWeek(date);
 if(kind==="month")return date.slice(0,7)+"-01";
 return date.slice(0,4)+"-01-01";
};
const periodEnd=(kind,date)=>{
 if(kind==="day")return date;
 if(kind==="week")return add(C.firstDayOfWeek(date),6);
 if(kind==="month"){const d=parse(date);return iso(new Date(d.getFullYear(),d.getMonth()+1,0,12));}
 return date.slice(0,4)+"-12-31";
};
let period="week",referenceDate=today(),showDetails=false;
function dayAvailability(date){const a=C.resolveAvailability(date);return a?clone(a):null;}
function pauseInfo(date){const p1=p.dayPauses[date];if(p1)return clone(p1);const a=C.resolveAvailability(date);return a?.mode==="rest"?{kind:"planejado",reason:"Descanso habitual",registeredAt:null}:null;}
function rowsToday(date){
 return S2.allOn(date).filter(x=>!(x.type==="task"&&x.sourceDate&&x.sourceDate!==date&&x.status!=="done"));
}
function capture(date){
 const linkedStudy=studies.sessions.filter(x=>x.date===date&&!x.archived).sort((a,b)=>Number(a.planOrder??0)-Number(b.planOrder??0)||(a.startTime||"99:99").localeCompare(b.startTime||"99:99")||String(a.createdAt||"").localeCompare(String(b.createdAt||"")));
 const taskRows=rowsToday(date).map(x=>{
  const r=p.records[x.id+"@"+date]||x.record||{};
  return {
   id:x.id,title:x.displayTitle||x.title,sourceDate:x.sourceDate||x.date,
   type:x.type,priority:x.priority||"medium",
   status:r.status||x.status||"pending",estimatedMin:x.estimatedMin??null,actualMin:r.actualMin??null,
   startTime:x.startTime||"",actualTime:r.actualTime||"",blockTitle:p.blocks.find(b=>b.id===x.blockId)?.title||"",
   recordedAt:r.markedAt||"",dueDate:x.dueDate||"",recurrence:x.recurrence?.kind||"none"
  };
 });
 const sessions=linkedStudy.map(x=>({
  id:x.id,kind:x.kind,cycleId:x.cycleId,cycle:studies.cycles.find(c=>c.id===x.cycleId)?.title||"",
  area:x.area,discipline:x.discipline,topic:x.topic,purpose:x.purpose,
  method:studies.methods.find(m=>m.id===x.methodId)?.title||"",
  plannedMin:x.plannedMin??null,actualMin:x.actualMin??null,
  status:x.status||"pending",startTime:x.startTime||"",actualTime:x.actualTime||"",focusId:x.focusId||"",evidence:clone(x.evidence||{questions:null,correct:null,quality:null}),
   timing:clone(state.timing?.records?.[x.id]||null)
 }));
 const attached=new Set(sessions.filter(x=>x.focusId).map(x=>x.focusId));
 const plannedStudy=sessions.reduce((a,x)=>a+Number(x.plannedMin||0),0);
 const plannedOther=taskRows.filter(x=>!(x.type==="focus"&&attached.has(x.id))).reduce((a,x)=>a+Number(x.estimatedMin||0),0);
 const actualStudy=sessions.reduce((a,x)=>a+Number(x.actualMin||0),0);
 const otherActual=taskRows.filter(x=>!(x.type==="focus"&&attached.has(x.id))).reduce((a,x)=>a+Number(x.actualMin||0),0);
 const availability=dayAvailability(date);
 const pause=pauseInfo(date);
 return {date,createdAt:now(),availability,availableMin:C.availabilityMinutes(availability),pause,activities:taskRows,studies:sessions,
   plan:{studyMin:plannedStudy,otherMin:plannedOther,totalMin:plannedStudy+plannedOther},
   result:{actualStudyMin:actualStudy,actualOtherMin:otherActual,recordedStudies:sessions.filter(x=>x.actualMin!=null).length,
    recordedActivities:taskRows.filter(x=>x.actualMin!=null).length},
   goal:{id:state.primaryGoalId||"",title:state.goals.find(x=>x.id===state.primaryGoalId)?.title||""},
   // Metadata de confirmação, nunca concluído automaticamente
   confirmed:"" };
}
function dailyCounts(snapshot){
 const a=snapshot.activities||[],ss=snapshot.studies||[];
 const focus=a.filter(x=>x.type==="focus"),habits=a.filter(x=>x.type==="habit"),tasks=a.filter(x=>x.type==="task");
 return {foci:focus.length,doneFocus:focus.filter(x=>x.status==="done").length,missedFocus:focus.filter(x=>["notdone","moved"].includes(x.status)).length,
  unregisteredFocus:focus.filter(x=>["pending","progress"].includes(x.status)).length,
  habitCount:habits.length,habitDone:habits.filter(x=>x.status==="done").length,
  habitOnTime:habits.filter(x=>x.status==="done"&&x.startTime&&x.actualTime).length,
  habitPunctual:habits.filter(x=>x.status==="done"&&x.startTime&&x.actualTime&&x.actualTime<=x.startTime).length,
  tasks:tasks.length,tasksDone:tasks.filter(x=>x.status==="done").length,
  plannedStudy:ss.length,studiesDone:ss.filter(x=>x.status==="done").length,
  studiesPartial:ss.filter(x=>x.status==="progress").length,studiesNotDone:ss.filter(x=>x.status==="notdone").length,
  missingStudyTimes:ss.filter(x=>x.actualMin==null&&x.status!=="notdone").length,
  unmarked:a.filter(x=>["pending","progress"].includes(x.status)).length+ss.filter(x=>["pending","progress"].includes(x.status)).length};
}
function hasCommitment(date){
 if(ev.closed[date])return true;
 if(p.dayPauses[date])return true;
 if(studies.sessions.some(x=>x.date===date&&!x.archived))return true;
 // Recurring obligations mean this date has a plan, even if never opened.
 return S2.allOn(date).some(x=>x.type!=="task"||x.date===date);
}
function pendingDates(until=today()){
 let res=[];
 for(let d=first(),n=0;d<until&&n<180;d=add(d,1),n++){
  if(isClosed(d)||!hasCommitment(d))continue;
  res.push(d);
 }
 return res;
}
function dayHasMovement(date){
 const snap=capture(date);
 if(p.dayPauses[date])return true;
 if(snap.activities.some(x=>x.recordedAt||x.actualMin!=null||x.actualTime||x.status!=="pending"))return true;
 if(snap.studies.some(x=>x.status!=="pending"||x.actualMin!=null||x.actualTime||x.timing))return true;
 return false;
}

function reviewStatus(s){return ({done:"Concluída",pending:"Pendente",progress:"Parcial / em andamento",notdone:"Não realizada",moved:"Remanejada"})[s]||"Pendente";}
function reviewTone(snap){
 const n=dailyCounts(snap),rest=!!snap.pause||snap.availability?.mode==="rest";
 const due=snap.activities.filter(a=>a.type==="task"&&a.dueDate&&a.dueDate<=snap.date),total=n.foci+n.habitCount+n.plannedStudy+due.length,done=n.doneFocus+n.habitDone+n.studiesDone+due.filter(a=>a.status==="done").length;
 if(rest&&!total)return {kind:"rest",label:"Descanso registrado",description:"Este dia possui descanso registrado e não tem compromissos identificados para pontuar.",rate:null};
 if(!total)return {kind:"unknown",label:"Sem dados suficientes",description:"Não há compromissos registrados para classificar o cumprimento.",rate:null};
 const rate=Math.round(100*done/total),kind=rate>=75?"good":rate>=45?"mid":"bad";
 return {kind,label:kind==="good"?"Bom cumprimento registrado":kind==="mid"?"Cumprimento parcial":"Abaixo do planejado",description:"Resumo dos compromissos do dia, sem tratar tarefas flexíveis como falhas automáticas.",rate};
}
function visualSummary(snap,final=false){
 const n=dailyCounts(snap),rating=reviewTone(snap);
 const totalActivities=n.foci+n.tasks+n.habitCount,doneActivities=n.doneFocus+n.tasksDone+n.habitDone;
 const missing=snap.activities.filter(a=>["pending","progress"].includes(a.status)&&(a.type!=="task"||a.dueDate&&a.dueDate<=snap.date)).length+snap.studies.filter(a=>["pending","progress"].includes(a.status)).length;
 const title=final?"Dia finalizado e preservado":"Balanço provisório — dia aberto";
 const positive=[];
 if(n.doneFocus)positive.push(n.doneFocus+" foco(s) concluído(s)");
 if(n.studiesDone)positive.push(n.studiesDone+" sessão(ões) concluída(s)");
 if(n.tasksDone)positive.push(n.tasksDone+" tarefa(s) concluída(s)");
 if(n.habitDone)positive.push(n.habitDone+" rotina(s) concluída(s)");
 const pending=[];
 if(missing)pending.push(missing+" registro(s) ainda pendente(s) ou em andamento");
 if(n.studiesNotDone)pending.push(n.studiesNotDone+" sessão(ões) marcada(s) como não realizada(s)");
 if(n.missingStudyTimes)pending.push(n.missingStudyTimes+" sessão(ões) sem tempo efetivo informado");
 return '<section class="evo-finish-hero '+rating.kind+'"><div class="evo-finish-eyebrow">'+(final?"✓ DIA FINALIZADO":"◷ REVISÃO PROVISÓRIA")+'</div>'+
 '<h2>'+E(title)+'</h2><div class="evo-finish-rating">'+E(rating.label)+(rating.rate!==null?'<strong>'+rating.rate+'%</strong>':"")+'</div>'+
 (rating.rate!==null?'<div class="evo-finish-progress"><i style="width:'+rating.rate+'%"></i></div>':"")+
 '<p>'+E(rating.description)+'</p></section>'+
 '<div class="evo-finish-grid">'+
 '<div><small>Focos</small><strong>'+n.doneFocus+'/'+n.foci+'</strong></div>'+
 '<div><small>Tarefas</small><strong>'+n.tasksDone+'/'+n.tasks+'</strong></div>'+
 '<div><small>Rotinas</small><strong>'+n.habitDone+'/'+n.habitCount+'</strong></div>'+
 '<div><small>Estudos</small><strong>'+n.studiesDone+'/'+n.plannedStudy+'</strong></div>'+
 '<div><small>Estudo real registrado</small><strong>'+E(minutes(snap.result.actualStudyMin))+'</strong></div>'+
 '<div><small>Carga prevista</small><strong>'+E(minutes(snap.plan.totalMin))+'</strong></div>'+
 '<div><small>Atividades concluídas</small><strong>'+doneActivities+'/'+totalActivities+'</strong></div>'+
 '<div><small>Registros ainda pendentes</small><strong>'+missing+'</strong></div></div>'+
 '<div class="evo-finish-notes"><div><strong>✓ Avanços registrados</strong><p>'+E(positive.join(" · ")||"Nenhuma conclusão explicitamente registrada.")+'</p></div>'+
 '<div><strong>◇ Pontos para conferir</strong><p>'+E(pending.join(" · ")||"Não há pendências identificadas nesta visão.")+'</p></div></div>'+
 (snap.pause?'<p class="note">Descanso registrado: '+E(snap.pause.kind||"informado")+(snap.pause.reason?" · "+E(snap.pause.reason):"")+'</p>':"");
}
function dayDetailInBatch(date){
 if(!pendingDates().includes(date))throw Error("Esta data já foi finalizada ou não está pendente.");
 const snap=capture(date),n=dailyCounts(snap);
 const makeActivity=x=>'<div class="evo-review-item"><div><strong>'+E(x.title)+'</strong><small>'+E(reviewStatus(x.status))+' · previsto '+(x.estimatedMin!=null?minutes(x.estimatedMin):"não informado")+' · real '+(x.actualMin!=null?minutes(x.actualMin):"não informado")+'</small></div>'+
 '<div class="evo-review-actions">'+(x.status!=="done"?'<button class="btn small ghost" data-s4="markActivity" data-id="'+A(x.id)+'" data-date="'+A(date)+'" data-status="done">✓ Concluir</button>':'<button class="btn small ghost" data-s4="markActivity" data-id="'+A(x.id)+'" data-date="'+A(date)+'" data-status="pending">↶ Desmarcar</button>')+
 '<button class="btn small ghost" data-s4="editActivity" data-id="'+A(x.id)+'" data-date="'+A(date)+'">Detalhes</button></div></div>';
 const makeStudy=(x,i)=>'<div class="evo-review-item"><div><strong>Sessão '+(i+1)+' · '+E(x.discipline||"Estudo")+'</strong><small>'+E(reviewStatus(x.status))+' · prevista '+(x.plannedMin!=null?minutes(x.plannedMin):"não informado")+' · realizada '+(x.actualMin!=null?minutes(x.actualMin):"não informado")+'</small></div>'+
 '<div class="evo-review-actions"><button class="btn small ghost" data-s4="editStudy" data-id="'+A(x.id)+'" data-date="'+A(date)+'">Registrar / corrigir</button></div></div>';
 C.openModal("Revisar "+fmt(date,false),'<div class="section-stack evo-batch-detail">'+visualSummary(snap,false)+
 '<p class="note">Este dia permanece aberto. Você pode ajustar registros, voltar à revisão e só então finalizar.</p>'+
 '<section><h3>Focos, tarefas e rotinas · '+snap.activities.length+'</h3><div class="evo-review-items">'+(snap.activities.map(makeActivity).join("")||'<p class="note">Nenhuma atividade cadastrada.</p>')+'</div></section>'+
 '<section><h3>Sessões de estudo · '+snap.studies.length+'</h3><div class="evo-review-items">'+(snap.studies.map(makeStudy).join("")||'<p class="note">Nenhuma sessão cadastrada.</p>')+'</div></section>'+
 '<p class="note">'+n.unmarked+' registro(s) pendente(s). A ausência de registro não comprova falta de execução.</p>'+
 '<div class="modal-footer"><button class="btn ghost" data-s4="batchReview">← Voltar ao lote</button>'+
 '<button class="btn primary" data-s4="openEditableDay" data-date="'+A(date)+'">Abrir dia completo</button></div></div>');
}
function batchReview(){
 const dates=pendingDates();
 if(!dates.length)return C.notify("Não há dias anteriores aguardando fechamento.");
 const row=d=>{const snap=capture(d),n=dailyCounts(snap),r=reviewTone(snap);
  return '<button type="button" class="evo-batch-date" data-s4="batchDay" data-date="'+A(d)+'"><span class="evo-batch-date-main"><strong>'+E(fmt(d,false))+'</strong><small>'+n.doneFocus+'/'+n.foci+' focos · '+n.studiesDone+'/'+n.plannedStudy+' sessões · '+n.tasksDone+'/'+n.tasks+' tarefas</small><small>'+n.unmarked+' pendente(s) · '+(dayHasMovement(d)?"Com registros de execução":"Sem execução registrada")+'</small></span><span class="evo-batch-state '+r.kind+'">'+E(r.label)+'</span><span aria-hidden="true">›</span></button>';};
 C.openModal("Revisar dias pendentes",'<form id="s4-batch-finalize" class="section-stack evo-batch-panel">'+
 '<p class="note">Selecione cada data para conferir e corrigir seus registros. O fechamento só acontecerá depois de sua confirmação.</p>'+
 '<div class="evo-batch-dates">'+dates.map(row).join("")+'</div>'+
 '<label class="evo-review-confirm"><input type="checkbox" name="reviewed" required><span><strong>Conferi os dias e autorizo o fechamento definitivo</strong><small>As pendências continuarão sem conclusão, e os registros serão preservados.</small></span></label>'+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button>'+
 '<button class="btn primary" type="submit">Finalizar '+dates.length+' dia(s)</button></div></form>');
}
function showFinishedFeedback(dates,index=0){
 if(index===0&&dates.length){
  // A navegação avança antes de mostrar o feedback; fechar o pop-up também deixa o dia seguinte à vista.
  const afterLast=add(dates[dates.length-1],1);
  state.date=afterLast>today()?afterLast:today();
  C.save();C.go("inicio");
 }
 if(index>=dates.length){C.closeModal();return;}
 const date=dates[index],snap=ev.closed[date];
 if(!snap){showFinishedFeedback(dates,index+1);return;}
 C.openModal("Feedback do dia",'<div class="section-stack evo-feedback-modal">'+
 '<p class="note">'+E(fmt(date,true))+(dates.length>1?' · '+(index+1)+' de '+dates.length+' dias finalizados':"")+'</p>'+
 visualSummary(snap,true)+
 '<details class="evo-feedback-details"><summary>Consultar registros individuais</summary><h3>Atividades</h3><div class="review-lines">'+
 ((snap.activities||[]).map(x=>reviewLine(x.title,x.status,x.estimatedMin,x.actualMin)).join("")||'<p class="note">Nenhuma atividade.</p>')+'</div>'+
 '<h3>Estudos</h3><div class="review-lines">'+((snap.studies||[]).map((x,i)=>reviewStudyLine(x,i)).join("")||'<p class="note">Nenhum estudo.</p>')+'</div></details>'+
 '<div class="modal-footer"><button class="btn primary" data-s4="feedbackNext" data-index="'+(index+1)+'">'+(index===dates.length-1?"Concluir e ir para hoje":"Próximo feedback →")+'</button></div></div>');
 // A lista serve somente para navegação entre feedbacks; nenhuma alteração é permitida após o fechamento.
 feedbackDates=dates.slice();
}
let feedbackDates=[];
function finalizeBatch(){
 const dates=pendingDates();
 if(!dates.length)throw Error("Não há dias pendentes.");
 for(const d of dates)if(window.OrbitaStage7?.inspect?.hasActiveForDate(d))throw Error("Encerre o cronômetro de "+fmt(d,false)+" antes de finalizar.");
 // Cada dia é confirmado na ordem cronológica; o snapshot preserva o estado revisado.
 for(const d of dates)finalize(d);
 showFinishedFeedback(dates);
 return dates;
}
function awardMilestones(){
 const qualifying=Object.values(ev.closed).filter(x=>{const n=dailyCounts(x);return n.foci>0&&n.doneFocus===n.foci;}).length;
 for(const threshold of [5,10,20,50]){
  const id="focus-fulfilled-"+threshold;
  if(qualifying>=threshold&&!ev.milestones.some(m=>m.id===id))ev.milestones.push({id,title:threshold+" dias com focos cumpridos",count:threshold,awardedAt:now()});
 }
}
function finalize(date){
 if(!validDate(date)||date<first()||!beforeNow(date))throw Error("Só é possível finalizar datas anteriores ou iguais a hoje.");
 if(isClosed(date))throw Error("Este dia já foi finalizado.");
  if(window.OrbitaStage7?.inspect?.hasActiveForDate(date))throw Error("Encerre o cronômetro da sessão antes de finalizar o dia.");
 const older=pendingDates(date);
 if(older.length)throw Error("Finalize primeiro "+older.length+" dia(s) anterior(es) pendente(s), começando em "+older[0].split("-").reverse().join("/")+".");
 const snap=capture(date);
 snap.confirmed=now();
 ev.closed[date]=clone(snap);
 if(!p.closedDays.includes(date))p.closedDays.push(date);
 ev.events||=[];ev.events.push({kind:"day_closed",date,at:snap.confirmed});
 awardMilestones();
 C.save();return snap;
}
function periodData(kind,date,preview=true){
 const start=kind==="all"?first():periodStart(kind,date),end=kind==="all"?today():periodEnd(kind,date);
 const from=start<first()?first():start;
 const rows=[];let open=0,unobserved=0,pastDays=0;
 for(let d=from;d<=end;d=add(d,1)){
  const closed=ev.closed[d];
  if(closed)rows.push(closed);
  else if(d<=today()){
   pastDays++;
   if(hasCommitment(d)){open++;if(preview)rows.push(capture(d));}
   else unobserved++;
  }
 }
 const count={days:rows.length,closed:rows.filter(x=>!!x.confirmed).length,plannedActive:0,rest:0,unplannedPauses:0,focus:0,doneFocus:0,missedFocus:0,
  habits:0,habitDone:0,habitRecordedTimes:0,habitOnTime:0,tasks:0,tasksDone:0,study:0,studiesDone:0,partial:0,studiesNotDone:0,actualMin:0,
  studyActualMin:0,plannedMin:0,knownStudyMinutes:0,missingStudyTimes:0,missingActivityTimes:0,
  changedPlans:0,lateRest:0,daysWithStudy:0,workDays:0,questions:0,correct:0,questionSessions:0,qualityRated:0,qualitySum:0,open,unobserved,elapsed:pastDays};
 const byArea={};const byDiscipline={};const byMethod={};const byTopic={};
 const daily=[];
 for(const snap of rows){
  const n=dailyCounts(snap);
  count.focus+=n.foci;count.doneFocus+=n.doneFocus;count.missedFocus+=n.missedFocus;
  count.habits+=n.habitCount;count.habitDone+=n.habitDone;
  count.habitRecordedTimes+=n.habitOnTime;count.habitOnTime+=n.habitPunctual;
  count.tasks+=n.tasks;count.tasksDone+=n.tasksDone;count.study+=n.plannedStudy;
  count.studiesDone+=n.studiesDone;count.partial+=n.studiesPartial;count.studiesNotDone+=n.studiesNotDone;
  count.actualMin+=(snap.result.actualStudyMin||0)+(snap.result.actualOtherMin||0);
  count.studyActualMin+=snap.result.actualStudyMin||0;
  count.plannedMin+=snap.plan.totalMin||0;count.knownStudyMinutes+=snap.result.recordedStudies||0;
  count.missingStudyTimes+=n.missingStudyTimes;
  count.missingActivityTimes+=snap.activities.filter(x=>x.actualMin==null).length;
  if(snap.studies.length&&snap.studies.some(x=>x.actualMin!=null))count.daysWithStudy++;
  if(snap.activities.length||snap.studies.length)count.workDays++;
  if(snap.pause){
   if(snap.pause.kind==="planejado")count.rest++;
   else{count.unplannedPauses++;if(snap.pause.declaredSameDay)count.lateRest++;}
  }else if(snap.availability?.mode==="rest")count.rest++;
  for(const ss of snap.studies){
   if(Number.isInteger(ss.evidence?.questions)&&ss.evidence.questions>0&&Number.isInteger(ss.evidence?.correct)){
    count.questions+=ss.evidence.questions;count.correct+=ss.evidence.correct;count.questionSessions++;
   }
   if(ss.evidence?.quality!=null&&Number.isInteger(ss.evidence.quality)){count.qualityRated++;count.qualitySum+=ss.evidence.quality;}
   if(ss.actualMin==null)continue;
   for(const [group,key] of [[byArea,ss.area],[byDiscipline,ss.discipline],[byMethod,ss.method],[byTopic,ss.topic]]){
    const name=key||"Não informado";group[name]=(group[name]||0)+Number(ss.actualMin);
   }
  }
  daily.push({date:snap.date,closed:!!snap.confirmed,studyMin:snap.result.actualStudyMin||0,
   focus:n.foci,doneFocus:n.doneFocus,rest:!!snap.pause||snap.availability?.mode==="rest",paused:snap.pause?.kind||"",plannedMin:snap.plan.totalMin||0});
 }
 let changes=0;
 for(const x of p.events||[]){
  const dated=x.date||"",at=dateOnly(x.at);
  if(at>=from&&at<=end&&["pause_change","focus_rescheduled"].includes(x.kind))changes++;
 }
 count.changedPlans=changes;
 const allClosed=unobserved===0&&open===0&&end<today() || unobserved===0&&open===0&&end===today()&&!!ev.closed[today()];
 return {kind,from,to:end,count,days:daily,byArea,byDiscipline,byMethod,byTopic,final:allClosed&&start>=first(),provisional:!allClosed||start<first()};
}
function sampleLevel(x){
 // Counting only days with real plans; empty days cannot create fake consistency.
 const meaningful=x.days.filter(d=>d.closed&&(d.focus>0||d.plannedMin>0||d.rest));
 if(meaningful.length>=14)return "reliable";
 if(meaningful.length>=5)return "initial";
 return "limited";
}
function focusRate(count){return count.focus?Math.round(count.doneFocus/count.focus*100):null;}
function signals(x){
 const c=x.count,level=sampleLevel(x),rate=focusRate(c);
 const messages=[];
 if(level==="limited"){messages.push({tone:"neutral",title:"Histórico em formação",body:"Os registros ainda não permitem afirmar tendências de disciplina ou evolução. Continue finalizando os dias e registrando resultados reais.",action:"Registrar com precisão seus estudos e compromissos."});}
 if(c.focus>=5&&rate!=null){
  if(rate>=85)messages.push({tone:"good",title:"Compromissos consistentes",body:"Você concluiu "+c.doneFocus+" de "+c.focus+" focos ("+rate+"%). Não é preciso aumentar a carga só para superar um resultado que já está estável.",action:"Manter o ritmo e observar a aprendizagem."});
  else if(rate<60&&level!=="limited")messages.push({tone:"warning",title:"Planejamento pouco executado",body:"Apenas "+rate+"% dos focos previstos foram concluídos. Repetir compromissos sem executá-los não está ajudando seu objetivo.",action:"Reduzir ou redistribuir os compromissos até caberem na sua disponibilidade."});
 }
 if(c.study>=5&&c.studiesDone>=3&&c.missingStudyTimes>0)messages.push({tone:"neutral",title:"Horas não informadas",body:"Você deixou a duração efetiva de "+c.missingStudyTimes+" sessão(ões) sem registro. A conclusão foi contabilizada, mas o tempo não foi inventado.",action:"Informar a duração real quando souber; não estimar retroativamente dias finalizados."});
 if(c.questions>=30&&c.questionSessions>=3&&level!=="limited")messages.push({tone:"neutral",title:"Exercícios registrados",body:"Você anotou "+c.correct+" acertos em "+c.questions+" questões ("+Math.round(c.correct/c.questions*100)+"%). O percentual é descritivo: dificuldade, assunto e condições das questões podem variar.",action:"Comparar resultados de exercícios equivalentes e revisar assuntos com mais erros."});
 if(c.unplannedPauses>=3&&level!=="limited")messages.push({tone:"warning",title:"Pausas extras recorrentes",body:"Foram registradas "+c.unplannedPauses+" pausas extraordinárias. Isso pode indicar imprevistos frequentes ou um planejamento incompatível com a rotina.",action:"Revisar compromissos e disponibilidade sem eliminar o descanso necessário."});
 if(c.plannedMin>0&&c.workDays>=5&&c.actualMin>0&&c.missingActivityTimes+c.missingStudyTimes===0&&c.actualMin<c.plannedMin*.5&&level!=="limited")
 messages.push({tone:"warning",title:"Previsões distantes da execução",body:"O tempo efetivamente registrado foi bem menor que o tempo planejado. Verifique se as metas estão superdimensionadas.",action:"Calibrar as próximas estimativas pelo histórico real."});
 if(c.rest>=1&&c.unplannedPauses===0&&c.workDays>=3)messages.push({tone:"good",title:"Descanso preservado",body:"Há dias de descanso programados no período. Eles fazem parte da organização e não são falhas.",action:"Continuar respeitando pausas previstas."});
 if(!c.focus&&!c.study&&!c.habits)messages.push({tone:"neutral",title:"Sem compromissos analisáveis",body:"Não há atividades suficientes neste período para avaliar cumprimento ou qualidade.",action:"Definir compromissos conforme seus objetivos, se desejar."});
 if(c.study&&Object.keys(x.byArea).length){
 const top=Object.entries(x.byArea).sort((a,b)=>b[1]-a[1])[0];
 if(top[1]>0)messages.push({tone:"neutral",title:"Distribuição do estudo",body:"A área "+top[0]+" concentrou "+minutes(top[1])+" das "+minutes(c.studyActualMin)+" registradas. Isso informa a distribuição, não prova melhor aprendizagem.",action:"Comparar a distribuição com suas prioridades."});
 }
 return messages.slice(0,4);
}
function guidance(x){
 const s=signals(x),tone=ev.settings.strictness||"firm";
 if(tone==="gentle")return s.map(o=>({...o,body:o.body.replace("Repetir compromissos sem executá-los não está ajudando seu objetivo.","A execução está abaixo do planejado e merece atenção.")}));
 return s;
}

/* Supervisor: diagnóstico verificável e contínuo. Dados ausentes não viram falhas inventadas. */
function legacyMentorAnalysis(){
 const all=periodData("all",today()),week=periodData("week",today()),previous=periodData("week",add(today(),-7));
 const c=all.count,w=week.count,b=previous.count;
 const nowMs=Date.now(),recent=7*86400000;
 const inRecent=x=>{const t=Date.parse(x||"");return Number.isFinite(t)&&t<=nowMs&&nowMs-t<=recent;};
 const events=[...(p.events||[]),...(studies.events||[])];
 const deleted=events.filter(x=>inRecent(x.at)&&["entry_deleted","session_deleted","planner_removed"].includes(x.kind)).reduce((n,x)=>n+(Array.isArray(x.ids)?x.ids.length:1),0);
 const created=events.filter(x=>inRecent(x.at)&&["entry_created","sessions_created","planner_created"].includes(x.kind)).reduce((n,x)=>n+(Array.isArray(x.ids)?x.ids.length:1),0);
 const lastMinute=(p.entries||[]).filter(x=>{
  if(!x.createdAt||x.recurrence?.kind!=="none")return false;
  const status=p.records?.[x.id+"@"+x.date],start=Date.parse(x.createdAt),end=Date.parse(status?.markedAt||"");
  return status?.status==="done"&&inRecent(x.createdAt)&&end>=start&&end-start<=15*60000;
 }).length;
 const issues=[];
 const addIssue=(key,score,tone,title,body,action,praise="",evidence="")=>issues.push({key,score,tone,title,body,action,praise,evidence});
 if(c.missingStudyTimes>=2)addIssue("missing",c.missingStudyTimes>=5?88:62,"warning","Registros incompletos",
  "Você concluiu sessões sem informar o tempo efetivo em "+c.missingStudyTimes+" registro(s). Sem esses dados, não consigo avaliar sua carga com precisão.",
  "Ao terminar a próxima sessão, confira a duração antes de concluir.", "Você está registrando suas sessões, e isso já permite acompanhar o planejamento.",
  c.missingStudyTimes+" sessões sem duração");
 if(w.workDays>=3&&w.plannedMin>=180&&w.actualMin>0&&w.missingStudyTimes===0&&w.missingActivityTimes===0){
  const ratio=w.actualMin/w.plannedMin;
  if(ratio<.7)addIssue("load",ratio<.45?91:71,"warning","Carga planejada e executada",
   "Nesta semana, foram planejadas "+minutes(w.plannedMin)+" e registradas "+minutes(w.actualMin)+". A diferença merece atenção, mas não significa automaticamente falta de esforço.",
   "Na próxima semana, ajuste a meta ou tente acrescentar um bloco pequeno e viável à rotina.",
   "Você já registrou tempo real suficiente para comparar seu plano com a execução.",
   minutes(w.actualMin)+" de "+minutes(w.plannedMin)+" previstas");
 }
 if(w.studyActualMin>=60&&b.studyActualMin>=60){
  const variation=w.studyActualMin/b.studyActualMin;
  if(variation>=1.25)addIssue("improvement",76,"good","Avanço na carga de estudos",
   "Sua carga registrada nesta semana subiu em relação à anterior: "+minutes(b.studyActualMin)+" antes e "+minutes(w.studyActualMin)+" agora.",
   "Conserve o ritmo e observe se ele permanece sustentável.","Você conseguiu avançar em relação à semana anterior.",
   minutes(b.studyActualMin)+" → "+minutes(w.studyActualMin));
  else if(variation<=.65&&w.workDays>=2)addIssue("drop",79,"warning","Queda de ritmo",
   "Sua duração registrada caiu de "+minutes(b.studyActualMin)+" para "+minutes(w.studyActualMin)+". Pode haver motivos legítimos; precisamos verificar o que mudou.",
   "Reveja os próximos blocos e escolha uma meta menor que consiga cumprir.","Você já demonstrou um ritmo maior anteriormente.",
   minutes(b.studyActualMin)+" → "+minutes(w.studyActualMin));
 }
 if(deleted>=3&&created>=3&&deleted/created>=.35)addIssue("deleted",80,"warning","Planejamento descartado",
  "Nos últimos sete dias, encontrei "+deleted+" exclusão(ões) registradas para "+created+" criação(ões). Você está planejando mais do que consegue manter?",
  "Antes de criar novos compromissos, confira o que realmente cabe na agenda.",
  "Você está revisando o planejamento; agora precisamos melhorar a precisão.",deleted+" exclusões recentes");
 if(lastMinute>=3)addIssue("late",69,"neutral","Atividades registradas na última hora",
  "Pelo menos "+lastMinute+" atividades foram criadas e concluídas em até 15 minutos. Isso pode ser registro retrospectivo, e não necessariamente esquecimento.",
  "Se pretende usá-las como planejamento, tente cadastrá-las antes de começar.",
  "Registrar o que fez também é válido; a questão é distinguir histórico de planejamento.",lastMinute+" registros próximos da conclusão");
 if(c.focus>=5){
  const rate=focusRate(c);
  if(rate>=85)addIssue("consistent",72,"good","Focos bem executados",
   "Você concluiu "+c.doneFocus+" de "+c.focus+" focos ("+rate+"%). É um resultado positivo, sem necessidade de aumentar a carga apenas por aumentar.",
   "Mantenha a qualidade e observe a regularidade.", "Seu acompanhamento mostra consistência.",rate+"% dos focos");
  else if(rate<60)addIssue("focus",78,"warning","Focos acumulados",
   "No histórico completo, "+c.doneFocus+" de "+c.focus+" focos foram concluídos ("+rate+"%). Há distância entre o planejado e o executado.",
   "Na próxima semana, selecione menos prioridades inegociáveis e acompanhe a execução.",
   "Você está definindo seus objetivos; agora precisamos ajustar a execução.",rate+"% dos focos");
 }
 if(c.unplannedPauses>=3)addIssue("pauses",58,"neutral","Pausas fora do plano",
  "Há "+c.unplannedPauses+" pausas extraordinárias registradas. Talvez sua disponibilidade precise de ajustes; descansar não é uma falha.",
  "Revise a disponibilidade informada antes de aumentar as metas.",
  "Reconhecer imprevistos ajuda a planejar melhor.",c.unplannedPauses+" pausas registradas");
 issues.sort((a,b)=>b.score-a.score);
 const picked=issues.slice(0,4);
 if(!picked.length){
  if(c.studyActualMin||c.focus||c.study) picked.push({key:"baseline",score:15,tone:"neutral",title:"Acompanhamento em andamento",praise:"Já existem registros que posso acompanhar.",body:"Ainda não identifiquei um padrão suficientemente consistente para uma cobrança específica. Isso não apaga o que você registrou.",action:"Continue informando os resultados reais. Vou comparar as próximas semanas.",evidence:"Histórico disponível"});
  else picked.push({key:"empty",score:0,tone:"neutral",title:"Vamos começar com dados reais",praise:"O planejamento está pronto para ser usado.",body:"Ainda não há evidências para avaliar desempenho, e não vou inventar críticas.",action:"Registre seus compromissos e suas primeiras sessões.",evidence:"Sem registros suficientes"});
 }
 const digest=picked.map(x=>x.key+":"+x.evidence).join("|");
 return {items:picked,digest,important:picked.some(x=>x.score>=65),closed:c.closed,days:c.days};
}
/* Critérios internos do Orientador v5.23. Não expor parâmetros no painel. */
const M_DAY=86400000;
const profiles={gentle:{high:7,medium:21,grace:.08,stagnation:35,penalty:.65},firm:{high:5,medium:14,grace:.04,stagnation:30,penalty:1},strict:{high:3,medium:10,grace:0,stagnation:28,penalty:1.15},hard:{high:2,medium:7,grace:0,stagnation:24,penalty:1.35}};
const mentorTone=()=>profiles[ev.settings.strictness]?ev.settings.strictness:"firm";
const cfg=()=>profiles[mentorTone()];
const clamp01=n=>Math.min(1,Math.max(0,n));
const elapsedDays=(from,to)=>Math.max(0,Math.round((parse(to)-parse(from))/M_DAY));
const closedRows=(from,to)=>Object.keys(ev.closed).filter(d=>d>=from&&d<=to).sort().map(d=>ev.closed[d]);
const labelMinutes=n=>minutes(Math.round(n));
function actualStudy(snap){return Math.max(0,Number(snap.result?.actualStudyMin)||0);}
function studyCapacity(snap){
 if(!snap.availability||snap.availableMin==null||!Number.isFinite(Number(snap.availableMin)))return null;
 const available=Math.max(0,Number(snap.availableMin)),other=Math.max(0,Number(snap.plan?.otherMin)||0,Number(snap.result?.actualOtherMin)||0);
 if(snap.pause||snap.availability.mode==="rest")return 0;
 // Reserve space for transitions, meals and breaks; avoid recommending the entire free interval.
 return Math.max(0,available*.8-other);
}
function studyWindow(from,to){
 const rows=closedRows(from,to).filter(s=>studyCapacity(s)>0&&!(s.studies||[]).some(x=>x.status!=="notdone"&&x.actualMin==null));
 const sum=rows.reduce((a,s)=>a+actualStudy(s),0),cap=rows.reduce((a,s)=>a+studyCapacity(s),0);
 return {days:rows.length,sum,capacity:cap,average:rows.length?sum/rows.length:0,use:cap?sum/cap:0};
}
function loadAssessment(end){
 const recent=studyWindow(add(end,-13),end),prior=studyWindow(add(end,-27),add(end,-14));
 const full=closedRows(add(end,-29),end),known=full.filter(s=>studyCapacity(s)>0&&!(s.studies||[]).some(x=>x.status!=="notdone"&&x.actualMin==null));
 const overload=known.filter(s=>actualStudy(s)>studyCapacity(s)*1.15&&actualStudy(s)>=180).length;
 const age=elapsedDays(first(),end)+1;
 if(known.length<4||recent.days<3)return {kind:"unknown",rate:null,recent,prior,age,overload};
 if(overload>=3&&overload/known.length>=.35)return {kind:"overload",rate:clamp01(1-.25*cfg().penalty),recent,prior,age,overload};
 if(prior.days<4||recent.days<4)return {kind:recent.use>=.85?"sustain":"forming",rate:null,recent,prior,age,overload};
 const change=prior.average>0?(recent.average-prior.average)/prior.average:recent.average>0?1:0;
 const capacityChange=prior.capacity/prior.days>0?(recent.capacity/recent.days)/(prior.capacity/prior.days):1;
 const out={recent,prior,age,overload,change};
 if(change>.5&&recent.average-prior.average>=60)return {...out,kind:"rapid",rate:clamp01(1-.12*cfg().penalty)};
 if(recent.use>=.85&&change>=-.15)return {...out,kind:"sustain",rate:1};
 if(change<-.25&&capacityChange>=.85&&prior.average>=30)return {...out,kind:"drop",rate:clamp01(1-Math.min(.65,Math.abs(change)*cfg().penalty))};
 if(change>=.08&&recent.average-prior.average>=10)return {...out,kind:"growth",rate:1};
 if(age>=cfg().stagnation&&prior.average>=30&&Math.abs(change)<.08&&recent.use<.65&&capacityChange>=.85&&recent.capacity/recent.days-recent.average>=60)return {...out,kind:"stagnation",rate:clamp01(1-.35*cfg().penalty)};
 return {...out,kind:"stable",rate:.95};
}
function taskHistory(end,live=false){
 // Historical snapshots contain the task at creation and completion. Keep a single row per flexible task.
 const map=new Map(),done=new Map();
 for(const snap of closedRows(first(),end))for(const a of snap.activities||[]){
  if(a.type!=="task")continue;
  const recurring=a.recurrence&&a.recurrence!=="none",key=recurring?a.id+"@"+snap.date:a.id;
  const row={...a,date:a.sourceDate||snap.date,occurrence:snap.date,key};
  const old=map.get(key);
  if(!old||snap.date>=old.occurrence)map.set(key,row);
  if(a.status==="done"&&!done.has(key))done.set(key,snap.date);
 }
 if(live){
  for(const x of p.entries||[]){
   if(x.type!=="task"||x.date>end||x.recurrence?.kind&&x.recurrence.kind!=="none")continue;
   if(x.archivedAt&&x.archivedAt<=end){map.delete(x.id);done.delete(x.id);continue;}
   map.set(x.id,{...x,key:x.id,occurrence:end});
  }
  for(const [key,r] of Object.entries(p.records||{})){
   const at=key.lastIndexOf("@"),id=key.slice(0,at),d=key.slice(at+1);
   if(r.status==="done"&&d<=end){if(map.has(key)&&!done.has(key))done.set(key,d);if(map.has(id)&&(!done.has(id)||done.get(id)>d))done.set(id,d);}
  }
  for(const x of S2.allOn(end)||[]){
   if(x.type!=="task"||!x.recurrence?.kind||x.recurrence.kind==="none")continue;
   const key=x.id+"@"+end;map.set(key,{...x,key,date:end,occurrence:end});if(x.status==="done")done.set(key,end);
  }
 }
 return [...map.values()].map(x=>({...x,completed:done.get(x.key)||""}));
}
function taskAssessment(from,end,live=false){
 const rows=taskHistory(end,live),issues=[],alerts=[],eligible=[];
 for(const x of rows){
  if(x.completed&&x.completed<from)continue;
  const age=elapsedDays(x.date,end),due=x.dueDate||"",priority=x.priority||"medium",tolerance=cfg()[priority],deadline=due&&due<=end;
  const late=!!due&&(x.completed?x.completed>due:end>due),dueNow=!!due&&due===end&&!x.completed;
  const overdueAge=late?elapsedDays(due,x.completed||end):0;
  const ageBreach=(!due||priority==="high"&&elapsedDays(end,due)<=2)&&Number.isFinite(tolerance)&&age>=tolerance&&!x.completed;
  const near=due&&due>end&&elapsedDays(end,due)<=2&&priority==="high"&&!x.completed;
  // A low priority without a deadline never causes an age penalty.
  if(late||dueNow||ageBreach){
   const severity=late?Math.min(1,.45+overdueAge*.09):dueNow?.35:Math.min(.85,.25+(age-tolerance)*.07);
   eligible.push(clamp01(1-severity*cfg().penalty));issues.push({x,age,late,dueNow,ageBreach});
  }else if(x.completed&&(deadline||priority==="high"||priority==="medium"))eligible.push(1);
  else if(deadline&&x.completed)eligible.push(1);
  if(near)alerts.push({x,age});
 }
 return {rate:eligible.length?eligible.reduce((a,b)=>a+b,0)/eligible.length:null,issues,alerts,rows};
}
function habitAssessment(rows){
 const grouped=new Map();
 for(const snap of rows)for(const a of snap.activities||[]){
  if(a.type!=="habit")continue;
  const key=a.id||a.title,old=grouped.get(key)||{title:a.title,done:0,miss:0,unknown:0,total:0};
  old.total++;if(a.status==="done")old.done++;else if(a.status==="notdone"||a.status==="moved")old.miss++;else old.unknown++;
  grouped.set(key,old);
 }
 const groups=[...grouped.values()],total=groups.reduce((n,g)=>n+g.total,0),done=groups.reduce((n,g)=>n+g.done,0),miss=groups.reduce((n,g)=>n+g.miss,0),unknown=total-done-miss;
 // Count actual misses strongly. Pending is a record gap, not a proven failure.
 const rate=total&&done+miss?clamp01((done+Math.min(cfg().grace*total,miss))/(done+miss)):null;
 return {groups,total,done,miss,unknown,rate};
}
function executionAssessment(rows){
 const h=habitAssessment(rows),f={total:0,done:0,miss:0,unknown:0},st={total:0,done:0,miss:0,unknown:0,planned:0,actual:0,known:0,missing:0,partial:0};
 for(const snap of rows){
  for(const a of snap.activities||[])if(a.type==="focus"){f.total++;if(a.status==="done")f.done++;else if(["notdone","moved"].includes(a.status))f.miss++;else f.unknown++;}
  for(const a of snap.studies||[]){
   st.total++;if(a.status==="done")st.done++;else if(a.status==="notdone")st.miss++;else if(a.status==="progress"&&a.actualMin!=null)st.partial++;else st.unknown++;
   if(a.actualMin!=null||a.status==="notdone"){st.actual+=Math.max(0,Number(a.actualMin)||0);st.planned+=Math.max(0,Number(a.plannedMin)||0);st.known++;}
   else st.missing++;
  }
 }
 const focusRate=f.total?clamp01((f.done+Math.min(f.miss,cfg().grace*f.total))/f.total):null;
 const sessionRate=st.total?clamp01((st.done+st.partial*.5)/st.total):null;
 const studyRate=sessionRate===null?null:st.planned>0?sessionRate*.7+clamp01(st.actual/st.planned)*.3:sessionRate;
 return {h,f,st,focusRate,studyRate};
}
function mentorWeek(date){
 const from=periodStart("week",date),to=periodEnd("week",date),end=to<today()?to:today(),rows=closedRows(from,end),last=rows.at(-1)?.date||end;
 const x=executionAssessment(rows),load=loadAssessment(last),tasks=taskAssessment(from,last,false);
 const components=[[30,x.h.rate],[25,x.focusRate],[20,load.rate],[15,x.studyRate],[10,tasks.rate]];
 const assessed=components.filter(([,r])=>r!==null&&Number.isFinite(r)),weight=assessed.reduce((n,[w])=>n+w,0);
 const provisional=rows.length<5||x.h.unknown>0||x.f.unknown>0||x.st.missing>0||weight<70||load.rate===null||end<to;
 let score=rows.length&&weight?Math.round(100*assessed.reduce((n,[w,r])=>n+w*r,0)/weight):null;
 if(score!==null&&provisional&&score>=96)score=95;
 if(score!==null&&score===100&&(x.h.miss||x.f.miss||x.st.miss||x.st.partial||tasks.issues.length))score=99;
 return {from,to,days:rows.length,score,rate:score,provisional,focus:x.f.total,doneFocus:x.f.done,study:x.st.total,studiesDone:x.st.done,studyMin:rows.reduce((n,s)=>n+actualStudy(s),0),plannedStudyMin:rows.reduce((n,s)=>n+(Number(s.plan?.studyMin)||0),0),tasks:tasks.rows.length,tasksDone:tasks.rows.filter(t=>t.completed).length,habits:x.h.total,habitsDone:x.h.done,habitsMiss:x.h.miss,execution:x,load,tasksAssessment:tasks};
}
const messages={
 habits:["Vamos ajustar essa rotina para que ela caiba no seu dia.","Você precisa dar às suas rotinas a mesma atenção que dá aos outros compromissos.","Você quer resultados consistentes com hábitos inconsistentes?","Planejamento sem execução é decoração. Sustente as rotinas que você assumiu."],
 focus:["Reveja o que dificultou a execução dos seus focos.","Você assumiu esses compromissos. Reorganize a agenda para cumpri-los.","Ninguém escolheu esse compromisso por você. Foi você quem decidiu que era importante.","Antes de assumir novas prioridades, entregue as que você mesmo declarou indispensáveis."],
 tasks:["Revise as tarefas que ainda precisam de atenção.","Resolva as pendências importantes ou revise sua prioridade.","Suas prioridades precisam refletir suas ações.","Se tudo é prioridade alta, você não está priorizando absolutamente nada."],
 stagnation:["Você tem uma base estável. Experimente um pequeno avanço, se fizer sentido.","Há espaço para evoluir gradualmente. Escolha um próximo passo viável.","Você está evoluindo ou apenas repetindo a mesma semana?","Já construiu uma base. Agora prove que consegue avançar sem perder a constância."],
 overload:["Seu esforço é importante. Reserve espaço para recuperação.","Reorganize a carga; seu ritmo precisa caber na sua disponibilidade.","Não confunda intensidade com disciplina. Quero um ritmo que consiga sustentar.","Não tente levantar um peso que não consegue sustentar. Constância antes de intensidade."],
 rapid:["Consolide o novo ritmo antes de aumentar novamente.","A carga cresceu rápido. Dê tempo para adaptar sua rotina.","Não tente construir em uma semana aquilo que exige meses de disciplina.","Não quero uma semana extraordinária seguida de abandono. Consolide o que conquistou."],
 drop:["Veja o que mudou e escolha um ritmo possível para retomar.","A carga diminuiu. Reavalie os obstáculos antes de planejar a recuperação.","Você já demonstrou um ritmo maior. O que mudou?","Não deixe uma queda de ritmo virar padrão. Ajuste a estratégia e retome com cautela."],
 growth:["Seu esforço está produzindo progresso.","A evolução registrada merece reconhecimento. Mantenha a estratégia.","Resultados concretos. Agora consolide essa conquista.","Finalmente, progresso comprovado. Sustente o que conquistou."],
 sustain:["Você está mantendo uma carga elevada. Cuide do descanso.","O ritmo já ocupa boa parte do tempo disponível; mantenha a constância.","Não preciso de mais horas. Preciso que você mantenha a qualidade e o descanso.","Não confunda mais horas com mais mérito. Sustente o ritmo, não se sobrecarregue."],
 study:["Observe o que dificultou as sessões planejadas.","Revise a duração e a distribuição das sessões.","Você precisa transformar sessões planejadas em estudo efetivo.","O plano não estuda por você. Cumpra o que é viável e ajuste o que não é."],
 missing:["Registre a duração quando souber.","Sem os tempos reais, não consigo avaliar a carga com precisão.","Não me dê uma conclusão sem os dados que consegue registrar.","Quero registros confiáveis, não uma lista de conclusões sem contexto."]
};
const phrases={
 good:["Esse esforço está construindo seu caminho. Continue.","Você ainda não chegou onde deseja, mas já avançou.","As raízes da educação são amargas, mas seus frutos são doces. — Atribuída a Aristóteles","Uma derrota não determina toda a trajetória.","Disciplina é continuar mesmo quando a empolgação desaparece."],
 firm:["Seu planejamento precisa sair do papel.","O que você fez nesta semana que não conseguia fazer na anterior?","Aumente sua dedicação ou reveja suas ambições.","Você quer resultados diferentes mantendo os mesmos comportamentos?"],
 caution:["Constância antes de intensidade.","Prefiro um ritmo sustentável a um esforço extraordinário que não dura.","Descansar quando necessário faz parte da preparação.","Não tente conquistar em um dia o que exige meses de prática."]
};
function voice(key){const list=messages[key]||messages.study;return list[["gentle","firm","strict","hard"].indexOf(mentorTone())];}
function mentorIssues(current){
 const issues=[],x=current.execution,load=current.load,live=taskAssessment(current.from,today(),true),rolling=habitAssessment(closedRows(add(today(),-29),today()));
 const addIssue=(key,score,tone,title,body,evidence,action)=>issues.push({key,score,tone,title,body,evidence,action:action||voice(key)});
 if(x.h.miss)addIssue("habits",92,"warning","Regularidade das rotinas",x.h.done+" de "+(x.h.done+x.h.miss)+" ocorrências registradas como cumpridas. "+rolling.groups.filter(g=>g.miss>=2).slice(0,3).map(g=>g.title+": "+g.miss+" não realizadas no último mês.").join(" "),x.h.miss+" não realizadas");
 if(x.h.unknown)addIssue("habitRecords",68,"neutral","Rotinas sem confirmação",x.h.unknown+" ocorrência(s) ficaram sem confirmação. Não vou presumir que você falhou.",""+x.h.unknown+" sem registro","Confira os registros antes de avaliar a regularidade.");
 if(x.f.miss||x.f.unknown)addIssue("focus",89,"warning","Focos pendentes ou não realizados",x.f.done+" de "+x.f.total+" focos foram concluídos. "+x.f.miss+" não realizados ou remanejados; "+x.f.unknown+" sem conclusão confirmada.",x.f.done+"/"+x.f.total);
 if(x.st.total>x.st.done)addIssue("study",78,"warning","Execução dos estudos",x.st.done+" de "+x.st.total+" sessões concluídas. "+x.st.partial+" parciais e "+x.st.miss+" não realizadas.",x.st.done+"/"+x.st.total);
 if(x.st.missing)addIssue("missing",66,"neutral","Duração sem registro",x.st.missing+" sessão(ões) sem duração confirmada.",x.st.missing+" sem duração");
 if(live.issues.length){
  const first=live.issues.sort((a,b)=>Number(b.late)-Number(a.late)||Number(b.x.priority==="high")-Number(a.x.priority==="high")||b.age-a.age)[0];
  const detail=first.late? "O prazo de «"+first.x.title+"» venceu"+(first.x.completed?" antes da conclusão.":"."):first.dueNow?"«"+first.x.title+"» vence hoje.":"«"+first.x.title+"» está pendente há "+first.age+" dias, com prioridade "+({high:"alta",medium:"média"}[first.x.priority]||"definida")+".";
  addIssue("tasks",85,"warning","Gestão das prioridades",detail+" "+live.issues.length+" pendência(s) ou atraso(s) merecem revisão.",live.issues.length+" em atenção");
 }
 if(live.alerts.length)addIssue("near",64,"neutral","Prazos próximos",live.alerts.length+" tarefa(s) de alta prioridade têm prazo próximo: "+live.alerts.slice(0,3).map(a=>a.x.title).join(", ")+".",live.alerts.length+" próximas do prazo","Reserve tempo para essas tarefas antes do vencimento.");
 const loadTitles={overload:"Carga elevada demais",rapid:"Aumento rápido da carga",stagnation:"Carga sem evolução",drop:"Redução de ritmo",growth:"Evolução dos estudos",sustain:"Ritmo elevado e estável"};
 if(loadTitles[load.kind]){
  const positive=["growth","sustain"].includes(load.kind);
  const detail=(load.kind==="overload"?load.overload+" dias com carga elevada no último mês. ":"")+ "Média recente: "+labelMinutes(load.recent.average)+" por dia registrado"+(load.prior.days>=4?", antes "+labelMinutes(load.prior.average):"")+". "+(load.kind==="sustain"||load.kind==="overload"?"Considere os outros compromissos e as pausas necessárias.":load.kind==="stagnation"?"Há espaço na disponibilidade registrada; avalie um avanço gradual.":"");
  addIssue(load.kind,load.kind==="overload"?96:load.kind==="stagnation"?84:load.kind==="rapid"?87:76,positive?"good":"warning",loadTitles[load.kind],detail,labelMinutes(load.recent.average)+"/dia");
 }
 if(x.h.done&&x.h.miss===0&&x.h.unknown===0)addIssue("habitGood",72,"good","Rotinas consistentes",x.h.done+" ocorrências cumpridas.",""+x.h.done+" realizadas","Continue sustentando seus hábitos.");
 if(x.f.done)addIssue("focusGood",60,"good","Focos entregues",x.f.done+" compromissos concluídos.",String(x.f.done),"Mantenha a qualidade.");
 if(x.st.done)addIssue("studyGood",60,"good","Sessões concluídas",x.st.done+" sessões concluídas nos dias analisados.",String(x.st.done),"Continue registrando os resultados reais.");
 for(const a of legacyMentorAnalysis().items.filter(i=>["deleted","late","pauses"].includes(i.key)))issues.push(a);
 if(!issues.length)addIssue("forming",10,"neutral","Acompanhamento em formação","Ainda preciso de mais registros para avaliar sua trajetória.","Histórico em formação","Continue registrando seus compromissos.");
 const memory=ev.mentor.issueHistory||{};
 for(const i of issues){
  const old=memory[i.key];
  if(i.tone==="warning"&&old?.active&&elapsedDays(old.first||today(),today())>=7)i.body="Já conversamos sobre esse padrão. "+i.body;
 }
 for(const [key,old] of Object.entries(memory)){
  if(!old?.active||!old?.last||elapsedDays(old.last,today())>30)continue;
  const improved=(key==="habits"&&x.h.total>=3&&x.h.miss===0&&x.h.unknown===0)||(key==="focus"&&x.f.total>0&&x.f.done===x.f.total)||(key==="stagnation"&&load.kind==="growth")||(key==="tasks"&&live.issues.length===0&&live.rows.some(t=>t.completed&&t.completed>=old.last));
  if(improved)addIssue("recovery-"+key,90,"good","Melhora após cobrança","O padrão que conversamos anteriormente apresentou melhora nos registros atuais.","Avanço registrado","Agora mantenha essa mudança.");
 }
 return issues.sort((a,b)=>b.score-a.score);
}
function mentorAnalysis(){
 const current=mentorWeek(today()),items=mentorIssues(current);
 return {items,digest:items.map(x=>x.key+":"+x.evidence).join("|"),important:items.some(x=>x.tone==="warning"),closed:current.days,days:current.days};
}
function mentorNoticeEligible(){
 if(ev.settings.mentorEnabled===false||ev.settings.mentorNotices===false)return false;
 if(Date.parse(ev.mentor.snoozeUntil||"")>Date.now())return false;
 const last=Math.max(...[ev.mentor.lastViewed,ev.mentor.lastDelivery].map(v=>Date.parse(v||"")).filter(Number.isFinite),Date.parse(first()+"T00:00:00"));
 const days=Math.max(3,Math.min(30,Number(ev.settings.mentorInterval)||7));
 return Number.isFinite(last)&&Date.now()-last>=days*M_DAY;
}
function mentorUnreadCount(){return mentorNoticeEligible()?1:0;}
function mentorUnread(){return mentorUnreadCount()>0;}
function mentorNotice(){
 if(!mentorNoticeEligible())return "";
 return '<aside class="card evo-mentor-message evo-mentor-note" aria-label="Lembrete do Orientador"><div class="evo-mentor-copy"><strong>Há algum tempo não conversamos.</strong><p>Quando puder, vamos rever seu desempenho.</p><div class="row"><button class="btn small ghost" data-s4="mentorOpen">Consultar</button><button class="btn small ghost" data-s4="mentorDismiss">Agora não</button></div></div></aside>';
}
function mentorVisualData(){
 const current=mentorWeek(today()),previous=mentorWeek(add(today(),-7)),history=[];
 for(let k=5;k>=0;k--)history.push(mentorWeek(add(today(),-k*7)));
 const known=history.filter(x=>x.score!==null),delta=current.score!==null&&previous.score!==null?current.score-previous.score:null;
 const all=mentorAnalysis(),problems=all.items.filter(i=>i.tone==="warning").map(i=>({...i,value:i.evidence,description:i.body})),positives=all.items.filter(i=>i.tone==="good").map(i=>({...i,value:i.evidence,description:i.body})),more=all.items.filter(i=>i.tone==="neutral");
 const ranked=problems[0],score=current.score;
 const grade=score===null?"Sem nota ainda":score===100?"Excepcional":score>=90?"Excelente":score>=80?"Muito bom":score>=70?"Bom":score>=60?"Regular":score>=40?"Insatisfatório":"Crítico";
 const stateTone=score===null?"neutral":score>=80?"good":score>=60?"mid":"bad";
 const category=["overload","rapid"].includes(ranked?.key)||["sustain","overload","rapid"].includes(current.load.kind)?"caution":ranked&&["strict","hard"].includes(mentorTone())?"firm":"good";
 const list=phrases[category],seed=Number(today().replaceAll("-",""));
 const slogan=ranked?ranked.action:positives[0]?.action||"Vamos acompanhar seus registros.";
 const proposal=previous.score===null?null:Math.min(100,previous.score+(previous.score>=85?3:5));
 return {current,previous,history,known,delta,problems,positives,more,ranked,grade,stateTone,slogan,proposal,phrase:list[seed%list.length]};
}
function mentorTrendGraph(data){
 const weeks=data.history,valid=weeks.filter(w=>w.score!==null);
 if(!valid.length)return '<p class="note">Ainda não há registros suficientes para acompanhar a evolução.</p>';
 return '<div class="evo-boss-chart" role="img" aria-label="Notas de execução das últimas seis semanas">'+weeks.map((w,i)=>{
  const h=w.score===null?0:Math.max(3,w.score);
  const color=w.score===null?"none":w.score>=70?"good":w.score>=50?"mid":"bad";
  return '<div class="evo-boss-barcol" title="'+E("Semana de "+fmt(w.from,false)+": "+(w.score===null?"sem nota":w.score+"/100"))+'"><strong>'+(w.score===null?"—":w.score)+'</strong><div class="evo-boss-barback">'+(w.score!==null?'<span class="'+color+'" style="height:'+h+'%"></span>':"")+'</div><small>'+E(i===weeks.length-1?"Atual":"S-"+(weeks.length-i-1))+'</small></div>';
 }).join("")+'</div><p class="note">Histórico de desempenho. Semanas com poucos dados são provisórias.</p>';
}
let mentorDraftTarget=null,statsExpanded=false;
function mentorPanel(){
 if(ev.settings.mentorEnabled===false)return '<section class="card"><h2>Orientador desativado</h2><p class="note">Suas estatísticas continuam disponíveis. Você pode reativar a análise nas preferências abaixo.</p></section>';
 const d=mentorVisualData(),x=d.current,tone=ev.settings.strictness||"firm",score=x.score;
 const display=score===null?"—":String(score),delta=d.delta;
 const trend=delta===null?"Sem comparação":delta>0?"▲ +"+delta+" p.p.":delta<0?"▼ "+delta+" p.p.":"● Estável";
 const trendTone=delta===null?"neutral":delta>0?"good":delta<0?"bad":"mid";
 const critique=d.slogan;
 const top=d.ranked?d.ranked.title+" · "+d.ranked.value:(score===null?"Ainda não há desempenho confirmado para cobrar.":"Mantenha o que está funcionando e cuide dos próximos compromissos.");
 const issue=(v,i)=>'<details class="evo-boss-detail"><summary><span class="evo-boss-detail-icon">!</span><span>'+E(v.title)+'</span><strong>'+E(v.value)+'</strong></summary><div><p>'+E(v.description)+'</p><p><strong>Próximo passo:</strong> '+E(v.action)+'</p></div></details>';
 const good=(v,i)=>'<details class="evo-boss-detail"><summary><span class="evo-boss-detail-icon">✓</span><span>'+E(v.title)+'</span><strong>'+E(v.value)+'</strong></summary><div><p>'+E(v.description)+'</p></div></details>';
 const target=mentorDraftTarget===null?d.proposal??60:mentorDraftTarget;
 const goal=ev.mentor.goal,finished=goal&&goal.weekEnd<today(),goalResult=goal&&finished?mentorWeek(goal.weekStart):null;
 const oldGoal=goal&&goal.scoringVersion!==2;const goalState=oldGoal?"Compromisso da avaliação anterior":goalResult&&goalResult.score!==null&&!goalResult.provisional?(goalResult.score>=goal.target?"Meta cumprida":"Meta não cumprida"):"Ainda sem resultado conclusivo";
 return '<section class="card evo-mentor-section evo-boss"><div class="evo-boss-head"><span class="overline">◉ Meu Orientador · CHEFE DE DESEMPENHO</span><span class="evo-boss-mini">'+E(x.days)+" dia(s) encerrado(s) nesta semana"+'</span></div>'+
 '<div class="evo-boss-diagnosis"><div class="evo-boss-score '+d.stateTone+'"><small>NOTA DE EXECUÇÃO</small><strong>'+display+'<span>/100</span></strong><b>'+E(d.grade)+'</b></div><div class="evo-boss-verdict"><span class="evo-boss-trend '+trendTone+'">'+E(trend)+'</span><h2>'+E(score===null?"Vamos acompanhar sua trajetória.":d.ranked?d.ranked.title:score>=90?"Bom trabalho. Mantenha a constância.":"Continue consolidando sua rotina.")+'</h2><p>'+E(critique)+'</p><small>'+E(x.provisional?"Avaliação provisória · "+x.days+" dia(s) finalizado(s)":"Avaliação dos registros disponíveis")+'.</small></div></div>'+
 '<p class="note evo-mentor-phrase">'+E(d.phrase)+'</p><div class="evo-boss-priority '+(d.ranked?"bad":"good")+'"><span>MINHA COBRANÇA PRINCIPAL</span><strong>'+E(top)+'</strong><small>'+E(d.ranked?d.ranked.action:"Continue registrando seus resultados reais.")+'</small></div>'+
 '<div class="evo-boss-grid"><details class="evo-boss-tile evo-boss-bad"><summary><span>✕</span><strong>Pontos de melhoria</strong><small>'+d.problems.length+' ponto(s)</small></summary><div class="evo-boss-tile-body">'+(d.problems.length?d.problems.map(issue).join(""):'<p class="note">Nenhuma falha confirmada nesta amostra.</p>')+'</div></details>'+
 '<details class="evo-boss-tile evo-boss-good"><summary><span>✓</span><strong>Pontos positivos</strong><small>'+d.positives.length+' avanço(s)</small></summary><div class="evo-boss-tile-body">'+(d.positives.length?d.positives.map(good).join(""):'<p class="note">Os pontos positivos aparecem conforme forem confirmados.</p>')+'</div></details>'+
 '<details class="evo-boss-tile"><summary><span>▥</span><strong>Minha evolução</strong><small>Últimas 6 semanas</small></summary><div class="evo-boss-tile-body">'+mentorTrendGraph(d)+'</div></details>'+
 '<details class="evo-boss-tile"><summary><span>◎</span><strong>Meta da semana</strong><small>Negociar com o chefe</small></summary><div class="evo-boss-tile-body"><p class="note">Proposta para a próxima semana: '+(d.proposal===null?"sem histórico comparável ainda":d.proposal+"% de execução")+'. Você pode escolher uma meta menor ou maior.</p><label class="evo-boss-target-label" for="s4-mentor-target">Sua meta <strong id="s4-mentor-target-value">'+target+'%</strong></label><input type="range" id="s4-mentor-target" min="0" max="100" step="5" value="'+target+'"><p class="note">Escolha um compromisso realista para a próxima semana.</p><button class="btn primary small" data-s4="mentorAcceptGoal">Assumir compromisso</button>'+
 (goal?'<div class="evo-boss-commitment"><strong>Compromisso registrado: '+goal.target+'%</strong><small>Semana de '+E(fmt(goal.weekStart,false))+' a '+E(fmt(goal.weekEnd,false))+'</small><p>'+E(finished?"Prestação de contas: "+goalState+(!oldGoal&&goalResult?.score!=null?" · avaliação "+goalResult.score+"%.":"."):"O chefe vai conferir este compromisso depois do prazo.")+'</p></div>':"")+
 '</div></details>'+
 '<details class="evo-boss-tile"><summary><span>▤</span><strong>Análises adicionais</strong><small>Registro, pausas e hábitos</small></summary><div class="evo-boss-tile-body">'+d.more.map(v=>'<details class="evo-boss-detail"><summary><span>'+E(v.title)+'</span><strong>'+E(v.evidence)+'</strong></summary><div><p>'+E(v.body)+'</p><p>'+E(v.action)+'</p></div></details>').join("")+'<p class="note">Vamos distinguir falta de registro de falta de execução.</p></div></details></div>'+
 '<div class="evo-boss-bottom"><button class="btn small ghost" data-s4="mentorStats">▥ Consultar estatísticas completas</button></div></section>';
}

function metric(label,value,subtitle){return '<div class="metric-card"><span>'+E(label)+'</span><strong>'+E(value)+'</strong>'+(subtitle?'<small>'+E(subtitle)+'</small>':"")+'</div>';}
function percent(value,total){return total?Math.round(value/total*100)+"%":"—";}
function dayReview(date){
 const snap=ev.closed[date]||capture(date),n=dailyCounts(snap),closed=isClosed(date),remaining=pendingDates(date);
 const unavailable=date>today();
 let content='<div class="hero-row"><div><div class="overline">FECHAMENTO DO DIA</div><h1>'+E(fmt(date,true))+'</h1><p class="kicker">'+(closed?"Registro finalizado e bloqueado para edição.":unavailable?"Um dia futuro não pode ser encerrado.":"Revise cada registro antes de tornar o dia definitivo.")+'</p></div><button class="btn small ghost" data-s4="backHome">← Voltar</button></div>';
 if(closed){
  content+='<div class="evo-alert evo-good">✓ Fechado em '+E(new Date(snap.confirmed).toLocaleString("pt-BR"))+'. Os registros desta data são somente leitura.</div>';
  content+='<section class="card"><div class="card-head"><h2>Balanço do dia</h2></div><p class="note">'+
   (n.foci?"Você concluiu "+n.doneFocus+" de "+n.foci+" foco(s). ":"Nenhum foco obrigatório foi registrado. ")+
   (n.plannedStudy?"Registrou "+minutes(snap.result.actualStudyMin)+" de tempo real em estudos; "+n.missingStudyTimes+" sessão(ões) sem tempo informado. ":"Não há sessões de estudo cadastradas. ")+
   (snap.pause?"A pausa foi registrada sem apagar as atividades planejadas.":"")+
   '</p><div class="row"><button class="btn small" data-s4="viewStats">Ver estatísticas</button>'+
   (lastStudyDayOfWeek(date)?'<button class="btn small primary" data-s4="viewStats">Balanço da semana</button>':"")+
   '</div></section>';
 }
 if(!closed&&remaining.length)content+='<div class="evo-alert evo-warning">Há '+remaining.length+' dia(s) anteriores aguardando fechamento. <button class="btn small" data-s4="batchReview">Revisar e finalizar em lote</button> <button class="btn small ghost" data-s4="reviewDate" data-date="'+A(remaining[0])+'">Primeiro dia</button></div>';
 content+='<div class="metrics-grid">'+metric("Focos concluídos",n.doneFocus+"/"+n.foci,n.missedFocus+" não realizados/remanejados")+metric("Estudos concluídos",n.studiesDone+"/"+n.plannedStudy,n.studiesPartial+" parcial(is)")+metric("Estudo real",minutes(snap.result.actualStudyMin),n.missingStudyTimes+" sem tempo registrado")+metric("Carga planejada",minutes(snap.plan.totalMin),"Tempo previsto, não execução")+'</div>';
 if(snap.pause)content+='<div class="evo-alert">☾ '+E(snap.pause.kind==="planejado"?"Descanso planejado":snap.pause.kind==="imprevisto"?"Pausa por imprevisto":"Descanso decidido no dia")+(snap.pause.reason?" — "+E(snap.pause.reason):"")+'</div>';
 content+='<section class="card"><div class="card-head"><h2>Revisão dos compromissos</h2>'+C.tag(n.unmarked+" sem conclusão")+'</div>'+(
 snap.activities.length?'<div class="review-lines">'+snap.activities.map(x=>reviewLine(x.title,x.status,x.estimatedMin,x.actualMin)).join("")+'</div>':'<p class="note">Nenhuma atividade cadastrada para este dia.</p>')+'</section>';
 if(!closed)content+='<div class="evo-review-open"><button class="btn small primary" data-s4="openEditableDay" data-date="'+A(date)+'">Editar atividades e estudos deste dia</button><p class="note">Abra o dia, marque ou desmarque os registros e volte para finalizar. Você também pode sair sem encerrar.</p></div>';
 content+='<section class="card"><div class="card-head"><h2>Revisão dos estudos</h2>'+C.tag(n.missingStudyTimes+" tempos não informados")+'</div>'+(
 snap.studies.length?'<div class="review-lines">'+snap.studies.map((x,i)=>reviewStudyLine(x,i)).join("")+'</div>':'<p class="note">Nenhuma sessão de estudo cadastrada.</p>')+'</section>';
 if(!closed&&!unavailable){
 content+='<section class="card evo-confirm"><h2>Finalizar definitivamente</h2><p class="note">Atividades pendentes permanecerão pendentes ou sem registro; não serão inventadas conclusões. A tarefa secundária poderá continuar em dias futuros, mas esta fotografia do dia não poderá ser editada.</p><p class="note">Depois de finalizar, não será possível acrescentar, apagar, remanejar ou corrigir os registros desta data pela interface.</p><form id="s4-finalize"><input type="hidden" name="date" value="'+A(date)+'"><label class="checkline"><input type="checkbox" name="reviewed" required> Revisei atividades, horários, estudos e registros ausentes.</label><div class="field"><label>Digite FINALIZAR para confirmar</label><input name="phrase" type="text" autocomplete="off" required placeholder="FINALIZAR"></div><button class="btn danger" type="submit" '+(remaining.length?"disabled":"")+'>Finalizar dia sem possibilidade de reabertura</button></form></section>';
 }
 return content;
}
// Sessões permanecem identificáveis mesmo quando várias matérias se repetem.
function reviewStudyLine(x,i){
 const context=[x.discipline||"Matéria não informada",x.topic,x.cycle||x.area,x.method].filter(Boolean).join(" · ");
 return reviewLine("Sessão "+(i+1),x.status,x.plannedMin,x.actualMin,context);
}
function reviewLine(title,status,planned,actual,details=""){
 const st={done:"Concluído",progress:"Em andamento",pending:"Sem registro de conclusão",moved:"Remanejado",notdone:"Não realizado"};
 return '<div class="review-line"><div><strong>'+E(title)+'</strong>'+
 (details?'<span class="study-review-context">'+E(details)+'</span>':"")+
 '<small>'+E(st[status]||status)+' · previsto '+(planned!=null?minutes(planned):"não informado")+
 ' · real '+(actual!=null?minutes(actual):"não informado")+'</small></div>'+
 '<span class="dot-state '+(status==="done"?"done":status==="pending"?"muted":"")+'">'+(status==="done"?"✓":"·")+'</span></div>';
}
function chartDays(x){
 if(!x.days.length)return '<p class="note">Ainda não há registros para representar.</p>';
 const max=Math.max(60,...x.days.map(q=>q.studyMin));
 return '<div class="evo-chart">'+x.days.slice(-14).map(row=>'<div class="evo-bar-col" title="'+E(row.date)+': '+minutes(row.studyMin)+'"><div class="evo-bar">'+(row.studyMin?'<i style="height:'+Math.max(4,Math.round(row.studyMin/max*100))+'%"></i>':'<span class="evo-zero">·</span>')+'</div><small>'+E(String(Number(row.date.slice(-2))))+'</small></div>').join("")+'</div>';
}
function previousComparison(x){
 if(x.kind!=="week"&&x.kind!=="month"&&x.kind!=="year")return "";
 const old=x.kind==="week"?add(x.from,-7):x.kind==="month"?iso(new Date(parse(x.from).getFullYear(),parse(x.from).getMonth()-1,1,12)):(Number(x.from.slice(0,4))-1)+"-01-01";
 if(old<first())return "";
 const prior=periodData(x.kind,old);
 const a=x.count,b=prior.count;
 if(a.closed<5||b.closed<5||a.focus<5||b.focus<5)return "";
 const currentRate=Math.round(a.doneFocus/a.focus*100),previousRate=Math.round(b.doneFocus/b.focus*100);
 const message=currentRate===previousRate?"O cumprimento percentual permaneceu igual.":currentRate>previousRate?"O cumprimento percentual cresceu "+(currentRate-previousRate)+" ponto(s).":"O cumprimento percentual caiu "+(previousRate-currentRate)+" ponto(s).";
 return '<section class="card"><div class="card-head"><h2>Comparação com o período anterior</h2></div><div class="metrics-grid">'+
 metric("Anterior",previousRate+"%",b.doneFocus+"/"+b.focus+" focos")+
 metric("Atual",currentRate+"%",a.doneFocus+"/"+a.focus+" focos")+
 '</div><p class="note" style="margin-top:12px">'+E(message)+' Compare também a quantidade e a dificuldade dos compromissos; porcentagens isoladas não demonstram qualidade do estudo.</p></section>';
}

function mentorActivitySummary(x){
 const n=x.count,rows=[
  ["Focos do dia",n.doneFocus,n.focus],
  ["Sessões de estudo",n.studiesDone,n.study],
  ["Rotinas e hábitos",n.habitDone,n.habits],["Tarefas secundárias",n.tasksDone,n.tasks]
 ];
 const cards=rows.map(([name,done,total])=>{
  const flexible=name==="Tarefas secundárias",pct=total?Math.round(done/total*100):null;
  const klass=flexible||pct===null?"neutral":pct>=75?"good":pct>=45?"mid":"bad";
  return '<div class="evo-boss-activity"><div><strong>'+E(name)+'</strong><span>'+done+' / '+total+'</span></div><div class="evo-boss-progress" role="img" aria-label="'+E(name+': '+(pct===null?'sem dados':pct+' por cento concluídos'))+'"><i class="'+klass+'" style="width:'+(pct||0)+'%"></i></div><small>'+(pct===null?"Sem compromissos no período":flexible?done+" concluídas · pendências não são falhas automáticas":pct+"% realizados")+'</small></div>';
 }).join("");
 const seen=Object.keys(ev.visitedDays||{}).filter(day=>day>=x.from&&day<=x.to&&day<=today()).length;
 const high=taskHistory(today(),true).filter(v=>v.priority==="high"&&!v.completed).length;
 return '<section class="card evo-boss-usage"><div class="card-head"><div><h2>Execução do planejamento</h2><p class="note">Quanto você está planejando e quanto realmente entrega?</p></div></div>'+
 '<div class="evo-boss-activity-grid">'+cards+'</div><div class="evo-boss-usage-foot"><span>◷ '+seen+' dia(s) com abertura registrada neste período</span><span>◉ '+high+' tarefa(s) de alta prioridade ainda pendente(s)</span></div>'+
 '<p class="note">Abrir o Órbita não equivale a estudar. Tarefas recorrentes e datas ainda não encerradas podem estar pendentes legitimamente.</p></section>';
}
function overviewPeriod(x){
 const n=x.count,rate=focusRate(n),source=x.final?"Relatório definitivo":"Análise provisória";
 let html='<div class="row-between"><div><div class="overline">EVOLUÇÃO · '+E(source.toUpperCase())+'</div><h2 style="margin:7px 0">'+E(fmt(x.from,false))+' — '+E(fmt(x.to,false))+'</h2></div><div class="row">'+C.tag(x.final?"Consolidado":"Provisório",x.final?"good":"warn")+'</div></div>';
 if(!x.final)html+='<p class="note">Parte do período ainda não foi finalizada ou não possui registros. As análises são descritivas; dias sem atividade registrada não são tratados como fracasso.</p>';
 html+='<div class="metrics-grid">'+metric("Compromissos",rate==null?"—":rate+"",n.doneFocus+" de "+n.focus+" focos concluídos")+metric("Horas reais de estudo",minutes(n.studyActualMin),n.missingStudyTimes+" sessões sem tempo")+metric("Horas planejadas",minutes(n.plannedMin),"Tarefas e estudos sem dupla contagem")+metric("Descansos",n.rest+" planejado(s)",n.unplannedPauses+" pausa(s) extraordinária(s)")+'</div>';
 html+=mentorActivitySummary(x);
 html+=previousComparison(x);
 html+='<section class="card evo-period-chart"><div class="card-head"><h2>Distribuição diária do estudo</h2><span class="note">Minutos realmente informados</span></div>'+chartDays(x)+'</section>';
 
 if(ev.milestones.length)html+='<section class="card"><div class="card-head"><h2>Conquistas reais</h2></div><div class="evo-achievements">'+ev.milestones.slice(-5).reverse().map(m=>'<div class="evo-achievement"><span aria-hidden="true">✦</span><div><strong>'+E(m.title)+'</strong><small>Concedida uma única vez, com base em fechamentos completos de focos.</small></div></div>').join("")+'</div></section>';

 html+='<section class="card"><div class="card-head"><h2>Mais indicadores</h2></div><div class="evo-rows">'+
 reportRow("Sessões concluídas",n.studiesDone+" / "+n.study)+
 reportRow("Sessões parciais",String(n.partial))+
 reportRow("Sessões não realizadas",String(n.studiesNotDone))+
 reportRow("Sessões planejadas",String(n.study))+
 reportRow("Rotinas concluídas",n.habitDone+" / "+n.habits)+
 reportRow("Pontualidade registrada",n.habitRecordedTimes?n.habitOnTime+"/"+n.habitRecordedTimes:"Não avaliada")+
 reportRow("Tarefas secundárias concluídas",String(n.tasksDone))+
 reportRow("Questões registradas",n.questions?n.correct+" acertos de "+n.questions+" respostas":"Sem resultados registrados")+
 reportRow("Qualidade percebida (autoavaliação)",n.qualityRated?(n.qualitySum/n.qualityRated).toFixed(1)+"/5 · "+n.qualityRated+" respostas":"Não informada")+
 reportRow("Tempo real de outras atividades",minutes(Math.max(0,n.actualMin-n.studyActualMin)))+
 reportRow("Dias efetivamente fechados",String(n.closed))+
 reportRow("Dias com compromissos abertos",String(n.open))+
 reportRow("Dias sem registros",String(n.unobserved))+
 '</div></section>';
 const areas=Object.entries(x.byArea).sort((a,b)=>b[1]-a[1]);
 if(areas.length)html+='<section class="card"><div class="card-head"><h2>Horas por área de estudo</h2></div><div class="evo-rows">'+areas.map(([name,num])=>reportRow(E(name),minutes(num))).join("")+'</div><p class="note">Uma matéria pode aparecer em várias áreas; suas horas pertencem apenas à área de cada sessão.</p></section>';
 return html;
}
function reportRow(left,right){return '<div class="row-between evo-row"><span>'+left+'</span><strong>'+E(right)+'</strong></div>';}
function viewEvolution(){
 const current=periodData(period,referenceDate);
 return '<div class="hero-row"><div><div class="overline">SEU HISTÓRICO</div><h1>Minha evolução</h1><p class="kicker">Os resultados vêm de registros reais. Constância conta tanto quanto aumentar a quantidade.</p></div><div class="row"><button class="btn small ghost" data-s4="backProfile">← Perfil</button><button class="btn small" data-s4="reviewDate" data-date="'+A(state.date)+'">Fechar dia</button></div></div>'+
 
 mentorPanel()+
 '<details class="evo-boss-stat-panel" id="evo-boss-statistics" '+(statsExpanded?'open':'')+'><summary>▥ Consultar todas as estatísticas · dia, semana, mês e ano</summary><div class="evo-statistics-area">'+
 '<div class="evo-toolbar"><div class="tab-line">'+[["day","Dia"],["week","Semana"],["month","Mês"],["year","Ano"]].map(([key,label])=>'<button class="tab '+(period===key?"active":"")+'" data-s4="period" data-period="'+key+'">'+label+'</button>').join("")+'</div><div class="row"><button class="btn small ghost" data-s4="prevPeriod">‹</button><button class="btn small" data-s4="currentPeriod">Atual</button><button class="btn small ghost" data-s4="nextPeriod">›</button></div></div>'+
 overviewPeriod(current)+
 '</div></details>'+
 '<section class="card"><div class="card-head"><h2>Preferências do orientador</h2></div><div class="evo-settings"><label class="checkline"><input id="s4-mentor-enabled" type="checkbox" '+(ev.settings.mentorEnabled!==false?"checked":"") +'> Ativar Orientador</label><label class="checkline"><input id="s4-mentor-notices" type="checkbox" '+(ev.settings.mentorNotices!==false?"checked":"")+'> Avisos discretos na tela inicial</label><label class="field">Personalidade<select id="s4-tone"><option value="hard" '+(ev.settings.strictness==="hard"?"selected":"")+'>Chefe implacável</option><option value="strict" '+(ev.settings.strictness==="strict"?"selected":"")+'>Chefe exigente</option><option value="firm" '+(ev.settings.strictness==="firm"?"selected":"")+'>Equilibrado</option><option value="gentle" '+(ev.settings.strictness==="gentle"?"selected":"")+'>Compreensivo</option></select></label><label class="field">Intervalo do lembrete<select id="s4-mentor-interval">'+[3,7,14,30].map(n=>'<option value="'+n+'" '+(Number(ev.settings.mentorInterval||7)===n?"selected":"")+'>A cada '+n+' dias</option>').join("")+'</select></label><label class="checkline"><input id="s4-reminders" type="checkbox" '+(ev.settings.reminders!==false?"checked":"")+'> Lembretes discretos de estatísticas</label></div></section>';
}
function yesterday(){return add(today(),-1);}
function lastStudyDayOfWeek(d){
 const weekEnd=periodEnd("week",d);
 if(d===weekEnd)return true;
 for(let j=add(d,1);j<=weekEnd;j=add(j,1)){
  if(C.resolveAvailability(j)?.mode!=="rest")return false;
 }
 return true;
}
function reminderEligible(){
 if(ev.settings.reminders===false||!ev.closed||!Object.keys(ev.closed).length)return false;
 const latest=Object.values(ev.closed).sort((a,b)=>b.date.localeCompare(a.date))[0];
 if(!latest)return false;
 const statsDate=dateOnly(ev.lastStatsView);
 const dismissed=dateOnly(ev.lastReminderDismissed);
 const ageSinceViewed=statsDate?(parse(today())-parse(statsDate))/86400000:99;
 const ageSinceDismiss=dismissed?(parse(today())-parse(dismissed))/86400000:99;
 const closedSinceView=Object.keys(ev.closed).filter(d=>!statsDate||d>statsDate).length;
 return ageSinceViewed>=7&&ageSinceDismiss>=7&&closedSinceView>=3;
}
function homeDecor(base){
 if(!C.availabilityReady())return base;
 const date=state.date,closed=ev.closed[date],pending=pendingDates();
 if(date<=today()&&!ev.visitedDays[date]){ev.visitedDays[date]=true;C.save();}
 let upper="";
 if(pending.length&&date===today())upper+='<div class="evo-alert evo-warning"><strong>Fechamento pendente</strong><span> Há '+pending.length+' dia(s) anteriores com planejamento ou registros. Você pode revisar e finalizar tudo de uma vez.</span><button class="btn small" data-s4="batchReview">Revisar e finalizar em lote</button><button class="btn small ghost" data-s4="reviewDate" data-date="'+A(pending[0])+'">Ver primeiro dia</button></div>';
 if(closed){
  const ct=dailyCounts(closed);
  return '<section class="hero-row"><div><div class="overline">REGISTRO DEFINITIVO</div><h1>'+E(fmt(date,true))+'</h1><p class="kicker">Histórico somente leitura; os dados abaixo foram preservados no fechamento.</p></div><div class="row">'+C.dateNavigator()+(date!==today()?'<button class="btn small ghost" data-action="goToday">Hoje</button>':"")+'<button class="btn small" data-s4="reviewDate" data-date="'+A(date)+'">Relatório diário</button></div></section>'+
  '<div class="evo-alert evo-good">✓ Dia finalizado. Os resultados mostrados pertencem ao registro preservado no fechamento.</div>'+
   
  '<div class="metrics-grid">'+metric("Focos",ct.doneFocus+"/"+ct.foci)+metric("Sessões",ct.studiesDone+"/"+ct.plannedStudy)+metric("Estudo real",minutes(closed.result.actualStudyMin))+metric("Carga prevista",minutes(closed.plan.totalMin))+'</div>'+
  '<section class="card"><h2 class="section-title">Atividades registradas</h2><div class="review-lines">'+(closed.activities.map(x=>reviewLine(x.title,x.status,x.estimatedMin,x.actualMin)).join("")||'<p class="note">Sem atividades.</p>')+'</div></section>'+
  '<section class="card"><h2 class="section-title">Estudos registrados</h2><div class="review-lines">'+(closed.studies.map((x,i)=>reviewStudyLine(x,i)).join("")||'<p class="note">Sem sessões.</p>')+'</div></section>';
 }
 if(date>today())return base;
 const closeLink='<div class="evo-footer"><button class="btn primary" data-s4="reviewDate" data-date="'+A(date)+'">Finalizar dia</button><button class="btn small ghost" data-s4="viewStats">Evolução</button></div>';
 const miniWeek=ev.settings.mentorEnabled===false&&lastStudyDayOfWeek(date)?'<div class="evo-alert"><span>Último dia de estudos previsto na semana. O balanço semanal já pode ser consultado como prévia; será definitivo após fechar os dias restantes.</span><button class="btn small" data-s4="viewStats">Ver semana</button></div>':"";
 const remind=ev.settings.mentorEnabled===false&&reminderEligible()?'<div class="evo-alert evo-reminder"><span>Seu desempenho merece uma revisão. Há novos registros para analisar.</span><button class="btn small" data-s4="viewStats">Ver estatísticas</button><button class="btn small ghost" data-s4="dismissReminder">Depois</button><button class="btn small ghost" data-s4="disableReminder">Desativar</button></div>':"";
 return upper+base+mentorNotice()+remind+miniWeek+closeLink;
}
function profileDecor(base){
 return base+'<section class="card"><div class="card-head"><h2>Evolução e orientador</h2><button class="btn primary small" data-s4="viewStats">Abrir estatísticas</button></div><p class="note">Análises diárias, semanais, mensais e anuais, descanso, consistência, carga e recomendações contextualizadas.</p>'+overviewMini()+'</section>';
}
function overviewMini(){
 const closed=Object.keys(ev.closed);
 return '<div class="row"><span class="status">'+closed.length+' dia(s) finalizado(s)</span><span class="status">'+pendingDates().length+' fechamento(s) pendente(s)</span><span class="status">'+ev.milestones.length+' conquista(s) fundamentada(s)</span></div>';
}
function calendarDecor(base){
 if(!isClosed(state.date))return base;
 // Nunca mostrar edição da data já finalizada: o resumo imutável é exibido no lugar do planejamento.
 const marker='<section class="card board">';
 const pos=base.indexOf(marker);
 const firstSection=pos<0?base:base.slice(0,pos);
 const snapshot=ev.closed[state.date];
 if(!snapshot)return base;
 return firstSection.replace(/<button[^>]*data-s2="pause"[^>]*>[\s\S]*?<\/button>/g,"")+'<section class="card"><div class="card-head"><h2>Dia finalizado · somente leitura</h2><button class="btn small" data-s4="reviewDate" data-date="'+A(state.date)+'">Ver relatório</button></div><p class="note">Planejamento e resultados preservados no momento do fechamento.</p><div class="review-lines">'+snapshot.activities.map(x=>reviewLine(x.title,x.status,x.estimatedMin,x.actualMin)).join("")+snapshot.studies.map(x=>reviewLine(x.discipline,x.status,x.plannedMin,x.actualMin)).join("")+'</div></section>';
}
function decorate(route,base){
 if(route==="inicio")return homeDecor(base);
 if(route==="perfil")return profileDecor(base);
 if(route==="planejamento")return calendarDecor(base);
 if(route==="evolucao"){if(ev.settings.mentorEnabled!==false&&ev.mentor.reviewDay!==today())markViewed();return viewEvolution();}
 if(route==="fechamento")return dayReview(state.date);
 return base;
}
function markViewed(){
 const analysis=mentorAnalysis(),day=today();ev.mentor.issueHistory||={};
 if(ev.mentor.reviewDay!==day){
  const memory=ev.mentor.issueHistory;
  for(const a of analysis.items.filter(i=>i.tone==="warning")){
   const old=memory[a.key];memory[a.key]={first:old?.active?old.first:day,last:day,active:true,count:(old?.count||0)+1};
  }
  for(const a of analysis.items.filter(i=>i.key.startsWith("recovery-"))){const old=memory[a.key.slice(9)];if(old)old.active=false;}
  ev.mentor.previousReview=ev.mentor.lastReview||null;ev.mentor.lastReview={studyActualMin:periodData("week",day).count.studyActualMin,at:now()};ev.mentor.reviewDay=day;
 }
 ev.lastStatsView=now();ev.mentor.lastViewed=now();ev.mentor.lastReadSignature=analysis.digest;ev.mentor.dismissedSignature="";ev.mentor.snoozeUntil="";mentorOptionsOpen=false;C.save();
}
function goView(){period="week";referenceDate=state.date;markViewed();C.go("evolucao");}
function confirmSubmit(data){
 if(!data.has("reviewed")||String(data.get("phrase")||"").trim()!=="FINALIZAR")throw Error("Marque a revisão e digite FINALIZAR exatamente.");
 const date=String(data.get("date")||"");
 finalize(date);
 showFinishedFeedback([date]);
}
const actions={
 batchReview(){batchReview()},
 batchDay(b){dayDetailInBatch(b.dataset.date)},
 markActivity(b){
  const date=b.dataset.date,id=b.dataset.id,status=b.dataset.status;
  if(isClosed(date))throw Error("Dia finalizado, sem edição.");
  S2.quickRecord(id,date,status);
  dayDetailInBatch(date);
 },
 editActivity(b){actions.openEditableDay(b)},
 editStudy(b){actions.openEditableDay(b)},
 openEditableDay(b){
  const date=b.dataset.date;
  if(!validDate(date)||isClosed(date))throw Error("Esta data não está aberta para edição.");
  C.closeModal();state.date=date;C.save();C.go("inicio");
  C.notify("Revise os registros deste dia. Depois, retorne a Revisar e finalizar em lote.");
 },
 feedbackNext(b){showFinishedFeedback(feedbackDates,Number(b.dataset.index)||0)},
 reviewDate(b){const date=b.dataset.date||state.date;if(date<first()||!validDate(date))return;state.date=date;C.save();C.go("fechamento");},
 backHome(){C.go("inicio")},
 backProfile(){C.go("perfil")},
 viewStats(){goView()},
 mentorOpen(){goView()},
 mentorQuick(){
  if(document.querySelector?.("#view .evo-boss")){markViewed();document.querySelector("#view .evo-boss")?.scrollIntoView?.({block:"start"});return;}
  markViewed();C.render();C.openModal("Conversar com Orientador",'<div id="s4-mentor-quick">'+mentorPanel()+'</div>');
 },
 mentorStats(){if(document.getElementById?.("s4-mentor-quick")){C.closeModal();goView();}statsExpanded=true;const node=document.getElementById?.("evo-boss-statistics");if(node){node.open=true;node.scrollIntoView?.({behavior:"smooth",block:"start"});}},
 mentorAcceptGoal(){const d=mentorVisualData(),target=Number(mentorDraftTarget===null?d.proposal??60:mentorDraftTarget);if(!Number.isInteger(target)||target<0||target>100)return C.notify("Meta inválida.");const start=add(periodStart("week",today()),7);ev.mentor.goal={target,weekStart:start,weekEnd:add(start,6),createdAt:now(),suggested:d.proposal,baseline:d.previous.score,scoringVersion:2};mentorDraftTarget=target;C.save();C.render();C.notify("Compromisso semanal registrado. O Orientador vai cobrar o resultado.");const quick=document.getElementById?.("s4-mentor-quick");if(quick)quick.innerHTML=mentorPanel();},
 mentorOptions(){mentorOptionsOpen=!mentorOptionsOpen;C.render()},
 mentorSnooze(b){const min=Number(b.dataset.min);if(![10,15,1440].includes(min))return;const until=min===1440?new Date(new Date().setHours(23,59,59,999)):new Date(Date.now()+min*60000);ev.mentor.snoozeUntil=until.toISOString();ev.mentor.lastDelivery=now();mentorOptionsOpen=false;C.save();C.render()},
 mentorDismiss(){ev.mentor.lastDelivery=now();mentorOptionsOpen=false;C.save();C.render()},
 mentorDisableNotices(){ev.settings.mentorNotices=false;mentorOptionsOpen=false;C.save();C.render()},
 period(b){statsExpanded=true;period=b.dataset.period;referenceDate=state.date;C.render()},
 prevPeriod(){statsExpanded=true;referenceDate=period==="day"?add(referenceDate,-1):period==="week"?add(referenceDate,-7):period==="month"?iso(new Date(parse(referenceDate).getFullYear(),parse(referenceDate).getMonth()-1,1,12)):referenceDate.slice(0,4)-1+"-01-01";if(referenceDate<first())referenceDate=first();C.render()},
 nextPeriod(){statsExpanded=true;referenceDate=period==="day"?add(referenceDate,1):period==="week"?add(referenceDate,7):period==="month"?iso(new Date(parse(referenceDate).getFullYear(),parse(referenceDate).getMonth()+1,1,12)):(Number(referenceDate.slice(0,4))+1)+"-01-01";C.render()},
 currentPeriod(){statsExpanded=true;referenceDate=today();C.render()},
 dismissReminder(){ev.lastReminderDismissed=now();C.save();C.render()},
 disableReminder(){ev.settings.reminders=false;C.save();C.render()}
};
document.addEventListener("click",event=>{
 const b=event.target.closest("[data-s4]");if(!b)return;
 event.preventDefault();try{actions[b.dataset.s4]?.(b);}catch(err){C.notify(err.message||"Erro ao consultar dados.");}
});
document.addEventListener("submit",event=>{
 const id=event.target?.getAttribute?.("id")||event.target?.id;
 if(!["s4-finalize","s4-batch-finalize"].includes(id))return;
 event.preventDefault();try{
  const data=new FormData(event.target);
  if(id==="s4-batch-finalize"){if(!data.has("reviewed"))throw Error("Confirme a revisão do lote.");finalizeBatch();}
  else confirmSubmit(data);
 }catch(err){C.notify(err.message||"Confira a confirmação.");}
});
document.addEventListener("change",event=>{
 if(event.target.id==="s4-mentor-enabled"){ev.settings.mentorEnabled=event.target.checked;C.save();C.render();}
 if(event.target.id==="s4-mentor-notices"){ev.settings.mentorNotices=event.target.checked;C.save();C.render();}
 if(event.target.id==="s4-mentor-target"){mentorDraftTarget=Number(event.target.value);const v=$("s4-mentor-target-value");if(v)v.textContent=mentorDraftTarget+"%";}
 if(event.target.id==="s4-tone"&&profiles[event.target.value]){ev.settings.strictness=event.target.value;C.save();C.render();}
 if(event.target.id==="s4-mentor-interval"){ev.settings.mentorInterval=Number(event.target.value)||7;C.save();C.render();}
 if(event.target.id==="s4-reminders"){ev.settings.reminders=event.target.checked;C.save();C.render();}
});
window.OrbitaStage4={decorate,afterRender(){
 const unread=mentorUnreadCount();
 const showBadge=unread>0&&ev.settings.mentorNotices!==false;
 const badge=document.getElementById?.("s4-mentor-top-badge");
 if(badge){badge.hidden=!showBadge;badge.textContent=showBadge?String(unread):"";badge.title=showBadge?"Consultar o Orientador":"";}
 for(const node of document.querySelectorAll?.('[data-nav="perfil"]')||[]){
  const previous=node.querySelector?.(".evo-mentor-badge");
  if(!showBadge){previous?.remove?.();continue;}
  if(!previous&&node.insertAdjacentHTML)node.insertAdjacentHTML("beforeend",'<span class="evo-mentor-badge" title="Consultar o Orientador" aria-label="Consultar o Orientador">'+unread+'</span>');
  else if(previous){previous.textContent=String(unread);previous.title="Consultar o Orientador";}
 }
},inspect:{get model(){return ev},mentorWeek,mentorVisualData,loadAssessment,taskAssessment,habitAssessment,capture,finalize,isClosed,dailyCounts,periodData,pendingDates,dayHasMovement,finalizeBatch,sampleLevel,guidance,mentorAnalysis,mentorUnread,mentorUnreadCount,mentorNoticeEligible,mentorPanel,reminderEligible,lastStudyDayOfWeek,actions}};
C.render();
})();