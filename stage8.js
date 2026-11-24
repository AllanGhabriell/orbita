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
let opened=false,drag=null,skipClickUntil=0,highlightIds=[],selecting=false,selectedNotes=new Set();
const defaults={x:null,y:null,width:340,height:430,locked:false,zoom:100,keepOpen:false,filter:"all",panelX:null,panelY:null};
if(!root.reminderUi||typeof root.reminderUi!=="object")root.reminderUi={...defaults};
const ui=root.reminderUi;
 opened=ui.keepOpen===true;
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
 return {width:w,height:h,left:clamp(Number.isFinite(ui.panelX)?ui.panelX:left,8,Math.max(8,b.width-w-8)),top:clamp(Number.isFinite(ui.panelY)?ui.panelY:top,8,Math.max(8,b.height-h-8))};
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
function resetLayout(){const b=bounds();ui.x=b.width-(b.width<=760?46:49)-18;ui.y=b.height-(b.width<=760?46:49)-b.bottom-18;ui.width=340;ui.height=430;ui.panelX=null;ui.panelY=null;ui.zoom=100;C.save();redraw();}
function pointerStart(ev){
 const target=ev.target.closest?.('[data-s8="toggle"],[data-s8="resize"],[data-s8="movePanel"]');
 if(!target||ui.locked||ev.button!==undefined&&ev.button!==0)return;
 const kind=target.dataset.s8==="resize"?"resize":target.dataset.s8==="movePanel"?"panel":"move",p=panelRect();
 drag={id:ev.pointerId,kind,startX:ev.clientX,startY:ev.clientY,x:ui.x,y:ui.y,w:p.width,h:p.height,left:p.left,top:p.top,moved:false};
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
 }else if(drag.kind==="panel"){
  ui.panelX=clamp(drag.left+dx,8,Math.max(8,b.width-drag.w-8));ui.panelY=clamp(drag.top+dy,8,Math.max(8,b.height-drag.h-8));
 }else{
  ui.panelX=drag.left;ui.panelY=drag.top;
  ui.width=clamp(drag.w+dx,Math.min(230,b.width-20),Math.max(230,b.width-drag.left-8));
  ui.height=clamp(drag.h+dy,Math.min(170,b.height-32),Math.max(170,b.height-drag.top-8));
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
function encodedTarget(n){
 const l=n?.link;if(!l)return "none";
 return [l.scope,encodeURIComponent(l.id||""),encodeURIComponent(l.scope==="next"?l.cycleId||"":l.date||"")].join("|");
}
const scopeLabel={none:"Somente no mural",today:"Atividade do dia exibido",future:"Sessão ou atividade futura",next:"Próxima sessão de uma matéria",discipline:"Todas as sessões de uma matéria",cycle:"Todas as sessões de um ciclo",legacy:"Vínculo já existente"};
function initialScope(n){
 const l=n?.link;
 if(!l)return "none";
 if(l.scope==="next")return "next";
 if(l.scope==="discipline")return "discipline";
 if(l.scope==="cycle")return "cycle";
 if(l.scope==="session"){const x=S3?.model?.sessions?.find(x=>x.id===l.id);return x?.date===C.state.date?"today":"future";}
 if(l.scope==="entry")return l.date===C.state.date?"today":"future";
 return "legacy";
}
function subjectChoices(){
 const cycles=S3?.model?.cycles||[],subjects=(S3?.model?.subjects||[]).filter(x=>!x.archived);
 const available=subjects.map(x=>({value:"next|"+encodeURIComponent(x.id)+"|"+encodeURIComponent(x.cycleId||""),label:x.title+" · "+(cycles.find(c=>c.id===x.cycleId)?.title||"Sem ciclo")}));
 const known=new Set(subjects.map(x=>String(x.title||"").toLocaleLowerCase("pt-BR")));
 for(const x of S3?.model?.sessions||[]){
  const title=String(x.discipline||"").trim();
  if(!title||known.has(title.toLocaleLowerCase("pt-BR")))continue;
  known.add(title.toLocaleLowerCase("pt-BR"));
  available.push({value:"next|"+encodeURIComponent(title)+"|",label:title+" · sessão independente"});
 }
 return available.sort((a,b)=>a.label.localeCompare(b.label,"pt-BR"));
}
function targetRows(scope,dateFilter){
 const date=scope==="today"?C.state.date:(dateFilter||C.today());
 const allSessions=(S3?.model?.sessions||[]).filter(x=>!x.archived&&x.status!=="done");
 const validEntry=x=>(x.type==="focus"||x.type==="task"||x.type==="habit")&&!x.archivedAt&&x.status!=="done";
 if(scope==="today"||scope==="future"){
  const sessions=allSessions.filter(x=>x.date===date);
  // Usar as ocorrências do planejamento, inclusive recorrentes, sem listar
  // cada "Matemática 1, Matemática 2" de todos os dias de uma vez.
  const entries=(S2?.allOn?.(date)||(S2?.model?.entries||[]).filter(x=>x.date===date)).filter(validEntry);
  return [...sessions.map(x=>({value:"session|"+encodeURIComponent(x.id)+"|",label:"Sessão · "+(x.discipline||"Estudo")+(x.topic?" · "+x.topic:"")})),...entries.map(x=>({value:"entry|"+encodeURIComponent(x.id)+"|"+encodeURIComponent(date),label:(x.type==="focus"?"Foco":x.type==="habit"?"Rotina":"Tarefa")+" · "+x.title}))].sort((a,b)=>a.label.localeCompare(b.label,"pt-BR"));
 }
 if(scope==="next")return subjectChoices();
 if(scope==="discipline"){
  const values=new Set([...(S3?.model?.subjects||[]).map(x=>x.title),...allSessions.map(x=>x.discipline)].filter(Boolean));
  return [...values].sort((a,b)=>a.localeCompare(b,"pt-BR")).map(x=>({value:"discipline|"+encodeURIComponent(x)+"|",label:x}));
 }
 if(scope==="cycle")return (S3?.model?.cycles||[]).filter(x=>!x.archived).map(x=>({value:"cycle|"+encodeURIComponent(x.id)+"|",label:x.title}));
 return [];
}
function targets(selected,scope,dateFilter,query=""){
 const rows=targetRows(scope,dateFilter);
 const filter=String(query||"").trim().toLocaleLowerCase("pt-BR");
 const visible=filter?rows.filter(x=>x.label.toLocaleLowerCase("pt-BR").includes(filter)):rows;
 if(selected&&selected!=="none"&&!visible.some(x=>x.value===selected))visible.unshift({value:selected,label:describeEncodedLink(selected)||"Vínculo atual (preservado)"});
 if(!visible.length)return '<option value="">Nenhuma atividade encontrada</option>';
 return '<option value="">Escolha uma opção</option>'+visible.map(x=>'<option value="'+A(x.value)+'" '+(x.value===selected?"selected":"")+'>'+E(x.label)+'</option>').join("");
}
function describeEncodedLink(value){
 try{return linkLabel(parseTarget(value));}catch{return "";}
}
function linkLabel(link){
 if(!link)return "";
 if(link.scope==="session"){const x=S3?.model?.sessions?.find(x=>x.id===link.id);return x?"Sessão · "+(x.discipline||"Estudo")+" · "+x.date+(x.topic?" · "+x.topic:""):"Sessão indisponível";}
 if(link.scope==="entry"){const x=(S2?.allOn?.(link.date)||(S2?.model?.entries||[]).filter(x=>x.date===link.date)).find(x=>x.id===link.id);return x?(x.type==="focus"?"Foco":x.type==="habit"?"Rotina":"Tarefa")+" · "+x.title+" · "+link.date:"Atividade indisponível";}
 if(link.scope==="next"){const x=S3?.model?.sessions?.find(x=>x.id===link.boundSessionId),subject=(S3?.model?.subjects||[]).find(x=>x.id===link.id);return "Próxima sessão · "+(subject?.title||link.id)+(x?" · "+x.date:" · aguardando planejamento");}
 if(link.scope==="discipline")return "Todas as sessões · "+link.id;
 if(link.scope==="cycle")return "Ciclo · "+((S3?.model?.cycles||[]).find(x=>x.id===link.id)?.title||"não encontrado");
 return "Vínculo atual";
}
function parseTarget(value){
 if(!value||value==="none")return null;
 const [scope,encodedId,encodedDate=""]=String(value).split("|");
 if(!["session","entry","discipline","cycle","next"].includes(scope))throw Error("Tipo de vínculo inválido.");
 const id=decodeURIComponent(encodedId||""),date=decodeURIComponent(encodedDate);
 if(!id)throw Error("Escolha o vínculo.");
 return {scope,id,...(scope==="entry"?{date}:scope==="next"?{cycleId:date}:{})};
}
function nextCandidate(link){
 const subject=(S3?.model?.subjects||[]).find(x=>x.id===link.id);
 const sessions=S3?.model?.sessions||[];
 const current=C.today();
 const eligible=sessions.map((x,i)=>({x,i})).filter(({x})=>
  !x.archived&&x.status!=="done"&&x.date>=current&&
  (subject?(x.subjectId===subject.id||(!x.subjectId&&String(x.discipline||"").toLocaleLowerCase("pt-BR")===String(subject.title).toLocaleLowerCase("pt-BR")))&&(!link.cycleId||x.cycleId===link.cycleId):
  String(x.discipline||"").trim().toLocaleLowerCase("pt-BR")===String(link.id).trim().toLocaleLowerCase("pt-BR"))
 );
 eligible.sort((a,b)=>a.x.date.localeCompare(b.x.date)||a.i-b.i);
 return eligible[0]?.x||null;
}
function bindNextNotes(){
 let changed=false;
 for(const n of notes){
  if(n.link?.scope!=="next"||n.link.boundSessionId)continue;
  const x=nextCandidate(n.link);
  if(x){n.link.boundSessionId=x.id;changed=true;}
 }
 if(changed)C.save();
}
function complete(link){
 if(!link)return false;
 if(link.scope==="next"){
  if(!link.boundSessionId)return false;
  const x=S3?.model?.sessions?.find(x=>x.id===link.boundSessionId);
  return !x||x.archived||x.status==="done";
 }
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
 bindNextNotes();
 let touched=false;
 for(const n of notes)if(n.link&&complete(n.link)){
  n.lastLinkLabel=linkLabel(n.link);
  n.link=null;touched=true;
 }
 if(touched)C.save();
}
function matches(n,ctx){
 const l=n.link;
 if(!l||complete(l)||ctx.status==="done")return false;
 if(l.scope==="next")return ctx.kind==="session"&&ctx.id===l.boundSessionId;
 if(l.scope==="session")return ctx.kind==="session"&&ctx.id===l.id;
 if(l.scope==="entry")return ctx.kind==="entry"&&ctx.id===l.id&&ctx.date===l.date;
 if(ctx.kind!=="session")return false;
 return l.scope==="discipline"&&ctx.discipline===l.id||l.scope==="cycle"&&ctx.cycleId===l.id;
}
function indicators(ctx){
 bindNextNotes();
 const linked=notes.filter(n=>matches(n,ctx));
 if(!linked.length)return "";
 const symbol=icons.pin; // Área de estudos apenas informa: as ações ficam exclusivamente no mural.
 return '<button type="button" class="s8-linked-pin" data-s8="jump" data-note-ids="'+A(linked.map(x=>x.id).join(","))+'" title="'+A(linked.length+" lembrete(s) vinculado(s). Abrir no mural.")+'" aria-label="Abrir '+linked.length+' lembrete(s) vinculado(s)">'+symbol+(linked.length>1?'<span>'+linked.length+'</span>':"")+'</button>';
}
const palette={high:"#f5dad1",medium:"#f5eecb",low:"#dcf0e3"};
const swatches=["#f5eecb","#f5dad1","#dcf0e3","#d6e7ff","#e5d9ff","#ffd9ed","#34364b","#ffffff"];
function safeColor(value){return /^#[0-9a-f]{6}$/i.test(String(value||""))?String(value).toLowerCase():"";}
function noteColor(n){return safeColor(n.color)||palette[n.priority]||palette.medium;}
function contrastColor(hex){const rgb=[1,3,5].map(i=>{const c=parseInt(hex.slice(i,i+2),16)/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.179?"#202020":"#ffffff";}
function sorted(){return [...notes].sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||(rank[a.priority]??1)-(rank[b.priority]??1)||String(b.createdAt).localeCompare(String(a.createdAt)));}
function togglePin(idValue){const n=note(idValue);if(!n)return;n.pinned=!n.pinned;C.save();redraw();}
function zoomBy(delta){ui.zoom=clamp((Number(ui.zoom)||100)+delta,65,150);C.save();redraw();}
function selectColor(idValue,value){const n=note(idValue);if(!n)return;const color=safeColor(value);if(!color)throw Error("Cor inválida.");n.color=color;C.save();redraw();}
function pinPanel(){ui.keepOpen=!ui.keepOpen;opened=true;C.save();redraw();}
function visibleNotes(){return sorted().filter(n=>ui.filter==="pinned"?n.pinned:ui.filter==="all"||n.priority===ui.filter);}
function bulkPin(value){for(const n of notes)if(selectedNotes.has(n.id))n.pinned=value;selectedNotes.clear();selecting=false;C.save();redraw();}


function markup(){
 const list=visibleNotes().map(n=>'<article id="s8-note-'+A(n.id)+'" class="s8-note s8-priority-'+A(n.priority)+(highlightIds.includes(n.id)?' s8-highlight':'')+'" style="--s8-note-bg:'+noteColor(n)+';--s8-note-fg:'+contrastColor(noteColor(n))+'" title="'+A(n.description||n.title)+'">'+
 '<div class="s8-note-top">'+(selecting?'<input type="checkbox" class="s8-select-note" data-s8-select="'+A(n.id)+'" aria-label="Selecionar '+A(n.title)+'" '+(selectedNotes.has(n.id)?"checked":"")+'>':"")+'<span class="s8-note-priority" data-priority="'+A(labels[n.priority]?n.priority:"medium")+'">● '+E(labels[n.priority]||"Média")+'</span><small>'+E(age(n.createdAt))+'</small><button type="button" class="s8-pin-note" data-s8="pinNote" data-id="'+A(n.id)+'" aria-pressed="'+!!n.pinned+'" title="'+(n.pinned?"Desafixar lembrete":"Fixar no topo")+'">'+(n.pinned?'📌':'♧')+'</button></div>'+
 '<strong>'+E(n.title)+'</strong>'+(n.link?'<small class="s8-link-label">⌁ '+E(linkLabel(n.link))+'</small>':n.lastLinkLabel?'<small class="s8-link-label s8-link-complete">✓ Vínculo encerrado · '+E(n.lastLinkLabel)+'</small>':"")+(n.description?'<details class="s8-note-details"><summary>Ver observação</summary><p>'+E(n.description)+'</p></details><div class="s8-note-hover" role="tooltip">'+E(n.description)+'</div>':"")+
 '<div class="s8-note-actions"><label class="s8-color-quick" title="Cor do lembrete"><span aria-hidden="true">◉</span><input type="color" aria-label="Cor do lembrete" data-s8-color="'+A(n.id)+'" value="'+noteColor(n)+'"></label><button type="button" data-s8="edit" data-id="'+A(n.id)+'">Editar</button><button type="button" data-s8="convert" data-id="'+A(n.id)+'">Planejar ↗</button><button type="button" class="s8-danger" data-s8="remove" data-id="'+A(n.id)+'">Excluir</button></div></article>').join("");
 return '<div id="s8-floating-root" class="s8-float" aria-label="Lembretes">'+
 '<button type="button" class="s8-trigger" data-s8="toggle" aria-expanded="'+opened+'" aria-controls="s8-panel" title="Mural de lembretes" aria-label="'+(opened?"Fechar":"Abrir")+' lembretes">'+
 '<svg width="27" height="27" viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M5 7h18v17H5z" fill="#f4e5ad" stroke="#aa9860" stroke-width="1.5"/><path d="M7 11h14M7 15h14M7 19h10" stroke="#b4a675" stroke-width="1.3" stroke-linecap="round"/><path d="m15 4 4 5" stroke="#a44950" stroke-width="2.5" stroke-linecap="round"/><circle cx="14" cy="5" r="4" fill="#d96874" stroke="#a44950" stroke-width="1"/><circle cx="13" cy="4" r="1.1" fill="#ffe2e5"/></svg>'+
 (notes.length?'<span class="s8-count">'+notes.length+'</span>':"")+'</button>'+
 (opened?'<section id="s8-panel" class="s8-panel" aria-label="Mural de lembretes"><header class="s8-panel-head"><div data-s8="movePanel" title="Arraste para mover o mural"><strong>📌 Lembretes</strong><small>'+visibleNotes().length+' de '+notes.length+' lembretes</small></div><button type="button" class="s8-close" data-s8="toggle" aria-label="Fechar lembretes">×</button></header>'+
 '<div class="s8-panel-options"><button type="button" class="s8-option" data-s8="lock" aria-pressed="'+!!ui.locked+'" title="'+(ui.locked?"Destravar tamanho e posição":"Travar tamanho e posição")+'">'+(ui.locked?"🔒 Travado":"🔓 Travar")+'</button><button type="button" class="s8-option" data-s8="pinPanel" aria-pressed="'+!!ui.keepOpen+'" title="Manter mural aberto">'+(ui.keepOpen?"📌 Aberto":"Fixar mural")+'</button><button type="button" class="s8-option" data-s8="reset" title="Restaurar tamanho, posição e zoom">↺</button><div class="s8-zoom"><button type="button" class="s8-option" data-s8="zoomOut" aria-label="Diminuir zoom">−</button><span>'+Math.round(Number(ui.zoom)||100)+'%</span><button type="button" class="s8-option" data-s8="zoomIn" aria-label="Aumentar zoom">+</button></div><select id="s8-filter" aria-label="Filtrar lembretes">'+[["all","Todos"],["pinned","Fixados"],["high","Alta"],["medium","Média"],["low","Baixa"]].map(([k,l])=>'<option value="'+k+'" '+(ui.filter===k?"selected":"")+'>'+l+'</option>').join("")+'</select></div>'+
 '<div class="s8-bulk-tools"><button type="button" class="s8-option" data-s8="selectMode">'+(selecting?"Cancelar seleção":"Selecionar vários")+'</button>'+(selecting?'<button type="button" class="s8-option" data-s8="bulkPin">Fixar selecionados</button><button type="button" class="s8-option" data-s8="bulkUnpin">Desafixar selecionados</button>':"")+'</div>'+
 '<div class="s8-note-list" style="--s8-z:'+clamp((Number(ui.zoom)||100)/100,.65,1.5)+';--s8-card-width:'+Math.round(235*clamp((Number(ui.zoom)||100)/100,.65,1.5))+'px">'+(list||'<p class="s8-empty">'+(notes.length?"Nenhum lembrete neste filtro.":"Seu mural está vazio.")+'</p>')+'</div>'+
 '<button type="button" class="btn small primary s8-add" data-s8="new">+ Novo lembrete</button>'+
 (!ui.locked?'<div class="s8-resize-handle" data-s8="resize" role="separator" aria-label="Arraste para ajustar largura e altura do mural" title="Arraste para redimensionar">◢</div>':"")+'</section>':"")+'</div>';
}
function redraw(){C.render();}
function jump(raw){
 highlightIds=String(raw||"").split(",").filter(id=>notes.some(n=>n.id===id));
 if(!highlightIds.length)return;
 opened=true;ui.filter="all";C.save();C.render();
 const element=$("s8-note-"+highlightIds[0]);
 element?.scrollIntoView?.({behavior:"smooth",block:"nearest"});
}
function selectedDateForLink(n,preselected){
 if(preselected?.target?.startsWith("session|"))return S3?.model?.sessions?.find(x=>x.id===preselected.target.split("|")[1])?.date||C.today();
 if(preselected?.target?.startsWith("entry|"))return decodeURIComponent(preselected.target.split("|")[2]||"")||C.today();
 if(n?.link?.scope==="entry")return n.link.date||C.today();
 if(n?.link?.scope==="session")return S3?.model?.sessions?.find(x=>x.id===n.link.id)?.date||C.today();
 return C.today();
}
function edit(idValue,preselected){
 const n=idValue?note(idValue):null;
 if(idValue&&!n)return C.notify("Lembrete não encontrado.");
 const scope=preselected?.scope||initialScope(n),target=preselected?.target||encodedTarget(n),targetDate=selectedDateForLink(n,preselected);
 C.openModal(n?"Editar lembrete":"Novo lembrete",'<form id="s8-note-form" class="section-stack">'+
 '<input type="hidden" name="id" value="'+A(n?.id||"")+'">'+
 '<div class="field"><label>Título</label><input name="title" maxlength="140" required value="'+A(n?.title||"")+'" placeholder="O que você quer lembrar?"></div>'+
 '<div class="field"><label>Observações (opcional)</label><textarea name="description" maxlength="1200" rows="3" placeholder="Detalhes para organizar depois">'+E(n?.description||"")+'</textarea></div>'+
 '<div class="field"><label>Prioridade</label><select name="priority">'+Object.entries(labels).map(([key,value])=>'<option value="'+key+'" '+((n?.priority||"medium")===key?"selected":"")+'>'+value+'</option>').join("")+'</select></div>'+
 '<div class="field"><label>Cor do papel</label><div class="s8-swatches">'+swatches.map(color=>'<button type="button" class="s8-swatch" data-s8="presetColor" data-color="'+color+'" style="--swatch:'+color+'" aria-label="Cor '+color+'"></button>').join("")+'<input type="color" name="color" id="s8-note-color" aria-label="Escolher qualquer cor" value="'+noteColor(n||{priority:"medium"})+'"></div><label class="checkline"><input type="checkbox" name="autoColor" '+(!safeColor(n?.color)?"checked":"")+'> Cor automática da prioridade</label><label class="checkline"><input type="checkbox" name="pinned" '+(n?.pinned?"checked":"")+'> Fixar este lembrete no topo</label></div>'+
 '<div class="field"><label>Ícone quando vinculado</label><select name="icon">'+Object.entries(icons).map(([key,value])=>'<option value="'+key+'" '+((n?.icon||"pin")===key?"selected":"")+'>'+value+" "+({pin:"Alfinete",bookmark:"Continuidade",alert:"Importante",idea:"Ideia"}[key])+'</option>').join("")+'</select></div>'+
 '<div class="field"><label>Onde este lembrete deve aparecer?</label><select name="linkScope" id="s8-link-scope">'+Object.entries(scopeLabel).filter(([k])=>k!=="legacy").map(([k,v])=>'<option value="'+k+'" '+((preselected? (preselected.scope===k) : initialScope(n)===k)?"selected":"")+'>'+E(v)+'</option>').join("")+(initialScope(n)==="legacy"?'<option value="legacy" selected>Vínculo anterior</option>':"")+'</select></div>'+
 '<div class="field" id="s8-target-wrap" '+(scope==="none"?"hidden":"")+'><label id="s8-target-label">Escolher vínculo</label>'+
 '<div id="s8-future-date-wrap" '+(scope==="future"?"":"hidden")+'><label for="s8-future-date">Data da atividade</label><input type="date" id="s8-future-date" value="'+A(targetDate)+'" min="'+A(C.today())+'"></div>'+
 '<label class="s8-search-label" for="s8-target-search">Filtrar opções</label><input type="search" id="s8-target-search" placeholder="Pesquisar atividade ou matéria" autocomplete="off">'+
 '<select name="target" id="s8-link-target">'+targets(target,scope,scope==="future"?targetDate:undefined)+'</select>'+
 '<small id="s8-link-help">Vínculos específicos encerram ao concluir a atividade; o lembrete permanece no mural.</small></div>'+
 '<p class="note">Lembretes não possuem conclusão ou data obrigatória. Ficam aqui até você excluir ou transformar em uma atividade.</p>'+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button type="submit" class="btn primary">Salvar lembrete</button></div></form>');
}
function saveNote(data){
 const title=String(data.get("title")||"").trim().slice(0,140);
 const description=String(data.get("description")||"").trim().slice(0,1200);
 const priority=String(data.get("priority")||"medium");
 const icon=String(data.get("icon")||"pin"),scope=String(data.get("linkScope")||"");
 const link=parseTarget(scope==="none"?"none":data.get("target"));
 if(scope&&scope!=="legacy"&&scope!=="none"&&!link)throw Error("Escolha a atividade, matéria ou ciclo para vincular.");
 if(scope==="next"&&link?.scope!=="next")throw Error("Escolha uma matéria válida para a próxima sessão.");
 if(!Object.hasOwn(icons,icon))throw Error("Ícone inválido.");
 if(link&&complete(link))throw Error("A atividade já foi concluída ou removida. Escolha outra.");
 if(!title)throw Error("Informe o título do lembrete.");
 if(!Object.hasOwn(labels,priority))throw Error("Prioridade inválida.");
 const existing=note(String(data.get("id")||""));
 const color=data.get("autoColor")?null:safeColor(data.get("color"))||existing?.color||null;
 const pinned=data.get("pinned")!==null;
 if(existing&&link?.scope==="next"&&existing.link?.scope==="next"&&link.id===existing.link.id&&link.cycleId===existing.link.cycleId){
  link.boundSessionId=existing.link.boundSessionId;
 }
 if(existing)Object.assign(existing,{title,description,priority,icon,link,color,pinned,lastLinkLabel:link?null:existing.lastLinkLabel,updatedAt:new Date().toISOString()});
 else notes.push({id:id(),title,description,priority,icon,link,color,pinned,createdAt:new Date().toISOString()});
 bindNextNotes();C.save();C.closeModal();redraw();C.notify(existing?"Lembrete atualizado.":"Lembrete adicionado.");
}
function updateTargetSelect(scope,keepSelection=false){
 const target=$("s8-link-target"),wrapper=$("s8-target-wrap");
 if(!target||!wrapper)return;
 wrapper.hidden=scope==="none";
 if(scope==="none")return;
 const datePicker=$("s8-future-date-wrap"),date=$("s8-future-date")?.value;
 if(datePicker)datePicker.hidden=scope!=="future";
 const search=$("s8-target-search");
 if(search&&!keepSelection)search.value="";
 const selected=keepSelection?target.value:"";
 target.innerHTML=targets(selected,scope,date,search?.value||"");
 const label=$("s8-target-label");
 if(label)label.textContent=scope==="next"?"Qual matéria deve receber o lembrete?":scope==="today"?"Atividade visível no dia":scope==="future"?"Atividade da data escolhida":scope==="discipline"?"Matéria":scope==="cycle"?"Ciclo":"Escolher vínculo";
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
 '<div class="field"><label>Objetivo relacionado (opcional)</label><select name="goalId"><option value="">Sem objetivo</option>'+ (root.goals||[]).filter(g=>!g.archived).map(g=>'<option value="'+A(g.id)+'">'+E(g.title)+'</option>').join("")+'</select></div>'+
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
 const values={type,title,date,editDate:date,priority,goalId:String(data.get("goalId")||""),startTime:String(data.get("startTime")||""),estimatedMin:String(data.get("estimatedMin")||""),repeat:"none"};
 const form={get:key=>values[key]??null,has:key=>Object.hasOwn(values,key),getAll:key=>values[key]==null?[]:[values[key]]};
 const previous=S2.model.entries.length;
 S2.submission("s2-entry",form);
 if(S2.model.entries.length!==previous+1)throw Error("Não foi possível criar a atividade; o lembrete foi preservado.");
 const created=S2.model.entries.at(-1);
 if(n.description)created.reminderDescription=n.description;
 if(n.createdAt)created.createdAt=n.createdAt;
 created.reminderSourceId=n.id;
 notes.splice(notes.indexOf(n),1);
 opened=!!ui.keepOpen;C.save();redraw();C.notify("Lembrete transformado em "+(type==="focus"?"foco do dia.":"tarefa secundária."));
}
document.addEventListener("click",ev=>{
 const b=ev.target.closest?.("[data-s8]");if(!b)return;
 ev.preventDefault();
 const action=b.dataset.s8;
 try{
  if(action==="toggle"){if(Date.now()<skipClickUntil){ev.stopPropagation?.();return;}opened=!opened;if(!opened){highlightIds=[];ui.keepOpen=false;C.save();}redraw();}
  else if(action==="new")edit();
  else if(action==="lock")toggleLock();
  else if(action==="reset")resetLayout();
  else if(action==="pinNote")togglePin(b.dataset.id);
  else if(action==="pinPanel")pinPanel();
  else if(action==="selectMode"){selecting=!selecting;selectedNotes.clear();redraw();}
  else if(action==="bulkPin")bulkPin(true);
  else if(action==="bulkUnpin")bulkPin(false);
  else if(action==="zoomOut")zoomBy(-10);
  else if(action==="zoomIn")zoomBy(10);
  else if(action==="presetColor"){const input=$("s8-note-color");if(input){input.value=b.dataset.color;const auto=input.closest("form")?.querySelector('[name="autoColor"]');if(auto)auto.checked=false;}}
  else if(action==="edit")edit(b.dataset.id);
  else if(action==="remove")remove(b.dataset.id);
  else if(action==="convert")convert(b.dataset.id);
  else if(action==="jump")jump(b.dataset.noteIds);
 }catch(err){C.notify(err.message||"Não foi possível executar a ação.");}
});
document.addEventListener("change",event=>{
 const t=event.target;
 if(t?.dataset?.s8Select){if(t.checked)selectedNotes.add(t.dataset.s8Select);else selectedNotes.delete(t.dataset.s8Select);return;}
 if(t?.dataset?.s8Color){selectColor(t.dataset.s8Color,t.value);return;}
 if(t?.id==="s8-filter"){ui.filter=["all","pinned","high","medium","low"].includes(t.value)?t.value:"all";C.save();redraw();return;}
 if(t?.id==="s8-note-color"){const auto=t.closest("form")?.querySelector('[name="autoColor"]');if(auto)auto.checked=false;}
 if(event.target?.id==="s8-link-scope")updateTargetSelect(event.target.value);
 if(event.target?.id==="s8-future-date")updateTargetSelect($("s8-link-scope")?.value||"future");
});
document.addEventListener("input",event=>{
 if(event.target?.id==="s8-target-search")updateTargetSelect($("s8-link-scope")?.value||"today",true);
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
document.addEventListener("keydown",ev=>{if(ev.key==="Escape"&&opened&&!$("modal-host")?.querySelector?.(".modal-layer")){opened=false;ui.keepOpen=false;C.save();redraw();}});
window.OrbitaStage8={decorate(route,base){if(route==="inicio"){prune();return base+markup();}return base},indicatorFor:indicators,afterRender(route){
 const incoming=document.querySelector?.('#view #s8-floating-root');
 const detached=document.querySelectorAll?.('body > #s8-floating-root')||[];
 if(route!=="inicio"){for(const node of detached)node.remove?.();return;}
 if(incoming&&document.body?.appendChild){
  for(const node of detached)if(node!==incoming)node.remove?.();
  document.body.appendChild(incoming);
 }
 place();
},inspect:{get notes(){return notes},get layout(){return ui},saveNote,remove,convertSubmit,age,sorted,togglePin,zoomBy,selectColor,panelRect,position,toggleLock,resetLayout,indicators,prune,jump,parseTarget,nextCandidate,bindNextNotes,targetRows,updateTargetSelect,linkLabel,selectedDateForLink}};
C.render();
})();
