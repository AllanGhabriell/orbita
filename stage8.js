/* Órbita — mural de lembretes: rascunhos sem conclusão nem impacto na carga diária. */
(function(){
"use strict";
const C=window.OrbitaCore,S2=window.OrbitaStage2?.inspect,S3=window.OrbitaStage3?.inspect;
if(!C||!S2)throw Error("Órbita: o mural precisa do planejamento inicializado");
const root=C.state;
if(!Array.isArray(root.reminders))root.reminders=[];
const notes=root.reminders;
const E=C.esc,A=C.attr;
const $=id=>document.getElementById(id);
const labels={high:"Alta",medium:"Média",low:"Baixa"};
const rank={high:0,medium:1,low:2};
let opened=false,drag=null,skipClickUntil=0,highlightIds=[];
const defaults={x:null,y:null,width:340,height:430,locked:false};
if(!root.reminderUi||typeof root.reminderUi!=="object")root.reminderUi={...defaults};
const ui=root.reminderUi;
for(const [key,value] of Object.entries(defaults))if(ui[key]===undefined)ui[key]=value;
const clamp=(v,low,high)=>Math.min(Math.max(v,low),high);
function bounds(){
 const width=window.innerWidth||document.documentElement?.clientWidth||1024;
 const height=window.innerHeight||document.documentElement?.clientHeight||768;
 const bottom=width<=760?82:10;
 return {width,height,bottom};
}
function position(){
 const {width,height,bottom}=bounds(),size=width<=760?46:49;
 ui.x=clamp(Number.isFinite(ui.x)?ui.x:width-size-22,8,Math.max(8,width-size-8));
 ui.y=clamp(Number.isFinite(ui.y)?ui.y:height-size-bottom-20,8,Math.max(8,height-size-bottom));
 return {size,width,height,bottom};
}
function panelRect(){
 const b=position(),margin=10;
 const w=clamp(Number(ui.width)||340,Math.min(230,b.width-20),Math.max(230,b.width-20));
 const h=clamp(Number(ui.height)||430,Math.min(170,b.height-32),Math.max(170,b.height-32));
 // Preferir abrir acima do botão, mas alternar para baixo quando falta espaço.
 const top=b.height-(ui.y+b.size)>=h+16?ui.y+b.size+10:ui.y>=h+16?ui.y-h-10:clamp(ui.y+((b.height-ui.y)>ui.y?b.size+10:-h-10),8,Math.max(8,b.height-h-8));
 const left=clamp(ui.x+b.size-w,8,Math.max(8,b.width-w-8));
 return {width:w,height:h,left,top:clamp(top,8,Math.max(8,b.height-h-8))};
}
function place(){
 const floater=$("s8-floating-root");if(!floater)return;
 const b=position();
 floater.style.left=ui.x+"px";floater.style.top=ui.y+"px";
 const panel=$("s8-panel");if(panel){
  const rect=panelRect();
  panel.style.left=rect.left+"px";panel.style.top=rect.top+"px";panel.style.width=rect.width+"px";panel.style.height=rect.height+"px";
 }
}
function toggleLock(){ui.locked=!ui.locked;C.save();redraw();C.notify(ui.locked?"Posição e tamanho travados.":"Agora você pode mover e redimensionar o mural.");}
function resetLayout(){const b=bounds();ui.x=b.width-(b.width<=760?46:49)-18;ui.y=b.height-(b.width<=760?46:49)-b.bottom-18;ui.width=340;ui.height=430;C.save();redraw();}
function pointerStart(ev){
 const target=ev.target.closest?.('[data-s8="toggle"],[data-s8="resize"]');
 if(!target||ui.locked||ev.button!==undefined&&ev.button!==0)return;
 const kind=target.dataset.s8==="resize"?"resize":"move",p=panelRect();
 drag={id:ev.pointerId,kind,startX:ev.clientX,startY:ev.clientY,x:ui.x,y:ui.y,w:p.width,h:p.height,moved:false};
 // Evitar capturar clique: só considerar arrasto depois de 7 px.
}
function pointerMove(ev){
 if(!drag||ev.pointerId!==drag.id)return;
 const dx=ev.clientX-drag.startX,dy=ev.clientY-drag.startY;
 if(!drag.moved&&Math.hypot(dx,dy)<7)return;
 drag.moved=true;ev.preventDefault?.();
 const b=bounds();
 if(drag.kind==="move"){
  const size=b.width<=760?46:49;
  ui.x=clamp(drag.x+dx,8,Math.max(8,b.width-size-8));
  ui.y=clamp(drag.y+dy,8,Math.max(8,b.height-size-b.bottom));
 }else{
  ui.width=clamp(drag.w+dx,Math.min(230,b.width-20),Math.max(230,b.width-20));
  ui.height=clamp(drag.h+dy,Math.min(170,b.height-32),Math.max(170,b.height-32));
 }
 place();
}
function pointerEnd(ev){
 if(!drag||ev.pointerId!==drag.id)return;
 if(drag.moved){skipClickUntil=Date.now()+600;C.save();}
 drag=null;
}

const note=id=>notes.find(x=>x.id===id);
const id=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():"rem-"+Date.now()+"-"+Math.random().toString(36).slice(2);
function age(created){
 const elapsed=Math.max(0,Date.now()-new Date(created).getTime());
 const days=Math.floor(elapsed/86400000);
 if(!Number.isFinite(days)||days<=0)return "Adicionado hoje";
 if(days===1)return "Há 1 dia";
 if(days<7)return "Há "+days+" dias";
 if(days<30){const weeks=Math.floor(days/7);return "Há "+weeks+(weeks===1?" semana":" semanas");}
 const months=Math.floor(days/30);return "Há "+months+(months===1?" mês":" meses");
}
const icons={pin:"📌",bookmark:"🔖",alert:"❗",idea:"💡"};
function encodedTarget(n){const l=n?.link;if(!l)return "none";return [l.scope,encodeURIComponent(l.id||""),encodeURIComponent(l.date||"")].join("|");}
function targets(selected){
 const sessions=(S3?.model?.sessions||[]).filter(x=>!x.archived&&x.status!=="done");
 const entries=(S2?.model?.entries||[]).filter(x=>(x.type==="focus"||x.type==="task")&&!x.archivedAt);
 const cycles=(S3?.model?.cycles||[]).filter(x=>!x.archived);
 const disciplines=[...new Set(sessions.map(x=>String(x.discipline||"").trim()).filter(x=>x&&x!=="Próxima matéria do ciclo"))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
 const options=[["none","Sem vínculo · apenas no mural"],
  ...sessions.map(x=>["session|"+encodeURIComponent(x.id)+"|","Sessão · "+(x.discipline||"Estudo")+" · "+x.date+(x.topic?" · "+x.topic:"")]),
  ...entries.map(x=>["entry|"+encodeURIComponent(x.id)+"|"+encodeURIComponent(x.date),"Atividade · "+x.title+" · "+x.date]),
  ...disciplines.map(x=>["discipline|"+encodeURIComponent(x)+"|","Matéria · "+x]),
  ...cycles.map(x=>["cycle|"+encodeURIComponent(x.id)+"|","Ciclo · "+x.title])
 ];
 if(selected!=="none"&&!options.some(x=>x[0]===selected))options.push([selected,"Vínculo anterior (consultar)"]);
 return options.map(([v,label])=>'<option value="'+A(v)+'" '+(selected===v?"selected":"")+'>'+E(label)+'</option>').join("");
}
function parseTarget(value){
 if(!value||value==="none")return null;
 const [scope,encodedId,encodedDate=""]=String(value).split("|");
 if(!["session","entry","discipline","cycle"].includes(scope))throw Error("Tipo de vínculo inválido.");
 const id=decodeURIComponent(encodedId||""),date=decodeURIComponent(encodedDate);
 if(!id)throw Error("Escolha o vínculo.");
 return {scope,id,...(scope==="entry"?{date}:{})};
}
function complete(link){
 if(!link)return false;
 if(link.scope==="session"){
  const x=S3?.model?.sessions?.find(x=>x.id===link.id);
  return !x||x.archived||x.status==="done";
 }
 if(link.scope==="entry"){
  const p=S2?.model,entry=p?.entries?.find(x=>x.id===link.id);
  if(!entry||entry.archivedAt)return true;
  const actual=p.records?.[link.id+"@"+link.date]?.status||"pending";
  return actual==="done";
 }
 return false;
}
function prune(){
 let touched=false;
 for(const n of notes)if(n.link&&complete(n.link)){n.link=null;touched=true;}
 if(touched)C.save();
}
function matches(n,ctx){
 const l=n.link;
 if(!l||complete(l)||ctx.status==="done")return false;
 if(l.scope==="session")return ctx.kind==="session"&&ctx.id===l.id;
 if(l.scope==="entry")return ctx.kind==="entry"&&ctx.id===l.id&&ctx.date===l.date;
 if(ctx.kind!=="session")return false;
 return l.scope==="discipline"&&ctx.discipline===l.id||l.scope==="cycle"&&ctx.cycleId===l.id;
}
function indicators(ctx){
 const linked=notes.filter(n=>matches(n,ctx));
 if(!linked.length)return "";
 const symbol=linked.length===1?icons[linked[0].icon]||icons.pin:icons.pin;
 return '<button type="button" class="s8-linked-pin" data-s8="jump" data-note-ids="'+A(linked.map(x=>x.id).join(","))+'" title="'+A(linked.length+" lembrete(s) vinculado(s). Abrir no mural.")+'" aria-label="Abrir '+linked.length+' lembrete(s) vinculado(s)">'+symbol+(linked.length>1?'<span>'+linked.length+'</span>':"")+'</button>';
}
function sorted(){return [...notes].sort((a,b)=>(rank[a.priority]??1)-(rank[b.priority]??1)||String(b.createdAt).localeCompare(String(a.createdAt)));}
function markup(){
 const list=sorted().map(n=>'<article id="s8-note-'+A(n.id)+'" class="s8-note s8-priority-'+A(n.priority)+(highlightIds.includes(n.id)?' s8-highlight':'')+'" title="'+A(n.description||n.title)+'">'+
 '<div class="s8-note-pin" aria-hidden="true">●</div><div class="s8-note-top"><span class="s8-note-priority">'+E(labels[n.priority]||"Média")+'</span><small>'+E(age(n.createdAt))+'</small></div>'+
 '<strong>'+E(n.title)+'</strong>'+(n.link?'<small class="s8-link-label">⌁ '+E(n.link.scope==="session"?"Sessão específica":n.link.scope==="entry"?"Atividade específica":n.link.scope==="discipline"?"Matéria: "+n.link.id:"Ciclo de estudos")+'</small>':"")+(n.description?'<details class="s8-note-details"><summary>Ver observação</summary><p>'+E(n.description)+'</p></details><div class="s8-note-hover" role="tooltip">'+E(n.description)+'</div>':"")+
 '<div class="s8-note-actions"><button type="button" data-s8="edit" data-id="'+A(n.id)+'">Editar</button><button type="button" data-s8="convert" data-id="'+A(n.id)+'">Planejar ↗</button><button type="button" class="s8-danger" data-s8="remove" data-id="'+A(n.id)+'">Excluir</button></div></article>').join("");
 return '<div id="s8-floating-root" class="s8-float" aria-label="Lembretes">'+
 '<button type="button" class="s8-trigger" data-s8="toggle" aria-expanded="'+opened+'" aria-controls="s8-panel" title="Mural de lembretes" aria-label="'+(opened?"Fechar":"Abrir")+' lembretes">'+
 '<svg width="27" height="27" viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M5 7h18v17H5z" fill="#f4e5ad" stroke="#aa9860" stroke-width="1.5"/><path d="M7 11h14M7 15h14M7 19h10" stroke="#b4a675" stroke-width="1.3" stroke-linecap="round"/><path d="m15 4 4 5" stroke="#a44950" stroke-width="2.5" stroke-linecap="round"/><circle cx="14" cy="5" r="4" fill="#d96874" stroke="#a44950" stroke-width="1"/><circle cx="13" cy="4" r="1.1" fill="#ffe2e5"/></svg>'+
 (notes.length?'<span class="s8-count">'+notes.length+'</span>':"")+'</button>'+
 (opened?'<section id="s8-panel" class="s8-panel" aria-label="Mural de lembretes"><header class="s8-panel-head"><div><strong>📌 Lembretes</strong><small>Ideias para planejar depois</small></div><button type="button" class="s8-close" data-s8="toggle" aria-label="Fechar lembretes">×</button></header>'+
 '<div class="s8-panel-options"><button type="button" class="s8-option" data-s8="lock" aria-pressed="'+!!ui.locked+'" title="'+(ui.locked?"Destravar tamanho e posição":"Travar tamanho e posição")+'">'+(ui.locked?"🔒 Travado":"🔓 Travar")+'</button><button type="button" class="s8-option" data-s8="reset">Redefinir posição</button></div>'+
 '<div class="s8-note-list">'+(list||'<p class="s8-empty">Seu mural está vazio. Guarde aqui ideias e tarefas ainda não planejadas.</p>')+'</div>'+
 '<button type="button" class="btn small primary s8-add" data-s8="new">+ Novo lembrete</button>'+
 (!ui.locked?'<div class="s8-resize-handle" data-s8="resize" role="separator" aria-label="Arraste para ajustar largura e altura do mural" title="Arraste para redimensionar">◢</div>':"")+'</section>':"")+'</div>';
}
function redraw(){C.render();}
function jump(raw){
 highlightIds=String(raw||"").split(",").filter(id=>notes.some(n=>n.id===id));
 if(!highlightIds.length)return;
 opened=true;C.render();
 const element=$("s8-note-"+highlightIds[0]);
 element?.scrollIntoView?.({behavior:"smooth",block:"nearest"});
}
function edit(idValue){
 const n=idValue?note(idValue):null;
 if(idValue&&!n)return C.notify("Lembrete não encontrado.");
 C.openModal(n?"Editar lembrete":"Novo lembrete",'<form id="s8-note-form" class="section-stack">'+
 '<input type="hidden" name="id" value="'+A(n?.id||"")+'">'+
 '<div class="field"><label>Título</label><input name="title" maxlength="140" required value="'+A(n?.title||"")+'" placeholder="O que você quer lembrar?"></div>'+
 '<div class="field"><label>Observações (opcional)</label><textarea name="description" maxlength="1200" rows="3" placeholder="Detalhes para organizar depois">'+E(n?.description||"")+'</textarea></div>'+
 '<div class="field"><label>Prioridade</label><select name="priority">'+Object.entries(labels).map(([key,value])=>'<option value="'+key+'" '+((n?.priority||"medium")===key?"selected":"")+'>'+value+'</option>').join("")+'</select></div>'+
 '<div class="field"><label>Ícone quando vinculado</label><select name="icon">'+Object.entries(icons).map(([key,value])=>'<option value="'+key+'" '+((n?.icon||"pin")===key?"selected":"")+'>'+value+" "+({pin:"Alfinete",bookmark:"Continuidade",alert:"Importante",idea:"Ideia"}[key])+'</option>').join("")+'</select></div>'+
 '<div class="field"><label>Vincular a (opcional)</label><select name="target">'+targets(encodedTarget(n))+'</select><small>Vínculos específicos desaparecem ao concluir a atividade. Matérias e ciclos continuam disponíveis.</small></div>'+
 '<p class="note">Lembretes não possuem conclusão ou data obrigatória. Ficam aqui até você excluir ou transformar em uma atividade.</p>'+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button type="submit" class="btn primary">Salvar lembrete</button></div></form>');
}
function saveNote(data){
 const title=String(data.get("title")||"").trim().slice(0,140);
 const description=String(data.get("description")||"").trim().slice(0,1200);
 const priority=String(data.get("priority")||"medium");
 const icon=String(data.get("icon")||"pin"),link=parseTarget(data.get("target"));
 if(!Object.hasOwn(icons,icon))throw Error("Ícone inválido.");
 if(link&&complete(link))throw Error("A atividade já foi concluída ou removida. Escolha outra.");
 if(!title)throw Error("Informe o título do lembrete.");
 if(!Object.hasOwn(labels,priority))throw Error("Prioridade inválida.");
 const existing=note(String(data.get("id")||""));
 if(existing)Object.assign(existing,{title,description,priority,icon,link,updatedAt:new Date().toISOString()});
 else notes.push({id:id(),title,description,priority,icon,link,createdAt:new Date().toISOString()});
 C.save();C.closeModal();redraw();C.notify(existing?"Lembrete atualizado.":"Lembrete adicionado.");
}
function remove(idValue){
 const n=note(idValue);if(!n)return;
 if(!window.confirm("Excluir o lembrete “"+n.title+"”?"))return;
 notes.splice(notes.indexOf(n),1);
 C.save();redraw();C.notify("Lembrete excluído.");
}
function convert(idValue){
 const n=note(idValue);if(!n)return C.notify("Lembrete não encontrado.");
 if(!C.availabilityReady())return C.notify("Configure a disponibilidade antes de planejar uma atividade.");
 const date=C.today()>C.state.firstAccess?C.today():C.state.firstAccess;
 C.openModal("Transformar em atividade",'<form id="s8-convert-form" class="section-stack"><input type="hidden" name="id" value="'+A(n.id)+'">'+
 '<p class="note">Crie um foco do dia ou uma tarefa secundária. O lembrete será removido somente após salvar a atividade.</p>'+
 '<div class="field"><label>Transformar em</label><select name="type"><option value="task">Tarefa secundária</option><option value="focus">Foco do dia</option></select></div>'+
 '<div class="field"><label>Atividade</label><input name="title" required maxlength="140" value="'+A(n.title)+'"></div>'+
 '<div class="field"><label>Data</label><input type="date" name="date" required min="'+A(C.state.firstAccess)+'" value="'+A(date)+'"></div>'+
 '<div class="field"><label>Prioridade (para tarefas secundárias)</label><select name="priority">'+Object.entries(labels).map(([k,v])=>'<option value="'+k+'" '+(n.priority===k?"selected":"")+'>'+v+'</option>').join("")+'</select></div>'+
 '<div class="field"><label>Horário (opcional)</label><input type="time" name="startTime"></div>'+
 '<div class="field"><label>Duração estimada em minutos (opcional)</label><input type="number" name="estimatedMin" min="1" max="1440"></div>'+
 (n.description?'<p class="note">Observação original: '+E(n.description)+'</p>':"")+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button type="submit" class="btn primary">Criar atividade</button></div></form>');
}
function convertSubmit(data){
 const n=note(String(data.get("id")||""));if(!n)throw Error("Lembrete não encontrado.");
 const type=String(data.get("type")||"");
 if(!["focus","task"].includes(type))throw Error("Selecione um tipo de atividade.");
 const title=String(data.get("title")||"").trim();
 if(!title||title.length>140)throw Error("Informe um título válido.");
 const date=String(data.get("date")||"");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<C.state.firstAccess||C.iso(C.parse(date))!==date)throw Error("Data inválida.");
 if(C.state.evolution?.closed?.[date]||S2.model.closedDays?.includes(date))throw Error("O dia escolhido já foi finalizado.");
 const priority=String(data.get("priority")||"medium");
 if(!Object.hasOwn(labels,priority))throw Error("Prioridade inválida.");
 const values={type,title,date,editDate:date,priority,startTime:String(data.get("startTime")||""),estimatedMin:String(data.get("estimatedMin")||""),repeat:"none"};
 const form={get:key=>values[key]??null,has:key=>Object.hasOwn(values,key),getAll:key=>values[key]==null?[]:[values[key]]};
 const previous=S2.model.entries.length;
 S2.submission("s2-entry",form);
 if(S2.model.entries.length!==previous+1)throw Error("Não foi possível criar a atividade; o lembrete foi preservado.");
 const created=S2.model.entries.at(-1);
 if(n.description)created.reminderDescription=n.description;
 created.reminderSourceId=n.id;
 notes.splice(notes.indexOf(n),1);
 opened=false;C.save();redraw();C.notify("Lembrete transformado em "+(type==="focus"?"foco do dia.":"tarefa secundária."));
}
document.addEventListener("click",ev=>{
 const b=ev.target.closest?.("[data-s8]");if(!b)return;
 ev.preventDefault();
 const action=b.dataset.s8;
 try{
  if(action==="toggle"){if(Date.now()<skipClickUntil){ev.stopPropagation?.();return;}opened=!opened;if(!opened)highlightIds=[];redraw();}
  else if(action==="new")edit();
  else if(action==="lock")toggleLock();
  else if(action==="reset")resetLayout();
  else if(action==="edit")edit(b.dataset.id);
  else if(action==="remove")remove(b.dataset.id);
  else if(action==="convert")convert(b.dataset.id);
  else if(action==="jump")jump(b.dataset.noteIds);
 }catch(err){C.notify(err.message||"Não foi possível executar a ação.");}
});
document.addEventListener("pointerdown",pointerStart);
document.addEventListener("pointermove",pointerMove,{passive:false});
document.addEventListener("pointerup",pointerEnd);
document.addEventListener("pointercancel",pointerEnd);
window.addEventListener?.("resize",()=>{if($("s8-floating-root"))place();});
document.addEventListener("submit",ev=>{
 const formId=ev.target?.getAttribute?.("id")||ev.target?.id;
 if(!["s8-note-form","s8-convert-form"].includes(formId))return;
 ev.preventDefault();
 try{
  const data=new FormData(ev.target);
  if(formId==="s8-note-form")saveNote(data);
  else convertSubmit(data);
 }catch(err){C.notify(err.message||"Verifique os dados informados.");}
});
document.addEventListener("keydown",ev=>{if(ev.key==="Escape"&&opened){opened=false;redraw();}});
window.OrbitaStage8={decorate(route,base){if(route==="inicio"){prune();return base+markup();}return base},indicatorFor:indicators,afterRender(route){
 const incoming=document.querySelector?.('#view #s8-floating-root');
 const detached=document.querySelectorAll?.('body > #s8-floating-root')||[];
 if(route!=="inicio"){for(const node of detached)node.remove?.();return;}
 if(incoming&&document.body?.appendChild){
  for(const node of detached)if(node!==incoming)node.remove?.();
  document.body.appendChild(incoming);
 }
 place();
},inspect:{get notes(){return notes},get layout(){return ui},saveNote,remove,convertSubmit,age,sorted,panelRect,position,toggleLock,resetLayout,indicators,prune,jump,parseTarget}};
C.render();
})();
