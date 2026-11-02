(function(){
"use strict";
const STORAGE="orbita:stage1:v1";
const DAYS=["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
const SHORT=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const PAGES={inicio:["SEU ESPAÇO","Meu dia"],planejamento:["CALENDÁRIO","Planejamento"],organizar:["SUAS ÁREAS","Organizar"],perfil:["SEU HISTÓRICO","Perfil e evolução"],disponibilidade:["SEU TEMPO","Disponibilidade"],configuracoes:["PREFERÊNCIAS","Configurações"]};
const $=(id)=>document.getElementById(id);
const iso=(d)=>{const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,"0");const day=String(d.getDate()).padStart(2,"0");return y+"-"+m+"-"+day;};
const parse=(s)=>{const a=String(s).split("-").map(Number);return new Date(a[0],a[1]-1,a[2],12);};
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return iso(d);};
const today=()=>iso(new Date());
const esc=(value)=>String(value==null?"":value).replace(/[&<>"']/g,(x)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
const attr=esc;
const hoursLabel=(v)=>{const minutes=Math.round(Number(v||0)*60);return Math.floor(minutes/60)+"h"+(minutes%60?String(minutes%60).padStart(2,"0"):"");};
const dateLabel=(d,withYear)=>parse(d).toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",...(withYear?{year:"numeric"}:{})});
const shortDate=(d)=>parse(d).toLocaleDateString("pt-BR",{day:"numeric",month:"short"});
const uid=()=>((typeof crypto!=="undefined"&&crypto.randomUUID)?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));
const fresh=()=>({schema:1,firstAccess:today(),date:today(),settings:{theme:"dark",motion:true,weekStart:0},availability:{weekly:[null,null,null,null,null,null,null],overrides:{}},goals:[],primaryGoalId:null});
let state;
try{const existing=JSON.parse(localStorage.getItem(STORAGE)||"null");state=existing&&existing.schema===1?existing:fresh();}
catch(e){state=fresh();}
if(!Array.isArray(state.goals))state.goals=[];
if(!state.availability)state.availability={weekly:[null,null,null,null,null,null,null],overrides:{}};
if(!Array.isArray(state.availability.weekly))state.availability.weekly=Array(7).fill(null);
if(!state.availability.overrides)state.availability.overrides={};
if(!state.settings)state.settings={theme:"dark",motion:true,weekStart:0};
if(!state.firstAccess)state.firstAccess=today();
if(!state.date||state.date<state.firstAccess)state.date=today();
let route=PAGES[location.hash.slice(1)]?location.hash.slice(1):"inicio";
let modalReturnFocus=null;
let glowTarget={x:-400,y:-400},glowAt={x:-400,y:-400},glowFrame=0,glowIsActive=false;
let toastTimer;
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(state));$("storage-indicator").title="Salvo neste navegador";return true;}catch(e){$("storage-indicator").title="Não foi possível salvar";notify("Erro ao salvar. Verifique o armazenamento do navegador.");return false;}}
function notify(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),3500);}
function availabilityReady(){return state.availability.weekly.some(Boolean)||Object.keys(state.availability.overrides).length>0;}
function resolveAvailability(date){return state.availability.overrides[date]||state.availability.weekly[parse(date).getDay()]||null;}
function availabilityMinutes(a){if(!a||a.mode==="rest")return 0;if(a.mode==="slots")return (a.slots||[]).reduce((sum,s)=>sum+(toMinutes(s.end)-toMinutes(s.start)),0);return Math.round(Number(a.hours||0)*60);}
function availabilityText(a){if(!a)return "Não configurado";if(a.mode==="rest")return "Descanso";if(a.mode==="slots")return hoursLabel(availabilityMinutes(a)/60)+" disponíveis";if(a.mode==="broad")return "Dia livre · "+hoursLabel(a.hours);return hoursLabel(a.hours)+" disponíveis";}
function toMinutes(t){const v=String(t||"").split(":").map(Number);return v[0]*60+v[1];}
function activeGoal(){return state.goals.find(g=>g.id===state.primaryGoalId&&!g.archived)||null;}
function applyTheme(){document.body.dataset.theme=state.settings.theme==="light"?"light":"dark";document.body.classList.toggle("motion-off",state.settings.motion===false);$("theme-switch").textContent=state.settings.theme==="light"?"☀":"☾";document.querySelector('meta[name="theme-color"]').content=state.settings.theme==="light"?"#f3f5fc":"#080913";}
function btn(label,action,cls,extra){return '<button type="button" class="btn '+(cls||"")+'" data-action="'+action+'" '+(extra||"")+'>'+label+"</button>";}
function tag(text,cls){return '<span class="status '+(cls||"")+'">'+esc(text)+"</span>";}
function empty(icon,title,text,button){return '<section class="card empty-state"><div class="empty-symbol" aria-hidden="true">'+icon+'</div><h2>'+esc(title)+'</h2><p>'+esc(text)+'</p>'+ (button||"")+"</section>";}
function page(content){return '<div class="view-inner">'+content+'</div>';}
function go(name){if(!PAGES[name])return;route=name;history.replaceState(null,"","#"+name);render();$("view").scrollTop=0;}
function updateDate(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(parse(date).getTime()))return notify("Data inválida.");if(date<state.firstAccess)return notify("Você só pode voltar até o primeiro acesso.");state.date=date;save();render();}
function render(){applyTheme();document.querySelectorAll("[data-nav]").forEach(x=>{x.classList.toggle("active",x.dataset.nav===route);if(x.dataset.nav===route)x.setAttribute("aria-current","page");else x.removeAttribute("aria-current");});$("top-eyebrow").textContent=PAGES[route][0];$("top-title").textContent=PAGES[route][1];
let content="";
if(route==="inicio")content=renderHome();
else if(route==="planejamento")content=renderWeek();
else if(route==="organizar")content=renderOrganize();
else if(route==="perfil")content=renderProfile();
else if(route==="disponibilidade")content=renderAvailability();
else content=renderSettings();
$("view").innerHTML=page(content);}
function dateNavigator(){return '<div class="date-nav"><button class="btn square" data-action="prevDay" '+(addDays(state.date,-1)<state.firstAccess?"disabled":"")+' aria-label="Dia anterior">‹</button><button class="btn date-button" data-action="jumpDate" title="Escolher data">'+esc(shortDate(state.date))+' ▾</button><button class="btn square" data-action="nextDay" aria-label="Próximo dia">›</button></div>';}
function renderHome(){
const goal=activeGoal(),a=resolveAvailability(state.date),ready=availabilityReady();
let out='<section class="hero-row"><div><div class="overline">SEU PLANEJAMENTO</div><h1>'+esc(dateLabel(state.date,true))+'</h1></div><div class="row">'+dateNavigator()+(state.date!==today()?btn("Hoje","goToday","ghost small"):"")+'</div></section>';
if(goal)out+='<section class="card hero-goal"><div class="orbital-icon">◎</div><div class="hero-content"><div class="overline">OBJETIVO PRINCIPAL</div><h2>'+esc(goal.title)+'</h2></div>'+btn("Ver objetivos","openProfile","small ghost")+'</section>';
else if(ready)out+='<div class="action-strip"><span class="icon">◎</span><p>Você ainda não definiu um objetivo principal.</p>'+btn("Adicionar objetivo","addGoal","small")+'</div>';
if(!ready){
out+=empty("◷","Primeiro, sua disponibilidade","Defina seus horários livres. O restante do planejamento será organizado a partir deles.",btn("Definir disponibilidade","openAvailability","primary"));
return out+'<div class="grid-2 dashboard-panels">'+moduleCard("Focos do dia","Ainda não há atividades.","target",false)+moduleCard("Ciclos de estudo","Configure sua disponibilidade antes de criar ciclos.","cycles",true)+'</div>';
}
if(!a)out+='<div class="action-strip"><span class="icon">◷</span><p>A disponibilidade desta data ainda não está configurada.</p>'+btn("Definir","editThisAvailability","small")+'</div>';
else out+='<div class="action-strip"><span class="icon">'+(a.mode==="rest"?"☾":"◷")+'</span><p>'+esc(availabilityText(a))+' neste dia · previsão definida por você, não um tempo obrigatório.</p>'+btn("Ajustar","editThisAvailability","small ghost")+'</div>';
out+='<div class="grid-2 dashboard-panels">'+moduleCard("Focos do dia","Nenhum foco cadastrado para esta data.","target",false)+moduleCard("Ciclos de estudo","Nenhum ciclo cadastrado.","cycles",false)+'</div>';
out+='<div class="grid-2 dashboard-panels">'+moduleCard("Tarefas secundárias","Nenhuma tarefa cadastrada.","tasks",false)+moduleCard("Rotinas e hábitos","Nenhuma rotina cadastrada.","habits",false)+'</div>';
out+='<div class="row-between"><span class="note">Sua estrutura inicial está pronta. Crie suas atividades nas próximas etapas.</span>'+btn("Objetivos","openProfile","small")+'</div>';
return out;}
function moduleCard(title,description,module,locked){return '<section class="card module"><div class="card-head"><h2>'+esc(title)+'</h2><span class="module-icon" aria-hidden="true">'+(locked?"⌑":module==="cycles"?"◉":module==="tasks"?"☷":module==="habits"?"◷":"◇")+'</span></div><p class="module-empty">'+esc(description)+'</p><div class="module-foot">'+tag(locked?"Disponibilidade necessária":"Etapa futura",locked?"warn":"")+'<button type="button" data-action="moduleHelp" data-module="'+module+'" class="btn small ghost">Detalhes ↗</button></div></section>';}
function firstDayOfWeek(date){const day=parse(date).getDay();return addDays(date,-((day-Number(state.settings.weekStart||0)+7)%7));}
function renderWeek(){
const start=firstDayOfWeek(state.date),end=addDays(start,6);
let out='<div class="hero-row"><div><div class="overline">VISÃO SEMANAL</div><h1>'+esc(shortDate(start))+' — '+esc(shortDate(end))+'</h1><p class="kicker">Selecione um dia para consultar sua disponibilidade.</p></div><div class="row">'+btn("‹ Semana","prevWeek","small")+btn("Hoje","goToday","small ghost")+btn("Próxima ›","nextWeek","small")+'</div></div>';
out+='<div class="week-grid">';
for(let i=0;i<7;i++){const d=addDays(start,i),a=resolveAvailability(d);out+='<button class="day-tile'+(d===state.date?" selected":"")+(d===today()?" today":"")+'" data-action="selectDay" data-date="'+d+'" aria-label="'+esc(dateLabel(d,true))+'"><span class="dow">'+SHORT[parse(d).getDay()]+'</span><span class="day-number">'+parse(d).getDate()+'</span><span class="day-meta">'+esc(a?a.mode==="rest"?"Descanso":hoursLabel(availabilityMinutes(a)/60):"—")+'</span></button>';}
out+='</div>';
const a=resolveAvailability(state.date),exception=!!state.availability.overrides[state.date];
out+='<section class="card"><div class="card-head"><div><h2>'+esc(dateLabel(state.date,true))+'</h2><small>'+ (exception?"Disponibilidade excepcional":"Planejamento do dia")+'</small></div>'+btn("Editar disponibilidade","editThisAvailability","small")+'</div><div class="row-between"><div><div class="overline">TEMPO DISPONÍVEL</div><h2 style="margin:6px 0">'+esc(availabilityText(a))+'</h2></div>'+tag(a?a.mode==="rest"?"Descanso":"Configurado":"Não definido",a?"good":"warn")+'</div></section>';
out+='<section class="card"><div class="card-head"><h2>Compromissos do dia</h2>'+tag("Etapa 2")+'</div><p class="note">O calendário de atividades, a cópia de semanas e as repetições serão ativados na etapa de Planejamento e Organização.</p></section>';
return out;}
function renderOrganize(){
const ready=availabilityReady();
const blocks=[["◫","Blocos e pastas","Organize compromissos por áreas, com cores e prioridades.","Etapa 2"],["◇","Tarefas e rotinas","Criação, edição, exclusão, recorrência e horários.","Etapa 2"],["◉","Ciclos de estudo","Sequência de matérias, sessões, reforços e modalidades.",ready?"Etapa 3":"Disponibilidade necessária"],["◎","Objetivos","Defina e gerencie seu objetivo principal e os secundários.","Disponível"]];
let out='<div class="hero-row"><div><div class="overline">SUAS ÁREAS</div><h1>Organize do seu jeito</h1><p class="kicker">As áreas serão criadas por você. Nada será cadastrado automaticamente.</p></div></div>';
out+='<div class="grid-2">';
blocks.forEach((b,i)=>{out+='<section class="card module"><div class="card-head"><h2>'+b[1]+'</h2><span class="module-icon">'+b[0]+'</span></div><p class="module-empty">'+b[2]+'</p><div class="module-foot">'+tag(b[3],i===3?"good":"")+'<button type="button" class="btn small" data-action="'+(i===3?"openProfile":"moduleHelp")+'"'+(i===3?"":' data-module="'+(i===2?"cycles":i===1?"tasks":"folders")+'"')+'>'+(i===3?"Gerenciar":"Ver detalhes")+'</button></div></section>';});
out+='</div>';return out;}
function renderProfile(){
const primary=activeGoal(),active=state.goals.filter(g=>!g.archived),archived=state.goals.filter(g=>g.archived);
let out='<section class="hero-row"><div><div class="overline">OBJETIVOS E EVOLUÇÃO</div><h1>Seu perfil</h1><p class="kicker">Resultados só aparecem depois que você tiver registros reais.</p></div>'+btn("+ Novo objetivo","addGoal","primary")+'</section>';
out+='<section class="card"><div class="card-head"><h2>Objetivo principal</h2>'+btn(primary?"Alterar":"Definir","addGoal","small ghost")+'</div>'+(primary?'<div class="hero-goal" style="padding:0;background:none;box-shadow:none"><div class="orbital-icon">◎</div><div class="hero-content"><h2>'+esc(primary.title)+'</h2><p class="kicker">'+esc(primary.description||"Sem descrição")+'</p></div></div>':'<p class="note">Nenhum objetivo principal definido.</p>')+'</section>';
out+='<section class="card"><div class="card-head"><h2>Meus objetivos</h2>'+tag(active.length+" ativos")+'</div><div class="simple-list">'+(active.length?active.map(goalEntry).join(""):'<p class="note">Nenhum objetivo criado.</p>')+'</div></section>';
if(archived.length)out+='<section class="card"><div class="card-head"><h2>Arquivados</h2>'+tag(archived.length)+'</div><div class="simple-list">'+archived.map(goalEntry).join("")+'</div></section>';
out+='<section class="card"><div class="card-head"><h2>Estatísticas</h2>'+tag("Aguardando dados")+'</div><p class="note">Acompanhamento de carga, constância, execução, estudos, hábitos e fechamento diário será implantado nas etapas 3 e 4. Nenhuma comparação é gerada sem registros suficientes.</p></section>';return out;}
function goalEntry(g){return '<div class="list-entry goal-accent"><div class="list-main"><strong>'+esc(g.title)+'</strong><small>'+esc(g.area||"Objetivo pessoal")+(g.deadline?" · até "+esc(shortDate(g.deadline)):"")+(g.archived?" · arquivado":"")+(state.primaryGoalId===g.id?" · principal":"")+'</small></div><div class="row">'+(!g.archived&&state.primaryGoalId!==g.id?'<button class="btn small ghost" data-action="makePrimary" data-id="'+attr(g.id)+'">Principal</button>':"")+'<button class="btn small ghost" data-action="editGoal" data-id="'+attr(g.id)+'">Editar</button><button class="btn small ghost" data-action="duplicateGoal" data-id="'+attr(g.id)+'">Copiar</button><button class="btn small ghost" data-action="'+(g.archived?"restoreGoal":"archiveGoal")+'" data-id="'+attr(g.id)+'">'+(g.archived?"Reativar":"Arquivar")+'</button><button class="btn small danger" data-action="deleteGoal" data-id="'+attr(g.id)+'" aria-label="Excluir objetivo">Excluir</button></div></div>';}
function renderAvailability(){
let out='<section class="hero-row"><div><div class="overline">BASE DO PLANEJAMENTO</div><h1>Minha disponibilidade</h1><p class="kicker">Defina as horas ou faixas livres de cada dia. O restante parte desta informação.</p></div>'+btn("+ Exceção por data","newException","small")+'</section>';
out+='<div class="grid-2">';
const order=Array.from({length:7},(_,i)=>(Number(state.settings.weekStart||0)+i)%7);
order.forEach(i=>{const a=state.availability.weekly[i];out+='<section class="card"><div class="row-between"><div><div class="overline">'+esc(DAYS[i])+'</div><h2 style="margin:7px 0 0;font-size:18px">'+esc(availabilityText(a))+'</h2></div>'+btn(a?"Editar":"+ Definir","editAvailDay","small", 'data-day="'+i+'"')+'</div>'+(a&&a.mode==="slots"?'<p class="note">'+a.slots.map(s=>esc(s.start)+"–"+esc(s.end)).join(" · ")+'</p>':"")+'</section>';});
out+='</div>';
const overrides=Object.entries(state.availability.overrides).sort((a,b)=>a[0].localeCompare(b[0]));
out+='<section class="card"><div class="card-head"><h2>Datas excepcionais</h2>'+tag(overrides.length+" alterações")+'</div>'+(overrides.length?'<div class="simple-list">'+overrides.map(([d,a])=>'<div class="list-entry"><div class="list-main"><strong>'+esc(dateLabel(d,true))+'</strong><small>'+esc(availabilityText(a))+'</small></div><div class="row"><button class="btn small ghost" data-action="editException" data-date="'+d+'">Editar</button><button class="btn small danger" data-action="removeException" data-date="'+d+'">Excluir</button></div></div>').join("")+'</div>':'<p class="note">Nenhuma exceção cadastrada.</p>')+'</section>';
out+='<p class="note">Os horários são informados por você. Esta etapa não cria automaticamente tarefas, rotinas ou metas.</p>';
return out;}
function renderSettings(){return '<div><div class="overline">PERSONALIZAÇÃO</div><h1 style="margin:6px 0;font-size:28px">Preferências</h1><p class="kicker">Somente o necessário. As demais funções serão adicionadas nas próximas etapas.</p></div><section class="card"><div class="setting-row"><div><strong>Tema</strong><small>Escolha entre aparência escura e clara.</small></div><select id="setting-theme" aria-label="Tema"><option value="dark" '+(state.settings.theme==="dark"?"selected":"")+'>Escuro</option><option value="light" '+(state.settings.theme==="light"?"selected":"")+'>Claro</option></select></div><div class="setting-row"><div><strong>Efeitos de movimento</strong><small>Fundo animado e luz que acompanha o cursor.</small></div><select id="setting-motion" aria-label="Movimento"><option value="yes" '+(state.settings.motion!==false?"selected":"")+'>Ativado</option><option value="no" '+(state.settings.motion===false?"selected":"")+'>Desativado</option></select></div><div class="setting-row"><div><strong>Primeiro dia da semana</strong><small>Personalize a visualização do calendário.</small></div><select id="setting-weekstart" aria-label="Início da semana"><option value="0" '+(Number(state.settings.weekStart)===0?"selected":"")+'>Domingo</option><option value="1" '+(Number(state.settings.weekStart)===1?"selected":"")+'>Segunda</option><option value="6" '+(Number(state.settings.weekStart)===6?"selected":"")+'>Sábado</option></select></div></section><section class="card"><h2 class="section-title">Armazenamento</h2><p class="note">Nesta etapa os dados ficam somente neste dispositivo. Login, backup e sincronização serão implementados na etapa 5. Não apague os dados do navegador sem ter uma cópia.</p><div class="row">'+btn("Ver disponibilidade","openAvailability","small")+btn("Ver objetivos","openProfile","small ghost")+'</div></section>';}
function openModal(title,body,footer){modalReturnFocus=document.activeElement;const host=$("modal-host");host.innerHTML='<div class="modal-layer"><div role="dialog" aria-modal="true" aria-labelledby="modal-title" class="modal-card"><div class="modal-head"><h2 id="modal-title">'+esc(title)+'</h2><button class="icon-button" type="button" data-action="closeModal" aria-label="Fechar">×</button></div><div class="modal-body">'+body+'</div>'+(footer?'<div class="modal-footer">'+footer+'</div>':"")+'</div></div>';host.querySelector(".modal-layer").addEventListener("click",(e)=>{if(e.target===e.currentTarget)closeModal();});const first=host.querySelector("input,select,textarea,button");if(first)first.focus();}
function closeModal(){$("modal-host").innerHTML="";if(modalReturnFocus&&modalReturnFocus.isConnected)modalReturnFocus.focus();}
function goalModal(id){const g=state.goals.find(x=>x.id===id)||{};const body='<form id="goal-form" class="section-stack"><input type="hidden" name="id" value="'+attr(g.id||"")+'"><div class="field"><label for="goal-title">Objetivo</label><input required maxlength="130" id="goal-title" name="title" placeholder="Qual é seu objetivo?" value="'+attr(g.title||"")+'"></div><div class="field"><label for="goal-area">Área (opcional)</label><input id="goal-area" name="area" maxlength="60" placeholder="Estudos, pessoal, profissional..." value="'+attr(g.area||"")+'"></div><div class="field"><label for="goal-description">Descrição (opcional)</label><textarea maxlength="900" id="goal-description" name="description" placeholder="O que você pretende alcançar?">'+esc(g.description||"")+'</textarea></div><div class="field"><label for="goal-deadline">Prazo (opcional)</label><input id="goal-deadline" type="date" name="deadline" value="'+attr(g.deadline||"")+'"></div><label class="checkline"><input type="checkbox" name="primary" '+(state.primaryGoalId===g.id?"checked":"")+'> Destacar como objetivo principal</label><div class="modal-footer"><button type="button" data-action="closeModal" class="btn ghost">Cancelar</button><button class="btn primary" type="submit">Salvar objetivo</button></div></form>';
openModal(g.id?"Editar objetivo":"Novo objetivo",body,"");}
function dateModal(){openModal("Escolher data",'<form id="date-form" class="section-stack"><div class="field"><label for="jump-date">Data</label><input id="jump-date" type="date" name="date" min="'+state.firstAccess+'" value="'+state.date+'" required></div><p class="note">Você pode consultar datas desde o seu primeiro acesso.</p><div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Ir para a data</button></div></form>',"");}
function chooseMode(mode){const hours=$("hours-area"),slots=$("slots-area");if(hours)hours.hidden=mode!=="hours"&&mode!=="broad";if(slots)slots.hidden=mode!=="slots";}
function slotRow(start,end){return '<div class="slot-row"><div class="field"><label>Início</label><input type="time" name="slotStart" value="'+attr(start||"08:00")+'" required></div><div class="field"><label>Fim</label><input type="time" name="slotEnd" value="'+attr(end||"12:00")+'" required></div><button class="btn small danger" type="button" data-action="removeSlot" aria-label="Remover intervalo">×</button></div>';}
function availabilityModal(day,date){
const exception=!!date;const a=exception?state.availability.overrides[date]:state.availability.weekly[day];const mode=a?a.mode:"hours";let body='<form id="availability-form" class="section-stack"><input type="hidden" name="day" value="'+(exception?"":day)+'"><input type="hidden" name="exception" value="'+(exception?"yes":"no")+'">';
if(exception)body+='<div class="field"><label>Data da exceção</label><input type="date" name="exceptionDate" min="'+state.firstAccess+'" value="'+attr(date)+'" required></div>';
body+='<div class="field"><span class="label">Como é sua disponibilidade?</span><div class="mode-grid">';
[["hours","Horas livres"],["slots","Faixas de horário"],["broad","Dia amplamente livre"],["rest","Descanso"]].forEach(([key,label])=>{body+='<label class="mode-card"><input type="radio" name="mode" value="'+key+'" '+(mode===key?"checked":"")+'>'+label+'</label>';});
body+='</div></div><div id="hours-area" class="field" '+(mode==="slots"||mode==="rest"?"hidden":"")+'><label>Quantas horas você tem disponíveis?</label><input type="number" name="hours" min="0.25" max="23.75" step="0.25" value="'+attr(a&&a.hours?a.hours:"")+'" placeholder="Ex.: 8"><div class="help">Dia amplamente livre não significa 24 horas de atividades.</div></div>';
body+='<div id="slots-area" class="section-stack" '+(mode!=="slots"?"hidden":"")+'><div class="row-between"><span class="label">Intervalos livres</span><button type="button" class="btn small" data-action="addSlot">+ Intervalo</button></div><div id="slot-list" class="section-stack">'+((a&&a.slots&&a.slots.length?a.slots:[{start:"08:00",end:"12:00"}]).map(s=>slotRow(s.start,s.end)).join(""))+'</div></div>';
if(!exception){
body+='<div class="field"><span class="label">Aplicar também a outros dias (opcional)</span><div class="pill-row">';
DAYS.forEach((d,i)=>{if(i!==day)body+='<label class="checkline" style="margin-right:12px"><input type="checkbox" name="copyDay" value="'+i+'">'+esc(SHORT[i])+'</label>';});
body+='</div></div>';
}
body+='<div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button>'+(!exception&&a?'<button type="button" class="btn danger" data-action="clearAvailDay" data-day="'+day+'">Limpar dia</button>':"")+'<button type="submit" class="btn primary">Salvar disponibilidade</button></div></form>';
openModal(exception?"Exceção por data":DAYS[day],body,"");
}
function exceptionDateModal(){openModal("Adicionar exceção",'<form id="exception-date-form" class="section-stack"><div class="field"><label>Escolha uma data</label><input type="date" name="date" min="'+state.firstAccess+'" value="'+(state.date>=state.firstAccess?state.date:today())+'" required></div><p class="note">A exceção terá prioridade sobre a disponibilidade habitual daquele dia.</p><div class="modal-footer"><button class="btn ghost" type="button" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Continuar</button></div></form>',"");}
function moduleModal(kind){const dictionary={target:["Focos do dia","Compromissos obrigatórios, remanejamentos e histórico serão implementados na etapa 2."],tasks:["Tarefas secundárias","Prioridades, tarefas flexíveis, conclusão e repetição serão implementadas na etapa 2."],habits:["Rotinas e hábitos","Horário-alvo, frequência e pontualidade serão implementados na etapa 2."],folders:["Blocos e pastas","Agrupamentos com cores, cópias e organização serão implementados na etapa 2."],cycles:["Ciclos de estudo","Sessões, matérias, reforços e estudos complementares serão implementados na etapa 3. A disponibilidade será necessária."]};
const [title,message]=dictionary[kind]||["Próxima etapa","Esta função será disponibilizada em uma etapa futura."];
openModal(title,'<p class="note">'+esc(message)+'</p><p class="note">O escopo completo está registrado nos documentos do repositório. Esta função não será marcada como concluída antes de funcionar.</p>',btn("Fechar","closeModal","primary"));}
function confirmModal(title,message,onConfirm){const id="confirm-action";openModal(title,'<p class="note">'+esc(message)+'</p><div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button type="button" class="btn danger" id="'+id+'">Confirmar</button></div>',"");$(id).addEventListener("click",()=>{onConfirm();closeModal();save();render();});}
function handleAction(action,button){const id=button.dataset.id,date=button.dataset.date;
switch(action){
case "closeBackdrop":case "closeModal":closeModal();break;
case "prevDay":updateDate(addDays(state.date,-1));break;
case "nextDay":updateDate(addDays(state.date,1));break;
case "goToday":updateDate(today());break;
case "prevWeek":updateDate(addDays(state.date,-7));break;
case "nextWeek":updateDate(addDays(state.date,7));break;
case "selectDay":updateDate(date);break;
case "jumpDate":dateModal();break;
case "openAvailability":go("disponibilidade");break;
case "openProfile":go("perfil");break;
case "addGoal":goalModal();break;
case "editGoal":goalModal(id);break;
case "duplicateGoal":{const original=state.goals.find(x=>x.id===id);if(original){const copy={...original,id:uid(),title:original.title+" (cópia)",archived:false};state.goals.push(copy);save();render();notify("Objetivo copiado.");}break;}
case "makePrimary":state.primaryGoalId=id;save();render();notify("Objetivo principal atualizado.");break;
case "archiveGoal":{const g=state.goals.find(x=>x.id===id);if(g){g.archived=true;if(state.primaryGoalId===id)state.primaryGoalId=null;save();render();notify("Objetivo arquivado.");}break;}
case "restoreGoal":{const g=state.goals.find(x=>x.id===id);if(g){g.archived=false;save();render();notify("Objetivo reativado.");}break;}
case "deleteGoal":confirmModal("Excluir objetivo","O objetivo será removido deste dispositivo. Esta ação não pode ser desfeita.",()=>{state.goals=state.goals.filter(g=>g.id!==id);if(state.primaryGoalId===id)state.primaryGoalId=null;notify("Objetivo excluído.");});break;
case "editAvailDay":availabilityModal(Number(button.dataset.day),null);break;
case "clearAvailDay":{const d=Number(button.dataset.day);confirmModal("Limpar disponibilidade","O dia voltará ao estado não configurado. Esta ação não remove outras datas.",()=>{state.availability.weekly[d]=null;notify("Disponibilidade limpa.");});break;}
case "editThisAvailability":availabilityModal(null,state.date);break;
case "newException":exceptionDateModal();break;
case "editException":availabilityModal(null,date);break;
case "removeException":confirmModal("Excluir exceção","Esta data voltará a usar a disponibilidade habitual da semana.",()=>{delete state.availability.overrides[date];notify("Exceção excluída.");});break;
case "addSlot":{const list=$("slot-list");if(list&&list.children.length<8)list.insertAdjacentHTML("beforeend",slotRow("13:00","17:00"));else notify("Máximo de 8 intervalos por dia.");break;}
case "removeSlot":{const row=button.closest(".slot-row");if(row&&row.parentElement.children.length>1)row.remove();else notify("Mantenha pelo menos um intervalo.");break;}
case "moduleHelp":moduleModal(button.dataset.module);break;
}}
document.addEventListener("click",(event)=>{const nav=event.target.closest("[data-nav]");if(nav){go(nav.dataset.nav);return;}const act=event.target.closest("[data-action]");if(act)handleAction(act.dataset.action,act);});
document.addEventListener("submit",(event)=>{
if(!event.target.id)return;
event.preventDefault();const form=event.target;const data=new FormData(form);
if(form.id==="goal-form"){
const title=String(data.get("title")||"").trim();if(!title)return notify("Informe o nome do objetivo.");
const id=String(data.get("id")||"")||uid();let g=state.goals.find(x=>x.id===id);
if(!g){g={id,archived:false};state.goals.push(g);}
g.title=title;g.area=String(data.get("area")||"").trim();g.description=String(data.get("description")||"").trim();g.deadline=String(data.get("deadline")||"");
if(data.has("primary")){g.archived=false;state.primaryGoalId=id;}else if(state.primaryGoalId===id)state.primaryGoalId=null;
save();closeModal();render();notify("Objetivo salvo.");return;
}
if(form.id==="date-form"){const date=String(data.get("date")||"");closeModal();updateDate(date);return;}
if(form.id==="exception-date-form"){const date=String(data.get("date")||"");if(date<state.firstAccess)return notify("Data anterior ao primeiro acesso.");closeModal();availabilityModal(null,date);return;}
if(form.id==="availability-form"){
const mode=String(data.get("mode")||"hours");let entry={mode};
if(mode==="hours"||mode==="broad"){
const hours=Number(data.get("hours"));if(!Number.isFinite(hours)||hours<=0||hours>=24)return notify("Informe horas válidas, entre 0,25 e 23,75.");entry.hours=hours;
}else if(mode==="slots"){
const starts=data.getAll("slotStart"),ends=data.getAll("slotEnd"),slots=[];
if(!starts.length)return notify("Adicione um intervalo.");
for(let i=0;i<starts.length;i++){const start=String(starts[i]),end=String(ends[i]);if(!start||!end||toMinutes(end)<=toMinutes(start))return notify("O fim de cada intervalo deve ser posterior ao início.");slots.push({start,end});}
slots.sort((a,b)=>a.start.localeCompare(b.start));for(let i=1;i<slots.length;i++)if(toMinutes(slots[i].start)<toMinutes(slots[i-1].end))return notify("Os intervalos não podem se sobrepor.");
entry.slots=slots;
}
if(data.get("exception")==="yes"){
const date=String(data.get("exceptionDate")||"");if(!date||date<state.firstAccess)return notify("Selecione uma data válida.");
state.availability.overrides[date]=entry;
}else{
const day=Number(data.get("day"));if(day<0||day>6||!Number.isInteger(day))return notify("Dia inválido.");
state.availability.weekly[day]=entry;
data.getAll("copyDay").forEach(i=>{const copy=Number(i);if(copy>=0&&copy<=6)state.availability.weekly[copy]=structuredClone(entry);});
}
save();closeModal();render();notify("Disponibilidade atualizada.");return;
}
});
document.addEventListener("change",(event)=>{
const t=event.target;
if(t.name==="mode"){chooseMode(t.value);return;}
if(t.id==="setting-theme"){state.settings.theme=t.value;save();render();return;}
if(t.id==="setting-motion"){state.settings.motion=t.value==="yes";save();render();return;}
if(t.id==="setting-weekstart"){state.settings.weekStart=Number(t.value);save();render();return;}
});
$("theme-switch").addEventListener("click",()=>{state.settings.theme=state.settings.theme==="dark"?"light":"dark";save();render();});
$("settings-switch").addEventListener("click",()=>go("configuracoes"));
document.addEventListener("keydown",(e)=>{if(e.key==="Escape"&&$("modal-host").innerHTML)closeModal();});
window.addEventListener("hashchange",()=>{const next=location.hash.slice(1);if(PAGES[next]){route=next;render();}});
function glowLoop(){const el=$("cursor-glow");if(!el)return;glowAt.x+=(glowTarget.x-glowAt.x)*.13;glowAt.y+=(glowTarget.y-glowAt.y)*.13;el.style.transform="translate3d("+glowAt.x+"px,"+glowAt.y+"px,0)";glowFrame=requestAnimationFrame(glowLoop);}
if(window.matchMedia&&window.matchMedia("(hover:hover) and (pointer:fine)").matches&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
document.addEventListener("pointermove",(e)=>{if(state.settings.motion===false)return;glowTarget.x=e.clientX-135;glowTarget.y=e.clientY-135;if(!glowIsActive){glowIsActive=true;$("cursor-glow").classList.add("active");if(!glowFrame)glowFrame=requestAnimationFrame(glowLoop);}},{passive:true});
document.addEventListener("pointerleave",()=>{$("cursor-glow").classList.remove("active");});
}
save();render();
})();