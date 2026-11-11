/* Órbita — mural de lembretes: rascunhos sem conclusão nem impacto na carga diária. */
(function(){
"use strict";
const C=window.OrbitaCore,S2=window.OrbitaStage2?.inspect;
if(!C||!S2)throw Error("Órbita: o mural precisa do planejamento inicializado");
const root=C.state;
if(!Array.isArray(root.reminders))root.reminders=[];
const notes=root.reminders;
const E=C.esc,A=C.attr;
const $=id=>document.getElementById(id);
const labels={high:"Alta",medium:"Média",low:"Baixa"};
const rank={high:0,medium:1,low:2};
let opened=false;
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
function sorted(){return [...notes].sort((a,b)=>(rank[a.priority]??1)-(rank[b.priority]??1)||String(b.createdAt).localeCompare(String(a.createdAt)));}
function markup(){
 const list=sorted().map(n=>'<article class="s8-note s8-priority-'+A(n.priority)+'">'+
 '<div class="s8-note-pin" aria-hidden="true">●</div><div class="s8-note-top"><span class="s8-note-priority">'+E(labels[n.priority]||"Média")+'</span><small>'+E(age(n.createdAt))+'</small></div>'+
 '<strong>'+E(n.title)+'</strong>'+(n.description?'<p>'+E(n.description)+'</p>':"")+
 '<div class="s8-note-actions"><button type="button" data-s8="edit" data-id="'+A(n.id)+'">Editar</button><button type="button" data-s8="convert" data-id="'+A(n.id)+'">Planejar ↗</button><button type="button" class="s8-danger" data-s8="remove" data-id="'+A(n.id)+'">Excluir</button></div></article>').join("");
 return '<div class="s8-float" aria-label="Lembretes">'+
 '<button type="button" class="s8-trigger" data-s8="toggle" aria-expanded="'+opened+'" aria-controls="s8-panel" title="Mural de lembretes" aria-label="'+(opened?"Fechar":"Abrir")+' lembretes">'+
 '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h10l3 3v14H7z"/><path d="M17 3v4h3M10 11h7M10 15h5"/><path d="M5 8H3v12h14"/></svg>'+
 (notes.length?'<span class="s8-count">'+notes.length+'</span>':"")+'</button>'+
 (opened?'<section id="s8-panel" class="s8-panel" aria-label="Mural de lembretes"><header class="s8-panel-head"><div><strong>📌 Lembretes</strong><small>Ideias para planejar depois</small></div><button type="button" class="s8-close" data-s8="toggle" aria-label="Fechar lembretes">×</button></header>'+
 '<div class="s8-note-list">'+(list||'<p class="s8-empty">Seu mural está vazio. Guarde aqui ideias e tarefas ainda não planejadas.</p>')+'</div>'+
 '<button type="button" class="btn small primary s8-add" data-s8="new">+ Novo lembrete</button></section>':"")+'</div>';
}
function redraw(){C.render();}
function edit(idValue){
 const n=idValue?note(idValue):null;
 if(idValue&&!n)return C.notify("Lembrete não encontrado.");
 C.openModal(n?"Editar lembrete":"Novo lembrete",'<form id="s8-note-form" class="section-stack">'+
 '<input type="hidden" name="id" value="'+A(n?.id||"")+'">'+
 '<div class="field"><label>Título</label><input name="title" maxlength="140" required value="'+A(n?.title||"")+'" placeholder="O que você quer lembrar?"></div>'+
 '<div class="field"><label>Observações (opcional)</label><textarea name="description" maxlength="1200" rows="3" placeholder="Detalhes para organizar depois">'+E(n?.description||"")+'</textarea></div>'+
 '<div class="field"><label>Prioridade</label><select name="priority">'+Object.entries(labels).map(([key,value])=>'<option value="'+key+'" '+((n?.priority||"medium")===key?"selected":"")+'>'+value+'</option>').join("")+'</select></div>'+
 '<p class="note">Lembretes não possuem conclusão ou data obrigatória. Ficam aqui até você excluir ou transformar em uma atividade.</p>'+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button type="submit" class="btn primary">Salvar lembrete</button></div></form>');
}
function saveNote(data){
 const title=String(data.get("title")||"").trim().slice(0,140);
 const description=String(data.get("description")||"").trim().slice(0,1200);
 const priority=String(data.get("priority")||"medium");
 if(!title)throw Error("Informe o título do lembrete.");
 if(!Object.hasOwn(labels,priority))throw Error("Prioridade inválida.");
 const existing=note(String(data.get("id")||""));
 if(existing)Object.assign(existing,{title,description,priority,updatedAt:new Date().toISOString()});
 else notes.push({id:id(),title,description,priority,createdAt:new Date().toISOString()});
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
  if(action==="toggle"){opened=!opened;redraw();}
  else if(action==="new")edit();
  else if(action==="edit")edit(b.dataset.id);
  else if(action==="remove")remove(b.dataset.id);
  else if(action==="convert")convert(b.dataset.id);
 }catch(err){C.notify(err.message||"Não foi possível executar a ação.");}
});
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
window.OrbitaStage8={decorate(route,base){return route==="inicio"?base+markup():base},inspect:{get notes(){return notes},saveNote,remove,convertSubmit,age,sorted}};
C.render();
})();
