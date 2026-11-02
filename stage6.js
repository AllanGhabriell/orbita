/* ÓRBITA — Complementos de conclusão: objetivos, agenda ocupada e revisões orientadas por evidências. */
(function(){
"use strict";
const C=window.OrbitaCore,P=window.OrbitaStage2?.inspect,T=window.OrbitaStage3?.inspect,V=window.OrbitaStage4?.inspect;
if(!C||!P||!T||!V)throw Error("Órbita: módulos anteriores indisponíveis");
const s=C.state,E=C.esc,A=C.attr,$=id=>document.getElementById(id),now=()=>new Date().toISOString();
const ID=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():"extra-"+Date.now()+"-"+Math.random().toString(36).slice(2);
const X=s.extension||(s.extension={version:6,busyWeekly:[[],[],[],[],[],[],[]],busyDates:{}});
if(!Array.isArray(X.busyWeekly))X.busyWeekly=Array.from({length:7},()=>[]);
for(let i=0;i<7;i++)if(!Array.isArray(X.busyWeekly[i]))X.busyWeekly[i]=[];
if(!X.busyDates||typeof X.busyDates!=="object")X.busyDates={};
const weekdays=["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
const clock=t=>Number(String(t).slice(0,2))*60+Number(String(t).slice(3,5));
const fromMinute=m=>String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
const validDate=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x))&&C.iso(C.parse(x))===x;
const validClock=x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(x));
const dayLocked=d=>!!s.evolution?.closed?.[d]||!!s.planner?.closedDays?.includes(d);
function occupied(d){
 const weekday=C.parse(d).getDay();
 return [...X.busyWeekly[weekday],...(X.busyDates[d]||[])].filter(b=>b&&validClock(b.start)&&validClock(b.end)&&b.start<b.end).sort((a,b)=>a.start.localeCompare(b.start));
}
function subtract(slots,busy){
 let spans=(slots||[]).map(w=>[clock(w.start),clock(w.end)]).filter(([a,b])=>a<b);
 for(const block of busy){
  const a=clock(block.start),b=clock(block.end),next=[];
  for(const [left,right] of spans){
   if(b<=left||a>=right)next.push([left,right]);
   else{if(left<a)next.push([left,a]);if(b<right)next.push([b,right]);}
  }
  spans=next;
 }
 return spans.filter(([a,b])=>a<b).map(([a,b])=>({start:fromMinute(a),end:fromMinute(b)}));
}
const baseAvailability=C.resolveAvailability.bind(C);
function freeAvailability(date){
 const a=baseAvailability(date);
 if(!a||a.mode!=="slots")return a;
 return {...a,slots:subtract(a.slots,occupied(date))};
}
C.resolveAvailability=freeAvailability;
C.occupiedForDate=occupied;
C.availableForDate=d=>C.availabilityMinutes(freeAvailability(d));
function warnCollisions(date){
 const busy=occupied(date),tasks=P.allOn(date).filter(x=>x.startTime&&x.estimatedMin&&(x.type!=="task"||x.date===date));
 const sessions=T.model.sessions.filter(x=>x.date===date&&!x.archived&&x.startTime&&x.plannedMin);
 const conflicts=[];
 for(const item of [...tasks.map(x=>({name:x.title,start:x.startTime,min:x.estimatedMin})),...sessions.map(x=>({name:x.discipline,start:x.startTime,min:x.plannedMin}))]){
  const left=clock(item.start),right=left+Number(item.min);
  for(const b of busy)if(left<clock(b.end)&&right>clock(b.start))conflicts.push(item.name+" × "+b.title);
 }
 return [...new Set(conflicts)];
}
function save(){C.save();C.render();}
function addBusy(data,id){
 const kind=String(data.kind||"weekly"),title=String(data.title||"").trim(),start=String(data.start||""),end=String(data.end||"");
 if(!title||title.length>90)throw Error("Informe um nome para o compromisso.");
 if(!validClock(start)||!validClock(end)||start>=end)throw Error("O horário final precisa ser posterior ao inicial.");
 if(!["weekly","date"].includes(kind))throw Error("Tipo de compromisso inválido.");
 let arr,day=null;
 if(kind==="weekly"){
  day=Number(data.weekday);
  if(!Number.isInteger(day)||day<0||day>6)throw Error("Dia da semana inválido.");
  arr=X.busyWeekly[day];
 }else{
  day=String(data.date||"");
  if(!validDate(day)||day<s.firstAccess)throw Error("Escolha uma data desde o primeiro acesso.");
  if(dayLocked(day))throw Error("O dia foi finalizado e não aceita alterações.");
  arr=X.busyDates[day]||(X.busyDates[day]=[]);
 }
 const item={id:id||ID(),title,start,end,createdAt:now()};
 if(id){const old=arr.findIndex(x=>x.id===id);if(old<0)throw Error("Compromisso não encontrado.");item.createdAt=arr[old].createdAt||now();arr[old]=item;}
 else arr.push(item);
 save();
 return item;
}
function removeBusy(kind,day,id){
 if(kind==="date"&&dayLocked(day))throw Error("Um dia fechado não pode ser alterado.");
 const list=kind==="weekly"?X.busyWeekly[Number(day)]:X.busyDates[day];
 if(!list)return;
 const index=list.findIndex(x=>x.id===id);
 if(index<0)return;
 list.splice(index,1);save();
}
function goal(id){return s.goals.find(g=>g.id===id);}
function steps(g){if(!Array.isArray(g.steps))g.steps=[];return g.steps;}
function saveStep(goalId,title,id){
 const g=goal(goalId);if(!g||g.archived)throw Error("Objetivo indisponível.");
 title=String(title||"").trim();
 if(!title||title.length>150)throw Error("Informe uma etapa válida.");
 const list=steps(g),existing=id?list.find(x=>x.id===id):null;
 if(id&&!existing)throw Error("Etapa não encontrada.");
 if(existing){existing.title=title;}else list.push({id:ID(),title,done:false,createdAt:now(),doneAt:null});
 save();
}
function toggleStep(goalId,id){
 const g=goal(goalId);if(!g||g.archived)throw Error("Objetivo indisponível.");
 const x=steps(g).find(q=>q.id===id);
 if(!x)throw Error("Etapa não encontrada.");
 x.done=!x.done;x.doneAt=x.done?now():null;
 save();
}
function removeStep(goalId,id){
 const g=goal(goalId);if(!g||g.archived)throw Error("Objetivo indisponível.");
 g.steps=steps(g).filter(x=>x.id!==id);save();
}
function currentGoalRelations(g){
 const cycles=T.model.cycles.filter(x=>x.goalId===g.id&&!x.archived);
 const tasks=P.model.entries.filter(x=>x.goalId===g.id&&!x.archivedAt);
 return {cycles,tasks};
}
function goalPanel(){
 const goals=s.goals.filter(g=>!g.archived);
 if(!goals.length)return "";
 let html='<section class="card s6-goal-panel"><div class="card-head"><h2>Etapas dos objetivos</h2><span class="note">Avanço declarado, sem porcentagem artificial</span></div>';
 for(const g of goals){
  const list=steps(g),done=list.filter(x=>x.done).length,linked=currentGoalRelations(g);
  html+='<div class="s6-goal"><div class="row-between"><div><strong>'+E(g.title)+'</strong><small>'+done+' de '+list.length+' etapa(s) concluída(s) · '+linked.tasks.length+' atividade(s) · '+linked.cycles.length+' ciclo(s)</small></div><button class="btn small" data-s6="newStep" data-goal="'+A(g.id)+'">+ Etapa</button></div>'+
  (list.length?'<div class="s6-step-list">'+list.map(x=>'<div class="s6-step"><button class="s6-tick '+(x.done?'done':'')+'" data-s6="toggleStep" data-goal="'+A(g.id)+'" data-id="'+A(x.id)+'" aria-label="'+(x.done?'Desmarcar':'Concluir')+' etapa">'+(x.done?'✓':'○')+'</button><span class="'+(x.done?'s6-done':'')+'">'+E(x.title)+'</span><button class="btn small ghost" data-s6="editStep" data-goal="'+A(g.id)+'" data-id="'+A(x.id)+'">Editar</button><button class="btn small ghost" data-s6="deleteStep" data-goal="'+A(g.id)+'" data-id="'+A(x.id)+'" aria-label="Excluir etapa">×</button></div>').join("")+'</div>':'<p class="note">Divida este objetivo em etapas concretas, se isso ajudar seu planejamento.</p>')+'</div>';
 }
 return html+'</section>';
}
function busyPanel(){
 const today=C.today();
 let html='<section class="card s6-busy"><div class="card-head"><h2>Horários ocupados</h2><button class="btn small primary" data-s6="newBusy">+ Compromisso fixo</button></div><p class="note">Curso, estágio, deslocamento ou outros compromissos. Se você cadastrou faixas livres, elas são descontadas automaticamente. Se informou apenas horas livres totais, não haverá desconto duplicado.</p>';
 let count=0;
 for(let d=0;d<7;d++)for(const x of X.busyWeekly[d]){
  count++;
  html+='<div class="s6-busy-row"><div><strong>'+E(x.title)+'</strong><small>'+weekdays[d]+' · '+E(x.start)+'–'+E(x.end)+'</small></div><div class="row"><button class="btn small ghost" data-s6="editBusy" data-kind="weekly" data-day="'+d+'" data-id="'+A(x.id)+'">Editar</button><button class="btn small ghost" data-s6="deleteBusy" data-kind="weekly" data-day="'+d+'" data-id="'+A(x.id)+'">Excluir</button></div></div>';
 }
 for(const [d,list] of Object.entries(X.busyDates).sort((a,b)=>a[0].localeCompare(b[0])))for(const x of list){
  count++;
  html+='<div class="s6-busy-row"><div><strong>'+E(x.title)+'</strong><small>'+E(d.split("-").reverse().join("/"))+' · '+E(x.start)+'–'+E(x.end)+'</small></div><div class="row"><button class="btn small ghost" data-s6="editBusy" data-kind="date" data-day="'+A(d)+'" data-id="'+A(x.id)+'" '+(dayLocked(d)?'disabled title="Dia finalizado"':'')+'>Editar</button><button class="btn small ghost" data-s6="deleteBusy" data-kind="date" data-day="'+A(d)+'" data-id="'+A(x.id)+'" '+(dayLocked(d)?'disabled title="Dia finalizado"':'')+'>Excluir</button></div></div>';
 }
 if(!count)html+='<p class="note">Nenhum horário ocupado registrado.</p>';
 const date=s.date,conflicts=warnCollisions(date);
 html+='<p class="note">Para '+E(date.split("-").reverse().join("/"))+': '+occupied(date).length+' compromisso(s) · '+conflicts.length+' conflito(s) com atividades planejadas.</p></section>';
 return html;
}
function dayBusyPanel(date){
 const list=occupied(date);if(!list.length)return "";
 const warnings=warnCollisions(date);
 let out='<section class="card s6-day-busy"><div class="card-head"><h2>Compromissos fixos</h2><span class="status">'+list.length+' registro(s)</span></div><div class="s6-busy-chipline">'+list.map(x=>'<span class="s6-chip">'+E(x.start)+'–'+E(x.end)+' · '+E(x.title)+'</span>').join("")+'</div>';
 if(warnings.length)out+='<p class="s6-warning">Conflitos com horários ocupados: '+E(warnings.slice(0,4).join("; "))+'. Você pode ajustar o planejamento; nada será remarcado automaticamente.</p>';
 return out+'</section>';
}
function allSessions(){
 const closed=s.evolution?.closed||{},frozen=Object.values(closed).flatMap(x=>(x.studies||[]).map(y=>({...y,date:x.date,methodLabel:y.method})));
 return [...T.model.sessions.filter(x=>!x.archived&&!closed[x.date]),...frozen];
}
function analyzeStudy(reference=C.today()){
 const recent=allSessions().filter(x=>x.date<=reference&&x.date>=C.addDays(reference,-60));
 const groups=new Map();
 let unknown=0;
 for(const x of recent){
  if(x.actualMin==null)unknown++;
  if(x.status!=="done"&&x.status!=="progress")continue;
  const key=[x.area||"",x.discipline||"",x.topic||""].join("\u0001");
  if(!x.discipline)continue;
  let g=groups.get(key);
  if(!g){g={area:x.area||"",discipline:x.discipline,topic:x.topic||"",last:x.date,count:0,questions:0,correct:0,evidence:0,quality:0,qualityCount:0,theory:0,practice:0,cycleId:x.cycleId||""};groups.set(key,g);}
  g.count++;if(x.date>g.last)g.last=x.date;
  const mode=String(x.methodLabel||T.model.methods.find(m=>m.id===x.methodId)?.title||"").toLowerCase();
  if(/teoria|leitura|aula/.test(mode))g.theory++;
  if(/quest|exerc|pr.tica|simulado/.test(mode))g.practice++;
  const q=Number(x.evidence?.questions),correct=Number(x.evidence?.correct);
  if(x.evidence?.questions!=null&&x.evidence?.correct!=null&&Number.isInteger(q)&&Number.isInteger(correct)&&q>=0&&correct>=0&&correct<=q){g.questions+=q;g.correct+=correct;g.evidence++;}
  const quality=Number(x.evidence?.quality);
  if(x.evidence?.quality!=null&&Number.isInteger(quality)&&quality>=1&&quality<=5){g.quality+=quality;g.qualityCount++;}
 }
 const result=[];
 for(const g of groups.values()){
  const label=g.discipline+(g.topic?" · "+g.topic:"");
  const lag=Math.round((C.parse(reference)-C.parse(g.last))/86400000);
  if(g.questions>=10&&g.evidence>=1&&g.correct/g.questions<.7)result.push({kind:"practice",priority:1,group:g,title:"Retomar exercícios: "+label,reason:"Foram registrados "+g.correct+" acertos em "+g.questions+" questões. Revise os erros antes de avançar; a dificuldade das questões pode variar."});
  else if(g.qualityCount>=2&&g.quality/g.qualityCount<=2.5)result.push({kind:"reinforcement",priority:2,group:g,title:"Reforçar: "+label,reason:"As últimas autoavaliações indicam dificuldade. Faça recuperação ativa e verifique o entendimento com questões."});
  else if(g.count>=2&&lag>=5&&lag<=60)result.push({kind:"review",priority:3,group:g,title:"Revisão distribuída: "+label,reason:"Há "+lag+" dias sem registro nesta matéria/assunto. Uma revisão curta pode ajudar a manter a lembrança."});
  else if(g.theory>=2&&g.practice===0)result.push({kind:"practice",priority:4,group:g,title:"Praticar após a teoria: "+label,reason:"Há registros de estudo teórico sem uma modalidade de exercícios identificada. Considere testar o que aprendeu."});
 }
 result.sort((a,b)=>a.priority-b.priority||a.group.last.localeCompare(b.group.last));
 if(unknown>=3)result.push({kind:"recording",priority:9,title:"Tempo real não registrado",reason:unknown+" sessões recentes não têm duração efetiva informada. Esses tempos não foram tratados como zero ou estimados."});
 return {sessionCount:recent.length,recommendations:result.slice(0,4)};
}
function studyPanel(){
 const data=analyzeStudy();
 if(!data.sessionCount)return "";
 let html='<section class="card s6-recommendations"><div class="card-head"><h2>Orientações de aprendizagem</h2><span class="note">Baseadas nos seus registros</span></div>';
 if(data.sessionCount<3)html+='<p class="note">O histórico ainda é curto; sugestões não são avaliações definitivas da aprendizagem.</p>';
 if(!data.recommendations.length)html+='<p class="note">Nenhuma revisão específica indicada pelos registros disponíveis. Mantenha seu ritmo e registre resultados quando fizer sentido.</p>';
 for(const [i,r] of data.recommendations.entries()){
  html+='<div class="s6-reco"><div><strong>'+E(r.title)+'</strong><p>'+E(r.reason)+'</p></div>'+(r.group?'<button class="btn small" data-s6="planReview" data-index="'+i+'">Agendar</button>':'')+'</div>';
 }
 return html+'</section>';
}
let pendingRecommendations=[];
function studyDecor(){
 const report=analyzeStudy();pendingRecommendations=report.recommendations;
 return studyPanel();
}
function openStepForm(goalId,id){
 const g=goal(goalId),step=id?steps(g).find(x=>x.id===id):null;
 if(!g)return;
 C.openModal(step?"Editar etapa":"Nova etapa",'<form id="s6-step-form" class="section-stack"><input type="hidden" name="goal" value="'+A(goalId)+'"><input type="hidden" name="id" value="'+A(id||"")+'"><div class="field"><label>Título da etapa</label><input name="title" required maxlength="150" value="'+A(step?.title||"")+'" placeholder="Ex.: Resolver um conjunto de exercícios"></div><div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Salvar etapa</button></div></form>');
}
function openBusyForm(kind="weekly",weekday=null,id=null){
 const d=kind==="date"?String(weekday||s.date):Number(weekday??C.parse(s.date).getDay());
 const list=kind==="date"?(X.busyDates[d]||[]):X.busyWeekly[d];
 const b=list.find(x=>x.id===id);
 const options=weekdays.map((name,i)=>'<option value="'+i+'" '+(i===Number(d)?'selected':'')+'>'+E(name)+'</option>').join("");
 C.openModal(b?"Editar compromisso":"Registrar horário ocupado",'<form id="s6-busy-form" class="section-stack"><input type="hidden" name="id" value="'+A(id||"")+'"><input type="hidden" name="oldKind" value="'+A(kind)+'"><input type="hidden" name="oldDay" value="'+A(d)+'"><div class="field"><label>Compromisso</label><input name="title" maxlength="90" required value="'+A(b?.title||"")+'" placeholder="Ex.: Curso, estágio, deslocamento"></div><div class="field"><label>Frequência</label><select name="kind" id="s6-frequency"><option value="weekly" '+(kind==="weekly"?'selected':'')+'>Semanal</option><option value="date" '+(kind==="date"?'selected':'')+'>Data específica</option></select></div><div class="field" id="s6-day-field" '+(kind==="date"?'hidden':'')+'><label>Dia da semana</label><select name="weekday">'+options+'</select></div><div class="field" id="s6-date-field" '+(kind==="weekly"?'hidden':'')+'><label>Data</label><input type="date" name="date" value="'+A(kind==="date"?d:s.date)+'" min="'+A(s.firstAccess)+'"></div><div class="form-grid"><div class="field"><label>Início</label><input type="time" name="start" value="'+A(b?.start||"08:00")+'" required></div><div class="field"><label>Fim</label><input type="time" name="end" value="'+A(b?.end||"12:00")+'" required></div></div><p class="note">Esses períodos sinalizam conflitos. Em faixas livres, as horas coincidentes serão descontadas, sem mexer nas horas que já foram declaradas como livres.</p><div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Salvar compromisso</button></div></form>');
}
function openReviewForm(i){
 const rec=pendingRecommendations[i],g=rec?.group;
 if(!g)return;
 const date=C.today(),validCycle=T.model.cycles.find(c=>c.id===g.cycleId&&!c.archived);
 C.openModal("Agendar estudo recomendado",'<form id="s6-review-form" class="section-stack"><input type="hidden" name="index" value="'+i+'"><p class="note">'+E(rec.reason)+'</p><div class="field"><label>Assunto</label><input readonly value="'+A(g.discipline+(g.topic?" · "+g.topic:""))+'"></div><div class="form-grid"><div class="field"><label>Data</label><input name="date" type="date" value="'+A(date)+'" min="'+A(s.firstAccess)+'" required></div><div class="field"><label>Duração prevista (min)</label><input name="minutes" type="number" value="40" min="5" max="720" required></div></div><p class="note">Será criada uma sessão de reforço, sem avançar automaticamente nenhum ciclo. Você decide se deseja realizá-la.</p><div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Agendar sessão</button></div></form>');
}
function decorate(route,base){
 if(route==="perfil")return base+goalPanel();
 if(route==="disponibilidade")return base+busyPanel();
 if(route==="planejamento")return base+dayBusyPanel(s.date);
 if(route==="estudos")return base+studyDecor();
 if(route==="evolucao")return base+studyDecor();
 return base;
}
function onAction(b){
 const type=b.dataset.s6,id=b.dataset.id,kind=b.dataset.kind,day=b.dataset.day;
 if(type==="newStep")openStepForm(b.dataset.goal);
 else if(type==="editStep")openStepForm(b.dataset.goal,id);
 else if(type==="toggleStep")toggleStep(b.dataset.goal,id);
 else if(type==="deleteStep"){if(window.confirm("Excluir esta etapa?"))removeStep(b.dataset.goal,id);}
 else if(type==="newBusy")openBusyForm();
 else if(type==="editBusy")openBusyForm(kind,day,id);
 else if(type==="deleteBusy"){if(window.confirm("Excluir este horário ocupado?"))removeBusy(kind,day,id);}
 else if(type==="planReview")openReviewForm(Number(b.dataset.index));
}
document.addEventListener("click",event=>{
 const b=event.target.closest("[data-s6]");if(!b)return;
 event.preventDefault();
 try{onAction(b);}catch(e){C.notify(e.message||"Não foi possível concluir esta ação.");}
});
document.addEventListener("change",event=>{
 if(event.target?.id==="s6-frequency"){
  const isDate=event.target.value==="date";
  const a=$("s6-day-field"),b=$("s6-date-field");
  if(a)a.hidden=isDate;if(b)b.hidden=!isDate;
 }
});
document.addEventListener("submit",event=>{
 const id=event.target?.id;
 if(!["s6-step-form","s6-busy-form","s6-review-form"].includes(id))return;
 event.preventDefault();
 const d=new FormData(event.target);
 try{
  if(id==="s6-step-form")saveStep(String(d.get("goal")),String(d.get("title")),String(d.get("id")||""));
  if(id==="s6-busy-form"){
   const kind=String(d.get("kind")),day=kind==="weekly"?Number(d.get("weekday")):String(d.get("date"));
   const oldId=String(d.get("id")||"");
   const oldKind=String(d.get("oldKind")),oldDay=String(d.get("oldDay"));
   const details={kind,weekday:day,date:day,title:d.get("title"),start:d.get("start"),end:d.get("end")};
   if(oldId&&(oldKind!==kind||String(oldDay)!==String(day))){
    if(oldKind==="date"&&dayLocked(oldDay))throw Error("O histórico do dia finalizado não pode ser alterado.");
    addBusy(details);
    removeBusy(oldKind,oldDay,oldId);
   }else addBusy(details,oldId);
  }
  if(id==="s6-review-form"){
   const item=pendingRecommendations[Number(d.get("index"))]?.group;
   if(!item)throw Error("Recomendação não encontrada.");
   const date=String(d.get("date")),min=Number(d.get("minutes"));
   if(!validDate(date)||date<s.firstAccess||dayLocked(date))throw Error("Escolha uma data aberta.");
   if(!Number.isInteger(min)||min<5||min>720)throw Error("Duração inválida.");
   const cycle=T.model.cycles.find(c=>c.id===item.cycleId&&!c.archived);
   T.addSessions({kind:"reinforcement",cycleId:cycle?.id||"",subjectId:"",date,area:item.area||"Estudo complementar",discipline:item.discipline,topic:item.topic,purpose:"Revisão por histórico",methodId:"",plannedMin:String(min),focusId:""},1);
   save();
  }
  C.closeModal();C.render();C.notify("Registro salvo.");
 }catch(e){C.notify(e.message||"Confira os campos.");}
});
window.OrbitaStage6={decorate,inspect:{occupied,subtract,freeAvailability,warnCollisions,addBusy,removeBusy,saveStep,toggleStep,removeStep,analyzeStudy,currentGoalRelations,steps,get model(){return X;}}};
C.render();
})();
