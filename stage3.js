/* ÓRBITA — Etapa 3: motor de estudos local. Supabase/SQL somente na etapa 5. */
(function(){
"use strict";
const C=window.OrbitaCore, S2=window.OrbitaStage2?.inspect;
if(!C||!S2)throw Error("Órbita: etapas anteriores não carregadas");
const s=C.state;
const db=s.studies||(s.studies={version:3,cycles:[],subjects:[],methods:[],sessions:[],events:[]});
for(const key of ["cycles","subjects","methods","sessions","events","topics","templates"])if(!Array.isArray(db[key]))db[key]=[];
const $=id=>document.getElementById(id);
const E=C.esc,A=C.attr, tag=C.tag, day=C.today, add=C.addDays,fmt=C.dateLabel;
const unique=()=>((typeof crypto!=="undefined"&&crypto.randomUUID)?crypto.randomUUID():"s"+Date.now().toString(36)+Math.random().toString(36).slice(2));
const now=()=>new Date().toISOString();
let lastHomeAdvance="";
const clone=x=>JSON.parse(JSON.stringify(x));
const notify=m=>C.notify(m), save=()=>C.save(),render=()=>C.render(),close=()=>C.closeModal();
const datesOkay=x=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(C.parse(x).getTime())&&C.iso(C.parse(x))===x;
const first=()=>s.firstAccess||day();
const blocked=date=>S2.model.closedDays?.includes(date);
function editable(date){if(blocked(date)){notify("Este dia já foi finalizado e não pode ser alterado.");return false}return true;}
const cycle=id=>db.cycles.find(c=>c.id===id);
const subject=id=>db.subjects.find(x=>x.id===id);
const method=id=>db.methods.find(x=>x.id===id);
const session=id=>db.sessions.find(x=>x.id===id);
const studiedSubjects=c=>db.subjects.filter(x=>x.cycleId===c.id).sort((a,b)=>a.order-b.order);
const activeSubjects=c=>studiedSubjects(c).filter(x=>!x.archived&&!x.paused);
const raw=(a,b)=>String(a||"").localeCompare(String(b||""),"pt-BR");
function minuteLabel(minutes){return C.hoursLabel((Number(minutes)||0)/60)}
function spanDate(d){return C.parse(d).toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})}
function rangeLabel(c){return c?.area||"Sem área"}
function logs(kind,fields){db.events.push({id:unique(),kind,at:now(),...fields});}
function validName(str,max=100){const x=String(str||"").trim();if(!x||x.length>max)throw Error("Informe um nome válido.");return x;}
function positiveInt(raw,fallback,min=1,max=10000){if(raw==null||String(raw).trim()==="")return fallback;const v=Number(raw);if(!Number.isInteger(v)||v<min||v>max)throw Error("Informe uma duração ou quantidade válida.");return v;}
function optionalMin(x){return String(x??"").trim()===""?null:positiveInt(x,null,1,1440);}
function validTime(x){return !x||/^([01]\d|2[0-3]):[0-5]\d$/.test(x);}
function focusForDate(date){return S2.allOn(date).filter(x=>x.type==="focus"&&x.status!=="moved");}
function usedFocus(date,excluded){return new Set(db.sessions.filter(x=>x.date===date&&x.id!==excluded&&!x.archived&&x.focusId).map(x=>x.focusId));}
function cycleState(c){
 if(!c)return null;
 const available=activeSubjects(c);
 if(!available.length){c.currentSubjectId=null;return null;}
 if(!available.some(x=>x.id===c.currentSubjectId))c.currentSubjectId=available[0].id;
 if(!Number.isInteger(c.stepNo)||c.stepNo<1)c.stepNo=1;
 if(!Array.isArray(c.history))c.history=[];
 return subject(c.currentSubjectId);
}
function stepSessions(c){return db.sessions.filter(x=>!x.archived&&x.kind==="cycle"&&x.cycleId===c.id&&x.stepNo===c.stepNo&&x.subjectId===c.currentSubjectId);}
function requiredSessions(c){const active=cycleState(c);if(!active)return 0;return Math.max(Number(active.targetSessions)||1,stepSessions(c).length);}
function progression(c){
 if(!c||c.archived)return false;
 let active=cycleState(c);
 if(!active)return false;
 const steps=stepSessions(c);
 const required=requiredSessions(c);
 const completed=steps.filter(x=>x.status==="done").length;
 if(completed<required)return false;
 const options=activeSubjects(c);
 let index=options.findIndex(x=>x.id===c.currentSubjectId);
 const next=options[(index+1)%options.length];
 const history={stepNo:c.stepNo,subjectId:c.currentSubjectId,completedIds:steps.filter(x=>x.status==="done").map(x=>x.id),required,completedAt:now()};
 c.history.push(history);
 c.stepNo++;
 c.currentSubjectId=next.id;
 logs("cycle_advanced",{cycleId:c.id,from:history.subjectId,to:c.currentSubjectId,stepNo:history.stepNo});
 return true;
}
function canUndoCompletedStep(sess){
 const c=cycle(sess.cycleId);
 if(!c||sess.kind!=="cycle"||sess.stepNo===c.stepNo)return true;
 const last=c.history?.at(-1);
 if(!last||last.stepNo!==sess.stepNo||last.subjectId!==sess.subjectId)throw Error("Há etapas posteriores. Preserve o histórico e crie uma sessão de reforço para corrigir o planejamento.");
 const newerDone=db.sessions.some(x=>x.cycleId===c.id&&x.kind==="cycle"&&x.stepNo===c.stepNo&&x.status==="done");
 if(newerDone)throw Error("O ciclo já tem conclusões posteriores. Ajuste o planejamento manualmente sem apagar o histórico.");
 c.history.pop();
 c.stepNo=last.stepNo;
 c.currentSubjectId=last.subjectId;
 logs("cycle_reopened",{cycleId:c.id,stepNo:c.stepNo,subjectId:c.currentSubjectId});
 return true;
}
function ensureCycleActive(c){if(!c||c.archived)throw Error("Ciclo indisponível.");if(!cycleState(c))throw Error("Ative pelo menos uma matéria neste ciclo.");}
function saveCycle(data,id){
 if(!id&&!C.availabilityReady())throw Error("Configure sua disponibilidade antes de criar ciclos de estudo.");
 const title=validName(data.title),area=validName(data.area,80);
 const duration=positiveInt(data.defaultMin,90,1,720),goalId=data.goalId||"";
 if(goalId&&!s.goals.some(g=>g.id===goalId&&!g.archived))throw Error("Objetivo não encontrado.");
 if(id){
  const c=cycle(id);if(!c)throw Error("Ciclo não encontrado.");
  Object.assign(c,{title,area,defaultMin:duration,goalId});
  logs("cycle_edited",{cycleId:id});
  return c;
 }
 const c={id:unique(),title,area,goalId,defaultMin:duration,archived:false,currentSubjectId:null,stepNo:1,history:[],createdAt:now()};
 db.cycles.push(c);logs("cycle_created",{cycleId:c.id});return c;
}
function saveSubject(data,id){
 const c=cycle(data.cycleId);if(!c)throw Error("Escolha um ciclo existente.");
 const title=validName(data.title),target=positiveInt(data.targetSessions,1,1,12);
 if(id){
  const x=subject(id);if(!x)throw Error("Matéria inexistente.");
  if(x.cycleId!==c.id)throw Error("Para transferir uma matéria, crie outra no ciclo de destino.");
  x.title=title;x.targetSessions=target;
  logs("subject_edited",{subjectId:id});return x;
 }
 const x={id:unique(),cycleId:c.id,title,targetSessions:target,order:studiedSubjects(c).length,paused:false,archived:false,reason:"",returnDate:"",createdAt:now()};
 db.subjects.push(x);if(!c.currentSubjectId)c.currentSubjectId=x.id;logs("subject_created",{subjectId:x.id,cycleId:c.id});return x;
}
function pauseSubject(id,paused,reason="",returnDate=""){
 const x=subject(id);if(!x)throw Error("Matéria inexistente.");
 if(returnDate&&(!datesOkay(returnDate)||returnDate<day()))throw Error("A data de retorno precisa ser atual ou futura.");
 const c=cycle(x.cycleId),old=cycleState(c);
 x.paused=!!paused;x.reason=paused?String(reason||"").trim():"";x.returnDate=paused?returnDate:"";
 if(paused&&old?.id===id&&c.currentSubjectId===id){
  const options=activeSubjects(c);
  c.currentSubjectId=options.length?options[0].id:null;
  if(options.length){c.stepNo++;logs("cycle_step_skipped",{cycleId:c.id,subjectId:id,reason:"subject_paused"});}
 }
 if(!paused&&!c.currentSubjectId)c.currentSubjectId=id;
 logs(paused?"subject_paused":"subject_resumed",{subjectId:id,cycleId:c.id,reason:x.reason,returnDate:x.returnDate});
}
function archiveSubject(id){
 const x=subject(id);if(!x)return;
 x.archived=!x.archived;const c=cycle(x.cycleId);
 if(x.archived&&c?.currentSubjectId===id){c.currentSubjectId=null;cycleState(c);if(c.currentSubjectId){c.stepNo++;logs("cycle_step_skipped",{cycleId:c.id,subjectId:id,reason:"subject_archived"});}}
 if(!x.archived&&!c.currentSubjectId)c.currentSubjectId=id;
 logs(x.archived?"subject_archived":"subject_restored",{subjectId:id});
}
function reorderSubject(id,delta){
 const x=subject(id);if(!x)return;
 const list=studiedSubjects(cycle(x.cycleId));
 const i=list.findIndex(q=>q.id===id),j=i+delta;
 if(j<0||j>=list.length)return;
 [list[i].order,list[j].order]=[list[j].order,list[i].order];
 logs("subject_reordered",{subjectId:id,direction:delta});
}
function saveMethod(data,id){
 const title=validName(data.title,80),desc=String(data.description||"").trim().slice(0,500);
 if(id){const x=method(id);if(!x)throw Error("Modalidade inexistente.");Object.assign(x,{title,description:desc});logs("method_edited",{methodId:id});return x;}
 const x={id:unique(),title,description:desc,archived:false,createdAt:now()};db.methods.push(x);logs("method_created",{methodId:x.id});return x;
}
function defaultsForSession(c,sub,mode,date){
 return {id:unique(),kind:mode||"cycle",cycleId:c?.id||"",subjectId:sub?.id||"",stepNo:0,date:date||s.date,area:c?.area||"",discipline:sub?.title||"",topic:"",purpose:"",methodId:"",plannedMin:c?.defaultMin||90,actualMin:null,startTime:"",status:"pending",focusId:"",archived:false,createdAt:now(),completedAt:null};
}
function normalizeSession(data,original){
 const kind=String(data.kind||"cycle");
 if(!["cycle","reinforcement","supplement"].includes(kind))throw Error("Tipo de sessão inválido.");
 const date=String(data.date||"");if(!datesOkay(date)||date<first())throw Error("Selecione uma data válida.");
 if(!editable(date))throw Error("Data fechada.");
 const c=data.cycleId?cycle(data.cycleId):null;
 if(data.cycleId&&!c)throw Error("Ciclo não encontrado.");
 if(c?.archived)throw Error("Reative o ciclo para planejar sessões.");
 const sub=data.subjectId?subject(data.subjectId):null;
 if(sub&&(!c||sub.cycleId!==c.id))throw Error("Matéria fora do ciclo selecionado.");
 if(kind==="cycle"){ensureCycleActive(c);const historical=original?.kind==="cycle"&&original.stepNo!==c.stepNo&&original.cycleId===c.id&&original.subjectId===sub?.id;if(!historical&&(!sub||sub.id!==c.currentSubjectId||sub.paused||sub.archived))throw Error("Para avançar o ciclo, use a matéria atual. Outras matérias são estudos complementares.");}
 const area=validName(data.area||c?.area,90),discipline=validName(data.discipline||sub?.title,90);
 const topic=String(data.topic||"").trim().slice(0,130),purpose=String(data.purpose||"").trim().slice(0,190);
 const plannedMin=optionalMin(data.plannedMin),actualMin=optionalMin(data.actualMin);
 const startTime=String(data.startTime||"");if(!validTime(startTime))throw Error("Horário inválido.");
 const methodId=String(data.methodId||"");if(methodId&&!method(methodId))throw Error("Modalidade não encontrada.");
 const focusId=String(data.focusId||"");
 if(focusId&&!focusForDate(date).some(f=>f.id===focusId))throw Error("Selecione um foco válido nesta data.");
 if(focusId&&usedFocus(date,original?.id).has(focusId))throw Error("Este foco já está vinculado a outra sessão de estudo.");
 if(original?.kind==="cycle"&&original.status==="done"&&(kind!=="cycle"||original.cycleId!==c?.id||original.subjectId!==sub?.id))throw Error("Não é possível transferir uma sessão concluída do ciclo. Crie uma nova sessão.");
 return {kind,date,cycleId:c?.id||"",subjectId:sub?.id||"",area,discipline,topic,purpose,methodId,plannedMin,actualMin,startTime,focusId};
}
function addSessions(data,count=1){
 const draft=normalizeSession(data);
 const n=positiveInt(count,1,1,12);
 const c=draft.cycleId?cycle(draft.cycleId):null;
 const result=[];
 for(let i=0;i<n;i++){
  const entry={...defaultsForSession(c,draft.subjectId?subject(draft.subjectId):null,draft.kind,draft.date),...draft,stepNo:draft.kind==="cycle"?c.stepNo:0};
  if(i>0)entry.focusId=""; // não duplicar relação com o mesmo foco
  db.sessions.push(entry);result.push(entry);
 }
 logs("sessions_created",{ids:result.map(x=>x.id),cycleId:draft.cycleId,kind:draft.kind,date:draft.date});
 return result;
}
// Planejamento em lote: cada linha corresponde a UMA sessão real e tem duração própria.
// Vagas de ciclo futuro recebem a matéria quando forem executadas, respeitando a rotação.
function addBatchSessions(data){
 const c=cycle(String(data.cycleId||""));ensureCycleActive(c);
 const begin=String(data.fromDate||""),end=String(data.toDate||"");
 if(!datesOkay(begin)||!datesOkay(end)||begin<first()||end<begin)throw Error("Selecione um período válido a partir do primeiro acesso.");
 const totalDays=Math.round((C.parse(end)-C.parse(begin))/86400000)+1;
 if(totalDays>31)throw Error("Planeje no máximo 31 dias por operação.");
 const count=positiveInt(data.count,1,1,12),duration=positiveInt(data.plannedMin,c.defaultMin||90,1,720);
 const useAvailable=!!data.onlyAvailable;
 const selected=Array.isArray(data.weekdays)?[...new Set(data.weekdays.map(Number))]:[];
 if(!useAvailable&&(!selected.length||selected.some(d=>!Number.isInteger(d)||d<0||d>6)))throw Error("Selecione pelo menos um dia da semana.");
 const dates=[];
 for(let i=0;i<totalDays;i++){
  const date=add(begin,i),a=C.resolveAvailability(date);
  if(blocked(date))continue;
  if(useAvailable){
   if(!a||a.mode==="rest"||C.availabilityMinutes(a)<=0)continue;
  }else if(!selected.includes(C.parse(date).getDay()))continue;
  dates.push(date);
 }
 if(!dates.length)throw Error("Nenhum dia aberto corresponde ao período e aos filtros escolhidos.");
 const total=dates.length*count;
 if(total>180)throw Error("Limite de 180 sessões por operação. Reduza o período ou a quantidade.");
 const result=[];
 for(const date of dates)for(let i=0;i<count;i++){
  const sess={...defaultsForSession(c,null,"cycle",date),rotationSlot:true,stepNo:0,subjectId:"",
   discipline:"Próxima matéria do ciclo",plannedMin:duration,actualMin:null,kind:"cycle",status:"pending"};
  db.sessions.push(sess);result.push(sess);
 }
 logs("sessions_batch_scheduled",{cycleId:c.id,dates,count,duration,ids:result.map(x=>x.id)});
 return result;
}
// Planejamento v4: somente a agenda é alterada. Conclusões e progresso ficam no Início.
let plannerUndo=null;
const planTopics=subjectId=>db.topics.filter(t=>!t.archived&&t.subjectId===subjectId);
const planWeekStart=date=>add(date,-((C.parse(date).getDay()+6)%7));
const planWeekDates=date=>Array.from({length:7},(_,i)=>add(planWeekStart(date),i));
const planDayEntries=date=>db.sessions.filter(x=>x.date===date&&!x.archived)
 .sort((a,b)=>Number(a.planOrder??0)-Number(b.planOrder??0)||(a.startTime||"99:99").localeCompare(b.startTime||"99:99")||String(a.createdAt||"").localeCompare(String(b.createdAt||"")));
function planIsEditable(x){
 if(!x||x.archived)throw Error("Sessão não encontrada.");
 if(x.status!=="pending")throw Error("Esta sessão já foi iniciada ou concluída. Corrija a execução primeiro na tela Início.");
 if(blocked(x.date))throw Error("Dia finalizado: preserve o histórico.");
 if(x.kind==="cycle"&&!x.rotationSlot&&x.stepNo!==cycle(x.cycleId)?.stepNo)throw Error("Esta sessão pertence a uma etapa anterior do ciclo.");
}
function planJournal(){
 const before=clone(db.sessions);
 return ()=>{plannerUndo={before,after:JSON.stringify(db.sessions)};};
}
function planUndo(){
 if(!plannerUndo)throw Error("Não há uma alteração recente para desfazer.");
 if(JSON.stringify(db.sessions)!==plannerUndo.after)throw Error("A agenda mudou desde a última edição. Não é seguro desfazer automaticamente.");
 for(const x of db.sessions)if(blocked(x.date)&&!plannerUndo.before.some(y=>y.id===x.id))throw Error("Um dia foi finalizado após a edição.");
 db.sessions.splice(0,db.sessions.length,...plannerUndo.before);
 plannerUndo=null;logs("planner_undo",{});save();render();notify("Última alteração no planejamento desfeita.");
}
function planNextOrder(date){
 return planDayEntries(date).reduce((n,x)=>Math.max(n,Number(x.planOrder)||0),0)+1;
}
function planValidate(data){
 const c=cycle(String(data.cycleId||""));
 ensureCycleActive(c);
 const date=String(data.date||"");
 if(!datesOkay(date)||date<first()||blocked(date))throw Error("Escolha uma data aberta a partir do primeiro acesso.");
 const mode=String(data.mode||"rotation");
 if(!["rotation","specific"].includes(mode))throw Error("Escolha seguir o ciclo ou selecionar uma matéria específica.");
 const sub=mode==="specific"?subject(String(data.subjectId||"")):null;
 if(mode==="specific"&&(!sub||sub.cycleId!==c.id||sub.archived))throw Error("Escolha uma matéria cadastrada nesse ciclo.");
 const plannedMin=positiveInt(data.plannedMin,c.defaultMin||90,1,720);
 const methodId=String(data.methodId||"");
 if(methodId&&(!method(methodId)||method(methodId).archived))throw Error("Modalidade indisponível na biblioteca.");
 const topicId=String(data.topicId||"");
 const topic=topicId?db.topics.find(t=>t.id===topicId&&!t.archived):null;
 if(topicId&&(!topic||topic.subjectId!==sub?.id))throw Error("O assunto selecionado não pertence à matéria escolhida.");
 return {date,cycleId:c.id,kind:mode==="rotation"?"cycle":"reinforcement",
  subjectId:sub?.id||"",stepNo:0,rotationSlot:mode==="rotation",
  area:c.area,discipline:sub?.title||"Próxima matéria do ciclo",plannedMin,methodId,
  topicId:topic?.id||"",topic:topic?.title||"",startTime:"",focusId:""};
}
function planCreate(data){
 const entry=planValidate(data),count=positiveInt(data.count,1,1,12);
 const finish=planJournal(),created=[];
 for(let i=0;i<count;i++){
  const c=cycle(entry.cycleId),sub=subject(entry.subjectId);
  const x={...defaultsForSession(c,sub,entry.kind,entry.date),...entry,
   id:unique(),planOrder:planNextOrder(entry.date)+i,status:"pending",actualMin:null,completedAt:null};
  db.sessions.push(x);created.push(x);
 }
 logs("planner_created",{ids:created.map(x=>x.id),date:entry.date});
 finish();save();render();return created;
}
function planEdit(id,data){
 const x=session(id);planIsEditable(x);
 const changed=planValidate(data);
 const finish=planJournal();
 Object.assign(x,changed,{actualMin:null,completedAt:null,planOrder:changed.date===x.date?x.planOrder:planNextOrder(changed.date)});
 // Manter id e createdAt para referências de registros externos.
 logs("planner_edited",{sessionId:id,date:x.date});
 finish();save();render();return x;
}
function planDelete(ids){
 const chosen=[...new Set(ids.map(String))];
 if(!chosen.length)throw Error("Selecione pelo menos uma sessão.");
 chosen.forEach(id=>planIsEditable(session(id)));
 const finish=planJournal();
 const set=new Set(chosen);
 db.sessions.splice(0,db.sessions.length,...db.sessions.filter(x=>!set.has(x.id)));
 logs("planner_removed",{ids:chosen});finish();save();render();return chosen.length;
}
function planCopyDraft(source,date){
 const c=cycle(source.cycleId),sub=subject(source.subjectId);
 if(source.kind==="cycle"&&c&&!c.archived&&activeSubjects(c).length)
  return {...defaultsForSession(c,null,"cycle",date),rotationSlot:true,discipline:"Próxima matéria do ciclo",
   plannedMin:source.plannedMin,methodId:source.methodId||"",topic:"",topicId:""};
 return {...defaultsForSession(c,sub,source.kind,date),kind:source.kind,cycleId:source.cycleId||"",
  subjectId:source.subjectId||"",discipline:source.discipline,area:source.area,
  rotationSlot:false,plannedMin:source.plannedMin,methodId:source.methodId||"",
  topic:source.topic||"",topicId:source.topicId||"",startTime:source.startTime||""};
}
function planCopyRange(sourceStart,targetStart,days=1,replace=false){
 if(![1,7].includes(days))throw Error("Período de cópia inválido.");
 if(!datesOkay(sourceStart)||!datesOkay(targetStart)||targetStart<first())throw Error("Selecione datas válidas para copiar.");
 if(days===7&&(sourceStart!==planWeekStart(sourceStart)||targetStart!==planWeekStart(targetStart)))throw Error("Para copiar a semana, escolha a segunda-feira inicial.");
 const sourceDates=Array.from({length:days},(_,i)=>add(sourceStart,i));
 const destDates=Array.from({length:days},(_,i)=>add(targetStart,i));
 if(sourceDates.some(x=>destDates.includes(x)))throw Error("Escolha um período de destino diferente da origem.");
 if(destDates.some(blocked))throw Error("A cópia inclui um dia finalizado. Escolha outro período.");
 const copies=sourceDates.flatMap((d,i)=>planDayEntries(d).map(x=>planCopyDraft(x,destDates[i])));
 if(!copies.length)throw Error("Nenhuma sessão encontrada no período de origem.");
 if(copies.length>180)throw Error("Copie no máximo 180 sessões de uma vez.");
 const finish=planJournal();
 if(replace){const dst=new Set(destDates);db.sessions.splice(0,db.sessions.length,...db.sessions.filter(x=>!dst.has(x.date)||x.status!=="pending"));}
 for(const x of copies){x.id=unique();x.createdAt=now();x.planOrder=planNextOrder(x.date);db.sessions.push(x);}
 logs("planner_copied",{sourceStart,targetStart,days,replace,count:copies.length});
 finish();save();render();return copies;
}
function planMove(id,date,order=0){
 const x=session(id);planIsEditable(x);
 if(!datesOkay(date)||date<first()||blocked(date))throw Error("Escolha um dia disponível para mover a sessão.");
 const finish=planJournal();
 if(x.date===date){const target=Number(order)||1;const peers=planDayEntries(date).filter(q=>q.id!==id);
  peers.splice(Math.min(Math.max(target-1,0),peers.length),0,x);
  peers.forEach((q,i)=>q.planOrder=i+1);
 }else{x.date=date;x.planOrder=planNextOrder(date);}
 logs("planner_moved",{id,date});finish();save();render();
}
function planBulk(ids,data){
 const list=[...new Set(ids.map(String))].map(session);
 if(!list.length)throw Error("Selecione as sessões que deseja editar.");
 list.forEach(planIsEditable);
 const dest=String(data.date||"");
 if(dest&&(!datesOkay(dest)||dest<first()||blocked(dest)))throw Error("Data de destino inválida ou finalizada.");
 const duration=String(data.plannedMin??"").trim()?positiveInt(data.plannedMin,90,1,720):null;
 const mode=String(data.mode||"keep");
 if(!["keep","rotation","specific"].includes(mode))throw Error("Escolha um tipo de estudo válido.");
 const selectedCycle=String(data.cycleId||"");
 const chosen=mode==="keep"?[]:list.map(x=>planValidate({
  cycleId:selectedCycle||x.cycleId,date:dest||x.date,mode,
  subjectId:data.subjectId||"",plannedMin:duration??x.plannedMin,methodId:x.methodId||""
 }));
 const finish=planJournal();
 for(const [i,x] of list.entries()){
  if(dest&&dest!==x.date){x.date=dest;x.planOrder=planNextOrder(dest);}
  if(duration!==null)x.plannedMin=duration;
  if(mode!=="keep"){const next=chosen[i];Object.assign(x,next,{planOrder:x.planOrder,status:"pending",actualMin:null,completedAt:null});}
 }
 logs("planner_bulk_edit",{ids:list.map(x=>x.id),date:dest,duration,mode});
 finish();save();render();return list;
}
function planSaveTemplate(name,date){
 const title=validName(name,60),start=planWeekStart(date);
 const items=planWeekDates(start).flatMap((d,i)=>planDayEntries(d).map(x=>{
  const p=planCopyDraft(x,d);
  return {offset:i,...p};
 }));
 if(!items.length)throw Error("Monte pelo menos uma sessão antes de salvar um modelo.");
 const template={id:unique(),title,items,createdAt:now()};
 db.templates.push(template);logs("planner_template_saved",{id:template.id});save();render();return template;
}
function planApplyTemplate(id,weekStart,replace=false){
 const t=db.templates.find(x=>x.id===id);
 if(!t)throw Error("Modelo de semana não encontrado.");
 if(!datesOkay(weekStart)||weekStart!==planWeekStart(weekStart)||weekStart<first())throw Error("Escolha a segunda-feira da semana de destino.");
 const dates=planWeekDates(weekStart);
 if(dates.some(blocked))throw Error("Uma data da semana já foi finalizada.");
 if(t.items.length>180)throw Error("Modelo ultrapassa o limite de 180 sessões.");
 const finish=planJournal();
 if(replace){const d=new Set(dates);db.sessions.splice(0,db.sessions.length,...db.sessions.filter(x=>!d.has(x.date)||x.status!=="pending"));}
 for(const item of t.items){
  const date=dates[item.offset],fresh=planCopyDraft(item,date);
  fresh.id=unique();fresh.planOrder=planNextOrder(date);
  db.sessions.push(fresh);
 }
 logs("planner_template_applied",{id,weekStart,replace});finish();save();render();return t.items.length;
}
function updateSession(id,data){
 const x=session(id);if(!x||x.archived)throw Error("Sessão indisponível.");
 if(!editable(x.date))throw Error("Data fechada.");
 const next=normalizeSession(data,x);
 // Editar o planejamento não apaga o tempo efetivamente registrado.
 next.actualMin=x.actualMin;
 if(x.kind==="cycle"&&x.stepNo!==cycle(x.cycleId)?.stepNo){
  if(x.date!==next.date||next.kind!=="cycle"||next.cycleId!==x.cycleId||next.subjectId!==x.subjectId)throw Error("Esta etapa já avançou. Preserve a data e a matéria do histórico; outros campos podem ser corrigidos.");
 }
 if(x.kind==="cycle"&&x.status==="done"&&x.stepNo===cycle(x.cycleId)?.stepNo&&next.date!==x.date)throw Error("Concluída: altere o plano antes de avançar.");
 Object.assign(x,next);
 if(x.rotationSlot){
  if(x.kind==="cycle"){x.subjectId="";x.stepNo=0;x.discipline="Próxima matéria do ciclo";}
  else x.rotationSlot=false;
 }
 logs("session_edited",{sessionId:id});return x;
}
function setSessionStatus(id,status,actualMin,actualTime){
 const x=session(id);if(!x||x.archived)throw Error("Sessão não encontrada.");
 if(!editable(x.date))throw Error("O dia está finalizado.");
 if(!["pending","progress","done"].includes(status))throw Error("Status inválido.");
 const minutes=optionalMin(actualMin);
 if(actualTime&&!validTime(actualTime))throw Error("Horário inválido.");
 if(x.status==="done"&&status!=="done"&&x.kind==="cycle")canUndoCompletedStep(x);
 const old=x.status;
 // Vagas futuras seguem o próximo assunto REAL na hora da execução,
 // sem fixar a matéria durante o planejamento de uma semana inteira.
 if(x.rotationSlot&&status!=="pending"){
  const c=cycle(x.cycleId);ensureCycleActive(c);
  const sub=cycleState(c);
  x.subjectId=sub.id;x.stepNo=c.stepNo;x.discipline=sub.title;
  x.rotationSlot=false;x.resolvedAt=now();
 }
 x.status=status;x.actualMin=minutes;x.actualTime=actualTime||"";
 if(status==="done")x.completedAt=x.completedAt||now();
 else x.completedAt=null;
 logs("session_status",{sessionId:id,from:old,to:status,actualMin:minutes});
 const c=x.kind==="cycle"?cycle(x.cycleId):null;
 if(c&&status==="done"&&x.stepNo===c.stepNo){
  if(progression(c))lastHomeAdvance=c.id;
 }
 return x;
}
function deleteSession(id){
 const x=session(id);if(!x)return;
 if(!editable(x.date))throw Error("Sessão em dia finalizado.");
 if(x.kind==="cycle"&&x.status==="done"&&cycle(x.cycleId)?.stepNo!==x.stepNo)canUndoCompletedStep(x);
 db.sessions=db.sessions.filter(q=>q.id!==id);
 logs("session_deleted",{sessionId:id,cycleId:x.cycleId,date:x.date});
}
function summarize(filter={}){
 const frozen=Object.values(s.evolution?.closed||{}).flatMap(snap=>(snap.studies||[]).map(x=>({...x,date:snap.date,methodLabel:x.method,cycleLabel:x.cycle,methodId:"",archived:false})));
 const entries=[...db.sessions.filter(x=>!x.archived&&!s.evolution?.closed?.[x.date]),...frozen].filter(x=>(!filter.from||x.date>=filter.from)&&(!filter.to||x.date<=filter.to)&&(!filter.cycleId||x.cycleId===filter.cycleId)&&(!filter.area||x.area===filter.area));
 const planned=entries.reduce((sum,x)=>sum+Number(x.plannedMin||0),0);
 const actual=entries.reduce((sum,x)=>sum+Number(x.actualMin||0),0);
 const actualRecorded=entries.filter(x=>x.actualMin!=null).length;
 const groups={areas:{},disciplines:{},topics:{},methods:{},cycles:{}};
 function inc(key,name,x){let k=name||"Não especificado";if(!groups[key][k])groups[key][k]={minutes:0,sessions:0,completed:0,recorded:0};const v=groups[key][k];v.sessions++;if(x.status==="done")v.completed++;if(x.actualMin!=null){v.minutes+=Number(x.actualMin);v.recorded++;}}
 for(const x of entries){
  inc("areas",x.area,x);inc("disciplines",x.discipline,x);inc("topics",x.topic,x);
  inc("methods",x.methodLabel||method(x.methodId)?.title||"Sem modalidade",x);
  inc("cycles",x.cycleLabel||cycle(x.cycleId)?.title||(x.cycleId?"Ciclo arquivado":"Complementar independente"),x);
 }
 return {sessions:entries.length,completed:entries.filter(x=>x.status==="done").length,inProgress:entries.filter(x=>x.status==="progress").length,plannedMin:planned,actualMin:actual,actualRecorded,unrecorded:entries.length-actualRecorded,groups};
}
function loadFor(date){
 const frozen=s.evolution?.closed?.[date];if(frozen)return {studyPlanned:frozen.plan.studyMin,otherPlanned:frozen.plan.otherMin,totalPlanned:frozen.plan.totalMin,available:frozen.availableMin,overlap:[],linkedFocuses:new Set(frozen.studies.filter(x=>x.focusId).map(x=>x.focusId)).size};
 const active=db.sessions.filter(x=>x.date===date&&!x.archived);
 const studyPlanned=active.reduce((n,x)=>n+Number(x.plannedMin||0),0);
 const linked=new Set(active.filter(x=>x.focusId).map(x=>x.focusId));
 const commitments=S2.allOn(date).filter(x=>x.type!=="task"||x.date===date);
 const otherPlanned=commitments.filter(x=>!(x.type==="focus"&&linked.has(x.id))).reduce((n,x)=>n+Number(x.estimatedMin||0),0);
 const available=C.availabilityMinutes(C.resolveAvailability(date));
 const overlap=[];
 const windows=[
 ...active.filter(x=>x.startTime&&x.plannedMin).map(x=>({title:x.discipline,start:Number(x.startTime.slice(0,2))*60+Number(x.startTime.slice(3,5)),end:Number(x.startTime.slice(0,2))*60+Number(x.startTime.slice(3,5))+x.plannedMin})),
 ...commitments.filter(x=>x.startTime&&x.estimatedMin&&!(x.type==="focus"&&linked.has(x.id))).map(x=>({title:x.title,start:Number(x.startTime.slice(0,2))*60+Number(x.startTime.slice(3,5)),end:Number(x.startTime.slice(0,2))*60+Number(x.startTime.slice(3,5))+x.estimatedMin}))
 ].sort((a,b)=>a.start-b.start);
 for(let i=0;i<windows.length;i++)for(let j=0;j<i;j++)if(windows[i].start<windows[j].end&&windows[j].start<windows[i].end)overlap.push([windows[j].title,windows[i].title]);
 return {studyPlanned,otherPlanned,totalPlanned:studyPlanned+otherPlanned,available,overlap,linkedFocuses:linked.size};
}
function statCard(label,value,detail){return '<div class="study-stat"><span>'+E(label)+'</span><strong>'+E(value)+'</strong>'+(detail?'<small>'+E(detail)+'</small>':"")+'</div>';}
function cycleProgress(c){
 const cur=cycleState(c),count=stepSessions(c).filter(x=>x.status==="done").length,required=requiredSessions(c);
 return {cur,count,required};
}
function cycleCard(c,compact=false){
 const {cur,count,required}=cycleProgress(c);
 return '<section class="card study-cycle-card"><div class="card-head"><div><div class="overline">'+E(c.area)+'</div><h2>'+E(c.title)+'</h2></div>'+tag(c.archived?"Arquivado":"Ciclo","")+'</div><div class="study-current"><div><span>PRÓXIMA MATÉRIA</span><strong>'+E(cur?.title||"Nenhuma matéria ativa")+'</strong><small>'+(cur?count+" de "+required+" sessão(ões) concluída(s) na etapa":"Adicione ou reative uma matéria")+'</small></div><div class="study-progress"><div style="width:'+(required?Math.round(count/required*100):0)+'%"></div></div></div><div class="row study-actions"><button class="btn small" data-s3="selectCycle" data-id="'+A(c.id)+'">Gerenciar</button>'+(cur&&!c.archived?'<button class="btn small primary" data-s3="planForCycle" data-cycle="'+A(c.id)+'">Planejar sessões</button>':"")+'</div></section>';
}
function tinySessions(date){
 const list=db.sessions.filter(x=>x.date===date&&!x.archived).sort((a,b)=>(a.startTime||"99:99").localeCompare(b.startTime||"99:99"));
 if(!list.length)return '<p class="note">Nenhuma sessão de estudo planejada para esta data.</p>';
 return '<div class="study-session-list">'+list.map(x=>sessionRow(x,true)).join("")+'</div>';
}
function sessionRow(x,compact=false){
 const c=cycle(x.cycleId),m=method(x.methodId),label=plannerLabel(x);
 const details=[c?.title||x.area||"Estudo complementar",x.topic,x.plannedMin!=null?minuteLabel(x.plannedMin)+" previstas":"",m?.title].filter(Boolean).join(" · ");
 const modifiable=x.status==="pending"&&!blocked(x.date);
 return '<div class="study-session-row '+(x.status==="done"?"done":"")+'"><span class="study-session-mark">'+(x.status==="done"?"✓":"◉")+'</span><div class="study-session-body"><strong>'+E(label)+'</strong><small>'+E(details)+'</small></div>'+
 '<div class="study-session-controls">'+(modifiable?
 '<button class="btn small ghost" data-s3="planEdit" data-id="'+A(x.id)+'">Editar</button><button class="btn small ghost" data-s3="planDuplicate" data-id="'+A(x.id)+'">Duplicar</button><button class="btn small danger" data-s3="planRemove" data-id="'+A(x.id)+'">Excluir</button>':
 '<span class="status">'+(x.status==="done"?"Concluída no Início":x.status==="progress"?"Em andamento":"Dia fechado")+'</span>')+'</div></div>';
}
function homePanel(){
 const date=s.date,load=loadFor(date),activeCycles=db.cycles.filter(x=>!x.archived);
 const daily=db.sessions.filter(x=>x.date===date&&!x.archived).sort((a,b)=>(a.startTime||"99:99").localeCompare(b.startTime||"99:99")||a.createdAt.localeCompare(b.createdAt));
 const done=daily.filter(x=>x.status==="done").length;
 const groups=[];
 for(const x of daily){
  const c=cycle(x.cycleId),key=c?.id||"extra";
  let group=groups.find(g=>g.key===key);
  if(!group){group={key,cycle:c,items:[]};groups.push(group);}
  group.items.push(x);
 }
 // O painel inicial é exclusivamente de EXECUÇÃO. O planejamento fica em Estudos.
 let body=groups.map(group=>{
  const c=group.cycle,p=c&&!c.archived?cycleProgress(c):null;
  const n=group.items.filter(x=>x.status==="done").length;
  const flash=c?.id===lastHomeAdvance?' study-home-advanced':'';
  const labels=group.items.map((x,i)=>{
   const sub=x.rotationSlot?p?.cur?.title||"Próxima matéria":x.discipline;
   return '<div class="study-daily-step '+(x.status==="done"?"is-done":x.status==="progress"?"is-active":"")+'"><span class="study-daily-marker">'+(x.status==="done"?"✓":i+1)+'</span><strong>'+E(sub)+'</strong><small>'+E(x.plannedMin!=null?minuteLabel(x.plannedMin):"Sem previsão")+'</small></div>';
  }).join('<div class="study-daily-link" aria-hidden="true"></div>');
  const entries=group.items.map((x,i)=>{
   const label=x.rotationSlot?p?.cur?.title||"Próxima matéria":x.discipline;
   const desc=[x.plannedMin!=null?minuteLabel(x.plannedMin)+" prevista(s)":"Sem duração prevista",x.startTime||"",x.status==="done"?"Concluída":x.status==="progress"?"Em andamento":"Pendente"].filter(Boolean).join(" · ");
   return '<div class="study-daily-entry '+(x.status==="done"?"is-done":"")+'"><span class="study-daily-number">'+(i+1)+'</span><div class="study-daily-label"><strong>'+E(label)+'</strong><small>'+E(desc)+'</small></div><div class="study-daily-controls">'+(!blocked(date)?'<button class="btn small '+(x.status==="done"?"ghost":"primary")+'" data-s3="quickDone" data-id="'+A(x.id)+'">'+(x.status==="done"?"↶ Desfazer":"✓ Concluir")+'</button><button class="btn small ghost" data-s3="recordSession" data-id="'+A(x.id)+'">Registrar</button>':'<span class="status">Dia fechado</span>')+'</div></div>';
  }).join("");
  return '<div class="study-daily-group'+flash+'"><div class="study-daily-heading"><div><strong>'+E(c?.title||"Estudos complementares")+'</strong><small>'+n+' de '+group.items.length+' concluída(s)'+(p?.cur?' · próxima matéria: '+E(p.cur.title):"")+'</small></div></div><div class="study-daily-track" aria-label="Sequência das sessões do dia">'+labels+'</div><div class="study-daily-list">'+entries+'</div></div>';
 }).join("");
 if(!groups.length)body='<div class="study-daily-empty"><p class="note">Nenhuma sessão planejada para esta data.</p><p class="note">Organize a quantidade de sessões e os dias da semana na área de Estudos. Depois, acompanhe e conclua tudo aqui.</p></div>';
 const real=summarize({from:date,to:date});
 return '<section class="card study-home-panel study-daily-panel"><div class="card-head"><h2>◉ Estudos de hoje</h2><button class="btn small ghost" data-s3="openStudies">Configurar estudos ↗</button></div>'+
  '<div class="study-daily-summary"><span>'+done+' de '+daily.length+' concluída(s)</span><span>'+minuteLabel(load.studyPlanned)+' planejadas</span><span>'+minuteLabel(real.actualMin)+' reais registradas</span></div>'+
  body+(activeCycles.length&&!groups.length?'<div class="study-daily-next"><strong>Próxima matéria do ciclo</strong><span>'+E(activeCycles.slice(0,3).map(x=>x.title+" · "+(cycleProgress(x).cur?.title||"Sem matéria")).join(" | "))+'</span></div>':"")+
  '</section>';
}
function loadPanel(date){
 const v=loadFor(date),base=C.resolveAvailability(date),warning=v.available>0&&v.totalPlanned>v.available;
 return '<section class="card study-load-panel"><div class="card-head"><h2>Analisador de carga</h2>'+tag(warning?"Excesso previsto":"Carga do dia",warning?"warn":"")+'</div>'+
 '<div class="study-load-numbers">'+statCard("Estudos previstos",minuteLabel(v.studyPlanned))+statCard("Outros compromissos",minuteLabel(v.otherPlanned))+statCard("Carga total",minuteLabel(v.totalPlanned))+statCard("Disponibilidade",base?.mode==="rest"?"Descanso":base?minuteLabel(v.available):"Não definida")+'</div>'+
 (base&&v.available>0?'<div class="study-progress"><div style="width:'+Math.min(100,Math.round(v.totalPlanned/v.available*100))+'%"></div></div>':"")+
 (warning?'<p class="study-notice">Sua carga excede a disponibilidade informada em '+minuteLabel(v.totalPlanned-v.available)+'. Nada será remarcado automaticamente.</p>':"")+
 (base?.mode==="rest"&&v.totalPlanned?'<p class="study-notice">Há atividades planejadas num dia de descanso. Confirme se isso foi intencional.</p>':"")+
 (v.overlap.length?'<p class="study-notice">'+v.overlap.length+' conflito(s) de horários previstos: '+E(v.overlap.slice(0,2).map(x=>x.join(" / ")).join("; "))+'.</p>':"")+
 '<p class="note">As horas vêm das sessões cadastradas. Atividades vinculadas a um foco são contadas uma única vez.</p></section>';
}
function studyView(){
 if(!C.availabilityReady())return '<div class="hero-row"><div><div class="overline">SEQUÊNCIA E APRENDIZAGEM</div><h1>Meus estudos</h1></div></div><section class="card empty-state"><div class="empty-symbol">◷</div><h2>Configure sua disponibilidade</h2><p>Para planejar ciclos e sessões, informe quando você tem tempo livre.</p><button class="btn primary" data-action="openAvailability">Definir disponibilidade</button></section>';
 const cycles=db.cycles.filter(x=>!x.archived),archived=db.cycles.filter(x=>x.archived);
 const tot=summarize(),forDay=summarize({from:s.date,to:s.date});
 const inMonth=summarize({from:s.date.slice(0,7)+"-01",to:s.date.slice(0,7)+"-31"});
 return '<div class="hero-row"><div><div class="overline">SEQUÊNCIA E APRENDIZAGEM</div><h1>Meus estudos</h1><p class="kicker">Os ciclos avançam com sessões concluídas, nunca automaticamente com a passagem dos dias.</p></div><div class="row"><button class="btn primary" data-s3="openPlanner">Planejar semana</button><button class="btn" data-s3="openLibrary">Biblioteca</button><button class="btn ghost" data-s3="newCycle">+ Ciclo</button></div></div>'+
 '<div class="study-dashboard-grid">'+statCard("Estudado no dia",minuteLabel(forDay.actualMin),forDay.actualRecorded+" com tempo informado")+statCard("Estudado no mês",minuteLabel(inMonth.actualMin),inMonth.unrecorded+" sem tempo registrado")+statCard("Sessões concluídas",String(tot.completed),tot.sessions+" cadastradas")+'</div>'+
 '<section class="card study-area"><div class="card-head"><h2>Seus ciclos</h2>'+tag(cycles.length+" ativos")+'</div>'+(cycles.length?'<div class="study-cycle-grid">'+cycles.map(x=>cycleCard(x)).join("")+'</div>':'<div class="study-empty"><p class="note">Nenhum ciclo criado. Cadastre uma área e as matérias na sequência que desejar.</p><button class="btn primary" data-s3="newCycle">Criar ciclo</button></div>')+'</section>'+
 (archived.length?'<section class="card"><div class="card-head"><h2>Ciclos arquivados</h2></div><div class="simple-list">'+archived.map(x=>'<div class="list-entry"><div class="list-main"><strong>'+E(x.title)+'</strong><small>'+E(x.area)+' · histórico preservado</small></div><button class="btn small" data-s3="restoreCycle" data-id="'+A(x.id)+'">Reativar</button><button class="btn small ghost" data-s3="selectCycle" data-id="'+A(x.id)+'">Consultar</button></div>').join("")+'</div></section>':'')+
 '<section class="card"><div class="card-head"><h2>Sessões · '+E(fmt(s.date,false))+'</h2><div class="row"><button class="btn small ghost" data-s3="prevStudyDay">‹</button><button class="btn small ghost" data-s3="studyToday">Hoje</button><button class="btn small ghost" data-s3="nextStudyDay">›</button></div></div>'+tinySessions(s.date)+'<div class="row" style="margin-top:13px"><button class="btn small primary" data-s3="openPlanner">Organizar a semana</button><button class="btn small ghost" data-s3="openLibrary">Biblioteca</button><button class="btn small ghost" data-s3="openMethods">Modalidades</button><button class="btn small ghost" data-s3="studyStats">Estatísticas</button></div></section>'+loadPanel(s.date);
}
function cycleDetail(c){
 if(!c)return studyView();
 const active=studiedSubjects(c),progress=cycleProgress(c),stats=summarize({cycleId:c.id});
 const all=db.sessions.filter(x=>x.cycleId===c.id&&!x.archived);
 return '<div class="hero-row"><div><div class="overline">'+E(c.area)+'</div><h1>'+E(c.title)+'</h1><p class="kicker">'+(c.goalId?E(s.goals.find(g=>g.id===c.goalId)?.title||"Objetivo indisponível"):"Ciclo independente de metas")+'</p></div><div class="row"><button class="btn small ghost" data-s3="backStudies">← Ciclos</button><button class="btn small" data-s3="editCycle" data-id="'+A(c.id)+'">Editar ciclo</button></div></div>'+
 '<div class="study-dashboard-grid">'+statCard("Horas reais no ciclo",minuteLabel(stats.actualMin),stats.actualRecorded+" com tempo")+statCard("Horas planejadas",minuteLabel(stats.plannedMin),stats.sessions+" sessões")+statCard("Concluídas",String(stats.completed),stats.unrecorded+" sem tempo registrado")+'</div>'+
 '<section class="card study-highlight"><div class="overline">ETAPA ATUAL</div><h2>'+E(progress.cur?.title||"Nenhuma matéria ativa")+'</h2><p class="note">'+(progress.cur?progress.count+" de "+progress.required+" sessões concluídas nesta etapa.":"Adicione ou reative matérias para continuar.")+'</p><div class="study-progress"><div style="width:'+(progress.required?Math.round(progress.count/progress.required*100):0)+'%"></div></div><div class="row">'+(progress.cur?'<button class="btn primary" data-s3="planForCycle" data-cycle="'+A(c.id)+'">Planejar sessões</button>':"")+'<button class="btn" data-s3="openPlanner">Organizar exceções</button><button class="btn ghost" data-s3="addSubject" data-cycle="'+A(c.id)+'">+ Matéria</button></div></section>'+
 '<section class="card"><div class="card-head"><h2>Sequência das matérias</h2>'+tag(active.length+" cadastradas")+'</div>'+(
 active.length?'<div class="study-subject-list">'+active.map((x,i)=>'<div class="study-subject-row '+(progress.cur?.id===x.id?"is-current":"")+'"><div class="study-subject-number">'+(i+1)+'</div><div class="study-subject-desc"><strong>'+E(x.title)+'</strong><small>'+x.targetSessions+' conclusão(ões) para avançar'+(x.paused?" · pausada"+(x.reason?" · "+E(x.reason):""):"")+(x.returnDate?" · retorno opcional "+E(x.returnDate):"")+(x.archived?" · arquivada":"")+'</small></div><div class="row">'+(x.paused?tag("Pausada","warn"):progress.cur?.id===x.id?tag("Atual","main"):"")+'<button class="btn small ghost" data-s3="moveSubject" data-id="'+A(x.id)+'" data-move="-1" '+(i===0?"disabled":"")+' title="Subir matéria">↑</button><button class="btn small ghost" data-s3="moveSubject" data-id="'+A(x.id)+'" data-move="1" '+(i===active.length-1?"disabled":"")+' title="Descer matéria">↓</button><button class="btn small ghost" data-s3="editSubject" data-id="'+A(x.id)+'">Editar</button><button class="btn small" data-s3="'+(x.paused?"resumeSubject":"pauseSubject")+'" data-id="'+A(x.id)+'">'+(x.paused?"Reativar":"Pausar")+'</button><button class="btn small ghost" data-s3="chooseNext" data-id="'+A(x.id)+'" title="Escolher próxima matéria">Próxima</button><button class="btn small ghost" data-s3="copySubject" data-id="'+A(x.id)+'" title="Copiar matéria">Copiar</button><button class="btn small ghost" data-s3="archiveSubject" data-id="'+A(x.id)+'">'+(x.archived?"Restaurar":"Arquivar")+'</button><button class="btn small danger" data-s3="deleteSubject" data-id="'+A(x.id)+'">Excluir</button></div></div>').join("")+'</div>':'<p class="note">Cadastre matérias para montar a sequência.</p>')+'</section>'+
 '<section class="card"><div class="card-head"><h2>Histórico de sessões</h2>'+tag(all.length+" sessões")+'</div>'+(all.length?'<div class="study-session-list">'+all.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30).map(x=>sessionRow(x)).join("")+'</div>':'<p class="note">Nenhuma sessão registrada neste ciclo.</p>')+'</section>'+
 '<div class="row"><button class="btn ghost" data-s3="copyCycle" data-id="'+A(c.id)+'">Duplicar ciclo</button><button class="btn ghost" data-s3="archiveCycle" data-id="'+A(c.id)+'">'+(c.archived?"Reativar ciclo":"Arquivar ciclo")+'</button><button class="btn danger" data-s3="deleteCycle" data-id="'+A(c.id)+'">Excluir ciclo</button></div>';
}
function methodsView(){
 const methods=db.methods;
 return '<div class="hero-row"><div><div class="overline">SUAS ESTRATÉGIAS</div><h1>Modalidades de estudo</h1><p class="kicker">Cadastre como costuma estudar. Nenhum método é imposto.</p></div><div class="row"><button class="btn small ghost" data-s3="backStudies">← Estudos</button><button class="btn primary" data-s3="newMethod">+ Modalidade</button></div></div>'+
 '<section class="card"><div class="card-head"><h2>Suas modalidades</h2>'+tag(methods.length+" cadastradas")+'</div>'+
 (methods.length?'<div class="task-list study-method-list">'+methods.map(x=>'<div class="task-row study-method-row"><div class="task-mark">◈</div><div class="task-main"><strong>'+E(x.title)+'</strong><div class="task-meta">'+E(x.description||"Sem descrição")+(x.archived?" · arquivada":"")+'</div></div><div class="task-actions study-method-actions"><button class="btn small ghost" data-s3="editMethod" data-id="'+A(x.id)+'">Editar</button><button class="btn small ghost" data-s3="copyMethod" data-id="'+A(x.id)+'">Copiar</button><button class="btn small ghost" data-s3="archiveMethod" data-id="'+A(x.id)+'">'+(x.archived?"Reativar":"Arquivar")+'</button><button class="btn small danger" data-s3="deleteMethod" data-id="'+A(x.id)+'">Excluir</button></div></div>').join("")+'</div>':'<p class="note">Nenhuma modalidade cadastrada. Exemplos opcionais: teoria, questões, revisão, flashcards, Feynman e laboratório.</p>')+'</section>';
}
// Plano da semana: só planejamento. Nenhuma execução é permitida nesta tela.
let plannerWeek=s.date,plannerSelectedDate=s.date,plannerSelection=new Set();
const plannerDow=["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"];
function plannerLabel(x){
 const c=cycle(x.cycleId),current=c&&!c.archived?cycleState(c):null;
 if(x.rotationSlot)return (current?.title||"Próxima matéria")+" · previsão do ciclo";
 return x.discipline||subject(x.subjectId)?.title||"Estudo complementar";
}
function plannerNavigation(){
 return '<div class="row study-plan-nav"><button class="btn small ghost" data-s3="planPrevWeek" title="Semana anterior">←</button>'+
 '<button class="btn small ghost" data-s3="planCurrentWeek">Esta semana</button>'+
 '<button class="btn small ghost" data-s3="planNextWeek" title="Próxima semana">→</button>'+
 '<label class="study-plan-date-pick">Ir para <input type="date" id="s3-plan-go-date" value="'+A(plannerWeek)+'" min="'+A(first())+'"></label></div>';
}
function plannerPreview(date){
 const entries=planDayEntries(date),load=loadFor(date);
 return '<section class="card study-plan-preview"><div class="card-head"><h2>Prévia do Início · '+E(fmt(date,false))+'</h2>'+tag(entries.length+" sessões")+'</div>'+
 (entries.length?'<div class="study-plan-preview-items">'+entries.map(x=>'<div class="study-plan-preview-item"><strong>'+E(plannerLabel(x))+'</strong><span>'+E(cycle(x.cycleId)?.title||x.area)+' · '+E(minuteLabel(x.plannedMin))+'</span></div>').join("")+'</div>':'<p class="note">Esse dia ainda não tem estudos programados.</p>')+
 '<p class="note">Carga prevista: '+E(minuteLabel(load.studyPlanned))+'. O Início mostra a matéria real quando você executar o ciclo. Esta é uma prévia, sem ações de conclusão.</p></section>';
}
function plannerView(){
 const start=planWeekStart(plannerWeek),dates=planWeekDates(plannerWeek);
 const count=dates.reduce((n,d)=>n+planDayEntries(d).length,0);
 const minutes=dates.reduce((n,d)=>n+loadFor(d).studyPlanned,0);
 const weekdayCards=dates.map((date,i)=>{
  const items=planDayEntries(date),daily=loadFor(date),finished=blocked(date),
   remaining=daily.available>0&&daily.totalPlanned>daily.available;
  const plan=items.map((x,j)=>{
   const c=cycle(x.cycleId),m=method(x.methodId),chosen=plannerSelection.has(x.id);
   const editable=x.status==="pending"&&!finished;
   const badgeLabel=x.status==="done"?"Concluída":x.status==="progress"?"Em andamento":x.rotationSlot?"Seguir ciclo":x.kind==="reinforcement"?"Matéria específica":"Avulsa";
   return '<div class="study-plan-item '+(chosen?"is-selected ":"")+(editable?"is-editable":"")+'" data-plan-id="'+A(x.id)+'" draggable="'+(editable?"true":"false")+'"><div class="study-plan-item-top"><span class="study-plan-grip" aria-hidden="true">⠿</span><div class="study-plan-item-body"><strong>'+E(plannerLabel(x))+'</strong><small>'+E(c?.title||x.area||"Sem ciclo")+' · '+E(minuteLabel(x.plannedMin))+(m?' · '+E(m.title):"")+(x.topic?' · '+E(x.topic):"")+'</small></div><span class="study-plan-status">'+E(badgeLabel)+'</span></div>'+
 (editable?'<div class="study-plan-item-actions"><button class="btn small ghost" data-s3="planSelect" data-id="'+A(x.id)+'" aria-pressed="'+chosen+'">'+(chosen?"✓ Selecionado":"Selecionar")+'</button><button class="btn small ghost" data-s3="planEdit" data-id="'+A(x.id)+'">Editar</button><button class="btn small ghost" data-s3="planDuplicate" data-id="'+A(x.id)+'">Duplicar</button><button class="btn small ghost" data-s3="planMove" data-id="'+A(x.id)+'">Mover</button><button class="btn small danger" data-s3="planRemove" data-id="'+A(x.id)+'">Excluir</button></div>':'<small class="study-plan-locked">Para alterar uma sessão iniciada, corrija sua execução no Início.</small>')+'</div>';
  }).join("");
  return '<div class="study-plan-day '+(date===s.date?"is-today":"")+'" data-plan-date="'+A(date)+'"><div class="study-plan-day-head"><button class="study-plan-day-title" data-s3="planPreviewDay" data-date="'+A(date)+'"><strong>'+plannerDow[i]+'</strong><small>'+E(spanDate(date))+'</small></button><span class="study-plan-day-total">'+items.length+' · '+E(minuteLabel(daily.studyPlanned))+'</span></div>'+
  (remaining?'<p class="study-plan-overload">Carga acima da disponibilidade</p>':"")+
  '<div class="study-plan-day-items">'+(plan||'<p class="study-plan-placeholder">Arraste uma sessão para cá ou adicione um estudo.</p>')+'</div>'+
  (finished?'<small>Dia finalizado: histórico preservado</small>':'<div class="study-plan-day-footer"><button class="btn small primary" data-s3="planAdd" data-date="'+A(date)+'">+ Estudo</button><button class="btn small ghost" data-s3="planCopyDay" data-date="'+A(date)+'">Copiar dia</button></div>')+'</div>';
 }).join("");
 const hasSelection=plannerSelection.size;
 return '<div class="hero-row"><div><div class="overline">EDIÇÃO DA SUA ROTINA</div><h1>Planejamento de estudos</h1><p class="kicker">Escolha ciclos e matérias já cadastrados. Configure o que aparecerá no Início; conclua os estudos somente lá.</p></div><div class="row"><button class="btn primary" data-s3="planAdd" data-date="'+A(s.date)+'">+ Estudo</button><button class="btn ghost" data-s3="openLibrary">Biblioteca</button><button class="btn ghost" data-s3="backStudies">Ciclos</button></div></div>'+
 '<section class="card study-plan-toolbar"><div><h2>Semana de '+E(spanDate(start))+' a '+E(spanDate(dates[6]))+'</h2><p class="note">'+count+' sessão(ões) · '+E(minuteLabel(minutes))+' de estudos previstos</p></div>'+plannerNavigation()+
 '<div class="study-plan-tools"><button class="btn small" data-s3="planCopyWeek">Copiar semana</button><button class="btn small ghost" data-s3="planSaveTemplate">Salvar modelo</button><button class="btn small ghost" data-s3="planUseTemplate">Aplicar modelo</button><button class="btn small ghost" data-s3="planBatch">Distribuir vários dias</button>'+
 (hasSelection?'<button class="btn small primary" data-s3="planBulk">Editar '+hasSelection+' selecionada(s)</button><button class="btn small danger" data-s3="planRemoveSelected">Excluir selecionadas</button><button class="btn small ghost" data-s3="planUnselect">Cancelar seleção</button>':"")+
 (plannerUndo?'<button class="btn small ghost" data-s3="planUndo">↶ Desfazer última edição</button>':"")+'</div></section>'+
 '<div class="study-plan-week">'+weekdayCards+'</div>'+
 plannerPreview(plannerSelectedDate)+
 '<p class="note">Para reorganizar no computador, arraste uma sessão para outro dia. No celular, use Mover. Repetir uma matéria específica cria um estudo extra sem alterar a rotação; seguir o ciclo mantém a próxima matéria dinâmica.</p>';
}
function studyLibraryView(){
 const cycles=db.cycles.filter(x=>!x.archived);
 const activeMethods=db.methods.filter(x=>!x.archived);
 return '<div class="hero-row"><div><div class="overline">CADASTRE UMA VEZ</div><h1>Biblioteca de estudos</h1><p class="kicker">Esses cadastros alimentam os seletores do planejamento. Você não precisará redigitar área, objetivo nem matéria.</p></div><div class="row"><button class="btn small ghost" data-s3="openPlanner">← Planejamento</button><button class="btn primary" data-s3="newCycle">+ Ciclo</button></div></div>'+
 '<section class="card study-library-section"><div class="card-head"><h2>Ciclos, áreas e matérias</h2>'+tag(cycles.length+" ciclos")+'</div>'+
 (cycles.length?cycles.map(c=>'<div class="study-library-cycle"><div class="study-library-cycle-head"><div><strong>'+E(c.title)+'</strong><small>'+E(c.area)+' · '+E(s.goals.find(g=>g.id===c.goalId)?.title||"Sem objetivo vinculado")+'</small></div><div class="row"><button class="btn small ghost" data-s3="editCycle" data-id="'+A(c.id)+'">Editar ciclo</button><button class="btn small" data-s3="addSubject" data-cycle="'+A(c.id)+'">+ Matéria</button><button class="btn small ghost" data-s3="selectCycle" data-id="'+A(c.id)+'">Sequência</button></div></div>'+
 (studiedSubjects(c).length?studiedSubjects(c).map(sub=>'<div class="study-library-sub"><div class="study-library-sub-head"><div><strong>'+E(sub.title)+'</strong><small>'+(sub.paused?"Pausada · ":"")+sub.targetSessions+' conclusão(ões) por etapa</small></div><div class="row"><button class="btn small ghost" data-s3="editSubject" data-id="'+A(sub.id)+'">Editar</button><button class="btn small ghost" data-s3="newTopic" data-subject="'+A(sub.id)+'">+ Assunto</button></div></div>'+
 (db.topics.filter(t=>t.subjectId===sub.id&&!t.archived).length?'<div class="study-library-topics">'+db.topics.filter(t=>t.subjectId===sub.id&&!t.archived).map(t=>'<span class="study-library-topic">'+E(t.title)+' <button class="study-library-topic-action" title="Editar assunto" data-s3="editTopic" data-id="'+A(t.id)+'">✎</button><button class="study-library-topic-action" title="Excluir assunto" data-s3="deleteTopic" data-id="'+A(t.id)+'">×</button></span>').join("")+'</div>':'<small class="study-library-empty">Sem assuntos cadastrados. O assunto é opcional no planejamento.</small>')+'</div>').join(""):'<p class="note">Cadastre matérias antes de planejar.</p>')+'</div>').join(""):'<p class="note">Crie seu primeiro ciclo para começar.</p>')+'</section>'+
 '<section class="card study-library-section"><div class="card-head"><h2>Modalidades</h2><button class="btn small primary" data-s3="newMethod">+ Modalidade</button></div>'+
 (activeMethods.length?'<div class="study-library-methods">'+activeMethods.map(m=>'<div class="study-library-method"><span>'+E(m.title)+'</span><button class="btn small ghost" data-s3="editMethod" data-id="'+A(m.id)+'">Editar</button></div>').join("")+'</div>':'<p class="note">Sem modalidades cadastradas. Você pode criá-las aqui e selecioná-las no planejamento.</p>')+
 '<div class="row"><button class="btn small ghost" data-s3="openMethods">Gerenciar modalidades e arquivos</button></div></section>';
}
function statsView(){
 const v=summarize(),recent=summarize({from:add(day(),-29),to:day()});
 const sections=[["Áreas de estudo",v.groups.areas],["Matérias (todas as áreas)",v.groups.disciplines],["Assuntos",v.groups.topics],["Modalidades",v.groups.methods],["Ciclos",v.groups.cycles]];
 return '<div class="hero-row"><div><div class="overline">RESULTADOS REGISTRADOS</div><h1>Estatísticas de estudo</h1><p class="kicker">Horas reais são contabilizadas somente quando informadas.</p></div><button class="btn ghost" data-s3="backStudies">← Estudos</button></div>'+
 '<div class="study-dashboard-grid">'+statCard("Horas reais",minuteLabel(v.actualMin),v.actualRecorded+" sessões com tempo")+statCard("Horas planejadas",minuteLabel(v.plannedMin),v.sessions+" sessões previstas")+statCard("Últimos 30 dias",minuteLabel(recent.actualMin),recent.completed+" concluídas")+'</div>'+
 (v.unrecorded?'<div class="action-strip"><span class="icon">◷</span><p>'+v.unrecorded+' sessão(ões) ainda não têm duração real registrada; não foram consideradas como zero minutos de estudo.</p></div>':"")+
 sections.map(([title,items])=>'<section class="card"><div class="card-head"><h2>'+E(title)+'</h2></div><div class="study-summary-list">'+(Object.keys(items).length?Object.entries(items).sort((a,b)=>b[1].minutes-a[1].minutes).map(([k,q])=>'<div class="study-summary-line"><div><strong>'+E(k)+'</strong><small>'+q.completed+' concluída(s) · '+q.recorded+'/'+q.sessions+' com tempo real</small></div><b>'+minuteLabel(q.minutes)+'</b></div>').join(""):'<p class="note">Sem registros suficientes nesta dimensão.</p>')+'</div></section>').join("");
}
let detailCycle="",screen="cycles";
function decorate(route,base){
 if(route==="inicio"&&C.availabilityReady()){
  const needle='<div class="grid-2 dashboard-panels">';
  if(base.includes(needle))return base.replace(needle,needle+homePanel())+loadPanel(s.date);
  return base+homePanel()+loadPanel(s.date);
 }
 if(route==="organizar")return base.replace('<div class="tab-line">','<div class="row"><button class="btn small" data-s3="openStudies">◉ Gerenciar ciclos e estudos</button><button class="btn small ghost" data-s3="openMethods">Modalidades</button></div><div class="tab-line">');
 if(route==="planejamento")return base+'<section class="card"><div class="card-head"><h2>Sessões planejadas · '+E(spanDate(s.date))+'</h2><button class="btn small" data-s3="openPlanner">Organizar estudos</button></div>'+tinySessions(s.date)+'</section>'+loadPanel(s.date);
 if(route==="estudos"){
  if(screen==="cycle"&&detailCycle)return cycleDetail(cycle(detailCycle));
  if(screen==="planner")return plannerView();
  if(screen==="library")return studyLibraryView();
  if(screen==="methods")return methodsView();
  if(screen==="stats")return statsView();
  return studyView();
 }
 return base;
}
const selectOptions=(items,selected,placeholder="Selecionar")=>'<option value="">'+E(placeholder)+'</option>'+items.map(x=>'<option value="'+A(x.id)+'" '+(selected===x.id?"selected":"")+'>'+E(x.title)+'</option>').join("");
const field=(label,name,value,type="text",attrs="")=>'<div class="field"><label>'+E(label)+'</label><input name="'+name+'" type="'+type+'" value="'+A(value??"")+'" '+attrs+'></div>';
function modal(title,form){C.openModal(title,form,"");}
function cycleModal(id){
 const c=id?cycle(id):null;
 modal(c?"Editar ciclo":"Novo ciclo",'<form id="s3-cycle" class="section-stack"><input type="hidden" name="id" value="'+A(c?.id||"")+'">'+field("Nome do ciclo","title",c?.title||"","text",'required maxlength="100" placeholder="Ex.: Meu ciclo de estudos"')+field("Área / finalidade","area",c?.area||"","text",'required maxlength="80" placeholder="Ex.: ENEM, Eletrônica"')+
 '<div class="form-grid">'+field("Duração padrão por sessão (min)","defaultMin",c?.defaultMin||90,"number",'min="1" max="720" required')+
 '<div class="field"><label>Objetivo relacionado (opcional)</label><select name="goalId">'+selectOptions(s.goals.filter(x=>!x.archived),c?.goalId,"Sem objetivo relacionado")+'</select></div></div>'+
 '<p class="note">A sequência começa vazia. Você adicionará e organizará as próprias matérias.</p><div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Salvar ciclo</button></div></form>');
}
function subjectModal(id,cycleId){
 const x=id?subject(id):null,c=cycle(x?.cycleId||cycleId);
 if(!c)return notify("Selecione um ciclo.");
 modal(x?"Editar matéria":"Adicionar matéria",'<form id="s3-subject" class="section-stack"><input name="id" type="hidden" value="'+A(x?.id||"")+'"><input name="cycleId" type="hidden" value="'+A(c.id)+'">'+field("Nome da matéria","title",x?.title||"","text",'required maxlength="100" placeholder="Ex.: Matemática"')+
 field("Conclusões para avançar à próxima matéria","targetSessions",x?.targetSessions||1,"number",'min="1" max="12" required')+
 '<p class="note">Esta quantidade define quando o ciclo muda de matéria; não agenda sessões nem acrescenta horas automaticamente. Para estudar Matemática três vezes hoje, agende três sessões na tela de Estudos. O ciclo avança quando as conclusões necessárias forem registradas no Início.</p><div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Salvar matéria</button></div></form>');
}
function pauseModal(id){
 const x=subject(id);if(!x)return;
 modal("Pausar matéria",'<form id="s3-pause" class="section-stack"><input name="id" value="'+A(id)+'" type="hidden"><p class="note">A matéria deixará de participar da rotação até que seja reativada manualmente. A data de retorno funciona como referência, não como reativação automática.</p><div class="field"><label>Motivo (opcional)</label><textarea name="reason" maxlength="550">'+E(x.reason||"")+'</textarea></div>'+field("Previsão de retorno (opcional)","returnDate",x.returnDate||"","date",'min="'+day()+'"')+
 '<div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Pausar matéria</button></div></form>');
}
function methodModal(id){
 const x=id?method(id):null;
 modal(x?"Editar modalidade":"Nova modalidade",'<form id="s3-method" class="section-stack"><input name="id" value="'+A(id||"")+'" type="hidden">'+field("Nome","title",x?.title||"","text",'required maxlength="80" placeholder="Ex.: Revisão ativa"')+'<div class="field"><label>Descrição opcional</label><textarea name="description" maxlength="500">'+E(x?.description||"")+'</textarea></div><div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button type="submit" class="btn primary">Salvar</button></div></form>');
}
// Formulários rápidos: área/objetivo/matéria vêm da biblioteca, nunca de digitação livre.
function planQuickModal(id="",presetDate=""){
 const x=id?session(id):null;
 if(x){planIsEditable(x);if(!x.cycleId)return sessionModal(id);}
 const cycles=db.cycles.filter(z=>!z.archived&&activeSubjects(z).length);
 const selected=cycle(x?.cycleId)||cycles[0];
 if(!selected){notify("Cadastre um ciclo com matérias na Biblioteca antes de planejar.");screen="library";C.go("estudos");return;}
 const mode=x?(x.rotationSlot?"rotation":"specific"):"rotation",dt=presetDate||x?.date||s.date;
 const chosen=x?.subjectId||"",sub=subject(chosen);
 const cycleOptions=cycles.map(z=>'<option value="'+A(z.id)+'" '+(selected.id===z.id?"selected":"")+'>'+E(z.title)+'</option>').join("");
 const subOpts=studiedSubjects(selected).filter(z=>!z.archived).map(z=>'<option value="'+A(z.id)+'" '+(sub?.id===z.id?"selected":"")+'>'+E(z.title)+(z.paused?" (pausada)":"")+'</option>').join("");
 const topicOpts=sub?planTopics(sub.id).map(t=>'<option value="'+A(t.id)+'" '+(x?.topicId===t.id?"selected":"")+'>'+E(t.title)+'</option>').join(""):"";
 const methodOpts=db.methods.filter(m=>!m.archived||m.id===x?.methodId).map(m=>'<option value="'+A(m.id)+'" '+(m.id===x?.methodId?"selected":"")+'>'+E(m.title)+'</option>').join("");
 modal(x?"Editar planejamento":"Adicionar estudo ao dia",
  '<form id="s3-quick" class="section-stack"><input name="id" type="hidden" value="'+A(x?.id||"")+'">'+
  '<div class="field"><label>Ciclo</label><select name="cycleId" id="s3-quick-cycle" required>'+cycleOptions+'</select></div>'+
  '<div class="study-quick-cycle-meta" id="s3-quick-meta">Área: '+E(selected.area)+' · '+E(s.goals.find(g=>g.id===selected.goalId)?.title||"Sem objetivo vinculado")+'</div>'+
  '<div class="field"><label>O que estudar?</label><select name="mode" id="s3-quick-mode"><option value="rotation" '+(mode==="rotation"?"selected":"")+'>Seguir a sequência do ciclo</option><option value="specific" '+(mode==="specific"?"selected":"")+'>Matéria específica (sem avançar o ciclo)</option></select></div>'+
  '<div class="field" id="s3-quick-subject-field" '+(mode==="rotation"?"hidden":"")+'><label>Matéria cadastrada</label><select name="subjectId" id="s3-quick-subject"><option value="">Selecione uma matéria</option>'+subOpts+'</select></div>'+
  '<div class="field" id="s3-quick-topic-field" '+(mode==="rotation"?"hidden":"")+'><label>Assunto cadastrado (opcional)</label><select name="topicId" id="s3-quick-topic"><option value="">Sem assunto definido</option>'+topicOpts+'</select></div>'+
  '<div class="form-grid">'+field("Data","date",dt,"date",'min="'+A(first())+'" required')+
  field("Duração (min)","plannedMin",x?.plannedMin??selected.defaultMin??90,"number",'min="1" max="720" required')+'</div>'+
  (!x?'<div class="field"><label>Quantas sessões nesse dia?</label><select name="count">'+[1,2,3,4,5,6,7,8,9,10,11,12].map(i=>'<option value="'+i+'">'+i+' sessão(ões)</option>').join("")+'</select></div>':"")+
  '<div class="field"><label>Modalidade cadastrada (opcional)</label><select name="methodId"><option value="">Sem modalidade definida</option>'+methodOpts+'</select></div>'+
  '<p class="note">Você está configurando o que aparecerá no Início. Somente lá será possível iniciar, concluir, desfazer e registrar o estudo.</p>'+
  '<p class="study-batch-error" id="s3-plan-error" role="alert" hidden></p>'+
  '<div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Salvar no planejamento</button></div></form>');
 updateQuickFields();
}
function updateQuickFields(changed=""){
 const form=$("s3-quick");if(!form)return;
 const c=cycle(form.querySelector('[name="cycleId"]')?.value);
 if(!c)return;
 const mode=form.querySelector('[name="mode"]')?.value;
 const subSelect=form.querySelector('[name="subjectId"]');
 const oldSub=changed==="cycle"?"":subSelect.value;
 const choices=studiedSubjects(c).filter(x=>!x.archived);
 subSelect.innerHTML='<option value="">Selecione uma matéria</option>'+choices.map(x=>'<option value="'+A(x.id)+'">'+E(x.title)+(x.paused?" (pausada)":"")+'</option>').join("");
 if(choices.some(x=>x.id===oldSub))subSelect.value=oldSub;
 else if(mode==="specific"&&choices.length)subSelect.value=choices[0].id;
 const sub=subject(subSelect.value),topicSelect=form.querySelector('[name="topicId"]');
 const oldTopic=changed==="subject"||changed==="cycle"?"":topicSelect.value;
 topicSelect.innerHTML='<option value="">Sem assunto definido</option>'+(sub?planTopics(sub.id).map(t=>'<option value="'+A(t.id)+'">'+E(t.title)+'</option>').join(""):"");
 if(planTopics(sub?.id).some(t=>t.id===oldTopic))topicSelect.value=oldTopic;
 $("s3-quick-subject-field").hidden=mode!=="specific";
 $("s3-quick-topic-field").hidden=mode!=="specific";
 $("s3-quick-meta").textContent="Área: "+c.area+" · "+(s.goals.find(g=>g.id===c.goalId)?.title||"Sem objetivo vinculado");
 if(changed==="cycle")form.querySelector('[name="plannedMin"]').value=c.defaultMin||90;
}
function topicModal(id="",preSubject=""){
 const topic=id?db.topics.find(x=>x.id===id):null;
 const subjects=db.subjects.filter(x=>!x.archived&&db.cycles.some(c=>c.id===x.cycleId&&!c.archived));
 if(!subjects.length)return notify("Cadastre pelo menos uma matéria na Biblioteca.");
 const options=subjects.map(x=>'<option value="'+A(x.id)+'" '+((topic?.subjectId||preSubject||subjects[0].id)===x.id?"selected":"")+'>'+E(cycle(x.cycleId)?.title||"Ciclo")+' · '+E(x.title)+'</option>').join("");
 modal(topic?"Editar assunto":"Cadastrar assunto",
  '<form id="s3-topic" class="section-stack"><input type="hidden" name="id" value="'+A(topic?.id||"")+'">'+
  '<div class="field"><label>Matéria</label><select name="subjectId">'+options+'</select></div>'+
  field("Assunto","title",topic?.title||"","text",'required maxlength="100" placeholder="Ex.: Equações do 2º grau"')+
  '<div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Salvar assunto</button></div></form>');
}
function planCopyModal(kind="week",source=""){
 const week=kind==="week",from=week?planWeekStart(plannerWeek):source||s.date;
 const target=add(from,7);
 modal(week?"Copiar semana completa":"Copiar programação de um dia",
 '<form id="s3-plan-copy" class="section-stack"><input name="kind" type="hidden" value="'+kind+'"><input name="source" type="hidden" value="'+A(from)+'">'+
 '<p class="note">Copiar sessões, ciclos e durações sem copiar conclusões, tempos realizados ou progresso. As matérias que seguem o ciclo continuarão dinâmicas.</p>'+
 field(week?"Segunda-feira de destino":"Data de destino","target",target,"date",'min="'+A(first())+'" required')+
 '<label class="study-batch-available"><input type="checkbox" name="replace" value="1">Substituir sessões pendentes no destino (preserva sessões já iniciadas/concluídas)</label>'+
 '<p class="study-batch-error" id="s3-plan-error" role="alert" hidden></p>'+
 '<div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Copiar '+(week?"semana":"dia")+'</button></div></form>');
}
function planMoveModal(id){
 const x=session(id);planIsEditable(x);
 modal("Mover sessão",'<form id="s3-plan-move" class="section-stack"><input type="hidden" name="id" value="'+A(id)+'">'+
 '<p class="note">'+E(plannerLabel(x))+' · '+E(minuteLabel(x.plannedMin))+'</p>'+
 field("Novo dia","date",x.date,"date",'min="'+A(first())+'" required')+
 '<div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Mover sessão</button></div></form>');
}
function planBulkModal(){
 if(!plannerSelection.size)return notify("Selecione primeiro as sessões.");
 const cycles=db.cycles.filter(x=>!x.archived&&activeSubjects(x).length);
 modal("Editar sessões selecionadas",'<form id="s3-plan-bulk" class="section-stack">'+
 '<p class="note">Alterações aplicadas às '+plannerSelection.size+' sessões selecionadas. Deixe campos em branco para manter o valor atual.</p>'+
 field("Mover todas para a data (opcional)","date","","date",'min="'+A(first())+'"')+
 field("Duração para todas, em minutos (opcional)","plannedMin","","number",'min="1" max="720"')+
 '<div class="field"><label>Matéria / ciclo</label><select name="mode" id="s3-bulk-mode"><option value="keep">Manter a matéria e o ciclo de cada sessão</option><option value="rotation">Seguir um ciclo selecionado</option><option value="specific">Escolher matéria específica</option></select></div>'+
 '<div id="s3-bulk-target" hidden><div class="field"><label>Ciclo de destino</label><select name="cycleId" id="s3-bulk-cycle"><option value="">Manter ciclos atuais</option>'+cycles.map(x=>'<option value="'+A(x.id)+'">'+E(x.title)+'</option>').join("")+'</select></div>'+
 '<div class="field" id="s3-bulk-subject-wrap" hidden><label>Matéria cadastrada</label><select name="subjectId" id="s3-bulk-subject"><option value="">Selecione uma matéria</option></select></div></div>'+
 '<p class="study-batch-error" id="s3-plan-error" role="alert" hidden></p>'+
 '<div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Aplicar às selecionadas</button></div></form>');
}
function updateBulkFields(){
 const mode=$("s3-bulk-mode")?.value,group=$("s3-bulk-target"),wrap=$("s3-bulk-subject-wrap");
 if(!group)return;
 group.hidden=mode==="keep";wrap.hidden=mode!=="specific";
 const id=$("s3-bulk-cycle")?.value,select=$("s3-bulk-subject");
 if(select){
  const subs=id?studiedSubjects(cycle(id)).filter(x=>!x.archived):[];
  select.innerHTML='<option value="">Selecione uma matéria</option>'+subs.map(x=>'<option value="'+A(x.id)+'">'+E(x.title)+'</option>').join("");
 }
}
function planTemplateModal(mode){
 if(mode==="save")return modal("Salvar semana como modelo",
 '<form id="s3-template-save" class="section-stack">'+field("Nome do modelo","title","","text",'required maxlength="60" placeholder="Ex.: Semana com foco no ENEM"')+
 '<p class="note">O modelo guardará quantidades, dias, ciclos e durações, mas nunca conclusões.</p><div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Salvar modelo</button></div></form>');
 if(!db.templates.length)return notify("Você ainda não tem modelos salvos. Salve uma semana primeiro.");
 modal("Aplicar modelo semanal",'<form id="s3-template-apply" class="section-stack">'+
 '<div class="field"><label>Modelo salvo</label><select name="id">'+db.templates.map(x=>'<option value="'+A(x.id)+'">'+E(x.title)+' ('+x.items.length+' sessões)</option>').join("")+'</select></div>'+
 field("Segunda-feira de destino","date",planWeekStart(plannerWeek),"date",'min="'+A(first())+'" required')+
 '<label class="study-batch-available"><input type="checkbox" name="replace" value="1">Substituir sessões pendentes da semana (sem apagar conclusões)</label>'+
 '<p class="study-batch-error" id="s3-plan-error" role="alert" hidden></p>'+
 '<div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Aplicar planejamento</button></div></form>');
}
function batchModal(preferredCycle=""){
 const selected=db.cycles.find(x=>x.id===preferredCycle&&!x.archived&&activeSubjects(x).length)||db.cycles.find(x=>!x.archived&&activeSubjects(x).length);
 if(!selected)return notify("Crie um ciclo e ative ao menos uma matéria antes de planejar sessões.");
 const start=s.date<first()?first():s.date,end=add(start,6);
 const options=db.cycles.filter(x=>!x.archived&&activeSubjects(x).length).map(x=>'<option value="'+A(x.id)+'" '+(selected.id===x.id?"selected":"")+'>'+E(x.title)+'</option>').join("");
 const weekdays=["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
 const days=weekdays.map((x,i)=>'<label class="study-batch-day"><input type="checkbox" name="weekdays" value="'+i+'" '+(i>=1&&i<=5?"checked":"")+'><span>'+x+'</span></label>').join("");
 modal("Distribuir sessões de estudo",'<form id="s3-batch" class="section-stack"><div class="field"><label>Ciclo de estudo</label><select name="cycleId" required>'+options+'</select></div>'+
 '<div class="form-grid">'+field("De","fromDate",start,"date",'min="'+A(first())+'" required')+field("Até (máximo 31 dias)","toDate",end,"date",'min="'+A(first())+'" required')+'</div>'+
 '<div class="form-grid">'+field("Sessões por dia","count",1,"number",'min="1" max="12" required')+field("Minutos por sessão","plannedMin",selected.defaultMin||90,"number",'min="1" max="720" required')+'</div>'+
 '<div class="study-batch-days"><strong>Dias da semana</strong><div class="study-batch-shortcuts"><button class="btn small ghost" type="button" data-s3="batchWeekdays">Segunda a sexta</button><button class="btn small ghost" type="button" data-s3="batchAll">Todos os dias</button><button class="btn small ghost" type="button" data-s3="batchClear">Limpar</button></div><div class="study-batch-days-grid">'+days+'</div></div>'+
 '<label class="study-batch-available"><input type="checkbox" name="onlyAvailable" value="1">Usar somente os dias com disponibilidade (substitui a seleção acima)</label>'+
 '<p class="note">Cada sessão será contada separadamente no analisador de carga. A matéria de cada vaga acompanha o ciclo na hora de estudar, sem avançá-lo apenas porque os dias passaram. Nada será marcado como concluído automaticamente.</p>'+
 '<p class="study-batch-error" id="s3-batch-error" role="alert" hidden></p>'+
 '<div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Criar sessões</button></div></form>');
}
function sessionModal(id,overrideCycle="",kind="",date=""){
 const x=id?session(id):null;
 const firstCycle=cycle(x?.cycleId||overrideCycle),selection=x?.kind||kind||(firstCycle?"cycle":"supplement");
 const dateValue=x?.date||date||s.date;
 const current=firstCycle?cycleState(firstCycle):null;
 const selectedSub=subject(x?.subjectId)||current;
 const focusItems=focusForDate(dateValue);
 const options=db.cycles.filter(c=>!c.archived||c.id===x?.cycleId);
 const methods=db.methods.filter(m=>!m.archived||m.id===x?.methodId);
 let template='<form id="s3-session" class="section-stack"><input name="id" type="hidden" value="'+A(x?.id||"")+'">'+
 '<div class="form-grid"><div class="field"><label>Tipo de estudo</label><select name="kind" id="s3-kind"><option value="cycle" '+(selection==="cycle"?"selected":"")+'>Etapa do ciclo</option><option value="reinforcement" '+(selection==="reinforcement"?"selected":"")+'>Reforço / estudo extra</option><option value="supplement" '+(selection==="supplement"?"selected":"")+'>Complementar independente</option></select></div><div class="field"><label>Ciclo (opcional para complementar)</label><select name="cycleId" id="s3-cycle-choice">'+selectOptions(options,x?.cycleId||overrideCycle,"Sem ciclo")+'</select></div></div>'+
 '<div class="form-grid"><div class="field"><label>Matéria do ciclo (opcional)</label><select name="subjectId" id="s3-subject-choice">'+selectOptions(firstCycle?studiedSubjects(firstCycle):[],selectedSub?.id,"Sem matéria")+'</select></div>'+field("Data do estudo","date",dateValue,"date",'min="'+A(first())+'" required')+'</div>'+
 '<div class="form-grid">'+field("Área / objetivo","area",x?.area||firstCycle?.area||"","text",'required maxlength="90" placeholder="ENEM, Eletrônica..."')+
 field("Matéria (classificação geral)","discipline",x?.discipline||selectedSub?.title||"","text",'required maxlength="90" placeholder="Matemática..."')+'</div>'+
 '<div class="form-grid">'+field("Assunto (opcional)","topic",x?.topic||"","text",'maxlength="130" placeholder="Trigonometria"')+
 field("Finalidade (opcional)","purpose",x?.purpose||"","text",'maxlength="190" placeholder="Aplicar em corrente alternada"')+'</div>'+
 '<div class="form-grid">'+field("Duração prevista (min)","plannedMin",x?.plannedMin??firstCycle?.defaultMin??90,"number",'min="1" max="1440" placeholder="Opcional"')+
 field("Início previsto (opcional)","startTime",x?.startTime||"","time")+'</div>'+
 '<div class="form-grid"><div class="field"><label>Modalidade</label><select name="methodId">'+selectOptions(methods,x?.methodId,"Sem modalidade")+'</select></div><div class="field"><label>Foco obrigatório vinculado</label><select name="focusId">'+selectOptions(focusItems.map(z=>({id:z.id,title:z.title})),x?.focusId,"Nenhum foco")+'</select></div></div>'+
 (!x?field("Quantidade de sessões iguais","count",1,"number",'min="1" max="12" required'):'')+
 '<p class="note" id="s3-session-help">A sessão usa a matéria selecionada. Somente etapas do ciclo avançam a rotação; reforços não avançam.</p>'+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Salvar sessão</button></div></form>';
 modal(x?"Editar sessão":"Agendar sessões",template);
 updateSessionChoices();
}
function updateSessionChoices(){
 const form=$("s3-session");if(!form)return;
 const c=cycle(form.elements?.cycleId?.value||form.querySelector('[name="cycleId"]')?.value);
 const select=form.querySelector('[name="subjectId"]'),kind=form.querySelector('[name="kind"]')?.value;
 if(!select)return;
 const previous=select.value,active=c?cycleState(c):null;
 select.innerHTML=selectOptions(c?studiedSubjects(c):[],kind==="cycle"?active?.id:previous,"Sem matéria");
 if(kind==="cycle"&&active)select.value=active.id;
 const help=$("s3-session-help");if(help)help.textContent=kind==="cycle"?"Etapa do ciclo: deve usar a matéria atual. Planeje todas as sessões necessárias antes de concluí-las.":kind==="reinforcement"?"Reforço: não avança a rotação, mesmo que seja concluído.":"Estudo complementar: pode ser independente do ciclo e também não avança a rotação.";
 const area=form.querySelector('[name="area"]');if(c&&area&&!area.value)area.value=c.area;
 const discipline=form.querySelector('[name="discipline"]');if(active&&discipline&&!discipline.value)discipline.value=active.title;
}
function recordModal(id){
 const x=session(id);if(!x)return;
 modal("Registrar estudo",'<form id="s3-record" class="section-stack"><input name="id" value="'+A(id)+'" type="hidden"><p class="note">'+E(x.discipline)+' · '+E(fmt(x.date,false))+'</p><div class="field"><label>Situação</label><select name="status"><option value="pending" '+(x.status==="pending"?"selected":"")+'>Pendente</option><option value="progress" '+(x.status==="progress"?"selected":"")+'>Em andamento / parcial</option><option value="done" '+(x.status==="done"?"selected":"")+'>Concluída</option></select></div>'+
 '<div class="form-grid">'+field("Tempo efetivo (minutos, opcional)","actualMin",x.actualMin??"","number",'min="1" max="1440" placeholder="Não inferir do previsto"')+
 field("Hora real de início (opcional)","actualTime",x.actualTime||"","time")+'</div>'+
 '<div class="form-grid">'+field("Questões respondidas (opcional)","questions",x.evidence?.questions??"","number",'min="0" max="10000"')+field("Questões corretas (opcional)","correct",x.evidence?.correct??"","number",'min="0" max="10000"')+'</div>'+
 '<div class="field"><label>Qualidade percebida do estudo (autoavaliação)</label><select name="quality"><option value="">Não informar</option>'+[1,2,3,4,5].map(n=>'<option value="'+n+'" '+(x.evidence?.quality===n?"selected":"")+'>'+n+' de 5</option>').join("")+'</select><small class="help">É uma percepção pessoal, não comprovação de aprendizagem.</small></div>'+
 '<p class="note">Sessões parciais registram esforço sem avançar o ciclo. Tempo real e resultados são opcionais; nenhum valor será inferido automaticamente.</p>'+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button type="submit" class="btn primary">Salvar registro</button></div></form>');
}
function ask(title,description,action,extra=""){
 modal(title,'<p class="note">'+E(description)+'</p><div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button type="button" class="btn danger" data-s3="'+action+'" '+extra+'>Confirmar</button></div>');
}
const actions={
 openPlanner(){screen="planner";plannerWeek=s.date;plannerSelectedDate=s.date;plannerSelection.clear();C.go("estudos");},
 openLibrary(){screen="library";C.go("estudos");},
 planPreviewDay(el){plannerSelectedDate=el.dataset.date;render();},
 planPrevWeek(){plannerWeek=add(planWeekStart(plannerWeek),-7);plannerSelectedDate=planWeekStart(plannerWeek);render();},
 planNextWeek(){plannerWeek=add(planWeekStart(plannerWeek),7);plannerSelectedDate=planWeekStart(plannerWeek);render();},
 planCurrentWeek(){plannerWeek=s.date;plannerSelectedDate=s.date;render();},
 planForCycle(el){screen="planner";plannerWeek=s.date;plannerSelectedDate=s.date;C.go("estudos");planQuickModal("",s.date);
  const sel=$("s3-quick-cycle");if(sel&&el.dataset.cycle){sel.value=el.dataset.cycle;updateQuickFields("cycle");}},
 planAdd(el){planQuickModal("",el?.dataset?.date||s.date);},
 planEdit(el){planQuickModal(el.dataset.id);},
 planDuplicate(el){
  const x=session(el.dataset.id);planIsEditable(x);
  if(!x.cycleId)return notify("Esta sessão antiga não possui ciclo. Edite-a antes de duplicar.");
  const created=planCreate({cycleId:x.cycleId,date:x.date,
   mode:x.rotationSlot||x.kind==="cycle"?"rotation":"specific",
   subjectId:x.subjectId,plannedMin:x.plannedMin||cycle(x.cycleId)?.defaultMin||90,
   methodId:x.methodId||"",topicId:x.topicId||"",count:1});
  notify("Sessão duplicada sem copiar resultados.");
 },
 planMove(el){planMoveModal(el.dataset.id);},
 planRemove(el){const x=session(el.dataset.id);planIsEditable(x);
  ask("Excluir sessão do planejamento","Essa sessão será removida apenas da agenda. Você poderá desfazer em seguida.",
    "planConfirmRemove",'data-id="'+A(x.id)+'"');},
 planConfirmRemove(el){planDelete([el.dataset.id]);plannerSelection.delete(el.dataset.id);close();notify("Sessão removida. Você pode desfazer.");},
 planSelect(el){const id=el.dataset.id;if(plannerSelection.has(id))plannerSelection.delete(id);else{planIsEditable(session(id));plannerSelection.add(id);}render();},
 planUnselect(){plannerSelection.clear();render();},
 planBulk(){planBulkModal();},
 planRemoveSelected(){if(!plannerSelection.size)return;
  ask("Excluir "+plannerSelection.size+" sessões?","A exclusão afeta somente as sessões pendentes selecionadas; você poderá desfazer.", "planConfirmRemoveSelected");},
 planConfirmRemoveSelected(){planDelete([...plannerSelection]);plannerSelection.clear();close();notify("Sessões removidas. É possível desfazer a última edição.");},
 planCopyDay(el){planCopyModal("day",el.dataset.date);},
 planCopyWeek(){planCopyModal("week");},
 planSaveTemplate(){planTemplateModal("save");},
 planUseTemplate(){planTemplateModal("apply");},
 planUndo(){planUndo();},
 newTopic(el){topicModal("",el?.dataset?.subject||"");},
 editTopic(el){topicModal(el.dataset.id);},
 deleteTopic(el){
  const t=db.topics.find(x=>x.id===el.dataset.id);if(!t)return;
  ask("Excluir assunto", "O assunto deixará de aparecer nos seletores. Sessões já realizadas manterão o registro histórico.",
  "confirmDeleteTopic",'data-id="'+A(t.id)+'"');
 },
 confirmDeleteTopic(el){
  const id=el.dataset.id,t=db.topics.find(x=>x.id===id);if(!t)return;
  if(db.sessions.some(x=>x.topicId===id))t.archived=true;
  else db.topics.splice(db.topics.findIndex(x=>x.id===id),1);
  logs("study_topic_deleted",{id});save();close();render();notify("Assunto atualizado.");
 },

 planBatch(el){if(!C.availabilityReady())return notify("Configure a disponibilidade antes de planejar.");batchModal(el?.dataset?.cycle||"");},
 batchWeekdays(){for(const input of document.querySelectorAll('#s3-batch input[name="weekdays"]'))input.checked=Number(input.value)>=1&&Number(input.value)<=5;},
 batchAll(){for(const input of document.querySelectorAll('#s3-batch input[name="weekdays"]'))input.checked=true;},
 batchClear(){for(const input of document.querySelectorAll('#s3-batch input[name="weekdays"]'))input.checked=false;},
 copyCycle(el){const x=cycle(el.dataset.id);if(!x)return;const y=saveCycle({title:x.title+" (cópia)",area:x.area,defaultMin:x.defaultMin,goalId:x.goalId});for(const old of studiedSubjects(x)){const copy=saveSubject({cycleId:y.id,title:old.title,targetSessions:old.targetSessions});if(old.paused)pauseSubject(copy.id,true,old.reason,old.returnDate&&old.returnDate>=day()?old.returnDate:"");}detailCycle=y.id;screen="cycle";save();render();notify("Ciclo duplicado sem copiar resultados.");},
 copySubject(el){const x=subject(el.dataset.id);if(!x)return;saveSubject({cycleId:x.cycleId,title:x.title+" (cópia)",targetSessions:x.targetSessions});save();render();notify("Matéria copiada.");},
 chooseNext(el){const x=subject(el.dataset.id),c=x&&cycle(x.cycleId);if(!c||x.paused||x.archived)return notify("Reative a matéria primeiro.");if(c.currentSubjectId!==x.id){const pending=stepSessions(c);if(pending.length)c.stepNo++;c.currentSubjectId=x.id;logs("cycle_next_manual",{cycleId:c.id,subjectId:x.id,previousStepSessions:pending.map(q=>q.id)});save();render();notify("Próxima matéria ajustada manualmente.");}},
 copySession(el){const x=session(el.dataset.id);if(!x)return;const nextDate=add(x.date,1);if(!editable(nextDate))return;const kind=x.kind==="cycle"?"reinforcement":x.kind;const c=cycle(x.cycleId);if(c?.archived)return notify("Ciclo arquivado. Reative-o para copiar sessões.");const copy={...x,id:unique(),date:nextDate,kind,stepNo:0,status:"pending",actualMin:null,actualTime:"",completedAt:null,focusId:"",createdAt:now()};db.sessions.push(copy);logs("session_copied",{fromId:x.id,toId:copy.id,date:nextDate});save();render();notify("Sessão copiada para o dia seguinte como estudo complementar, sem duplicar conclusão.");},
 copyMethod(el){const x=method(el.dataset.id);if(!x)return;saveMethod({title:x.title+" (cópia)",description:x.description});save();render();notify("Modalidade copiada.");},
 openStudies(){screen="cycles";detailCycle="";C.go("estudos")},
 backStudies(){screen="cycles";detailCycle="";plannerSelection.clear();render()},
 selectCycle(el){screen="cycle";detailCycle=el.dataset.id;C.go("estudos")},
 newCycle(){if(!C.availabilityReady())return notify("Configure sua disponibilidade antes de criar ciclos.");cycleModal()},editCycle(el){cycleModal(el.dataset.id)},
 addSubject(el){subjectModal(null,el.dataset.cycle||detailCycle)},editSubject(el){subjectModal(el.dataset.id)},
 pauseSubject(el){pauseModal(el.dataset.id)},
 resumeSubject(el){pauseSubject(el.dataset.id,false);save();render();notify("Matéria reativada.");},
 archiveSubject(el){archiveSubject(el.dataset.id);save();render();notify("Matéria atualizada.");},
 moveSubject(el){reorderSubject(el.dataset.id,Number(el.dataset.move));save();render()},
 deleteSubject(el){
  const x=subject(el.dataset.id);if(!x)return;
  const existing=db.sessions.some(q=>q.subjectId===x.id);
  ask("Excluir matéria",existing?"Esta matéria possui sessões registradas. Ela será arquivada para preservar o histórico.":"A matéria será removida da sequência.", "confirmDeleteSubject",'data-id="'+A(x.id)+'"');
 },
 confirmDeleteSubject(el){
  const x=subject(el.dataset.id);if(!x)return;
  if(db.sessions.some(q=>q.subjectId===x.id)){x.archived=true;x.paused=true;const c=cycle(x.cycleId);if(c.currentSubjectId===x.id){c.currentSubjectId=null;cycleState(c);}logs("subject_archived",{subjectId:x.id,reason:"history"});}
  else {db.subjects=db.subjects.filter(q=>q.id!==x.id);const c=cycle(x.cycleId);if(c.currentSubjectId===x.id){c.currentSubjectId=null;cycleState(c);}logs("subject_deleted",{subjectId:x.id});}
  save();close();render();notify("Matéria atualizada.");},
 restoreCycle(el){const x=cycle(el.dataset.id);if(!x)return;x.archived=false;logs("cycle_restored",{cycleId:x.id});save();render();notify("Ciclo reativado.");},
 archiveCycle(el){
  const x=cycle(el.dataset.id);if(!x)return;
  x.archived=!x.archived;logs(x.archived?"cycle_archived":"cycle_restored",{cycleId:x.id});save();screen="cycles";detailCycle="";render();notify(x.archived?"Ciclo arquivado.":"Ciclo reativado.");},
 deleteCycle(el){
  const x=cycle(el.dataset.id);if(!x)return;
  ask("Excluir ciclo",db.sessions.some(q=>q.cycleId===x.id)?"Há sessões relacionadas. O ciclo será arquivado para preservar as estatísticas e o histórico.":"O ciclo e suas matérias serão excluídos.", "confirmDeleteCycle",'data-id="'+A(x.id)+'"');
 },
 confirmDeleteCycle(el){
  const x=cycle(el.dataset.id);if(!x)return;
  if(db.sessions.some(q=>q.cycleId===x.id)){x.archived=true;logs("cycle_archived",{cycleId:x.id,reason:"history"});}
  else{db.cycles=db.cycles.filter(q=>q.id!==x.id);db.subjects=db.subjects.filter(q=>q.cycleId!==x.id);logs("cycle_deleted",{cycleId:x.id});}
  save();close();screen="cycles";detailCycle="";render();notify("Ciclo atualizado.");},
 newSession(el){if(!C.availabilityReady())return notify("Configure sua disponibilidade antes de criar sessões.");screen="planner";plannerWeek=s.date;plannerSelectedDate=s.date;C.go("estudos");planQuickModal("",s.date);},
 editSession(el){planQuickModal(el.dataset.id)},recordSession(el){
 if(location.hash!=="#inicio")return notify("Registre estudos somente na tela Início.");
 recordModal(el.dataset.id);
},
 quickDone(el){
  if(location.hash!=="#inicio")return notify("Conclua e desfaça sessões somente na tela Início.");
  const x=session(el.dataset.id);if(!x)return;
  try{setSessionStatus(x.id,x.status==="done"?"pending":"done",x.actualMin,x.actualTime);save();render();notify("Registro atualizado.");}catch(err){notify(err.message);}
 },
 deleteSession(el){const x=session(el.dataset.id);if(!x)return;ask("Excluir sessão","O registro será removido apenas se o dia ainda estiver aberto e não houver etapas posteriores que dependam dele.","confirmDeleteSession",'data-id="'+A(x.id)+'"');},
 confirmDeleteSession(el){try{deleteSession(el.dataset.id);save();close();render();notify("Sessão excluída.");}catch(err){notify(err.message);}},
 newMethod(){methodModal()},editMethod(el){methodModal(el.dataset.id)},openMethods(){screen="methods";C.go("estudos")},studyStats(){screen="stats";C.go("estudos")},
 archiveMethod(el){const m=method(el.dataset.id);if(m){m.archived=!m.archived;logs("method_archive_change",{methodId:m.id,archived:m.archived});save();render();}},
 deleteMethod(el){const m=method(el.dataset.id);if(!m)return;ask("Excluir modalidade","As sessões existentes manterão a classificação histórica por referência. Uma modalidade usada será arquivada.","confirmDeleteMethod",'data-id="'+A(m.id)+'"')},
 confirmDeleteMethod(el){const id=el.dataset.id,m=method(id);if(!m)return;if(db.sessions.some(x=>x.methodId===id)){m.archived=true;}else db.methods=db.methods.filter(x=>x.id!==id);logs("method_delete_or_archive",{methodId:id});save();close();render();},
 prevStudyDay(){const prev=add(s.date,-1);if(prev>=first()){s.date=prev;save();render();}},
 nextStudyDay(){s.date=add(s.date,1);save();render()},
 studyToday(){s.date=day();save();render()}
};
function submission(id,data){
 if(id==="s3-quick"){
  const previous=String(data.get("id")||"");
  const payload={cycleId:data.get("cycleId"),mode:data.get("mode"),subjectId:data.get("subjectId"),
   topicId:data.get("topicId"),methodId:data.get("methodId"),date:data.get("date"),
   plannedMin:data.get("plannedMin"),count:data.get("count")||1};
  const saved=previous?planEdit(previous,payload):planCreate(payload);
  plannerWeek=String(data.get("date"));plannerSelectedDate=plannerWeek;
  plannerSelection.clear();close();render();notify(previous?"Planejamento atualizado.":saved.length+" sessão(ões) adicionada(s) à agenda.");
  return;
 }
 if(id==="s3-topic"){
  const previous=String(data.get("id")||""),sub=subject(String(data.get("subjectId")||""));
  if(!sub||sub.archived)throw Error("Selecione uma matéria válida da Biblioteca.");
  const title=validName(data.get("title"),100);
  if(previous){
   const t=db.topics.find(x=>x.id===previous);if(!t)throw Error("Assunto não encontrado.");
   Object.assign(t,{title,subjectId:sub.id});
  }else db.topics.push({id:unique(),title,subjectId:sub.id,archived:false,createdAt:now()});
  logs("study_topic_saved",{id:previous||db.topics.at(-1).id});
  save();close();render();notify("Assunto salvo na Biblioteca.");
  return;
 }
 if(id==="s3-plan-copy"){
  const days=data.get("kind")==="week"?7:1;
  const copied=planCopyRange(String(data.get("source")),String(data.get("target")),days,data.get("replace")==="1");
  plannerWeek=String(data.get("target"));plannerSelectedDate=plannerWeek;plannerSelection.clear();
  close();render();notify(copied.length+" sessão(ões) copiadas. Conclusões não foram copiadas.");
  return;
 }
 if(id==="s3-plan-move"){
  const date=String(data.get("date"));planMove(String(data.get("id")),date);
  plannerWeek=date;plannerSelectedDate=date;plannerSelection.clear();
  close();render();notify("Sessão movida para "+fmt(date,false)+".");return;
 }
 if(id==="s3-plan-bulk"){
  const changed=planBulk([...plannerSelection],{
   date:data.get("date"),plannedMin:data.get("plannedMin"),mode:data.get("mode"),
   cycleId:data.get("cycleId"),subjectId:data.get("subjectId")});
  if(data.get("date")){plannerWeek=String(data.get("date"));plannerSelectedDate=plannerWeek;}
  plannerSelection.clear();close();render();notify(changed.length+" sessões ajustadas.");return;
 }
 if(id==="s3-template-save"){
  const template=planSaveTemplate(data.get("title"),plannerWeek);
  close();render();notify("Modelo "+template.title+" salvo.");return;
 }
 if(id==="s3-template-apply"){
  const n=planApplyTemplate(String(data.get("id")),String(data.get("date")),data.get("replace")==="1");
  plannerWeek=String(data.get("date"));plannerSelectedDate=plannerWeek;plannerSelection.clear();
  close();render();notify(n+" sessões aplicadas a partir do modelo.");return;
 }
 if(id==="s3-batch"){
  const selected=String(data.get("cycleId")||""),group=cycle(selected);
  const ids=addBatchSessions({cycleId:selected,fromDate:data.get("fromDate"),toDate:data.get("toDate"),count:data.get("count"),plannedMin:data.get("plannedMin"),weekdays:data.getAll("weekdays"),onlyAvailable:data.get("onlyAvailable")==="1"});
  save();close();render();notify(ids.length+" sessões planejadas. Execute-as na tela Início.");
  return;
 }
 if(id==="s3-cycle"){const x=saveCycle({title:data.get("title"),area:data.get("area"),defaultMin:data.get("defaultMin"),goalId:data.get("goalId")},String(data.get("id")||""));detailCycle=x.id;screen="cycle";save();close();C.go("estudos");render();notify("Ciclo salvo.");return;}
 if(id==="s3-subject"){const x=saveSubject({cycleId:String(data.get("cycleId")),title:data.get("title"),targetSessions:data.get("targetSessions")},String(data.get("id")||""));save();close();render();notify("Matéria salva.");return;}
 if(id==="s3-pause"){pauseSubject(String(data.get("id")),true,String(data.get("reason")||""),String(data.get("returnDate")||""));save();close();render();notify("Matéria pausada.");return;}
 if(id==="s3-method"){saveMethod({title:data.get("title"),description:data.get("description")},String(data.get("id")||""));save();close();render();notify("Modalidade salva.");return;}
 if(id==="s3-session"){
  const payload={kind:data.get("kind"),cycleId:String(data.get("cycleId")||""),subjectId:String(data.get("subjectId")||""),date:data.get("date"),area:data.get("area"),discipline:data.get("discipline"),topic:data.get("topic"),purpose:data.get("purpose"),methodId:data.get("methodId"),plannedMin:data.get("plannedMin"),startTime:data.get("startTime"),focusId:data.get("focusId")};
  const id=String(data.get("id")||"");
  if(id)updateSession(id,payload);else addSessions(payload,data.get("count"));
  save();close();render();notify("Sessão salva.");return;
 }
 if(id==="s3-record"){
 const questionsRaw=String(data.get("questions")??"").trim(),correctRaw=String(data.get("correct")??"").trim(),qualityRaw=String(data.get("quality")??"").trim();
 const questions=questionsRaw===""?null:Number(questionsRaw),correct=correctRaw===""?null:Number(correctRaw),quality=qualityRaw===""?null:Number(qualityRaw);
 if(questions!==null&&(!Number.isInteger(questions)||questions<0||questions>10000))throw Error("Quantidade de questões inválida.");
 if(correct!==null&&(!Number.isInteger(correct)||correct<0||correct>10000))throw Error("Quantidade de acertos inválida.");
 if(correct!==null&&(questions===null||correct>questions))throw Error("Informe primeiro o total de questões; acertos não podem exceder o total.");
 if(quality!==null&&(!Number.isInteger(quality)||quality<1||quality>5))throw Error("Qualidade percebida inválida.");
 const x=setSessionStatus(String(data.get("id")),String(data.get("status")),data.get("actualMin"),String(data.get("actualTime")||""));
 x.evidence={questions,correct,quality};logs("learning_evidence",{sessionId:x.id,questions,correct,quality});save();close();render();notify(x.status==="done"?"Sessão concluída.":"Registro atualizado.");return;
 }
}
document.addEventListener("click",event=>{
 const t=event.target.closest("[data-s3]");if(!t)return;
 event.preventDefault();try{actions[t.dataset.s3]?.(t);}catch(err){notify(err.message||"Não foi possível realizar a operação.");console.error(err);}
});
document.addEventListener("submit",event=>{
 const id=event.target?.getAttribute?.("id")||event.target?.id;
 if(!String(id||"").startsWith("s3-"))return;
 event.preventDefault();try{submission(id,new FormData(event.target));}catch(err){const alert=$("s3-plan-error")||$("s3-batch-error");if(alert){alert.textContent=err.message||"Confira os campos.";alert.hidden=false;}notify(err.message||"Verifique os dados preenchidos.");}
});
document.addEventListener("change",event=>{
 const el=event.target;if(el?.id==="s3-cycle-choice"||el?.id==="s3-kind")updateSessionChoices();
 if(el?.id==="s3-quick-cycle")updateQuickFields("cycle");
 else if(el?.id==="s3-quick-mode")updateQuickFields("mode");
 else if(el?.id==="s3-quick-subject")updateQuickFields("subject");
 if(el?.id==="s3-bulk-mode"||el?.id==="s3-bulk-cycle")updateBulkFields();
 if(el?.id==="s3-plan-go-date"&&datesOkay(el.value)){plannerWeek=el.value;plannerSelectedDate=el.value;render();}
 if(el?.name==="subjectId"){
  const sub=subject(el.value),form=$("s3-session");if(sub&&form){const discipline=form.querySelector('[name="discipline"]');if(discipline)discipline.value=sub.title;}
 }
});
// Desktop: arrastar sessão para outro dia ou mudar sua posição.
// Celulares mantêm a opção equivalente Mover por data.
document.addEventListener("dragstart",event=>{
 const item=event.target.closest?.(".study-plan-item[draggable='true']");
 if(!item||!event.dataTransfer)return;
 event.dataTransfer.setData("text/plain",item.dataset.planId);
 event.dataTransfer.effectAllowed="move";
 item.classList.add("is-dragging");
});
document.addEventListener("dragover",event=>{
 const zone=event.target.closest?.(".study-plan-day");
 if(!zone||screen!=="planner")return;
 event.preventDefault();
 if(event.dataTransfer)event.dataTransfer.dropEffect="move";
 zone.classList.add("is-drop-target");
});
document.addEventListener("drop",event=>{
 const zone=event.target.closest?.(".study-plan-day");
 if(!zone||screen!=="planner")return;
 event.preventDefault();
 const id=event.dataTransfer?.getData("text/plain")||"";
 try{
  if(!id)return;
  const rows=[...zone.querySelectorAll(".study-plan-item")];
  const target=event.target.closest?.(".study-plan-item");
  const position=target?rows.indexOf(target)+1:0;
  planMove(id,zone.dataset.planDate,position);
  plannerSelectedDate=zone.dataset.planDate;plannerSelection.clear();
  notify("Sessão reorganizada. Pode desfazer a última edição.");
 }catch(err){notify(err.message||"Não foi possível mover.");}
});
document.addEventListener("dragend",()=>{
 for(const n of document.querySelectorAll(".study-plan-day.is-drop-target,.study-plan-item.is-dragging"))n.classList.remove("is-drop-target","is-dragging");
});
window.OrbitaStage3={decorate,inspect:{get model(){return db},saveCycle,saveSubject,pauseSubject,archiveSubject,reorderSubject,saveMethod,addSessions,addBatchSessions,planValidate,planCreate,planEdit,planDelete,planMove,planBulk,planCopyRange,planSaveTemplate,planApplyTemplate,planUndo,planWeekStart,planDayEntries,updateSession,setSessionStatus,deleteSession,progression,cycleState,stepSessions,requiredSessions,summarize,loadFor,cycleProgress,subject,cycle,session,actions,submission}};
render();
})();