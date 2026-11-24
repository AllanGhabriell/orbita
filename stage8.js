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
 const b=position(),m=8;
 const maxW=Math.max(1,b.width-2*m),maxH=Math.max(1,b.height-b.bottom-2*m);
 const w=clamp(Number(ui.width)||340,Math.min(210,maxW),maxW);
 const h=clamp(Number(ui.height)||430,Math.min(160,maxH),maxH);
 const left=clamp(Number.isFinite(ui.panelX)?ui.panelX:ui.x+b.size-w,m,Math.max(m,b.width-w-m));
 const top=clamp(Number.isFinite(ui.panelY)?ui.panelY:ui.y+b.size-h,m,Math.max(m,b.height-b.bottom-h-m));
 return {width:w,height:h,left,top};
}
function place(){
 const floater=$("s8-floating-root");if(!floater)return;
 const b=position(),rect=opened?panelRect():{left:ui.x,top:ui.y,width:b.size,height:b.size};
 Object.assign(floater.style,{left:rect.left+"px",top:rect.top+"px",width:rect.width+"px",height:rect.height+"px"});
}
function toggleLock(){ui.locked=!ui.locked;C.save();redraw();}
function resetLayout(){const b=bounds();ui.x=b.width-(b.width<=760?46:49)-18;ui.y=b.height-(b.width<=760?46:49)-b.bottom-18;ui.width=340;ui.height=430;ui.panelX=null;ui.panelY=null;ui.zoom=100;C.save();redraw();}
function openPanel(){
 opened=true;
 const r=panelRect();ui.panelX=r.left;ui.panelY=r.top;
 C.save();redraw();
}
function closePanel(){
 const r=panelRect(),b=position();
 ui.x=r.left+r.width-b.size;ui.y=r.top;
 position();opened=false;ui.keepOpen=false;highlightIds=[];selecting=false;selectedNotes.clear();
 C.save();redraw();
}
function pointerStart(ev){
 const target=ev.target.closest?.('[data-s8="toggle"],[data-s8="resize"],[data-s8="movePanel"]');
 if(!target||ui.locked||ev.button!==undefined&&ev.button!==0)return;
 const kind=target.dataset.s8==="resize"?"resize":target.dataset.s8==="movePanel"?"panel":"move",p=panelRect();
 drag={id:ev.pointerId,kind,edge:target.dataset.edge||"se",target,startX:ev.clientX,startY:ev.clientY,x:ui.x,y:ui.y,w:p.width,h:p.height,left:p.left,top:p.top,moved:false};
 if(kind!=="move")ev.preventDefault?.();
 try{target.setPointerCapture?.(ev.pointerId);}catch{}
}
function pointerMove(ev){
 if(!drag||ev.pointerId!==drag.id)return;
 const dx=ev.clientX-drag.startX,dy=ev.clientY-drag.startY;
 if(!drag.moved&&Math.hypot(dx,dy)<4)return;
 drag.moved=true;ev.preventDefault?.();
 const b=bounds(),m=8,maxR=b.width-m,maxB=b.height-b.bottom-m;
 if(drag.kind==="move"){
  const size=b.width<=760?46:49;
  ui.x=clamp(drag.x+dx,m,Math.max(m,b.width-size-m));
  ui.y=clamp(drag.y+dy,m,Math.max(m,b.height-size-b.bottom));
  ui.panelX=null;ui.panelY=null;
 }else if(drag.kind==="panel"){
  ui.panelX=clamp(drag.left+dx,m,Math.max(m,maxR-drag.w));
  ui.panelY=clamp(drag.top+dy,m,Math.max(m,maxB-drag.h));
 }else{
  const minW=Math.min(210,maxR-m),minH=Math.min(160,maxB-m);
  let l=drag.left,t=drag.top,r=l+drag.w,bot=t+drag.h;
  if(drag.edge.includes("w"))l=clamp(l+dx,m,r-minW);
  if(drag.edge.includes("e"))r=clamp(r+dx,l+minW,maxR);
  if(drag.edge.includes("n"))t=clamp(t+dy,m,bot-minH);
  if(drag.edge.includes("s"))bot=clamp(bot+dy,t+minH,maxB);
  ui.panelX=l;ui.panelY=t;ui.width=r-l;ui.height=bot-t;
 }
 place();
}
function pointerEnd(ev){
 if(!drag||ev.pointerId!==drag.id)return;
 if(drag.moved){skipClickUntil=Date.now()+350;C.save();}
 try{drag.target.releasePointerCapture?.(ev.pointerId);}catch{}
 drag=null;
}
function applyLayout(data){
 const b=bounds();
 ui.width=clamp(Number(data.get("width"))||340,Math.min(210,b.width-16),b.width-16);
 ui.height=clamp(Number(data.get("height"))||430,Math.min(160,b.height-b.bottom-16),b.height-b.bottom-16);
 ui.zoom=clamp(Number(data.get("zoom"))||100,50,200);
 ui.locked=data.get("locked")!==null;ui.keepOpen=data.get("keepOpen")!==null;
 const filter=String(data.get("filter")||"all");ui.filter=["all","pinned","high","medium","low"].includes(filter)?filter:"all";
 const r=panelRect();ui.panelX=r.left;ui.panelY=r.top;
 C.save();C.closeModal();redraw();
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
const icons={pin:"Alfinete",bookmark:"Continuidade",alert:"Importante",idea:"Ideia"};
function glyph(name){
 const paths={pin:'<path d="m16 3 5 5-4 2-3 5-5-5 5-3zM9 15l-6 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',note:'<path d="M5 3h14v13l-5 5H5zM14 21v-5h5M8 8h8m-8 4h6"/>',link:'<path d="M10 13a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-2 2m3 5a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l2-2"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',edit:'<path d="m4 16 11-11 4 4L8 20H4z"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',trash:'<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/>',check:'<path d="m5 12 4 4L19 6"/>',select:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/>'};
 return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||"")+'</svg>';
}
function smallButton(action,icon,label,extra=""){return '<button type="button" class="s8-mini" data-s8="'+action+'" title="'+A(label)+'" aria-label="'+A(label)+'" '+extra+'>'+glyph(icon)+'</button>';}

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
 const symbol=glyph("pin"); // Área de estudos apenas informa: as ações ficam exclusivamente no mural.
 return '<button type="button" class="s8-linked-pin" data-s8="jump" data-note-ids="'+A(linked.map(x=>x.id).join(","))+'" title="'+A(linked.length+" lembrete(s) vinculado(s). Abrir no mural.")+'" aria-label="Abrir '+linked.length+' lembrete(s) vinculado(s)">'+symbol+(linked.length>1?'<span>'+linked.length+'</span>':"")+'</button>';
}
const palette={high:"#f5dad1",medium:"#f5eecb",low:"#dcf0e3"};
const swatches=["#f5eecb","#f5dad1","#dcf0e3","#d6e7ff","#e5d9ff","#ffd9ed","#34364b","#ffffff"];
function safeColor(value){return /^#[0-9a-f]{6}$/i.test(String(value||""))?String(value).toLowerCase():"";}
function noteColor(n){return safeColor(n.color)||palette[n.priority]||palette.medium;}
function contrastColor(hex){const rgb=[1,3,5].map(i=>{const c=parseInt(hex.slice(i,i+2),16)/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.179?"#202020":"#ffffff";}
function sorted(){return [...notes].sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||(rank[a.priority]??1)-(rank[b.priority]??1)||String(b.createdAt).localeCompare(String(a.createdAt)));}
function togglePin(idValue){const n=note(idValue);if(!n)return;n.pinned=!n.pinned;C.save();redraw();}
function zoomBy(delta){ui.zoom=clamp((Number(ui.zoom)||100)+delta,50,200);C.save();redraw();}
function selectColor(idValue,value){const n=note(idValue);if(!n)return;const color=safeColor(value);if(!color)throw Error("Cor inválida.");n.color=color;C.save();redraw();}
function pinPanel(){ui.keepOpen=!ui.keepOpen;opened=true;C.save();redraw();}
function visibleNotes(){return sorted().filter(n=>ui.filter==="pinned"?n.pinned:ui.filter==="all"||n.priority===ui.filter);}
function bulkPin(value){for(const n of notes)if(selectedNotes.has(n.id))n.pinned=value;selectedNotes.clear();selecting=false;C.save();redraw();}


function noteMenu(idValue){
 const n=note(idValue);if(!n)return;
 const item=(act,ic,label,tone="")=>'<button type="button" class="orb-manage-item '+tone+'" data-s8="'+act+'" data-id="'+A(n.id)+'"><span class="orb-manage-icon">'+glyph(ic)+'</span><span><strong>'+E(label)+'</strong></span><span aria-hidden="true">›</span></button>';
 C.openModal("Lembrete",'<div class="section-stack orb-manage"><strong>'+E(n.title)+'</strong>'+
 (n.description?'<p style="white-space:pre-wrap;margin:0">'+E(n.description)+'</p>':"")+
 '<small class="note">'+E(labels[n.priority]||"Média")+' · '+E(age(n.createdAt))+'</small>'+
 (n.link||n.lastLinkLabel?'<small class="note">'+E(n.link?linkLabel(n.link):"Vínculo encerrado · "+n.lastLinkLabel)+'</small>':"")+
 '<section class="orb-manage-group">'+item("edit","edit","Editar / cor / prioridade")+item("pinNote","pin",n.pinned?"Desafixar":"Fixar no topo")+item("convert","arrow","Transformar em atividade")+item("remove","trash","Excluir","orb-risk")+'</section></div>');
}
function settingsMenu(){
 const b=bounds(),r=panelRect();
 const field=(label,name,value,min,max)=>'<label class="field"><span>'+label+'</span><input type="number" name="'+name+'" min="'+min+'" max="'+max+'" value="'+Math.round(value)+'" required></label>';
 C.openModal("Mural de lembretes",'<form id="s8-layout-form" class="section-stack"><div class="grid-2">'+field("Largura (px)","width",r.width,Math.min(210,b.width-16),b.width-16)+field("Altura (px)","height",r.height,Math.min(160,b.height-b.bottom-16),b.height-b.bottom-16)+'</div>'+
 field("Zoom (%)","zoom",Number(ui.zoom)||100,50,200)+
 '<label class="field"><span>Mostrar</span><select name="filter">'+[["all","Todos"],["pinned","Fixados"],["high","Alta"],["medium","Média"],["low","Baixa"]].map(([k,l])=>'<option value="'+k+'" '+(ui.filter===k?"selected":"")+'>'+l+'</option>').join("")+'</select></label>'+
 '<label class="checkline"><input type="checkbox" name="locked" '+(ui.locked?"checked":"")+'> Travar posição e tamanho</label><label class="checkline"><input type="checkbox" name="keepOpen" '+(ui.keepOpen?"checked":"")+'> Manter aberto ao voltar ao Início</label>'+
 '<div class="row"><button type="button" class="btn small ghost" data-s8="selectMode">Selecionar vários</button><button type="button" class="btn small ghost" data-s8="reset">Restaurar layout</button></div>'+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button type="submit" class="btn primary">Aplicar</button></div></form>');
}
function markup(){
 if(!opened)return '<div id="s8-floating-root" class="s8-float" aria-label="Lembretes"><button type="button" class="s8-trigger" data-s8="toggle" aria-expanded="false" title="Abrir lembretes" aria-label="Abrir lembretes">'+glyph("note")+(notes.length?'<span class="s8-count">'+notes.length+'</span>':"")+'</button></div>';
 const list=visibleNotes().map(n=>{
  const p=labels[n.priority]?n.priority:"medium",link=n.link?linkLabel(n.link):n.lastLinkLabel?"Vínculo encerrado · "+n.lastLinkLabel:"";
  return '<article id="s8-note-'+A(n.id)+'" data-s8-card="'+A(n.id)+'" class="s8-note s8-priority-'+p+(highlightIds.includes(n.id)?' s8-highlight':'')+'" style="--s8-note-bg:'+noteColor(n)+';--s8-note-fg:'+contrastColor(noteColor(n))+'">'+
   '<div class="s8-note-top">'+(selecting?'<input type="checkbox" class="s8-select-note" data-s8-select="'+A(n.id)+'" aria-label="Selecionar '+A(n.title)+'" '+(selectedNotes.has(n.id)?"checked":"")+'>':"")+
   '<span class="s8-note-priority" data-priority="'+p+'" title="Prioridade '+E(labels[p])+'">'+E(labels[p])+'</span><div class="s8-note-tools">'+
   (link?'<span class="s8-link-symbol" title="'+A(link)+'" aria-label="'+A(link)+'">'+glyph("link")+'</span>':"")+
   smallButton("pinNote","pin",n.pinned?"Desafixar lembrete":"Fixar no topo",'data-id="'+A(n.id)+'" aria-pressed="'+!!n.pinned+'"')+
   smallButton("noteMenu","more","Mais opções",'data-id="'+A(n.id)+'"')+'</div></div>'+
   '<button class="s8-note-title" type="button" data-s8="noteMenu" data-id="'+A(n.id)+'" title="'+A(n.description||n.title)+'">'+E(n.title)+'</button>'+
   (n.description?'<details class="s8-note-details"><summary>Ver observação</summary><p>'+E(n.description)+'</p></details>':"")+'</article>';
 }).join("");
 const z=clamp((Number(ui.zoom)||100)/100,.5,2);
 return '<div id="s8-floating-root" class="s8-float s8-open" aria-label="Lembretes"><section id="s8-panel" class="s8-panel" aria-label="Mural de lembretes"><header class="s8-panel-head"><div data-s8="movePanel" title="'+(ui.locked?"Mural travado":"Arraste para mover o mural")+'"><strong>Lembretes <small>'+visibleNotes().length+(visibleNotes().length!==notes.length?"/"+notes.length:"")+'</small></strong>'+(ui.locked?glyph("lock"):"")+'</div><div class="s8-head-tools">'+
 smallButton("new","plus","Novo lembrete")+smallButton("settings","more","Configurar mural")+smallButton("close","close","Fechar mural")+'</div></header>'+
 (selecting?'<div class="s8-bulk-tools"><span>Selecionar</span>'+smallButton("bulkPin","pin","Fixar selecionados")+smallButton("bulkUnpin","pin","Desafixar selecionados")+smallButton("selectMode","close","Sair da seleção")+'</div>':"")+
 '<div class="s8-note-list" style="--s8-z:'+z+';--s8-card-width:'+Math.round(212*z)+'px">'+(list||'<p class="s8-empty">'+(notes.length?"Sem lembretes neste filtro.":"Nenhum lembrete.")+'</p>')+'</div>'+
 (!ui.locked?["nw","n","ne","e","se","s","sw","w"].map(edge=>'<div class="s8-resize-handle s8-edge-'+edge+'" data-s8="resize" data-edge="'+edge+'" title="Redimensionar mural" aria-hidden="true"></div>').join(""):"")+'</section></div>';
}

function redraw(){C.render();}
function jump(raw){
 highlightIds=String(raw||"").split(",").filter(id=>notes.some(n=>n.id===id));
 if(!highlightIds.length)return;
 ui.filter="all";openPanel();
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
 '<div class="field"><label>Ícone quando vinculado</label><select name="icon">'+Object.entries(icons).map(([key,value])=>'<option value="'+key+'" '+((n?.icon||"pin")===key?"selected":"")+'>'+E(value)+'</option>').join("")+'</select></div>'+
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
 C.save();redraw();C.notify("Lembrete transformado em "+(type==="focus"?"foco do dia.":"tarefa secundária."));
}
document.addEventListener("click",ev=>{
 const b=ev.target.closest?.("[data-s8]");if(!b)return;
 ev.preventDefault();
 const action=b.dataset.s8;
 try{
  if(action==="toggle"){if(Date.now()<skipClickUntil){ev.stopPropagation?.();return;}openPanel();}
  else if(action==="close")closePanel();
  else if(action==="settings")settingsMenu();
  else if(action==="noteMenu")noteMenu(b.dataset.id);
  else if(action==="new")edit();
  else if(action==="lock")toggleLock();
  else if(action==="reset"){C.closeModal();resetLayout();}
  else if(action==="pinNote"){if(b.closest?.(".modal-card"))C.closeModal();togglePin(b.dataset.id);}
  else if(action==="pinPanel")pinPanel();
  else if(action==="selectMode"){if(b.closest?.(".modal-card"))C.closeModal();selecting=!selecting;selectedNotes.clear();redraw();}
  else if(action==="bulkPin")bulkPin(true);
  else if(action==="bulkUnpin")bulkPin(false);
  else if(action==="zoomOut")zoomBy(-10);
  else if(action==="zoomIn")zoomBy(10);
  else if(action==="presetColor"){const input=$("s8-note-color");if(input){input.value=b.dataset.color;const auto=input.closest("form")?.querySelector('[name="autoColor"]');if(auto)auto.checked=false;}}
  else if(action==="edit")edit(b.dataset.id);
  else if(action==="remove"){C.closeModal();remove(b.dataset.id);}
  else if(action==="convert")convert(b.dataset.id);
  else if(action==="jump")jump(b.dataset.noteIds);
 }catch(err){C.notify(err.message||"Não foi possível executar a ação.");}
});
document.addEventListener("contextmenu",ev=>{
 const card=ev.target.closest?.("[data-s8-card]");if(!card)return;ev.preventDefault();noteMenu(card.dataset.s8Card);
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
 if(!["s8-note-form","s8-convert-form","s8-layout-form"].includes(formId))return;
 ev.preventDefault();
 try{
  const data=new FormData(ev.target);
  if(formId==="s8-note-form")saveNote(data);
  else if(formId==="s8-layout-form")applyLayout(data);
  else convertSubmit(data);
 }catch(err){C.notify(err.message||"Verifique os dados informados.");}
});
document.addEventListener("keydown",ev=>{if(ev.key==="Escape"&&opened&&!$("modal-host")?.querySelector?.(".modal-layer"))closePanel();});
window.OrbitaStage8={decorate(route,base){if(route==="inicio"){prune();return base+markup();}return base},indicatorFor:indicators,afterRender(route){
 const incoming=document.querySelector?.('#view #s8-floating-root');
 const detached=document.querySelectorAll?.('body > #s8-floating-root')||[];
 if(route!=="inicio"){for(const node of detached)node.remove?.();return;}
 if(incoming&&document.body?.appendChild){
  for(const node of detached)if(node!==incoming)node.remove?.();
  document.body.appendChild(incoming);
 }
 place();
},inspect:{get notes(){return notes},get layout(){return ui},saveNote,remove,convertSubmit,age,sorted,togglePin,zoomBy,selectColor,panelRect,position,openPanel,closePanel,applyLayout,toggleLock,resetLayout,indicators,prune,jump,parseTarget,nextCandidate,bindNextNotes,targetRows,updateTargetSelect,linkLabel,selectedDateForLink}};
C.render();
})();
