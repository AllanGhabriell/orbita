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
  studiesPartial:ss.filter(x=>x.status==="progress").length,
  missingStudyTimes:ss.filter(x=>x.actualMin==null).length,
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
function batchReview(){
 const dates=pendingDates();
 if(!dates.length)return C.notify("Não há dias anteriores aguardando fechamento.");
 const recorded=dates.filter(dayHasMovement),unrecorded=dates.filter(d=>!dayHasMovement(d));
 const row=d=>{const snap=capture(d),n=dailyCounts(snap);return '<div class="review-line"><div><strong>'+E(fmt(d,false))+'</strong><small>'+snap.activities.length+' atividade(s) prevista(s) · '+snap.studies.length+' estudo(s) · '+n.unmarked+' pendente(s)'+(dayHasMovement(d)?' · há registros de execução':' · sem execução registrada')+'</small></div></div>';};
 C.openModal("Revisar dias pendentes",'<form id="s4-batch-finalize" class="section-stack"><p class="note">Feche '+dates.length+' dia(s) de uma só vez. Apenas datas com movimentação aparecem para revisão detalhada. Dias sem registro de execução serão fechados mantendo as atividades pendentes, nunca concluídas automaticamente.</p>'+
 (recorded.length?'<section><h3>Com movimentação · '+recorded.length+'</h3><div class="review-lines">'+recorded.map(row).join("")+'</div></section>':"")+
 (unrecorded.length?'<section><h3>Sem execução registrada · '+unrecorded.length+'</h3><p class="note">Estas datas possuem planejamento, mas não possuem execução registrada. Não será inventado nenhum resultado.</p><div class="review-lines">'+unrecorded.map(row).join("")+'</div></section>':"")+
 '<label class="checkline"><input type="checkbox" name="reviewed" required> Conferi o resumo e concordo em finalizar definitivamente todas as datas listadas.</label>'+
 '<p class="note">O fechamento é irreversível. Se precisar corrigir algum registro, cancele e abra aquele dia antes.</p>'+
 '<div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Finalizar '+dates.length+' dia(s)</button></div></form>');
}
function finalizeBatch(){
 const dates=pendingDates(),done=[];
 if(!dates.length)throw Error("Não há dias pendentes.");
 // Validação completa antes de iniciar: impedimentos devem ser resolvidos sem fechar parcialmente o lote.
 for(const d of dates){
  if(window.OrbitaStage7?.inspect?.hasActiveForDate(d))throw Error("Encerre o cronômetro do dia "+fmt(d,false)+" antes do fechamento em lote.");
 }
 for(const d of dates){finalize(d);done.push(d);}
 C.closeModal();C.go("inicio");C.notify(done.length+" dia(s) finalizado(s). Registros preservados sem conclusões automáticas.");
 return done;
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
  habits:0,habitDone:0,habitRecordedTimes:0,habitOnTime:0,tasks:0,tasksDone:0,study:0,studiesDone:0,partial:0,actualMin:0,
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
  count.studiesDone+=n.studiesDone;count.partial+=n.studiesPartial;
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
function mentorAnalysis(){
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
function mentorUnread(){
 if(ev.settings.mentorEnabled===false)return false;
 const analysis=mentorAnalysis();
 return analysis.important&&analysis.digest!==ev.mentor.lastReadSignature&&analysis.digest!==ev.mentor.dismissedSignature;
}
function mentorNoticeEligible(){
 if(ev.settings.mentorEnabled===false||ev.settings.mentorNotices===false||!mentorUnread())return false;
 if(Date.parse(ev.mentor.snoozeUntil||"")>Date.now())return false;
 const base=Date.parse(ev.mentor.lastViewed||ev.mentor.lastDelivery||state.firstAccess+"T12:00:00");
 if(Number.isFinite(base)&&Date.now()-base<3*86400000)return false;
 return true;
}
function mentorNotice(){
 if(!mentorNoticeEligible())return "";
 const detail=mentorOptionsOpen?'<div class="evo-mentor-options"><button class="btn small ghost" data-s4="mentorSnooze" data-min="10">Daqui a 10 min</button><button class="btn small ghost" data-s4="mentorSnooze" data-min="15">Daqui a 15 min</button><button class="btn small ghost" data-s4="mentorSnooze" data-min="1440">Não mostrar hoje</button><button class="btn small ghost" data-s4="mentorDismiss">Dispensar mensagem</button><button class="btn small ghost" data-s4="mentorDisableNotices">Desativar avisos</button></div>':"";
 return '<section class="card evo-mentor-message" aria-label="Nova mensagem do orientador"><div class="evo-mentor-avatar" aria-hidden="true">◉</div><div class="evo-mentor-copy"><strong>O Orientador quer conversar</strong><p>Tenho observações novas sobre seu planejamento. Quando puder, venha conferir o que mudou.</p><div class="row"><button class="btn primary small" data-s4="mentorOpen">Ver feedback</button><button class="btn small ghost" data-s4="mentorOptions">'+(mentorOptionsOpen?"Ocultar opções":"Agora não ▾")+'</button></div>'+detail+'</div></section>';
}
function mentorPanel(){
 if(ev.settings.mentorEnabled===false)return '<section class="card"><h2>Orientador desativado</h2><p class="note">Suas estatísticas continuam disponíveis. Você pode reativar a análise nas preferências abaixo.</p></section>';
 const a=mentorAnalysis(),tone=ev.settings.strictness||"firm";
 const intro=a.items.some(x=>x.tone==="warning")?"Tenho alguns pontos para cobrar, mas também quero reconhecer o que você já conseguiu registrar. Vamos aos fatos.":"Vamos examinar sua evolução com base nos registros reais, sem comparações inventadas.";
 const cards=a.items.map((x,i)=>'<article class="evo-mentor-feedback '+A(x.tone)+'"><div class="evo-mentor-feedback-top"><span>'+E(i+1+" · "+x.title)+'</span><small>'+E(x.evidence)+'</small></div><p>'+E(x.praise)+'</p><p>'+E(tone==="gentle"?x.body:x.body)+'</p><strong>Próximo passo</strong><p>'+E(x.action)+'</p></article>').join("");
 return '<section class="card evo-mentor-section"><div class="card-head"><div><h2>◉ Meu Orientador</h2><p class="note">Análise de todo o histórico, com atenção às últimas semanas. A seleção de Dia, Semana, Mês ou Ano altera apenas as estatísticas.</p></div></div><p class="evo-mentor-intro">'+E(intro)+'</p><div class="evo-mentor-feedbacks">'+cards+'</div><p class="note">O Orientador usa regras e registros do Órbita, não uma IA externa. Ele não presume motivos pessoais nem inventa tempos. As recomendações são sugestões ajustáveis.</p></section>';
}
function metric(label,value,subtitle){return '<div class="metric-card"><span>'+E(label)+'</span><strong>'+E(value)+'</strong>'+(subtitle?'<small>'+E(subtitle)+'</small>':"")+'</div>';}
function percent(value,total){return total?Math.round(value/total*100)+"%":"—";}
function dayReview(date){
 const snap=ev.closed[date]||capture(date),n=dailyCounts(snap),closed=!!snap.confirmed,remaining=pendingDates(date);
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
function overviewPeriod(x){
 const n=x.count,rate=focusRate(n),source=x.final?"Relatório definitivo":"Análise provisória";
 let html='<div class="row-between"><div><div class="overline">EVOLUÇÃO · '+E(source.toUpperCase())+'</div><h2 style="margin:7px 0">'+E(fmt(x.from,false))+' — '+E(fmt(x.to,false))+'</h2></div><div class="row">'+C.tag(x.final?"Consolidado":"Provisório",x.final?"good":"warn")+'</div></div>';
 if(!x.final)html+='<p class="note">Parte do período ainda não foi finalizada ou não possui registros. As análises são descritivas; dias sem atividade registrada não são tratados como fracasso.</p>';
 html+='<div class="metrics-grid">'+metric("Compromissos",rate==null?"—":rate+"",n.doneFocus+" de "+n.focus+" focos concluídos")+metric("Horas reais de estudo",minutes(n.studyActualMin),n.missingStudyTimes+" sessões sem tempo")+metric("Horas planejadas",minutes(n.plannedMin),"Tarefas e estudos sem dupla contagem")+metric("Descansos",n.rest+" planejado(s)",n.unplannedPauses+" pausa(s) extraordinária(s)")+'</div>';
 html+=previousComparison(x);
 html+='<section class="card evo-period-chart"><div class="card-head"><h2>Distribuição diária do estudo</h2><span class="note">Minutos realmente informados</span></div>'+chartDays(x)+'</section>';
 html+=mentorPanel();
 if(ev.milestones.length)html+='<section class="card"><div class="card-head"><h2>Conquistas reais</h2></div><div class="evo-achievements">'+ev.milestones.slice(-5).reverse().map(m=>'<div class="evo-achievement"><span aria-hidden="true">✦</span><div><strong>'+E(m.title)+'</strong><small>Concedida uma única vez, com base em fechamentos completos de focos.</small></div></div>').join("")+'</div></section>';

 html+='<section class="card"><div class="card-head"><h2>Mais indicadores</h2></div><div class="evo-rows">'+
 reportRow("Sessões concluídas",n.studiesDone+" / "+n.study)+
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
 '<div class="evo-toolbar"><div class="tab-line">'+[["day","Dia"],["week","Semana"],["month","Mês"],["year","Ano"]].map(([key,label])=>'<button class="tab '+(period===key?"active":"")+'" data-s4="period" data-period="'+key+'">'+label+'</button>').join("")+'</div><div class="row"><button class="btn small ghost" data-s4="prevPeriod">‹</button><button class="btn small" data-s4="currentPeriod">Atual</button><button class="btn small ghost" data-s4="nextPeriod">›</button></div></div>'+
 overviewPeriod(current)+
 '<section class="card"><div class="card-head"><h2>Preferências do orientador</h2></div><div class="evo-settings"><label class="checkline"><input id="s4-mentor-enabled" type="checkbox" '+(ev.settings.mentorEnabled!==false?"checked":"") +'> Ativar Orientador</label><label class="checkline"><input id="s4-mentor-notices" type="checkbox" '+(ev.settings.mentorNotices!==false?"checked":"")+'> Avisos discretos na tela inicial</label><label class="field">Tom do feedback<select id="s4-tone"><option value="firm" '+(ev.settings.strictness==="firm"?"selected":"")+'>Firme e objetivo</option><option value="gentle" '+(ev.settings.strictness==="gentle"?"selected":"")+'>Mais discreto</option></select></label><label class="checkline"><input id="s4-reminders" type="checkbox" '+(ev.settings.reminders!==false?"checked":"")+'> Lembretes discretos de estatísticas</label></div></section>';
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
 let upper='<div class="evo-mentor-access"><button class="btn small ghost" data-s4="mentorOpen" title="Abrir acompanhamento geral">◉ Conversar com Orientador</button></div>';
 if(pending.length&&date===today())upper+='<div class="evo-alert evo-warning"><strong>Fechamento pendente</strong><span> Há '+pending.length+' dia(s) anteriores com planejamento ou registros. Você pode revisar e finalizar tudo de uma vez.</span><button class="btn small" data-s4="batchReview">Revisar e finalizar em lote</button><button class="btn small ghost" data-s4="reviewDate" data-date="'+A(pending[0])+'">Ver primeiro dia</button></div>';
 if(closed){
  const ct=dailyCounts(closed);
  return '<section class="hero-row"><div><div class="overline">REGISTRO DEFINITIVO</div><h1>'+E(fmt(date,true))+'</h1><p class="kicker">Histórico somente leitura; os dados abaixo foram preservados no fechamento.</p></div><div class="row">'+C.dateNavigator()+(date!==today()?'<button class="btn small ghost" data-action="goToday">Hoje</button>':"")+'<button class="btn small" data-s4="reviewDate" data-date="'+A(date)+'">Relatório diário</button></div></section>'+
  '<div class="evo-alert evo-good">✓ Dia finalizado. Os resultados mostrados pertencem ao registro preservado no fechamento.</div>'+
  '<div class="evo-mentor-access"><button class="btn small ghost" data-s4="mentorOpen">◉ Conversar com Orientador</button></div>'+ 
  '<div class="metrics-grid">'+metric("Focos",ct.doneFocus+"/"+ct.foci)+metric("Sessões",ct.studiesDone+"/"+ct.plannedStudy)+metric("Estudo real",minutes(closed.result.actualStudyMin))+metric("Carga prevista",minutes(closed.plan.totalMin))+'</div>'+
  '<section class="card"><h2 class="section-title">Atividades registradas</h2><div class="review-lines">'+(closed.activities.map(x=>reviewLine(x.title,x.status,x.estimatedMin,x.actualMin)).join("")||'<p class="note">Sem atividades.</p>')+'</div></section>'+
  '<section class="card"><h2 class="section-title">Estudos registrados</h2><div class="review-lines">'+(closed.studies.map((x,i)=>reviewStudyLine(x,i)).join("")||'<p class="note">Sem sessões.</p>')+'</div></section>';
 }
 if(date>today())return base;
 const closeLink='<div class="evo-footer"><button class="btn primary" data-s4="reviewDate" data-date="'+A(date)+'">Revisar e finalizar o dia</button><button class="btn small ghost" data-s4="viewStats">Ver evolução</button></div>';
 const miniWeek=lastStudyDayOfWeek(date)?'<div class="evo-alert"><span>Último dia de estudos previsto na semana. O balanço semanal já pode ser consultado como prévia; será definitivo após fechar os dias restantes.</span><button class="btn small" data-s4="viewStats">Ver semana</button></div>':"";
 const remind=reminderEligible()?'<div class="evo-alert evo-reminder"><span>Seu desempenho merece uma revisão. Há novos registros para analisar.</span><button class="btn small" data-s4="viewStats">Ver estatísticas</button><button class="btn small ghost" data-s4="dismissReminder">Depois</button><button class="btn small ghost" data-s4="disableReminder">Desativar</button></div>':"";
 return mentorNotice()+upper+remind+base+miniWeek+closeLink;
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
 if(route==="evolucao")return viewEvolution();
 if(route==="fechamento")return dayReview(state.date);
 return base;
}
function markViewed(){ev.lastStatsView=now();ev.mentor.lastViewed=now();ev.mentor.lastReadSignature=mentorAnalysis().digest;ev.mentor.dismissedSignature="";ev.mentor.snoozeUntil="";mentorOptionsOpen=false;C.save();}
function goView(){period="week";referenceDate=state.date;markViewed();C.go("evolucao");}
function confirmSubmit(data){
 if(!data.has("reviewed")||String(data.get("phrase")||"").trim()!=="FINALIZAR")throw Error("Marque a revisão e digite FINALIZAR exatamente.");
 const date=String(data.get("date")||"");finalize(date);
 const snap=ev.closed[date];
 C.closeModal();C.go("fechamento");
 C.notify("Dia finalizado definitivamente.");
 if(lastStudyDayOfWeek(date))C.notify("Fechamento concluído. A prévia semanal está disponível em Evolução.");
}
const actions={
 batchReview(){batchReview()},
 reviewDate(b){const date=b.dataset.date||state.date;if(date<first()||!validDate(date))return;state.date=date;C.save();C.go("fechamento");},
 backHome(){C.go("inicio")},
 backProfile(){C.go("perfil")},
 viewStats(){goView()},
 mentorOpen(){goView()},
 mentorOptions(){mentorOptionsOpen=!mentorOptionsOpen;C.render()},
 mentorSnooze(b){const min=Number(b.dataset.min);if(![10,15,1440].includes(min))return;const until=min===1440?new Date(new Date().setHours(23,59,59,999)):new Date(Date.now()+min*60000);ev.mentor.snoozeUntil=until.toISOString();ev.mentor.lastDelivery=now();mentorOptionsOpen=false;C.save();C.render()},
 mentorDismiss(){ev.mentor.dismissedSignature=mentorAnalysis().digest;ev.mentor.lastDelivery=now();mentorOptionsOpen=false;C.save();C.render()},
 mentorDisableNotices(){ev.settings.mentorNotices=false;mentorOptionsOpen=false;C.save();C.render()},
 period(b){period=b.dataset.period;referenceDate=state.date;C.render()},
 prevPeriod(){referenceDate=period==="day"?add(referenceDate,-1):period==="week"?add(referenceDate,-7):period==="month"?iso(new Date(parse(referenceDate).getFullYear(),parse(referenceDate).getMonth()-1,1,12)):referenceDate.slice(0,4)-1+"-01-01";if(referenceDate<first())referenceDate=first();C.render()},
 nextPeriod(){referenceDate=period==="day"?add(referenceDate,1):period==="week"?add(referenceDate,7):period==="month"?iso(new Date(parse(referenceDate).getFullYear(),parse(referenceDate).getMonth()+1,1,12)):(Number(referenceDate.slice(0,4))+1)+"-01-01";C.render()},
 currentPeriod(){referenceDate=today();C.render()},
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
 if(event.target.id==="s4-tone"){ev.settings.strictness=event.target.value;C.save();C.render();}
 if(event.target.id==="s4-reminders"){ev.settings.reminders=event.target.checked;C.save();C.render();}
});
window.OrbitaStage4={decorate,afterRender(){
 const unread=mentorUnread()&&ev.settings.mentorNotices!==false;
 for(const node of document.querySelectorAll?.('[data-nav="perfil"]')||[]){
  const previous=node.querySelector?.(".evo-mentor-badge");
  if(!unread){previous?.remove?.();continue;}
  if(!previous&&node.insertAdjacentHTML)node.insertAdjacentHTML("beforeend",'<span class="evo-mentor-badge" title="Nova análise do Orientador" aria-label="Nova análise do Orientador">1</span>');
 }
},inspect:{get model(){return ev},capture,finalize,isClosed,dailyCounts,periodData,pendingDates,dayHasMovement,finalizeBatch,sampleLevel,guidance,mentorAnalysis,mentorUnread,mentorNoticeEligible,mentorPanel,reminderEligible,lastStudyDayOfWeek,actions}};
C.render();
})();