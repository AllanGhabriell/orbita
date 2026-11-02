/* ÓRBITA — Etapa 3: motor de estudos local. Supabase/SQL somente na etapa 5. */
(function(){
"use strict";
const C=window.OrbitaCore, S2=window.OrbitaStage2?.inspect;
if(!C||!S2)throw Error("Órbita: etapas anteriores não carregadas");
const s=C.state;
const db=s.studies||(s.studies={version:3,cycles:[],subjects:[],methods:[],sessions:[],events:[]});
for(const key of ["cycles","subjects","methods","sessions","events"])if(!Array.isArray(db[key]))db[key]=[];
const $=id=>document.getElementById(id);
const E=C.esc,A=C.attr, tag=C.tag, day=C.today, add=C.addDays,fmt=C.dateLabel;
const unique=()=>((typeof crypto!=="undefined"&&crypto.randomUUID)?crypto.randomUUID():"s"+Date.now().toString(36)+Math.random().toString(36).slice(2));
const now=()=>new Date().toISOString();
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
function updateSession(id,data){
 const x=session(id);if(!x||x.archived)throw Error("Sessão indisponível.");
 if(!editable(x.date))throw Error("Data fechada.");
 const next=normalizeSession(data,x);
 // Editar o planejamento não apaga o tempo efetivamente registrado.
 next.actualMin=x.actualMin;
 if(x.kind==="cycle"&&x.stepNo!==cycle(x.cycleId)?.stepNo){
  if(x.date!==next.date||next.plannedMin!==x.plannedMin||next.focusId!==x.focusId||next.methodId!==x.methodId)throw Error("Esta etapa já avançou. Preserve o planejamento histórico.");
 }
 if(x.kind==="cycle"&&x.status==="done"&&x.stepNo===cycle(x.cycleId)?.stepNo&&next.date!==x.date)throw Error("Concluída: altere o plano antes de avançar.");
 Object.assign(x,next);logs("session_edited",{sessionId:id});return x;
}
function setSessionStatus(id,status,actualMin,actualTime){
 const x=session(id);if(!x||x.archived)throw Error("Sessão não encontrada.");
 if(!editable(x.date))throw Error("O dia está finalizado.");
 if(!["pending","progress","done"].includes(status))throw Error("Status inválido.");
 const minutes=optionalMin(actualMin);
 if(actualTime&&!validTime(actualTime))throw Error("Horário inválido.");
 if(x.status==="done"&&status!=="done"&&x.kind==="cycle")canUndoCompletedStep(x);
 const old=x.status;
 x.status=status;x.actualMin=minutes;x.actualTime=actualTime||"";
 if(status==="done")x.completedAt=x.completedAt||now();
 else x.completedAt=null;
 logs("session_status",{sessionId:id,from:old,to:status,actualMin:minutes});
 const c=x.kind==="cycle"?cycle(x.cycleId):null;
 if(c&&status==="done"&&x.stepNo===c.stepNo)progression(c);
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
 const entries=db.sessions.filter(x=>!x.archived&&(!filter.from||x.date>=filter.from)&&(!filter.to||x.date<=filter.to)&&(!filter.cycleId||x.cycleId===filter.cycleId)&&(!filter.area||x.area===filter.area));
 const planned=entries.reduce((sum,x)=>sum+Number(x.plannedMin||0),0);
 const actual=entries.reduce((sum,x)=>sum+Number(x.actualMin||0),0);
 const actualRecorded=entries.filter(x=>x.actualMin!=null).length;
 const groups={areas:{},disciplines:{},topics:{},methods:{},cycles:{}};
 function inc(key,name,x){let k=name||"Não especificado";if(!groups[key][k])groups[key][k]={minutes:0,sessions:0,completed:0,recorded:0};const v=groups[key][k];v.sessions++;if(x.status==="done")v.completed++;if(x.actualMin!=null){v.minutes+=Number(x.actualMin);v.recorded++;}}
 for(const x of entries){
  inc("areas",x.area,x);inc("disciplines",x.discipline,x);inc("topics",x.topic,x);
  inc("methods",method(x.methodId)?.title||"Sem modalidade",x);
  inc("cycles",cycle(x.cycleId)?.title||(x.cycleId?"Ciclo arquivado":"Complementar independente"),x);
 }
 return {sessions:entries.length,completed:entries.filter(x=>x.status==="done").length,inProgress:entries.filter(x=>x.status==="progress").length,plannedMin:planned,actualMin:actual,actualRecorded,unrecorded:entries.length-actualRecorded,groups};
}
function loadFor(date){
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
 return '<section class="card study-cycle-card"><div class="card-head"><div><div class="overline">'+E(c.area)+'</div><h2>'+E(c.title)+'</h2></div>'+tag(c.archived?"Arquivado":"Ciclo","")+'</div><div class="study-current"><div><span>PRÓXIMA MATÉRIA</span><strong>'+E(cur?.title||"Nenhuma matéria ativa")+'</strong><small>'+(cur?count+" de "+required+" sessão(ões) concluída(s) na etapa":"Adicione ou reative uma matéria")+'</small></div><div class="study-progress"><div style="width:'+(required?Math.round(count/required*100):0)+'%"></div></div></div><div class="row study-actions"><button class="btn small" data-s3="selectCycle" data-id="'+A(c.id)+'">Gerenciar</button>'+(cur&&!c.archived?'<button class="btn small primary" data-s3="newSession" data-cycle="'+A(c.id)+'">+ Sessão</button>':"")+'</div></section>';
}
function tinySessions(date){
 const list=db.sessions.filter(x=>x.date===date&&!x.archived).sort((a,b)=>(a.startTime||"99:99").localeCompare(b.startTime||"99:99"));
 if(!list.length)return '<p class="note">Nenhuma sessão de estudo planejada para esta data.</p>';
 return '<div class="study-session-list">'+list.map(x=>sessionRow(x,true)).join("")+'</div>';
}
function sessionRow(x,compact=false){
 const c=cycle(x.cycleId),m=method(x.methodId);
 const desc=[c?.title||"Estudo complementar",x.topic,x.startTime?x.startTime:"",x.plannedMin!=null?minuteLabel(x.plannedMin)+" previstas":"",x.actualMin!=null?minuteLabel(x.actualMin)+" registradas":""].filter(Boolean).join(" · ");
 return '<div class="study-session-row '+(x.status==="done"?"done":"")+'"><div class="study-session-mark">'+(x.status==="done"?"✓":x.status==="progress"?"◷":"◉")+'</div><div class="study-session-body"><strong>'+E(x.discipline)+'</strong><small>'+E(desc)+'</small>'+((m||x.purpose)?'<small>'+E([m?.title,x.purpose].filter(Boolean).join(" • "))+'</small>':"")+'</div><div class="study-session-controls">'+(!blocked(x.date)?'<button class="btn small ghost" data-s3="quickDone" data-id="'+A(x.id)+'" title="'+(x.status==="done"?"Reabrir sessão":"Concluir sessão")+'">'+(x.status==="done"?"↶":"✓")+'</button>':"")+'<button class="btn small" data-s3="recordSession" data-id="'+A(x.id)+'">Registro</button><button class="btn small ghost" data-s3="editSession" data-id="'+A(x.id)+'" title="Editar sessão">✎</button><button class="btn small ghost" data-s3="copySession" data-id="'+A(x.id)+'" title="Copiar sessão">⧉</button><button class="btn small danger" data-s3="deleteSession" data-id="'+A(x.id)+'" title="Excluir sessão">×</button></div></div>';
}
function homePanel(){
 const date=s.date,load=loadFor(date),c=db.cycles.filter(c=>!c.archived),daily=db.sessions.filter(x=>x.date===date&&!x.archived),tot=summarize({from:date,to:date});
 return '<section class="card study-home-panel"><div class="card-head"><h2>◉ Ciclos e estudos</h2><button class="btn small ghost" data-s3="openStudies">Abrir ciclos ↗</button></div>'+
 (c.length?'<div class="study-home-next">'+c.slice(0,3).map(x=>{const p=cycleProgress(x);return '<button class="study-chip" data-s3="selectCycle" data-id="'+A(x.id)+'"><span>'+E(x.title)+'</span><strong>'+E(p.cur?.title||"Sem matéria")+'</strong></button>'}).join("")+'</div>':'<p class="note">Nenhum ciclo cadastrado. Crie seu primeiro ciclo quando quiser.</p>')+
 '<div class="study-stats-mini"><span>'+daily.length+' sessão(ões) planejada(s)</span><span>'+minuteLabel(tot.actualMin)+' efetivamente registradas</span></div>'+
 '<div class="row">'+(c.length?'<button class="btn small primary" data-s3="newSession">+ Sessão</button>':'<button class="btn small" data-s3="newCycle">+ Ciclo</button>')+'<button class="btn small ghost" data-s3="openStudies">Estudos complementares</button></div></section>';
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
 const cycles=db.cycles.filter(x=>!x.archived);
 const tot=summarize(),forDay=summarize({from:s.date,to:s.date});
 const inMonth=summarize({from:s.date.slice(0,7)+"-01",to:s.date.slice(0,7)+"-31"});
 return '<div class="hero-row"><div><div class="overline">SEQUÊNCIA E APRENDIZAGEM</div><h1>Meus estudos</h1><p class="kicker">Os ciclos avançam com sessões concluídas, nunca automaticamente com a passagem dos dias.</p></div><div class="row"><button class="btn primary" data-s3="newCycle">+ Ciclo</button><button class="btn" data-s3="newSession">+ Sessão</button></div></div>'+
 '<div class="study-dashboard-grid">'+statCard("Estudado no dia",minuteLabel(forDay.actualMin),forDay.actualRecorded+" com tempo informado")+statCard("Estudado no mês",minuteLabel(inMonth.actualMin),inMonth.unrecorded+" sem tempo registrado")+statCard("Sessões concluídas",String(tot.completed),tot.sessions+" cadastradas")+'</div>'+
 '<section class="card study-area"><div class="card-head"><h2>Seus ciclos</h2>'+tag(cycles.length+" ativos")+'</div>'+(cycles.length?'<div class="study-cycle-grid">'+cycles.map(x=>cycleCard(x)).join("")+'</div>':'<div class="study-empty"><p class="note">Nenhum ciclo criado. Cadastre uma área e as matérias na sequência que desejar.</p><button class="btn primary" data-s3="newCycle">Criar ciclo</button></div>')+'</section>'+
 '<section class="card"><div class="card-head"><h2>Sessões · '+E(fmt(s.date,false))+'</h2><div class="row"><button class="btn small ghost" data-s3="prevStudyDay">‹</button><button class="btn small ghost" data-s3="studyToday">Hoje</button><button class="btn small ghost" data-s3="nextStudyDay">›</button></div></div>'+tinySessions(s.date)+'<div class="row" style="margin-top:13px"><button class="btn small" data-s3="newSession">+ Agendar</button><button class="btn small ghost" data-s3="openMethods">Modalidades</button><button class="btn small ghost" data-s3="studyStats">Estatísticas</button></div></section>'+loadPanel(s.date);
}
function cycleDetail(c){
 if(!c)return studyView();
 const active=studiedSubjects(c),progress=cycleProgress(c);
 const all=db.sessions.filter(x=>x.cycleId===c.id&&!x.archived);
 return '<div class="hero-row"><div><div class="overline">'+E(c.area)+'</div><h1>'+E(c.title)+'</h1><p class="kicker">'+(c.goalId?E(s.goals.find(g=>g.id===c.goalId)?.title||"Objetivo indisponível"):"Ciclo independente de metas")+'</p></div><div class="row"><button class="btn small ghost" data-s3="backStudies">← Ciclos</button><button class="btn small" data-s3="editCycle" data-id="'+A(c.id)+'">Editar ciclo</button></div></div>'+
 '<section class="card study-highlight"><div class="overline">ETAPA ATUAL</div><h2>'+E(progress.cur?.title||"Nenhuma matéria ativa")+'</h2><p class="note">'+(progress.cur?progress.count+" de "+progress.required+" sessões concluídas nesta etapa.":"Adicione ou reative matérias para continuar.")+'</p><div class="study-progress"><div style="width:'+(progress.required?Math.round(progress.count/progress.required*100):0)+'%"></div></div><div class="row">'+(progress.cur?'<button class="btn primary" data-s3="newSession" data-cycle="'+A(c.id)+'">Agendar etapa atual</button>':"")+'<button class="btn" data-s3="newSession" data-cycle="'+A(c.id)+'" data-mode="reinforcement">Estudo de reforço</button><button class="btn ghost" data-s3="addSubject" data-cycle="'+A(c.id)+'">+ Matéria</button></div></section>'+
 '<section class="card"><div class="card-head"><h2>Sequência das matérias</h2>'+tag(active.length+" cadastradas")+'</div>'+(
 active.length?'<div class="study-subject-list">'+active.map((x,i)=>'<div class="study-subject-row '+(progress.cur?.id===x.id?"is-current":"")+'"><div class="study-subject-number">'+(i+1)+'</div><div class="study-subject-desc"><strong>'+E(x.title)+'</strong><small>'+x.targetSessions+' sessão(ões) por etapa'+(x.paused?" · pausada"+(x.reason?" · "+E(x.reason):""):"")+(x.returnDate?" · retorno opcional "+E(x.returnDate):"")+(x.archived?" · arquivada":"")+'</small></div><div class="row">'+(x.paused?tag("Pausada","warn"):progress.cur?.id===x.id?tag("Atual","main"):"")+'<button class="btn small ghost" data-s3="moveSubject" data-id="'+A(x.id)+'" data-move="-1" '+(i===0?"disabled":"")+' title="Subir matéria">↑</button><button class="btn small ghost" data-s3="moveSubject" data-id="'+A(x.id)+'" data-move="1" '+(i===active.length-1?"disabled":"")+' title="Descer matéria">↓</button><button class="btn small ghost" data-s3="editSubject" data-id="'+A(x.id)+'">Editar</button><button class="btn small" data-s3="'+(x.paused?"resumeSubject":"pauseSubject")+'" data-id="'+A(x.id)+'">'+(x.paused?"Reativar":"Pausar")+'</button><button class="btn small ghost" data-s3="chooseNext" data-id="'+A(x.id)+'" title="Escolher próxima matéria">Próxima</button><button class="btn small ghost" data-s3="copySubject" data-id="'+A(x.id)+'" title="Copiar matéria">Copiar</button><button class="btn small ghost" data-s3="archiveSubject" data-id="'+A(x.id)+'">'+(x.archived?"Restaurar":"Arquivar")+'</button><button class="btn small danger" data-s3="deleteSubject" data-id="'+A(x.id)+'">Excluir</button></div></div>').join("")+'</div>':'<p class="note">Cadastre matérias para montar a sequência.</p>')+'</section>'+
 '<section class="card"><div class="card-head"><h2>Histórico de sessões</h2>'+tag(all.length+" sessões")+'</div>'+(all.length?'<div class="study-session-list">'+all.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30).map(x=>sessionRow(x)).join("")+'</div>':'<p class="note">Nenhuma sessão registrada neste ciclo.</p>')+'</section>'+
 '<div class="row"><button class="btn ghost" data-s3="copyCycle" data-id="'+A(c.id)+'">Duplicar ciclo</button><button class="btn ghost" data-s3="archiveCycle" data-id="'+A(c.id)+'">'+(c.archived?"Reativar ciclo":"Arquivar ciclo")+'</button><button class="btn danger" data-s3="deleteCycle" data-id="'+A(c.id)+'">Excluir ciclo</button></div>';
}
function methodsView(){
 const methods=db.methods;
 return '<div class="hero-row"><div><div class="overline">SUAS ESTRATÉGIAS</div><h1>Modalidades de estudo</h1><p class="kicker">Cadastre como costuma estudar. Nenhum método é imposto.</p></div><div class="row"><button class="btn small ghost" data-s3="backStudies">← Estudos</button><button class="btn primary" data-s3="newMethod">+ Modalidade</button></div></div>'+
 '<section class="card"><div class="card-head"><h2>Suas modalidades</h2>'+tag(methods.length+" cadastradas")+'</div>'+
 (methods.length?'<div class="task-list">'+methods.map(x=>'<div class="task-row"><div class="task-mark">◈</div><div class="task-main"><strong>'+E(x.title)+'</strong><div class="task-meta">'+E(x.description||"Sem descrição")+(x.archived?" · arquivada":"")+'</div></div><div class="task-actions"><button class="btn small ghost" data-s3="editMethod" data-id="'+A(x.id)+'">Editar</button><button class="btn small ghost" data-s3="copyMethod" data-id="'+A(x.id)+'">Copiar</button><button class="btn small ghost" data-s3="archiveMethod" data-id="'+A(x.id)+'">'+(x.archived?"Reativar":"Arquivar")+'</button><button class="btn small danger" data-s3="deleteMethod" data-id="'+A(x.id)+'">Excluir</button></div></div>').join("")+'</div>':'<p class="note">Nenhuma modalidade cadastrada. Exemplos opcionais: teoria, questões, revisão, flashcards, Feynman e laboratório.</p>')+'</section>';
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
 if(route==="planejamento")return base+'<section class="card"><div class="card-head"><h2>Sessões de estudo · '+E(spanDate(s.date))+'</h2><button class="btn small" data-s3="newSession">+ Sessão</button></div>'+tinySessions(s.date)+'</section>'+loadPanel(s.date);
 if(route==="estudos"){
  if(screen==="cycle"&&detailCycle)return cycleDetail(cycle(detailCycle));
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
 field("Sessões necessárias por etapa","targetSessions",x?.targetSessions||1,"number",'min="1" max="12" required')+
 '<p class="note">Exemplo: 2 sessões significa que a matéria só libera a próxima após duas conclusões válidas na mesma etapa. Estudos de reforço não avançam o ciclo.</p><div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Salvar matéria</button></div></form>');
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
 field("Hora real de início (opcional)","actualTime",x.actualTime||"","time")+'</div><p class="note">Sessões parciais registram esforço sem avançar o ciclo. A conclusão exige confirmação; o tempo real pode permanecer não informado.</p>'+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button type="submit" class="btn primary">Salvar registro</button></div></form>');
}
function ask(title,description,action,extra=""){
 modal(title,'<p class="note">'+E(description)+'</p><div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button type="button" class="btn danger" data-s3="'+action+'" '+extra+'>Confirmar</button></div>');
}
const actions={
 copyCycle(el){const x=cycle(el.dataset.id);if(!x)return;const y=saveCycle({title:x.title+" (cópia)",area:x.area,defaultMin:x.defaultMin,goalId:x.goalId});for(const old of studiedSubjects(x)){const copy=saveSubject({cycleId:y.id,title:old.title,targetSessions:old.targetSessions});if(old.paused)pauseSubject(copy.id,true,old.reason,old.returnDate&&old.returnDate>=day()?old.returnDate:"");}detailCycle=y.id;screen="cycle";save();render();notify("Ciclo duplicado sem copiar resultados.");},
 copySubject(el){const x=subject(el.dataset.id);if(!x)return;saveSubject({cycleId:x.cycleId,title:x.title+" (cópia)",targetSessions:x.targetSessions});save();render();notify("Matéria copiada.");},
 chooseNext(el){const x=subject(el.dataset.id),c=x&&cycle(x.cycleId);if(!c||x.paused||x.archived)return notify("Reative a matéria primeiro.");if(c.currentSubjectId!==x.id){const pending=stepSessions(c);if(pending.length)c.stepNo++;c.currentSubjectId=x.id;logs("cycle_next_manual",{cycleId:c.id,subjectId:x.id,previousStepSessions:pending.map(q=>q.id)});save();render();notify("Próxima matéria ajustada manualmente.");}},
 copySession(el){const x=session(el.dataset.id);if(!x)return;const nextDate=add(x.date,1);if(!editable(nextDate))return;const kind=x.kind==="cycle"?"reinforcement":x.kind;const c=cycle(x.cycleId);if(c?.archived)return notify("Ciclo arquivado. Reative-o para copiar sessões.");const copy={...x,id:unique(),date:nextDate,kind,stepNo:0,status:"pending",actualMin:null,actualTime:"",completedAt:null,focusId:"",createdAt:now()};db.sessions.push(copy);logs("session_copied",{fromId:x.id,toId:copy.id,date:nextDate});save();render();notify("Sessão copiada para o dia seguinte como estudo complementar, sem duplicar conclusão.");},
 copyMethod(el){const x=method(el.dataset.id);if(!x)return;saveMethod({title:x.title+" (cópia)",description:x.description});save();render();notify("Modalidade copiada.");},
 openStudies(){screen="cycles";detailCycle="";C.go("estudos")},
 backStudies(){screen="cycles";detailCycle="";render()},
 selectCycle(el){screen="cycle";detailCycle=el.dataset.id;C.go("estudos")},
 newCycle(){cycleModal()},editCycle(el){cycleModal(el.dataset.id)},
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
 newSession(el){if(!C.availabilityReady())return notify("Configure sua disponibilidade antes de criar sessões.");sessionModal(null,el.dataset.cycle||((location.hash==="#estudos"&&screen==="cycle")?detailCycle:""),el.dataset.mode||"",s.date);},
 editSession(el){sessionModal(el.dataset.id)},recordSession(el){recordModal(el.dataset.id)},
 quickDone(el){
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
 if(id==="s3-record"){const x=setSessionStatus(String(data.get("id")),String(data.get("status")),data.get("actualMin"),String(data.get("actualTime")||""));save();close();render();notify(x.status==="done"?"Sessão concluída.":"Registro atualizado.");return;}
}
document.addEventListener("click",event=>{
 const t=event.target.closest("[data-s3]");if(!t)return;
 event.preventDefault();try{actions[t.dataset.s3]?.(t);}catch(err){notify(err.message||"Não foi possível realizar a operação.");console.error(err);}
});
document.addEventListener("submit",event=>{
 if(!event.target.id?.startsWith("s3-"))return;
 event.preventDefault();try{submission(event.target.id,new FormData(event.target));}catch(err){notify(err.message||"Verifique os dados preenchidos.");}
});
document.addEventListener("change",event=>{
 const el=event.target;if(el?.id==="s3-cycle-choice"||el?.id==="s3-kind")updateSessionChoices();
 if(el?.name==="subjectId"){
  const sub=subject(el.value),form=$("s3-session");if(sub&&form){const discipline=form.querySelector('[name="discipline"]');if(discipline)discipline.value=sub.title;}
 }
});
window.OrbitaStage3={decorate,inspect:{get model(){return db},saveCycle,saveSubject,pauseSubject,archiveSubject,reorderSubject,saveMethod,addSessions,updateSession,setSessionStatus,deleteSession,progression,cycleState,stepSessions,requiredSessions,summarize,loadFor,cycleProgress,subject,cycle,session,actions,submission}};
render();
})();