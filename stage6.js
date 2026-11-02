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
// Cadastro semanal com múltiplos dias; gravação única para evitar registros parciais.
function weeklyGroup(item){return item.groupId||item.id;}
function groupedWeekly(){
 const result=new Map();
 for(let d=0;d<7;d++)for(const item of X.busyWeekly[d]){
  const key=weeklyGroup(item);
  if(!result.has(key))result.set(key,{id:key,title:item.title,start:item.start,end:item.end,days:[],members:[]});
  const group=result.get(key);
  group.days.push(d);
  group.members.push({day:d,id:item.id});
 }
 return [...result.values()].map(group=>({...group,days:[...new Set(group.days)].sort((a,b)=>a-b)}));
}
function normalizeDays(days){
 if(!Array.isArray(days)||!days.length)throw Error("Selecione pelo menos um dia da semana.");
 const chosen=[...new Set(days.map(Number))].sort((a,b)=>a-b);
 if(chosen.some(d=>!Number.isInteger(d)||d<0||d>6))throw Error("Há um dia da semana inválido.");
 return chosen;
}
function updateBusy(data,original=null){
 const kind=String(data.kind||"weekly");
 if(!["weekly","date"].includes(kind))throw Error("Tipo de compromisso inválido.");
 const title=String(data.title||"").trim(),start=String(data.start||""),end=String(data.end||"");
 if(!title||title.length>90)throw Error("Informe o nome do compromisso (até 90 caracteres).");
 if(!validClock(start)||!validClock(end)||start>=end)throw Error("O fim do compromisso deve ser posterior ao início.");
 const days=kind==="weekly"?normalizeDays(data.weekdays):[];
 const date=kind==="date"?String(data.date||""):"";
 if(kind==="date"){
  if(!validDate(date)||date<s.firstAccess)throw Error("Selecione uma data válida a partir do primeiro acesso.");
  if(dayLocked(date))throw Error("Esse dia já foi finalizado.");
 }
 let old=null,group=null;
 if(original?.id){
  if(original.kind==="weekly"){
   group=groupedWeekly().find(g=>g.members.some(x=>x.day===Number(original.day)&&x.id===original.id));
   if(!group)throw Error("Não foi possível localizar o compromisso original.");
  }else{
   const oldDate=String(original.day||"");
   if(dayLocked(oldDate))throw Error("O compromisso de um dia finalizado não pode ser editado.");
   old=(X.busyDates[oldDate]||[]).find(x=>x.id===original.id);
   if(!old)throw Error("Não foi possível localizar o compromisso original.");
  }
 }
 const sameGroup=group?.id||ID();
 // Prepara todas as mudanças antes de alterar o estado real.
 const weekly=X.busyWeekly.map(list=>list.map(x=>({...x})));
 const dated=Object.fromEntries(Object.entries(X.busyDates).map(([k,list])=>[k,list.map(x=>({...x}))]));
 const createdAt=old?.createdAt||group?.members?.length&&X.busyWeekly[group.members[0].day].find(x=>x.id===group.members[0].id)?.createdAt||now();
 if(group)for(const {day,id} of group.members)weekly[day]=weekly[day].filter(x=>x.id!==id);
 if(old)dated[original.day]=(dated[original.day]||[]).filter(x=>x.id!==original.id);
 let result=null;
 if(kind==="weekly"){
  for(const day of days){
   const item={id:ID(),groupId:sameGroup,title,start,end,createdAt};
   weekly[day].push(item);
   if(!result)result=item;
  }
 }else{
  const item={id:kind==="date"&&old?old.id:ID(),title,start,end,createdAt};
  (dated[date]||(dated[date]=[])).push(item);
  result=item;
 }
 // Mantém os arrays originais, usados por outros módulos na sessão atual.
 for(let i=0;i<7;i++)X.busyWeekly[i].splice(0,X.busyWeekly[i].length,...weekly[i]);
 for(const day of Object.keys(X.busyDates))if(!(day in dated))delete X.busyDates[day];
 for(const [day,list] of Object.entries(dated)){
  if(!X.busyDates[day])X.busyDates[day]=[];
  X.busyDates[day].splice(0,X.busyDates[day].length,...list);
 }
 if(!C.save())throw Error("Não foi possível gravar o compromisso neste navegador. Verifique o armazenamento disponível.");
 return result;
}
function deleteBusyGroup(kind,day,id){
 if(kind!=="weekly"){removeBusy(kind,day,id);return;}
 const group=groupedWeekly().find(g=>g.members.some(x=>x.day===Number(day)&&x.id===id));
 if(!group)throw Error("Compromisso não encontrado.");
 for(const x of group.members)X.busyWeekly[x.day]=X.busyWeekly[x.day].filter(entry=>entry.id!==x.id);
 C.save();
 C.render();
}
function busyDaysLabel(days){
 const d=[...days].sort((a,b)=>a-b).join(",");
 if(d==="0,1,2,3,4,5,6")return "Todos os dias";
 if(d==="1,2,3,4,5")return "Segunda a sexta";
 if(d==="1,2,3,4,5,6")return "Segunda a sábado";
 return days.map(i=>["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][i]).join(", ");
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
 for(const group of groupedWeekly()){
  count++;
  const entry=group.members[0];
  html+='<div class="s6-busy-row"><div><strong>'+E(group.title)+'</strong><small>'+E(busyDaysLabel(group.days))+' · '+E(group.start)+'–'+E(group.end)+'</small></div><div class="row"><button class="btn small ghost" data-s6="editBusy" data-kind="weekly" data-day="'+entry.day+'" data-id="'+A(entry.id)+'">Editar</button><button class="btn small ghost" data-s6="deleteBusy" data-kind="weekly" data-day="'+entry.day+'" data-id="'+A(entry.id)+'">Excluir</button></div></div>';
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
 const day=kind==="date"?String(weekday||s.date):Number(weekday??C.parse(s.date).getDay());
 const entry=kind==="date"?(X.busyDates[day]||[]).find(x=>x.id===id):X.busyWeekly[day]?.find(x=>x.id===id);
 if(id&&!entry)throw Error("Não foi possível localizar o compromisso para edição.");
 const group=kind==="weekly"&&entry?groupedWeekly().find(g=>g.members.some(x=>x.day===day&&x.id===id)):null;
 const selected=group?.days||[day];
 const weekdaysHtml=weekdays.map((label,i)=>'<label class="s6-weekday-choice"><input type="checkbox" name="weekdays" value="'+i+'" '+(selected.includes(i)?'checked':'')+'><span>'+E(label)+'</span></label>').join("");
 C.openModal(entry?"Editar compromisso":"Registrar horário ocupado",
  '<form id="s6-busy-form" class="section-stack" novalidate>'+
  '<input type="hidden" name="id" value="'+A(id||"")+'">'+
  '<input type="hidden" name="oldKind" value="'+A(kind)+'">'+
  '<input type="hidden" name="oldDay" value="'+A(day)+'">'+
  '<div class="field"><label for="s6-busy-title">Compromisso</label><input id="s6-busy-title" name="title" maxlength="90" required value="'+A(entry?.title||"")+'" placeholder="Ex.: IFPB - Eletrônica"></div>'+
  '<div class="field"><label for="s6-frequency">Frequência</label><select name="kind" id="s6-frequency"><option value="weekly" '+(kind==="weekly"?'selected':'')+'>Semanal</option><option value="date" '+(kind==="date"?'selected':'')+'>Data específica</option></select></div>'+
  '<fieldset class="s6-weekdays" id="s6-day-field" '+(kind==="date"?'hidden':'')+'><legend>Dias da semana</legend><div class="s6-weekday-actions"><button type="button" class="btn small ghost" data-s6="weekBusiness" data-selection="business">Segunda a sexta</button><button type="button" class="btn small ghost" data-s6="weekAll" data-selection="all">Todos os dias</button><button type="button" class="btn small ghost" data-s6="weekNone" data-selection="none">Limpar</button></div><div class="s6-weekday-grid">'+weekdaysHtml+'</div><small>Você pode marcar vários dias para o mesmo compromisso.</small></fieldset>'+
  '<div class="field" id="s6-date-field" '+(kind==="weekly"?'hidden':'')+'><label for="s6-busy-date">Data</label><input id="s6-busy-date" type="date" name="date" value="'+A(kind==="date"?day:s.date)+'" min="'+A(s.firstAccess)+'" '+(kind==="weekly"?'disabled':'')+'></div>'+
  '<div class="form-grid"><div class="field"><label for="s6-busy-start">Início</label><input id="s6-busy-start" type="time" name="start" value="'+A(entry?.start||"08:00")+'" required></div><div class="field"><label for="s6-busy-end">Fim</label><input id="s6-busy-end" type="time" name="end" value="'+A(entry?.end||"12:00")+'" required></div></div>'+
  '<p class="note">O compromisso fica registrado nos dias selecionados e sinaliza conflitos, sem criar tarefas automaticamente.</p>'+
  '<p id="s6-form-error" class="s6-form-error" role="alert" hidden></p>'+
  '<div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Salvar compromisso</button></div></form>');
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
 else if(type==="deleteBusy"){if(window.confirm("Excluir este compromisso dos dias selecionados?"))deleteBusyGroup(kind,day,id);}
 else if(["weekBusiness","weekAll","weekNone"].includes(type)){
  const chosen=type==="weekAll"?[0,1,2,3,4,5,6]:type==="weekBusiness"?[1,2,3,4,5]:[];
  for(const input of document.querySelectorAll('#s6-busy-form input[name="weekdays"]'))input.checked=chosen.includes(Number(input.value));
 }
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
  const dateInput=$("s6-busy-date");
  if(dateInput)dateInput.disabled=!isDate;
 }
});
document.addEventListener("submit",event=>{
 // Campos internos name="id" podem sombrear HTMLFormElement.id no navegador real.
 const id=event.target?.getAttribute?.("id")||event.target?.id;
 if(!["s6-step-form","s6-busy-form","s6-review-form"].includes(id))return;
 event.preventDefault();
 const d=new FormData(event.target);
 try{
  if(id==="s6-step-form")saveStep(String(d.get("goal")),String(d.get("title")),String(d.get("id")||""));
  if(id==="s6-busy-form"){
   const kind=String(d.get("kind"));
   const previousId=String(d.get("id")||"");
   const previous=previousId?{id:previousId,kind:String(d.get("oldKind")),day:String(d.get("oldDay"))}:null;
   const saved=updateBusy({kind,title:d.get("title"),start:d.get("start"),end:d.get("end"),
      weekdays:d.getAll("weekdays"),date:d.get("date")},previous);
   // Evita apresentar "salvo" se a operação não ficou registrada na coleção.
   if(kind==="weekly"&&!groupedWeekly().some(g=>g.members.some(member=>member.id===saved.id)))
    throw Error("O compromisso não apareceu na lista após o salvamento.");
   if(kind==="date"&&!(X.busyDates[String(d.get("date"))]||[]).some(x=>x.id===saved.id))
    throw Error("O compromisso não apareceu na data cadastrada.");
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
 }catch(e){
  const err=$("s6-form-error");
  if(err){err.textContent=e.message||"Confira os campos.";err.hidden=false;}
  C.notify(e.message||"Confira os campos.");
 }
});
window.OrbitaStage6={decorate,inspect:{occupied,subtract,freeAvailability,warnCollisions,addBusy,removeBusy,saveStep,toggleStep,removeStep,analyzeStudy,currentGoalRelations,steps,updateBusy,deleteBusyGroup,groupedWeekly,busyDaysLabel,get model(){return X;}}};
C.render();
})();
