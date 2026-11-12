/* ÓRBITA — Etapa 2. Planejamento independente de Supabase; os dados locais serão migrados na etapa 5. */
(function(){
"use strict";
const C=window.OrbitaCore;
if(!C)throw Error("Órbita Core não inicializado");
const s=C.state;
const p=s.planner||(s.planner={version:2,blocks:[],entries:[],records:{},overrides:{},dayPauses:{},closedDays:[]});
p.blocks||=[];p.entries||=[];p.records||={};p.overrides||={};p.dayPauses||={};p.closedDays||=[];p.events||=[];
const $=(id)=>document.getElementById(id);
const e=C.esc, a=C.attr, D=C.addDays, iso=C.iso, day=C.today, fmt=C.dateLabel, tag=C.tag, button=C.btn;
const ID=()=>((typeof crypto!=="undefined"&&crypto.randomUUID)?crypto.randomUUID():"id-"+Date.now()+"-"+Math.random().toString(36).slice(2));
const clone=(o)=>JSON.parse(JSON.stringify(o));
const MIN=20;
let organizing="focus",calendarView="week",monthAnchor=day(),copyDraft=null;
const DAYS=["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const SHORT=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const COLORS=["#9c84f7","#5db9ea","#42bd97","#e8aa62","#ed7f9e","#9facc5"];
function ds(x){return String(x||"").slice(0,10)}
function validDate(x){return /^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(C.parse(x).valueOf())&&iso(C.parse(x))===x;}
function before(a,b){return a<b}
function endMonth(date){const q=C.parse(date);return iso(new Date(q.getFullYear(),q.getMonth()+1,0,12))}
function startMonth(date){return date.slice(0,7)+"-01"}
function addMonths(date,n){const q=C.parse(date);return iso(new Date(q.getFullYear(),q.getMonth()+n,1,12))}
function monthName(date){return C.parse(date).toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}
function uidKey(id,date){return id+"@"+date}
function firstUse(){return s.firstAccess||day()}
function locked(date){return p.closedDays.includes(date)}
function notify(m){C.notify(m)}
function save(){C.save()}
function render(){C.render()}
function go(r){C.go(r)}
function canChange(date){if(locked(date)){notify("Este dia já foi finalizado.");return false}return true}
function find(id){return p.entries.find(x=>x.id===id)}
function block(id){return p.blocks.find(x=>x.id===id)}
function blockLabel(id){let b=block(id);return b?'<span class="block-pill"><i style="background:'+a(b.color)+'"></i>'+e(b.title)+(b.archived?" (arquivado)":"")+'</span>':""}
function entryTitle(o){return o.displayTitle||o.title}
function statusText(st){return ({done:"Concluída",progress:"Em andamento",notdone:"Não realizada",moved:"Remanejada",pending:"Pendente"})[st]||"Pendente"}
function dtClock(isoString){return isoString?new Date(isoString).toLocaleString("pt-BR"):""}
function recurLabel(r){if(!r||r.kind==="none")return "Pontual";const label=r.kind==="daily"?"Diária":r.kind==="weekdays"?"Semanal · "+(r.weekdays||[]).map(x=>SHORT[x]).join(", "):r.kind==="interval"?"A cada "+r.everyDays+" dia(s)":"Mensal · dia "+r.monthDay;return label+" · "+(r.end?"até "+r.end.split("-").reverse().join("/"):"sem término")}
function routineStats(x){let planned=0,done=0;const end=x.recurrence?.end&&x.recurrence.end<day()?x.recurrence.end:day();for(let d=x.date;d<=end;d=D(d,1)){if(!occDate(x,d)||p.overrides[uidKey(x.id,d)]?.removed)continue;planned++;const status=p.records[uidKey(x.id,d)]?.status||s.evolution?.closed?.[d]?.activities?.find(a=>a.id===x.id)?.status;if(status==="done")done++;}return {planned,done,percent:planned?Math.round(100*done/planned):0};}
function baseEntry(b){return {id:ID(),type:b.type||"focus",title:b.title||"",date:b.date||s.date,createdAt:new Date().toISOString(),blockId:b.blockId||"",priority:b.priority||"medium",goalId:b.goalId||"",startTime:b.startTime||"",estimatedMin:b.estimatedMin||null,dueDate:b.dueDate||"",recurrence:b.recurrence||{kind:"none"},archivedAt:"",origin:b.origin||null};}
function occDate(entry,date){
 if(date<entry.date)return false;
 if(entry.archivedAt&&date>=entry.archivedAt)return false;
 let r=entry.recurrence||{kind:"none"};
 if(r.end&&date>r.end)return false;
 if(r.kind==="none")return entry.date===date;
 if(r.kind==="daily")return true;
 if(r.kind==="interval")return Number.isInteger(Number(r.everyDays))&&Number(r.everyDays)>0&&Math.round((C.parse(date)-C.parse(entry.date))/86400000)%Number(r.everyDays)===0;
 if(r.kind==="weekdays")return (r.weekdays||[]).includes(C.parse(date).getDay());
 if(r.kind==="monthday")return C.parse(date).getDate()===Number(r.monthDay);
 return false;
}
function occurrence(entry,date){
 if(!occDate(entry,date))return null;
 const k=uidKey(entry.id,date);
 if(p.overrides[k]?.removed)return null;
 let o={...entry,occurrenceDate:date,override:p.overrides[k]||{},displayTitle:entry.title};
 if(o.override.fields)Object.assign(o,o.override.fields);
 if(entry.recurrence?.numbered){
  let count=0,first=startMonth(date);
  for(let d=first;d<=date;d=D(d,1)){
   if(occDate(entry,d)&&!p.overrides[uidKey(entry.id,d)]?.removed)count++;
  }
  o.displayTitle=o.title+" "+count;
 }
 o.record=p.records[k]||null;
 o.status=o.record?.status||"pending";
 return o;
}
function allOn(date){
 const frozen=s.evolution?.closed?.[date];if(frozen)return frozen.activities.map(x=>({...x,date,displayTitle:x.title,occurrenceDate:date,record:{status:x.status,actualMin:x.actualMin,actualTime:x.actualTime}}));
 const rows=p.entries.map(x=>occurrence(x,date)).filter(Boolean);
 // Tarefas flexíveis seguem acessíveis até a conclusão, inclusive se criadas em outro dia.
 for(const entry of p.entries.filter(x=>x.type==="task"&&x.recurrence?.kind==="none"&&x.date<date)){
  const completed=Object.entries(p.records).find(([k,v])=>k.startsWith(entry.id+"@")&&v.status==="done");
  if(completed&&completed[0].split("@")[1]<date)continue;
  if(entry.archivedAt&&entry.archivedAt<=date)continue;
  if(!rows.some(o=>o.id===entry.id)){
   const o={...entry,occurrenceDate:date,sourceDate:entry.date,displayTitle:entry.title,record:p.records[uidKey(entry.id,date)]||null};
   o.status=o.record?.status||(completed&&completed[0].split("@")[1]===date?"done":"pending");
   rows.push(o);
  }
 }
 return rows;
}
function kindOn(date,type){return allOn(date).filter(x=>x.type===type).sort((x,y)=>{
  if(x.status==="done"&&y.status!=="done")return 1;
  if(y.status==="done"&&x.status!=="done")return -1;
  if(type==="task"){const rank={high:0,medium:1,low:2};const diff=(rank[x.priority]??1)-(rank[y.priority]??1);if(diff)return diff;}
  return (x.startTime||"99:99").localeCompare(y.startTime||"99:99")||x.title.localeCompare(y.title);
 });}
function overlapsFor(date){const items=allOn(date).filter(x=>x.startTime&&x.estimatedMin&&(x.type!=="task"||x.date===date));const windows=items.map(x=>({id:x.id,title:x.title,start:Number(x.startTime.slice(0,2))*60+Number(x.startTime.slice(3,5)),end:Number(x.startTime.slice(0,2))*60+Number(x.startTime.slice(3,5))+Number(x.estimatedMin)})).sort((x,y)=>x.start-y.start);const conflicts=[];for(let i=1;i<windows.length;i++)for(let j=0;j<i;j++)if(windows[i].start<windows[j].end&&windows[j].start<windows[i].end)conflicts.push([windows[j].title,windows[i].title]);return conflicts;}
function hoursFor(date){const rows=allOn(date);const seen=new Set();return rows.reduce((total,x)=>{const k=x.id; if(seen.has(k))return total;seen.add(k);if(x.type==="task"&&x.date!==date)return total;return total+Number(x.estimatedMin||0)},0)}
function availabilityStatus(date){const val=C.resolveAvailability(date);return val?(val.mode==="rest"?"Descanso":C.hoursLabel(C.availabilityMinutes(val)/60)+" livres"):"Sem disponibilidade definida"}
function restInfo(date){const x=p.dayPauses[date];if(x)return x;const av=C.resolveAvailability(date);return av?.mode==="rest"?{kind:"planejado",reason:"Disponibilidade definida como descanso"}:null}
function dueAge(entry,date){const start=entry.createdAt?.slice(0,10)||entry.date;const diff=Math.round((C.parse(date)-C.parse(start))/86400000);return Math.max(0,diff)}
function itemRow(o,date,compact=false){
 const key=uidKey(o.id,date);const rec=p.records[key]||o.record;
 const st=rec?.status||o.status||"pending";
 const color=block(o.blockId)?.color||"transparent";
 const taskAge=o.type==="task"&&dueAge(o,date)>=4?'<span class="age-chip" title="Dias desde a criação">'+dueAge(o,date)+'d</span>':"";
 const desc=[o.goalId?s.goals.find(g=>g.id===o.goalId)?.title||"": "",o.type==="habit"?recurLabel(o.recurrence):"",o.startTime?o.startTime:"",o.estimatedMin?C.hoursLabel(o.estimatedMin/60):"",o.type==="task"&&o.dueDate?"Prazo "+o.dueDate.split("-").reverse().join("/"):""].filter(Boolean).join(" · ");
 // Prioridade visível apenas nas tarefas secundárias; nenhuma ação de conclusão muda.
 const priority=o.type==="task"?(["high","medium","low"].includes(o.priority)?o.priority:"medium"):null;
 const priorityText={high:"Alta",medium:"Média",low:"Baixa"};
 const priorityBadge=priority?'<span class="task-priority task-priority-'+priority+'" title="Prioridade '+priorityText[priority]+'" aria-label="Prioridade '+priorityText[priority]+'"><span class="task-priority-dot" aria-hidden="true"></span>'+priorityText[priority]+'</span>':"";
 const controls=(locked(date)?"":'<button class="btn small ghost" data-s2="status" data-id="'+a(o.id)+'" data-date="'+date+'" data-value="'+(st==="done"?"pending":"done")+'" title="'+(st==="done"?"Desmarcar":"Concluir")+'">'+(st==="done"?"↶":"✓")+'</button><button class="btn small ghost" data-s2="status" data-id="'+a(o.id)+'" data-date="'+date+'" data-value="progress" title="Em andamento">◷</button>');
 return '<div class="task-row '+(st==="done"?"task-done":"")+'" style="--task-color:'+a(color)+'"><div class="task-mark">'+(st==="done"?"✓":st==="progress"?"◷":st==="notdone"?"×":st==="moved"?"↷":"·")+'</div><div class="task-main"><div class="task-title">'+e(entryTitle(o))+' '+taskAge+'</div><div class="task-meta">'+priorityBadge+blockLabel(o.blockId)+(desc?'<span>'+e(desc)+'</span>':"")+'<span>'+e(statusText(st))+'</span></div></div><div class="task-actions">'+controls+(window.OrbitaStage8?.indicatorFor?.({kind:"entry",id:o.id,date,status:st})||"")+'<button class="btn small ghost" data-s2="editEntry" data-id="'+a(o.id)+'" data-date="'+a(o.occurrenceDate||date)+'" title="Editar">✎</button><button class="btn small ghost" data-s2="moreEntry" data-id="'+a(o.id)+'" data-date="'+a(o.occurrenceDate||date)+'" title="Mais ações">⋯</button></div></div>';
}
function emptyList(message){return '<p class="note empty-inline">'+e(message)+'</p>';}
function listFor(date,type){const items=kindOn(date,type);return items.length?'<div class="task-list">'+items.map(x=>itemRow(x,date)).join("")+'</div>':emptyList(({focus:"Nenhum foco definido.",task:"Nenhuma tarefa secundária.",habit:"Nenhuma rotina cadastrada."})[type]);}
function decorateHome(){
 const goal=C.activeGoal(),rest=restInfo(s.date),avail=C.resolveAvailability(s.date),ready=C.availabilityReady();
 let html='<section class="hero-row"><div><div class="overline">PLANEJAMENTO DO DIA</div><h1>'+e(fmt(s.date,true))+'</h1></div><div class="row">'+C.dateNavigator()+(s.date!==day()?button("Hoje","goToday","small ghost"):"")+'</div></section>';
 if(goal)html+='<section class="card hero-goal"><div class="orbital-icon">◎</div><div class="hero-content"><div class="overline">OBJETIVO PRINCIPAL</div><h2>'+e(goal.title)+'</h2></div>'+button("Ver","openProfile","small ghost")+'</section>';
 else if(ready)html+='<div class="action-strip"><span class="icon">◎</span><p>Você ainda não definiu seu objetivo principal.</p>'+button("Definir","addGoal","small")+'</div>';
 if(!ready)return null; // preserva o bloqueio contextual original
 const pauses=Object.keys(p.dayPauses).length;
 html+='<div class="action-strip"><span class="icon">'+(rest?"☾":"◷")+'</span><p>'+e(rest?(rest.kind==="planejado"?"Dia de descanso planejado":rest.kind==="imprevisto"?"Pausa por imprevisto":"Pausa registrada no dia"):(avail?availabilityStatus(s.date):"Configure o tempo disponível para esta data"))+'. Não apaga compromissos registrados.</p><button class="btn small" data-s2="pause" data-date="'+s.date+'">'+(rest&&p.dayPauses[s.date]?"Editar pausa":"Descanso / pausa")+'</button></div>';
 const estimated=hoursFor(s.date),available=C.availabilityMinutes(avail);
 if(overlapsFor(s.date).length)html+='<div class="action-strip warning-strip"><span class="icon">◷</span><p>Há '+overlapsFor(s.date).length+' sobreposição(ões) de horário. Elas são permitidas, mas convém revisar o dia.</p></div>';
 if(estimated&&available&&estimated>available)html+='<div class="action-strip warning-strip"><span class="icon">!</span><p>Você planejou '+C.hoursLabel(estimated/60)+' e informou '+C.hoursLabel(available/60)+' disponíveis. Revise se a carga é viável.</p></div>';
 html+='<div class="grid-2 dashboard-panels">';
 for(const [type,title] of [["focus","Focos do dia"],["task","Tarefas secundárias"]]){
  html+='<section class="card board"><div class="card-head"><h2>'+title+'</h2><button class="btn small ghost" data-s2="newEntry" data-type="'+type+'">+ Adicionar</button></div>'+listFor(s.date,type)+'</section>';
 }
 html+='</div><section class="card board"><div class="card-head"><h2>Rotinas e hábitos</h2><button class="btn small ghost" data-s2="newEntry" data-type="habit">+ Adicionar</button></div>'+listFor(s.date,"habit")+'</section>';
 html+='<div class="row-between"><p class="note">Duração planejada nesta data: <strong>'+C.hoursLabel(estimated/60)+'</strong>. Horas efetivas só serão computadas quando informadas.</p><button class="btn small" data-s2="newEntry" data-type="focus">Novo foco</button></div>';
 return html;
}
function studyCountOn(date){
 const frozen=s.evolution?.closed?.[date];
 if(frozen)return (frozen.studies||[]).length;
 return (s.studies?.sessions||[]).filter(x=>x.date===date&&!x.archived).length;
}
function startWeek(date){return C.firstDayOfWeek(date)}
function monthCalendar(){
 const m=startMonth(monthAnchor),start=startWeek(m);
 let out='<div class="month-grid">';
 for(let i=0;i<42;i++){
  const d=D(start,i);const current=d.slice(0,7)===monthAnchor.slice(0,7),count=allOn(d).filter(x=>x.type==="focus"||x.type==="habit").length,studyCount=studyCountOn(d);
  out+='<button class="month-day '+(!current?"outside ":"")+(s.date===d?"selected ":"")+'" data-s2="chooseDate" data-date="'+d+'" '+(d<firstUse()?"disabled":"")+'><strong>'+Number(d.slice(-2))+'</strong><span>'+ ([restInfo(d)?"☾":"",count?count+" ativ.":"",studyCount?studyCount+" ses.":""].filter(Boolean).join(" · "))+'</span></button>';
 }
 return out+"</div>";
}
function decoratePlan(){
 const start=startWeek(s.date),end=D(start,6),av=C.resolveAvailability(s.date);
 let out='<section class="hero-row"><div><div class="overline">SEU CALENDÁRIO</div><h1>'+e(calendarView==="month"?monthName(monthAnchor):C.dateLabel(start,false)+" — "+C.dateLabel(end,false))+'</h1></div><div class="row"><button class="btn small" data-s2="switchCalendar" data-mode="week" aria-pressed="'+(calendarView==="week")+'">Semana</button><button class="btn small" data-s2="switchCalendar" data-mode="month" aria-pressed="'+(calendarView==="month")+'">Mês</button><button class="btn small ghost" data-s2="copyPlan">Copiar ▾</button></div></section>';
 out+='<div class="row-between"><div class="row"><button class="btn square" data-s2="prevPeriod">‹</button><button class="btn small ghost" data-s2="now">Hoje</button><button class="btn square" data-s2="nextPeriod">›</button></div><button class="btn small" data-s2="pause" data-date="'+s.date+'">Descanso / pausa</button></div>';
 if(calendarView==="week"){
  out+='<div class="week-grid">';
  for(let i=0;i<7;i++){
   const d=D(start,i),count=allOn(d).filter(x=>x.type==="focus"||x.type==="habit").length,studyCount=studyCountOn(d);
   const fullStatus=[restInfo(d)?"☾ Descanso":count?count+" atividade(s)":availabilityStatus(d),studyCount?studyCount+" sessão(ões) de estudo":""].filter(Boolean).join(" · ");
   const available=C.resolveAvailability(d),freeMin=available?C.availabilityMinutes(available):null;
   const compactStatus=studyCount?(count?count+" at. · "+studyCount+" ses.":studyCount+" ses."):(restInfo(d)?"☾":count?count+" ativ.":freeMin===null?"—":freeMin===0?"0h":freeMin%60===0?(freeMin/60)+"h":"✓");
   out+='<button class="day-tile '+(s.date===d?"selected ":"")+(d===day()?"today ":"")+'" data-s2="chooseDate" data-date="'+d+'" aria-label="'+a(fmt(d,true)+" — "+fullStatus)+'" '+(d<firstUse()?"disabled":"")+'><span class="dow">'+SHORT[C.parse(d).getDay()]+'</span><span class="day-number">'+C.parse(d).getDate()+'</span><span class="day-meta">'+e(fullStatus)+'</span><span class="day-meta-compact" aria-hidden="true">'+e(compactStatus)+'</span></button>';
  }
  out+='</div>';
 } else out+=monthCalendar();
 const all=allOn(s.date);
 if(overlapsFor(s.date).length)out+='<div class="action-strip warning-strip"><span class="icon">◷</span><p>'+overlapsFor(s.date).length+' conflito(s) de horários previstos. Nenhuma atividade foi bloqueada.</p></div>';
 out+='<section class="card board"><div class="card-head"><div><h2>'+e(fmt(s.date,true))+'</h2><small>'+e(availabilityStatus(s.date))+' · '+C.hoursLabel(hoursFor(s.date)/60)+' em outras atividades'+(studyCountOn(s.date)?' · '+studyCountOn(s.date)+' sessão(ões) de estudo':'')+'</small></div><div class="row"><button class="btn small" data-s2="newEntry" data-type="focus">+ Foco</button><button class="btn small" data-s2="newEntry" data-type="task">+ Tarefa</button><button class="btn small" data-s2="newEntry" data-type="habit">+ Rotina</button></div></div>';
 out+=all.length?'<div class="task-list">'+[...kindOn(s.date,"focus"),...kindOn(s.date,"habit"),...kindOn(s.date,"task")].map(x=>itemRow(x,s.date)).join("")+'</div>':emptyList("Nenhuma atividade planejada para esta data.");
 out+='</section>';
 return out;
}
function decorateOrganize(){
 const tabs=[["focus","Focos"],["task","Tarefas"],["habit","Rotinas"],["block","Blocos"]];
 let out='<section class="hero-row"><div><div class="overline">SUAS ÁREAS</div><h1>Organizar</h1><p class="kicker">Controle e personalize os componentes do planejamento.</p></div><button class="btn primary" data-s2="'+(organizing==="block"?"newBlock":"newEntry")+'" '+(organizing!=="block"?'data-type="'+organizing+'"':"")+' >+ Adicionar</button></section>';
 out+='<div class="tab-line">'+tabs.map(([key,label])=>'<button class="tab '+(organizing===key?"active":"")+'" data-s2="organizeTab" data-type="'+key+'">'+label+'</button>').join("")+'</div>';
 if(organizing==="block"){
  const blocks=p.blocks;
  out+='<section class="card board"><div class="card-head"><h2>Meus blocos</h2>'+tag(blocks.length+" criados")+'</div>';
  out+=blocks.length?'<div class="task-list organize-list">'+blocks.map(b=>'<div class="task-row organize-row" style="--task-color:'+a(b.color)+'"><div class="task-mark">◫</div><div class="task-main"><div class="task-title">'+e(b.title)+'</div><div class="task-meta">'+(b.archived?"Arquivado":"Ativo")+' · '+p.entries.filter(x=>x.blockId===b.id).length+' atividade(s)</div></div><div class="task-actions organize-actions"><button class="btn small" data-s2="editBlock" data-id="'+a(b.id)+'">Editar</button><button class="btn small ghost" data-s2="duplicateBlock" data-id="'+a(b.id)+'">Copiar</button><button class="btn small ghost" data-s2="archiveBlock" data-id="'+a(b.id)+'">'+(b.archived?"Reativar":"Arquivar")+'</button><button class="btn small danger" data-s2="deleteBlock" data-id="'+a(b.id)+'">Excluir</button></div></div>').join("")+'</div>':emptyList("Crie um bloco para agrupar suas atividades.");
  out+='</section>';return out;
 }
 const entries=p.entries.filter(x=>x.type===organizing);
 out+='<section class="card board"><div class="card-head"><h2>'+({focus:"Focos obrigatórios",task:"Tarefas secundárias",habit:"Rotinas e hábitos"})[organizing]+'</h2>'+tag(entries.length+" criado(s)")+'</div>'+(organizing==="habit"?'<p class="note">Concluir hoje não remove as próximas ocorrências. Cada execução mantém seu registro.</p>':"");
 out+=entries.length?'<div class="task-list organize-list">'+entries.map(x=>'<div class="task-row organize-row" style="--task-color:'+a(block(x.blockId)?.color||"transparent")+'"><div class="task-mark">◈</div><div class="task-main"><div class="task-title">'+e(x.title)+'</div><div class="task-meta">'+blockLabel(x.blockId)+'<span>'+e(x.recurrence?.kind!=="none"?recurLabel(x.recurrence):fmt(x.date,false))+'</span><span>'+e(x.archivedAt?"Arquivada":"Ativa")+'</span>'+(organizing==="habit"?'<span>'+routineStats(x).done+' de '+routineStats(x).planned+' realizadas ('+routineStats(x).percent+'%)</span>':"")+'</div></div><div class="task-actions organize-actions"><button class="btn small" data-s2="editEntry" data-id="'+a(x.id)+'" data-date="'+a(x.date)+'">Editar</button><button class="btn small ghost" data-s2="duplicateEntry" data-id="'+a(x.id)+'">Copiar</button><button class="btn small ghost" data-s2="archiveEntry" data-id="'+a(x.id)+'">'+(x.archivedAt?"Reativar":"Arquivar")+'</button><button class="btn small danger" data-s2="deleteEntry" data-id="'+a(x.id)+'">Excluir</button></div></div>').join("")+'</div>':emptyList("Nenhum item cadastrado.");
 out+='</section>';return out;
}
function blockOptions(selected){return '<option value="">Sem bloco</option>'+p.blocks.filter(b=>!b.archived||b.id===selected).map(b=>'<option value="'+a(b.id)+'" '+(selected===b.id?"selected":"")+'>'+e(b.title)+(b.archived?" (arquivado)":"")+'</option>').join("");}
function formField(label,name,value,type="text",attrs=""){return '<div class="field"><label>'+e(label)+'</label><input type="'+type+'" name="'+name+'" value="'+a(value??"")+'" '+attrs+'></div>';}
function entryModal(type,id,date){
 if(locked(date||s.date))return notify("Dia finalizado: apenas consulta ao registro original.");
 let original=id?find(id):null;
 if(!original&&!C.availabilityReady())return notify("Configure sua disponibilidade antes de planejar.");
 const x=id?(occurrence(original,date||original.date)||original):baseEntry({type,date:date||s.date,recurrence:type==="habit"?{kind:"daily"}:{kind:"none"}});
 const editing=!!original;
 const form='<form id="s2-entry" class="section-stack"><input type="hidden" name="id" value="'+a(id||"")+'"><input type="hidden" name="editDate" value="'+a(date||x.date)+'"><input type="hidden" name="type" value="'+a(type||x.type)+'">'+
 formField("Nome da atividade","title",x.title,"text",'required maxlength="140"')+
 '<div class="field"><label>Objetivo relacionado (opcional)</label><select name="goalId"><option value="">Sem objetivo</option>'+s.goals.filter(g=>!g.archived).map(g=>'<option value="'+a(g.id)+'" '+(x.goalId===g.id?"selected":"")+'>'+e(g.title)+'</option>').join("")+'</select></div>'+
 '<div class="form-grid">'+formField("Data inicial","date",x.date,"date",'required min="'+firstUse()+'"')+
 '<div class="field"><label>Bloco</label><select name="blockId">'+blockOptions(x.blockId)+'</select></div></div>'+
 (type==="task"?'<div class="form-grid"><div class="field"><label>Prioridade</label><select name="priority"><option value="high" '+(x.priority==="high"?"selected":"")+'>Alta</option><option value="medium" '+(x.priority==="medium"?"selected":"")+'>Média</option><option value="low" '+(x.priority==="low"?"selected":"")+'>Baixa</option></select></div>'+formField("Prazo opcional","dueDate",x.dueDate,"date")+'</div>':"")+
 '<div class="form-grid">'+formField(type==="habit"?"Horário-alvo (opcional)":"Horário (opcional)","startTime",x.startTime||"","time")+
 formField("Duração estimada em minutos","estimatedMin",x.estimatedMin??"","number",'min="1" max="1440" step="1" placeholder="Opcional"')+'</div>'+
 '<div class="field"><label>'+(type==="habit"?"Tipo de rotina":"Repetição")+'</label><select name="repeat"><option value="daily" '+(x.recurrence?.kind==="daily"?"selected":"")+'>Diária — todos os dias</option><option value="weekdays" '+(x.recurrence?.kind==="weekdays"?"selected":"")+'>Semanal — dias escolhidos</option><option value="interval" '+(x.recurrence?.kind==="interval"?"selected":"")+'>Por intervalo — a cada N dias</option><option value="monthday" '+(x.recurrence?.kind==="monthday"?"selected":"")+'>Mensal — dia do mês</option><option value="none" '+(x.recurrence?.kind==="none"?"selected":"")+'>Pontual — somente uma vez</option></select></div>'+
 '<div class="repeat-fields" id="s2-repeat-fields">'+repeatFields(x.recurrence||{kind:"none"},x.date)+'</div>'+
 (editing&&x.recurrence?.kind!=="none"?'<div class="field"><label>Alcance da edição</label><select name="scope"><option value="future" '+((date||x.date)===original?.date?"selected":"")+'>Esta e futuras ocorrências</option><option value="single" '+((date||x.date)!==original?.date?"selected":"")+'>Somente esta ocorrência</option></select></div>':"")+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button type="submit" class="btn primary">Salvar</button></div></form>';
 C.openModal(editing?"Editar atividade":"Nova atividade",form,"");
}
function repeatFields(r,date){
 if(r.kind==="none")return '<p class="note">Atividade pontual. Para repetir, selecione outro tipo.</p>';
 const fields=['<div class="field"><label>Encerramento</label><select name="repeatTermination"><option value="never" '+(!r.end?"selected":"")+'>Sem data de término</option><option value="date" '+(r.end?"selected":"")+'>Até uma data</option></select></div>','<div id="s2-repeat-end" '+(!r.end?'hidden':'')+' class="field"><label>Último dia da repetição</label><input type="date" name="repeatEnd" min="'+a(date)+'" value="'+a(r.end||endMonth(date))+'"></div>'];
 if(r.kind==="weekdays")fields.unshift('<div class="field"><span class="label">Dias de execução</span><div class="pill-row">'+SHORT.map((name,i)=>'<label class="checkline" style="padding-right:8px"><input type="checkbox" name="weekday" value="'+i+'" '+((r.weekdays||[C.parse(date).getDay()]).includes(i)?"checked":"")+'>'+name+'</label>').join("")+'</div></div>');
 if(r.kind==="interval")fields.unshift(formField("Intervalo em dias","everyDays",r.everyDays||2,"number",'required min="1" max="365" step="1"'));
 if(r.kind==="monthday")fields.unshift(formField("Dia do mês","monthDay",r.monthDay||Number(date.slice(-2)),"number",'min="1" max="31"'));
 fields.push('<label class="checkline"><input name="numbered" type="checkbox" '+(r.numbered?"checked":"")+'> Numerar ocorrências do mês (opcional)</label>');return fields.join("");
}
function readForm(formData,old){
 const date=ds(formData.get("date"));if(!validDate(date)||date<firstUse())throw Error("Selecione uma data válida desde o primeiro acesso.");
 const type=String(formData.get("type"));const title=String(formData.get("title")||"").trim().slice(0,140);
 if(!title)throw Error("Informe o nome da atividade.");
 const estimated=String(formData.get("estimatedMin")||"").trim();const minutes=estimated?Number(estimated):null;
 if(minutes!==null&&(!Number.isInteger(minutes)||minutes<1||minutes>1440))throw Error("A duração deve estar entre 1 e 1440 minutos.");
 const repeat=String(formData.get("repeat")||"none");
 let recurrence={kind:repeat};
 if(repeat!=="none"){
  const termination=String(formData.get("repeatTermination")||"date");
  if(!["never","date"].includes(termination))throw Error("Encerramento inválido.");
  if(termination==="date"){const end=ds(formData.get("repeatEnd"));if(!validDate(end)||end<date)throw Error("Informe uma data final válida.");recurrence.end=end;}
  recurrence.numbered=formData.has("numbered");
  if(repeat==="weekdays"){recurrence.weekdays=formData.getAll("weekday").map(Number).filter(x=>x>=0&&x<7);if(!recurrence.weekdays.length)throw Error("Selecione ao menos um dia da semana.");}
  if(repeat==="interval"){recurrence.everyDays=Number(formData.get("everyDays"));if(!Number.isInteger(recurrence.everyDays)||recurrence.everyDays<1||recurrence.everyDays>365)throw Error("Informe um intervalo de 1 a 365 dias.");}
  if(repeat==="monthday"){recurrence.monthDay=Number(formData.get("monthDay"));if(!Number.isInteger(recurrence.monthDay)||recurrence.monthDay<1||recurrence.monthDay>31)throw Error("Escolha um dia do mês válido.");}
  if(!["daily","weekdays","interval","monthday"].includes(repeat))throw Error("Tipo de repetição inválido.");
 }
 return {type,title,date,blockId:String(formData.get("blockId")||""),goalId:String(formData.get("goalId")||""),priority:String(formData.get("priority")||"medium"),startTime:String(formData.get("startTime")||""),estimatedMin:minutes,dueDate:ds(formData.get("dueDate")||""),recurrence};
}
function preserveRecord(id,date){return !!p.records[uidKey(id,date)]||locked(date)}
function updateEntry(data,original,editDate,scope){
 if(!original){p.entries.push(baseEntry(data));return}
 const effective=editDate||original.date;
 if(!canChange(effective))return;
 if(original.recurrence?.kind!=="none"&&scope!=="future"){
  if(data.date!==original.date&&data.date!==effective){p.overrides[uidKey(original.id,effective)]={removed:true};p.entries.push(baseEntry({...data,recurrence:{kind:"none"},origin:{type:"occurrence_revision",fromId:original.id,fromDate:effective}}));return;}
  p.overrides[uidKey(original.id,effective)]={fields:{title:data.title,blockId:data.blockId,goalId:data.goalId,startTime:data.startTime,estimatedMin:data.estimatedMin,priority:data.priority,dueDate:data.dueDate}};
  return;
 }
 if(original.recurrence?.kind!=="none"&&scope==="future"&&effective>original.date){
  // Mantém o modelo anterior e seus registros, criando outro modelo apenas para a nova sequência.
  original.recurrence.end=D(effective,-1);
  const next=baseEntry({...data,date:effective,origin:{type:"template_revision",fromId:original.id}});
  p.entries.push(next);
  return;
 }
 // Edição simples ou no início de uma sequência, preservando registros na etapa 2.
 if(Object.keys(p.records).some(k=>k.startsWith(original.id+"@"))&&original.recurrence?.kind!=="none"&&scope==="future"){
  original.recurrence.end=D(effective,-1);
  p.entries.push(baseEntry({...data,date:effective,origin:{type:"template_revision",fromId:original.id}}));return;
 }
 Object.assign(original,data);
}
function blockModal(id){const b=block(id)||{};C.openModal(id?"Editar bloco":"Novo bloco",'<form id="s2-block" class="section-stack"><input type="hidden" name="id" value="'+a(id||"")+'">'+formField("Nome do bloco","title",b.title||"","text",'required maxlength="80"')+'<div class="field"><label>Cor</label><input type="color" name="color" value="'+a(b.color||COLORS[0])+'" style="width:80px;height:43px"></div><div class="modal-footer"><button type="button" data-action="closeModal" class="btn ghost">Cancelar</button><button class="btn primary">Salvar</button></div></form>',"");}
function statusModal(id,date){if(locked(date))return notify("Dia finalizado: registro em modo de consulta.");const x=find(id),r=p.records[uidKey(id,date)]||{};
 if(!x)return;
 C.openModal("Registrar execução",'<form id="s2-record" class="section-stack"><input type="hidden" name="id" value="'+a(id)+'"><input type="hidden" name="date" value="'+a(date)+'"><div class="field"><label>Situação</label><select name="status">'+[["pending","Pendente"],["progress","Em andamento"],["done","Concluída"],["notdone","Não realizada"]].map(([key,label])=>'<option value="'+key+'" '+(r.status===key?"selected":"")+'>'+label+'</option>').join("")+'</select></div>'+formField("Duração real (minutos, opcional)","actualMin",r.actualMin||"","number",'min="1" max="1440"')+(x.type==="habit"?formField("Horário real (opcional)","actualTime",r.actualTime||"","time"):"")+'<p class="note">A duração real não será preenchida automaticamente com a previsão.</p><div class="modal-footer"><button type="button" data-action="closeModal" class="btn ghost">Cancelar</button><button type="submit" class="btn primary">Salvar registro</button></div></form>',"");}
function moreModal(id,date){
 const x=find(id);if(!x)return;
 C.openModal("Gerenciar atividade",'<p class="note">'+e(x.title)+' · '+e(fmt(date,false))+'</p><div class="action-cards"><button class="btn" data-s2="recordDetail" data-id="'+a(id)+'" data-date="'+date+'">Registro de execução</button><button class="btn" data-s2="editEntry" data-id="'+a(id)+'" data-date="'+date+'">Editar</button><button class="btn" data-s2="duplicateEntry" data-id="'+a(id)+'">Copiar</button>'+(x.type==="focus"?'<button class="btn" data-s2="moveFocus" data-id="'+a(id)+'" data-date="'+date+'">Remanejar foco</button>':"")+'<button class="btn" data-s2="archiveEntry" data-id="'+a(id)+'">'+(x.archivedAt?"Reativar":"Arquivar")+'</button><button class="btn danger" data-s2="deleteEntry" data-id="'+a(id)+'" data-date="'+date+'">Excluir</button></div>',"");
}
function moveModal(id,date){
 const o=find(id);if(!o)return;
 C.openModal("Remanejar foco",'<form id="s2-move" class="section-stack"><input type="hidden" name="id" value="'+a(id)+'"><input type="hidden" name="date" value="'+a(date)+'">'+formField("Nova data","target",D(date,1),"date",'min="'+a(firstUse())+'" required')+'<div class="field"><label>Motivo (opcional)</label><textarea name="reason" maxlength="600" placeholder="Por que o planejamento mudou?"></textarea></div><p class="note">O compromisso permanecerá marcado como remanejado na origem. Não será considerado concluído.</p><div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Confirmar remanejamento</button></div></form>',"");
}
function pauseModal(date){
 const old=p.dayPauses[date];
 C.openModal("Descanso ou pausa",'<form id="s2-pause" class="section-stack"><input type="hidden" name="date" value="'+a(date)+'"><div class="field"><label>Tipo</label><select name="kind"><option value="planejado" '+(old?.kind==="planejado"?"selected":"")+'>Descanso planejado</option><option value="imprevisto" '+(old?.kind==="imprevisto"?"selected":"")+'>Imprevisto</option><option value="mesmo_dia" '+(old?.kind==="mesmo_dia"?"selected":"")+'>Descanso decidido no próprio dia</option></select></div><div class="field"><label>Motivo (opcional)</label><textarea name="reason" maxlength="700">'+e(old?.reason||"")+'</textarea></div><p class="note">As atividades anteriormente planejadas serão preservadas. Mudanças feitas na própria data ficam registradas.</p><div class="modal-footer">'+(old?'<button type="button" class="btn danger" data-s2="removePause" data-date="'+a(date)+'">Remover pausa</button>':"")+'<button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Registrar pausa</button></div></form>',"");
}
function copyModal(){
 C.openModal("Copiar planejamento",'<form id="s2-copy-preview" class="section-stack"><p class="note">Copie os compromissos previstos sem levar estados de conclusão. Os itens repetidos não serão duplicados automaticamente.</p><div class="field"><label>O que copiar?</label><select name="kind"><option value="week">Semana</option><option value="month">Mês</option><option value="block">Bloco em um mês</option></select></div><div class="form-grid">'+formField("Data de origem","origin",s.date,"date",'required min="'+a(firstUse())+'"')+formField("Data de destino","target",D(s.date,7),"date",'required min="'+a(firstUse())+'"')+'</div><div class="field"><label>Bloco (usado se selecionar Bloco)</label><select name="blockId">'+p.blocks.filter(b=>!b.archived).map(b=>'<option value="'+a(b.id)+'">'+e(b.title)+'</option>').join("")+'</select></div><div class="field"><label>Se já existir uma atividade igual na data</label><select name="conflict"><option value="skip">Ignorar duplicata</option><option value="replace">Substituir programação existente (somente dias abertos)</option></select></div><div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Ver prévia</button></div></form>',"");
}
function copyPlanDraft(data){
 const kind=String(data.get("kind")),origin=ds(data.get("origin")),target=ds(data.get("target")),blockId=String(data.get("blockId")||""),conflict=String(data.get("conflict")||"skip");
 if(!validDate(origin)||!validDate(target)||target<firstUse())throw Error("Selecione datas válidas.");
 const sourceStart=kind==="week"?startWeek(origin):startMonth(origin);
 const sourceEnd=kind==="week"?D(sourceStart,6):endMonth(origin);
 const targetStart=kind==="week"?startWeek(target):startMonth(target);
 let changes=[],seen=new Set();
 for(let date=sourceStart;date<=sourceEnd;date=D(date,1)){
  // Desconsidera tarefas secundárias carregadas de outras datas.
  for(const o of allOn(date).filter(x=>x.occurrenceDate===date)){
   if(kind==="block"&&o.blockId!==blockId)continue;
   if(o.type==="task"&&o.sourceDate)continue;
   let targetDate;
   if(kind==="week")targetDate=D(targetStart,Math.round((C.parse(date)-C.parse(sourceStart))/86400000));
   else if(kind==="month")targetDate=targetStart.slice(0,7)+date.slice(-3);
   else{ // Bloco por mês: mantém o dia da semana via deslocamento por semanas.
    const week=Math.floor((Number(date.slice(-2))-1)/7),dow=C.parse(date).getDay(),first=C.parse(targetStart);
    const offset=(dow-first.getDay()+7)%7;targetDate=D(targetStart,offset+7*week);
   }
   if(!validDate(targetDate)||targetDate.slice(0,7)!==targetStart.slice(0,7)&&kind!=="week")continue;
   if(locked(targetDate)||targetDate<firstUse())continue;
   const key=o.type+"|"+o.title.toLowerCase()+"|"+targetDate;
   if(seen.has(key))continue;seen.add(key);
   const duplicates=allOn(targetDate).filter(x=>x.type===o.type&&x.title.toLowerCase()===o.title.toLowerCase());
   changes.push({type:o.type,title:o.title,date:targetDate,blockId:o.blockId,goalId:o.goalId||"",priority:o.priority,startTime:o.startTime,estimatedMin:o.estimatedMin,dueDate:o.dueDate,recurrence:{kind:"none"},duplicateIds:duplicates.map(x=>x.id),sourceId:o.id});
  }
 }
 return {changes,kind,origin,target,conflict};
}
function showCopyPreview(draft){
 copyDraft=draft;
 const duplicates=draft.changes.filter(x=>x.duplicateIds.length);
 C.openModal("Prévia da cópia",'<p class="note">'+draft.changes.length+' ocorrência(s) localizada(s); '+duplicates.length+' conflito(s). A cópia não inclui conclusão ou duração real.</p><div class="copy-preview">'+(draft.changes.length?draft.changes.slice(0,60).map(x=>'<div class="row-between copy-preview-row"><span>'+e(x.title)+'</span><small>'+e(x.date.split("-").reverse().join("/"))+(x.duplicateIds.length?" · duplicada":"")+'</small></div>').join(""):emptyList("Nenhuma ocorrência elegível encontrada."))+'</div><div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" data-s2="confirmCopy" '+(!draft.changes.length?"disabled":"")+'>Confirmar cópia</button></div>',"");
}
function performCopy(){
 if(!copyDraft)return;
 let added=0,skipped=0;
 for(const x of copyDraft.changes){
  if(locked(x.date)){skipped++;continue;}
  if(x.duplicateIds.length){
   if(copyDraft.conflict==="skip"){skipped++;continue;}
   // Conserva qualquer atividade com registros, por segurança.
   const removing=x.duplicateIds.filter(id=>!Object.keys(p.records).some(k=>k.startsWith(id+"@"))&&find(id)?.recurrence?.kind==="none");
   if(removing.length!==x.duplicateIds.length){skipped++;continue;}
   p.entries=p.entries.filter(e=>!removing.includes(e.id));
  }
  p.entries.push(baseEntry({...x,origin:{type:"copied",sourceId:x.sourceId}}));added++;
 }
 copyDraft=null;save();C.closeModal();render();notify(added+" atividade(s) copiadas; "+skipped+" ignorada(s).");
}
function confirmDeleteEntry(id,date){
 const x=find(id);if(!x)return;
 if(date&&locked(date))return notify("Dia finalizado: não é possível excluir.");
 let details=x.recurrence?.kind!=="none"?"Somente esta ocorrência ou a sequência inteira?":"A atividade será excluída do planejamento aberto.";
 const action=x.recurrence?.kind!=="none"?'<div class="field"><label>Alcance</label><select id="s2-delete-scope"><option value="one">Somente esta ocorrência</option><option value="future">Esta e futuras ocorrências</option><option value="all">Todas as ocorrências abertas</option></select></div>':"";
 C.openModal("Excluir atividade",'<p class="note">'+e(details)+' Registros já finalizados não poderão ser apagados.</p>'+action+'<div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button class="btn danger" data-s2="confirmDelete" data-id="'+a(id)+'" data-date="'+a(date||x.date)+'">Excluir</button></div>',"");
}
function deleteEntry(id,date,scope){
 const x=find(id);if(!x)return;
 if(scope==="one"&&x.recurrence?.kind!=="none"){if(locked(date))return notify("Dia finalizado: ocorrência protegida.");p.overrides[uidKey(id,date)]={removed:true};return;}
 if(scope==="future"&&x.recurrence?.kind!=="none"){if(locked(date))return notify("Dia finalizado: o modelo passado deve ser preservado.");x.recurrence.end=D(date,-1);return;}
 // Não permite apagar registros em dias já fechados, inclusive na série.
 const hasLocked=Object.keys(p.records).some(k=>k.startsWith(id+"@")&&locked(k.split("@")[1]))||Object.values(s.evolution?.closed||{}).some(snapshot=>snapshot.activities.some(x=>x.id===id));
 if(hasLocked){notify("Esta atividade tem registros em dias finalizados; arquive-a em vez de excluir.");return;}
 p.entries=p.entries.filter(e=>e.id!==id);
 Object.keys(p.records).filter(k=>k.startsWith(id+"@")).forEach(k=>delete p.records[k]);
 Object.keys(p.overrides).filter(k=>k.startsWith(id+"@")).forEach(k=>delete p.overrides[k]);
}
function quickRecord(id,date,status){
 if(!canChange(date))return;
 const x=find(id);if(!x)return;
 const rec=p.records[uidKey(id,date)]||{};
 if(rec.status==="moved"&&status!=="moved")return notify("Este foco foi remanejado. Consulte o destino ou edite o planejamento.");
 if(status==="pending"){delete p.records[uidKey(id,date)];}
 else p.records[uidKey(id,date)]={...rec,status,markedAt:new Date().toISOString()};
 p.events.push({kind:"status_change",id,date,from:rec.status||"pending",to:status,at:new Date().toISOString()});
 save();render();notify(status==="done"?"Concluída. Você pode informar a duração real nos detalhes.":"Situação atualizada.");
}
const actions={
 newEntry(b){entryModal(b.dataset.type||"focus")},editEntry(b){const x=find(b.dataset.id);if(x)entryModal(x.type,x.id,b.dataset.date||x.date)},
 moreEntry(b){moreModal(b.dataset.id,b.dataset.date||s.date)},
 recordDetail(b){statusModal(b.dataset.id,b.dataset.date||s.date)},
 status(b){quickRecord(b.dataset.id,b.dataset.date,b.dataset.value)},
 organizeTab(b){organizing=b.dataset.type;render()},
 newBlock(){blockModal()},editBlock(b){blockModal(b.dataset.id)},
 duplicateBlock(b){const x=block(b.dataset.id);if(!x)return;p.blocks.push({...clone(x),id:ID(),title:x.title+" (cópia)",archived:false});save();render();notify("Bloco copiado.")},
 archiveBlock(b){const x=block(b.dataset.id);if(!x)return;x.archived=!x.archived;save();render();notify(x.archived?"Bloco arquivado.":"Bloco reativado.")},
 deleteBlock(b){const x=block(b.dataset.id);if(!x)return;C.openModal("Excluir bloco",'<p class="note">As atividades desse bloco continuarão existindo, mas ficarão sem etiqueta. Registros anteriores permanecem.</p><div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn danger" data-s2="confirmDeleteBlock" data-id="'+a(x.id)+'">Excluir</button></div>',"")},
 confirmDeleteBlock(b){const id=b.dataset.id;p.entries.forEach(x=>{if(x.blockId===id)x.blockId="";});p.blocks=p.blocks.filter(x=>x.id!==id);save();C.closeModal();render();notify("Bloco excluído.")},
 duplicateEntry(b){const x=find(b.dataset.id);if(!x)return;const next=baseEntry({...x,id:undefined,date:D(x.date,1),title:x.title+" (cópia)",recurrence:{kind:"none"},origin:{type:"copied",sourceId:x.id}});p.entries.push(next);save();C.closeModal();render();notify("Atividade copiada para o dia seguinte.")},
 archiveEntry(b){const x=find(b.dataset.id);if(!x)return;x.archivedAt=x.archivedAt?"":day();save();C.closeModal();render();notify(x.archivedAt?"Atividade arquivada.":"Atividade reativada.")},
 deleteEntry(b){confirmDeleteEntry(b.dataset.id,b.dataset.date)},
 confirmDelete(b){const scope=$("s2-delete-scope")?.value||"all";deleteEntry(b.dataset.id,b.dataset.date,scope);save();C.closeModal();render();notify("Exclusão processada.")},
 moveFocus(b){moveModal(b.dataset.id,b.dataset.date)},
 pause(b){pauseModal(b.dataset.date||s.date)},
 removePause(b){if(!canChange(b.dataset.date))return;const old=p.dayPauses[b.dataset.date];p.events.push({kind:"pause_removed",date:b.dataset.date,before:old?clone(old):null,at:new Date().toISOString()});delete p.dayPauses[b.dataset.date];save();C.closeModal();render();notify("Pausa removida.")},
 chooseDate(b){if(b.dataset.date<firstUse())return;s.date=b.dataset.date;save();render()},
 switchCalendar(b){calendarView=b.dataset.mode;monthAnchor=s.date;render()},
 prevPeriod(){if(calendarView==="week"){const d=D(s.date,-7);if(d>=firstUse())s.date=d;}else monthAnchor=addMonths(monthAnchor,-1);save();render()},
 nextPeriod(){if(calendarView==="week")s.date=D(s.date,7);else monthAnchor=addMonths(monthAnchor,1);save();render()},
 now(){s.date=day();monthAnchor=day();save();render()},
 copyPlan(){copyModal()},confirmCopy(){performCopy()}
};
function submission(id,data){
 if(id==="s2-entry"){
  const origin=find(String(data.get("id")||"")),date=ds(data.get("editDate")||"");
  const payload=readForm(data,origin);
  if(!canChange(date||payload.date)||!canChange(payload.date))return;
  if(payload.recurrence.kind!=="none"&&payload.recurrence.end&&payload.recurrence.end>D(payload.date,3650))throw Error("O período máximo por sequência é de dez anos.");
  const scope=String(data.get("scope")||"single");
  if(origin)updateEntry(payload,origin,date,scope);
  else p.entries.push(baseEntry(payload));
  save();C.closeModal();render();notify(origin?"Atividade atualizada.":"Atividade cadastrada.");return;
 }
 if(id==="s2-block"){
  const title=String(data.get("title")||"").trim();if(!title)throw Error("Informe o nome do bloco.");
  const color=String(data.get("color")||COLORS[0]);if(!/^#[a-f0-9]{6}$/i.test(color))throw Error("Cor inválida.");
  const id=String(data.get("id")||"");let b=block(id);if(!b){b={id:ID(),archived:false};p.blocks.push(b);}b.title=title;b.color=color;
  save();C.closeModal();render();notify("Bloco salvo.");return;
 }
 if(id==="s2-record"){
  const item=String(data.get("id")),date=String(data.get("date"));if(!canChange(date))return;
  const status=String(data.get("status")),min=String(data.get("actualMin")||""),actualMin=min?Number(min):null;
  if(actualMin!==null&&(!Number.isInteger(actualMin)||actualMin<1||actualMin>1440))throw Error("Duração real inválida.");
  const actualTime=String(data.get("actualTime")||"");if(!["pending","progress","done","notdone"].includes(status))throw Error("Estado inválido.");
  if(p.records[uidKey(item,date)]?.status==="moved")throw Error("Este foco foi remanejado; o registro da origem deve ser preservado.");
  if(status==="pending"&&!actualMin&&!actualTime)delete p.records[uidKey(item,date)];
  else p.records[uidKey(item,date)]={status,actualMin,actualTime,markedAt:new Date().toISOString()};
  save();C.closeModal();render();notify("Registro atualizado.");return;
 }
 if(id==="s2-move"){
  const item=String(data.get("id")),date=ds(data.get("date")),target=ds(data.get("target"));if(!validDate(target)||target<firstUse()||target===date)throw Error("Escolha outra data válida.");
  if(!canChange(date)||!canChange(target))return;
  const x=find(item);if(!x||x.type!=="focus")throw Error("Foco inválido.");
  const reason=String(data.get("reason")||"").trim();
  const source=occurrence(x,date)||x;
  if(source.status==="done")throw Error("O foco já foi concluído e não pode ser remanejado como pendente.");
  const next=baseEntry({...source,date:target,recurrence:{kind:"none"},origin:{type:"rescheduled",fromId:x.id,fromDate:date,reason}});
  p.entries.push(next);
  p.records[uidKey(item,date)]={status:"moved",markedAt:new Date().toISOString(),target,reason};
  p.events.push({kind:"focus_rescheduled",id:item,date,target,reason,at:new Date().toISOString(),newId:next.id});
  save();C.closeModal();render();notify("Foco remanejado com registro da alteração.");return;
 }
 if(id==="s2-pause"){
  const date=ds(data.get("date"));if(!canChange(date))return;
  const kind=String(data.get("kind")),reason=String(data.get("reason")||"").trim();
  if(!["planejado","imprevisto","mesmo_dia"].includes(kind))throw Error("Tipo inválido.");
  let old=p.dayPauses[date];
  p.dayPauses[date]={kind,reason,registeredAt:old?.registeredAt||new Date().toISOString(),updatedAt:new Date().toISOString(),declaredSameDay:date===day(),originalPlannedMinutes:old?.originalPlannedMinutes??hoursFor(date)};
  p.events.push({kind:"pause_change",date,before:old?clone(old):null,after:clone(p.dayPauses[date]),at:new Date().toISOString()});
  save();C.closeModal();render();notify("Pausa registrada sem apagar o planejamento.");return;
 }
 if(id==="s2-copy-preview"){
  const preview=copyPlanDraft(data);showCopyPreview(preview);return;
 }
}
document.addEventListener("click",(ev)=>{
 const el=ev.target.closest("[data-s2]");if(!el)return;
 ev.preventDefault();const fn=actions[el.dataset.s2];if(fn){try{fn(el)}catch(err){notify(err.message||"Não foi possível realizar a operação.");console.error(err);}}
});
document.addEventListener("submit",(ev)=>{
 const id=ev.target?.getAttribute?.("id")||ev.target?.id;
 if(!String(id||"").startsWith("s2-"))return;
 ev.preventDefault();try{submission(id,new FormData(ev.target));}catch(err){notify(err.message||"Revise o formulário.");}
});
document.addEventListener("change",(ev)=>{
 if(ev.target?.name!=="repeat"||!$("s2-repeat-fields"))return;
 const form=ev.target.closest("form");const date=form?.querySelector('[name="date"]')?.value||s.date;
 $("s2-repeat-fields").innerHTML=repeatFields({kind:ev.target.value,weekdays:[C.parse(date).getDay()]},date);
});
document.addEventListener("change",ev=>{if(ev.target?.name!=="repeatTermination")return;const field=$("s2-repeat-end");if(!field)return;field.hidden=ev.target.value!=="date";const input=field.querySelector('input[name="repeatEnd"]');if(input)input.required=ev.target.value==="date";});
const originalRender=window.OrbitaStage2?.decorate;
window.OrbitaStage2={decorate(route,base){
 if(route==="inicio")return decorateHome()||base;
 if(route==="planejamento")return decoratePlan();
 if(route==="organizar")return decorateOrganize();
 return base;
},inspect:{get model(){return p},occurrence,allOn,kindOn,hoursFor,copyPlanDraft,performCopy,quickRecord,updateEntry,deleteEntry,submission}};
render();
})();