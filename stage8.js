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
const important=n=>n?.priority==="high";
const notePriority=v=>v==="high"||v==="yes"?"high":"low";
const normalizeFilter=v=>v==="high"?"high":v==="medium"||v==="low"?"low":v==="pinned"?"pinned":"all";
let opened=false,drag=null,skipClickUntil=0,highlightIds=[],selecting=false,selectedNotes=new Set();
const defaults={x:null,y:null,width:340,height:430,locked:false,zoom:100,keepOpen:false,filter:"all",panelX:null,panelY:null,opacity:28,appearanceVersion:2,blur:4,background:"glass",backgroundColor:"",paperOpacity:100,spacing:6,radius:8,cardWidth:212,columns:0,layoutMode:"masonry",fontSize:14,fontWeight:620,textAlign:"left",shadow:false,showPriority:true,showAge:false,showDate:false,showLinks:true,showObservations:true,orderMode:"auto",manualOrder:[]};
if(!root.reminderUi||typeof root.reminderUi!=="object")root.reminderUi={...defaults};
const ui=root.reminderUi;
 opened=ui.keepOpen===true;
if(ui.appearanceVersion!==2){if(ui.opacity===92||ui.opacity==null)ui.opacity=28;ui.appearanceVersion=2;}
for(const [key,value] of Object.entries(defaults))if(ui[key]===undefined)ui[key]=Array.isArray(value)?[]:value;
ui.filter=normalizeFilter(ui.filter);
const expandedNotes=new Set();let cardDrag=null,layoutObserver=null,contextAnchor=null,selectionHold=null,selectionHeld=false;
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
 closeContext();expandedNotes.clear();
 const r=panelRect(),b=position();
 ui.x=r.left+r.width-b.size;ui.y=r.top;
 position();opened=false;ui.keepOpen=false;highlightIds=[];selecting=false;selectedNotes.clear();
 C.save();redraw();
}
function pointerStart(ev){
 if(contextAnchor&&!ev.target.closest?.("#s8-context"))closeContext();
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
 const filter=String(data.get("filter")||"all");ui.filter=normalizeFilter(filter);
 const r=panelRect();ui.panelX=r.left;ui.panelY=r.top;
 C.save();C.closeModal();redraw();
}

const note=id=>notes.find(x=>x.id===id);
/* Images are compact raster attachments in the same saved/synced document.
 * Bound their storage cost; never accept remote URLs or SVG markup. */
const IMAGE_LIMIT=8,IMAGE_SIZE=240000,IMAGE_TOTAL=1500000,FILE_LIMIT=25*1024*1024;
let imageDraft=null,imageViewer=null;
const imagePositions=new Map();
function validImage(x){return !!x&&typeof x.src==="string"&&x.src.length<=IMAGE_SIZE&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(x.src);}
function noteImages(n){return Array.isArray(n?.images)?n.images.filter(validImage).slice(0,IMAGE_LIMIT):[];}
function imageBudget(items,except=""){
 const total=notes.filter(n=>n.id!==except).reduce((n,x)=>n+noteImages(x).reduce((a,y)=>a+y.src.length,0),0);
 return total+items.reduce((n,x)=>n+x.src.length,0)<=IMAGE_TOTAL;
}
function imageData(file){
 return new Promise((resolve,reject)=>{
  if(!file||!/^image\/(?:jpeg|png|webp|gif|bmp|avif|x-ms-bmp)$/i.test(file.type)||file.size>FILE_LIMIT)return reject(Error("Escolha uma imagem válida de até 25 MB."));
  const url=URL.createObjectURL(file),img=new Image();
  function fail(){URL.revokeObjectURL(url);reject(Error("Não foi possível abrir esta imagem."));}
  img.onerror=fail;
  img.onload=()=>{
   try{
    if(!img.naturalWidth||!img.naturalHeight)throw Error("Imagem inválida.");
    const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
    if(!ctx)throw Error("Não foi possível preparar a imagem.");
    let edge=1600,src="";
    for(let attempt=0;attempt<8;attempt++){
     const ratio=Math.min(1,edge/Math.max(img.naturalWidth,img.naturalHeight));
     canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
     ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
     src=canvas.toDataURL("image/webp",.82-attempt*.045);
     if(!src.startsWith("data:image/webp;")){ctx.globalCompositeOperation="destination-over";ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.globalCompositeOperation="source-over";src=canvas.toDataURL("image/jpeg",.82-attempt*.045);}
     if(src.length<=IMAGE_SIZE&&validImage({src}))break;
     edge=Math.round(edge*.78);
    }
    if(!validImage({src}))throw Error("A imagem não coube no limite de armazenamento.");
    resolve({id:id(),name:String(file.name||"Imagem colada").slice(0,120),src,width:canvas.width,height:canvas.height});
   }catch(e){reject(e);}finally{URL.revokeObjectURL(url);}
  };
  img.src=url;
 });
}
function imageEditorMarkup(items){
 return items.map((x,i)=>'<div class="s8-image-edit-item"><img src="'+A(x.src)+'" alt="'+A(x.name||"Imagem "+(i+1))+'"><button type="button" data-s8="removeImageDraft" data-index="'+i+'" class="s8-image-remove" aria-label="Remover imagem '+(i+1)+'" title="Remover imagem">×</button></div>').join("");
}
function refreshImageEditor(draft){
 if(!draft||imageDraft!==draft||!draft.form?.isConnected)return;
 const list=$("s8-image-edit-list"),hint=$("s8-image-edit-status"),picker=$("s8-image-input");
 if(list)list.innerHTML=imageEditorMarkup(draft.items);
 if(hint)hint.textContent=draft.busy?"Preparando imagens…":[draft.items.length?draft.items.length+"/"+IMAGE_LIMIT+" imagens":"",draft.message].filter(Boolean).join(" · ");
 if(picker)picker.disabled=draft.busy||draft.items.length>=IMAGE_LIMIT;
 const attach=draft.form.querySelector('[data-s8="chooseImages"]');if(attach)attach.disabled=draft.busy||draft.items.length>=IMAGE_LIMIT;
 const submit=draft.form.querySelector('button[type="submit"]');if(submit)submit.disabled=draft.busy;
}
async function addDraftImages(files){
 const draft=imageDraft;if(!draft||!draft.form?.isConnected||draft.busy)return;
 draft.busy=true;draft.message="";refreshImageEditor(draft);
 try{
  for(const file of files){
   if(imageDraft!==draft||!draft.form.isConnected)return;
   if(draft.items.length>=IMAGE_LIMIT){draft.message="Limite de imagens atingido.";break;}
   try{
    const item=await imageData(file);
    if(imageDraft!==draft||!draft.form.isConnected)return;
    if(!imageBudget([...draft.items,item],draft.id)){draft.message="Espaço de imagens esgotado. Remova algum anexo.";break;}
    draft.items.push(item);
   }catch(e){draft.message=e.message||"Não foi possível adicionar a imagem.";}
  }
 }finally{draft.busy=false;refreshImageEditor(draft);}
}
function imageIndex(n){const len=noteImages(n).length;return len?((Number(imagePositions.get(n.id)||0)%len)+len)%len:0;}
function galleryMarkup(n){
 const imgs=noteImages(n);if(!imgs.length)return "";
 const i=imageIndex(n),x=imgs[i],key=A(n.id);
 return '<div class="s8-gallery" data-s8-gallery="'+key+'"><button type="button" class="s8-image-preview" data-s8="imageOpen" data-id="'+key+'" aria-label="Ampliar imagem '+(i+1)+' de '+imgs.length+'" title="Ampliar imagem"><img src="'+A(x.src)+'" alt="'+A(x.name||"Imagem do lembrete")+'" loading="lazy" decoding="async" draggable="false"><span class="s8-image-expand" aria-hidden="true">'+glyph("expand")+'</span></button>'+
 (imgs.length>1?'<button type="button" class="s8-image-nav s8-image-prev" data-s8="imagePrev" data-id="'+key+'" aria-label="Imagem anterior">'+glyph("chevronLeft")+'</button><button type="button" class="s8-image-nav s8-image-next" data-s8="imageNext" data-id="'+key+'" aria-label="Próxima imagem">'+glyph("chevronRight")+'</button><span class="s8-image-count" aria-live="polite">'+(i+1)+' / '+imgs.length+'</span>':'')+'</div>';
}
function moveImage(idValue,delta){
 const n=note(idValue),imgs=noteImages(n);if(imgs.length<2)return;
 imagePositions.set(idValue,(imageIndex(n)+delta+imgs.length)%imgs.length);
 const card=$("s8-note-"+idValue),gallery=card?.querySelector?.(".s8-gallery");
 if(gallery){const action=document.activeElement?.dataset?.s8;gallery.outerHTML=galleryMarkup(n);if(action==="imagePrev"||action==="imageNext")card.querySelector('[data-s8="'+action+'"]')?.focus({preventScroll:true});}
 if(imageViewer?.id===idValue){imageViewer.zoom=1;renderImageViewer();}
}
function closeImageViewer(){
 const v=imageViewer;if(!v)return;imageViewer=null;v.root.remove();if(v.returnFocus?.isConnected)v.returnFocus.focus({preventScroll:true});
}
function renderImageViewer(){
 const v=imageViewer;if(!v)return;
 const n=note(v.id),imgs=noteImages(n);if(!imgs.length){closeImageViewer();return;}
 const i=imageIndex(n),x=imgs[i];
 v.root.innerHTML='<div class="s8-viewer-top"><div><strong>'+E(n.title)+'</strong><small>'+E(x.name||"Imagem")+' · '+(i+1)+' / '+imgs.length+'</small></div><button type="button" data-s8="imageClose" class="s8-viewer-btn" aria-label="Fechar imagem" title="Fechar">'+glyph("close")+'</button></div>'+
 '<div class="s8-viewer-stage"><div class="s8-viewer-canvas" style="--s8-image-zoom:'+v.zoom+'"><img src="'+A(x.src)+'" alt="'+A(x.name||"Imagem do lembrete")+'" draggable="false"></div></div>'+
 '<div class="s8-viewer-controls">'+(imgs.length>1?'<button type="button" class="s8-viewer-btn" data-s8="viewerPrev" aria-label="Imagem anterior">'+glyph("chevronLeft")+'</button>':'')+
 '<button type="button" class="s8-viewer-btn" data-s8="imageZoomOut" aria-label="Diminuir zoom">'+glyph("minus")+'</button><button type="button" class="s8-viewer-btn s8-viewer-percent" data-s8="imageZoomReset" aria-label="Restaurar zoom">'+Math.round(v.zoom*100)+'%</button><button type="button" class="s8-viewer-btn" data-s8="imageZoomIn" aria-label="Aumentar zoom">'+glyph("plus")+'</button>'+
 (imgs.length>1?'<button type="button" class="s8-viewer-btn" data-s8="viewerNext" aria-label="Próxima imagem">'+glyph("chevronRight")+'</button>':'')+'</div>';
}
function openImageViewer(idValue){
 const n=note(idValue);if(!noteImages(n).length||!document.createElement)return;
 closeContext();closeImageViewer();
 const overlay=document.createElement("div");overlay.id="s8-image-viewer";overlay.className="s8-image-viewer";overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");overlay.setAttribute("aria-label","Visualização de imagem");
 imageViewer={id:idValue,zoom:1,root:overlay,returnFocus:document.activeElement};
 document.body.appendChild(overlay);renderImageViewer();
 overlay.addEventListener("click",ev=>{if(ev.target===overlay||ev.target.classList?.contains("s8-viewer-stage")||ev.target.classList?.contains("s8-viewer-canvas"))closeImageViewer();});
 overlay.querySelector('[data-s8="imageClose"]')?.focus();
}
function imageZoom(delta){
 const v=imageViewer;if(!v)return;
 v.zoom=delta===0?1:clamp(v.zoom+delta,1,4);
 const canvas=v.root.querySelector(".s8-viewer-canvas"),label=v.root.querySelector(".s8-viewer-percent"),stage=v.root.querySelector(".s8-viewer-stage");
 if(canvas)canvas.style.setProperty("--s8-image-zoom",v.zoom);
 if(label)label.textContent=Math.round(v.zoom*100)+"%";
 if(v.zoom===1&&stage){stage.scrollLeft=0;stage.scrollTop=0;}
}

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
 const paths={imageAdd:'<rect x="3" y="5" width="15" height="15" rx="2"/><circle cx="7.5" cy="9.5" r="1.5"/><path d="m3 17 5-5 4 4 2-2 4 4M20 2v6m-3-3h6"/>',expand:'<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/>',chevronLeft:'<path d="m15 18-6-6 6-6"/>',chevronRight:'<path d="m9 18 6-6-6-6"/>',sort:'<path d="M7 3v18m-4-4 4 4 4-4M13 5h8m-8 5h6m-6 5h4"/>',unlock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>',reset:'<path d="M5 9a8 8 0 1 1 0 6M5 4v5h5"/>',all:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m7 12 3 3 7-7M2 7V2h5"/>',minus:'<path d="M5 12h14"/>',pin:'<path d="m16 3 5 5-4 2-3 5-5-5 5-3zM9 15l-6 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',note:'<path d="M5 3h14v13l-5 5H5zM14 21v-5h5M8 8h8m-8 4h6"/>',link:'<path d="M10 13a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-2 2m3 5a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l2-2"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',edit:'<path d="m4 16 11-11 4 4L8 20H4z"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',trash:'<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/>',check:'<path d="m5 12 4 4L19 6"/>',select:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/>'};
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
  if(x.rotationSlot)continue;
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
function subjectMatchesNext(x,link){
 if(link.cycleId&&x.cycleId!==link.cycleId)return false;
 const sub=(S3?.model?.subjects||[]).find(y=>y.id===link.id);
 const forecast=x.rotationSlot&&x.status==="pending"?S3?.rotationPreview?.(x):null;
 const subjectId=forecast?.id||x.subjectId||"",discipline=forecast?.title||x.discipline||"";
 const normalized=v=>String(v||"").trim().toLocaleLowerCase("pt-BR");
 return sub?(subjectId?subjectId===sub.id:normalized(discipline)===normalized(sub.title)):normalized(discipline)===normalized(link.id);
}
function nextEligible(x){
 return !!x&&!x.archived&&x.status==="pending"&&x.date>=C.today()&&x.id!==root.timing?.active?.sessionId&&!root.evolution?.closed?.[x.date]&&!root.planner?.closedDays?.includes(x.date);
}
function nextCandidate(link){
 const sessions=S3?.model?.sessions||[];
 const eligible=sessions.map((x,i)=>({x,i})).filter(({x})=>nextEligible(x)&&subjectMatchesNext(x,link));
 eligible.sort((a,b)=>a.x.date.localeCompare(b.x.date)||Number(a.x.planOrder??0)-Number(b.x.planOrder??0)||(a.x.startTime||"99:99").localeCompare(b.x.startTime||"99:99")||String(a.x.createdAt||"").localeCompare(String(b.x.createdAt||""))||a.i-b.i);
 return eligible[0]?.x||null;
}
function bindNextNotes(persist=true){
 let changed=false;
 for(const n of notes){
  const l=n.link;if(l?.scope!=="next")continue;
  const old=(S3?.model?.sessions||[]).find(x=>x.id===l.boundSessionId);
  const started=old&&root.timing?.records?.[old.id]?.startedAt;
  // A correctly reserved session keeps its reminder after starting. Legacy links
  // created after the timer began may point at the wrong session.
  const active=old&&old.id===root.timing?.active?.sessionId;
  const legacyLate=!l.bindingVersion&&started&&Date.parse(n.updatedAt||n.createdAt||"")>Date.parse(started);
  if(old&&!old.archived&&old.status==="done")continue;
  if(old&&!old.archived&&(active||old.status==="progress")&&!legacyLate)continue;
  const x=nextCandidate(l),target=x?.id;
  if(target!==l.boundSessionId){if(target)l.boundSessionId=target;else delete l.boundSessionId;changed=true;}
  if(target&&l.bindingVersion!==2){l.bindingVersion=2;changed=true;}
 }
 if(changed&&persist)C.save();
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
function noteColor(n){return safeColor(n.color)||(important(n)?palette.high:palette.medium);}
function contrastColor(hex){const rgb=[1,3,5].map(i=>{const c=parseInt(hex.slice(i,i+2),16)/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.179?"#202020":"#ffffff";}
function automatic(a,b){return Number(important(b))-Number(important(a))||String(b.createdAt).localeCompare(String(a.createdAt));}
function sorted(){
 const order=new Map((Array.isArray(ui.manualOrder)?ui.manualOrder:[]).map((id,i)=>[id,i]));
 return [...notes].sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||(!a.pinned&&!b.pinned?Number(important(b))-Number(important(a)):0)||(ui.orderMode==="manual"&&!a.pinned&&!b.pinned?((order.get(a.id)??1e9)-(order.get(b.id)??1e9)):0)||automatic(a,b));
}
function moveNote(id,targetId,after=false){
 const n=note(id),target=note(targetId);if(!n||n.pinned||!target||target.pinned||id===targetId||important(n)!==important(target))return false;
 const order=sorted().filter(x=>!x.pinned).map(x=>x.id).filter(x=>x!==id);
 order.splice(order.indexOf(targetId)+(after?1:0),0,id);ui.manualOrder=order;ui.orderMode="manual";C.save();redraw();return true;
}
function resetOrder(){ui.orderMode="auto";ui.manualOrder=[];C.save();redraw();}
function toggleSelection(id){if(!note(id))return;selectedNotes.has(id)?selectedNotes.delete(id):selectedNotes.add(id);redraw();}
function selectionAction(act){
 if(act==="selectAll"){selecting=true;ui.filter="all";selectedNotes=new Set(notes.map(n=>n.id));}
 else if(act==="clearSelection"){selecting=true;selectedNotes.clear();}
 else if(act==="invertSelection"){selecting=true;ui.filter="all";selectedNotes=new Set(notes.filter(n=>!selectedNotes.has(n.id)).map(n=>n.id));}
 else{selecting=false;selectedNotes.clear();}
 C.save();redraw();
}
function toggleObservation(id){if(!note(id)?.description)return;const list=document.querySelector?.("#s8-panel .s8-note-list"),top=list?.scrollTop||0;expandedNotes.has(id)?expandedNotes.delete(id):expandedNotes.add(id);redraw();const next=document.querySelector?.("#s8-panel .s8-note-list");if(next)next.scrollTop=top;const fold=$("s8-note-"+id)?.querySelector?.(".s8-fold");fold?.scrollIntoView?.({block:"nearest",inline:"nearest"});}

function togglePin(idValue){const n=note(idValue);if(!n)return;n.pinned=!n.pinned;C.save();redraw();}
function setZoom(value,commit=false){
 ui.zoom=clamp(Number(value)||100,50,200);
 const list=document.querySelector?.("#s8-panel .s8-note-list"),out=$("s8-zoom-value"),slider=$("s8-zoom-slider");
 list?.style?.setProperty?.("--s8-z",String(ui.zoom/100));
 list?.style?.setProperty?.("--s8-card-width",Math.round((Number(ui.cardWidth)||212)*ui.zoom/100)+"px");
 if(out)out.textContent=ui.zoom+"%";if(slider)slider.value=String(ui.zoom);
 layoutNotes();if(commit)C.save();
}
function zoomBy(delta){setZoom((Number(ui.zoom)||100)+delta,true);redraw();}
function setOpacity(value,commit=false){
 ui.opacity=clamp(Number.isFinite(Number(value))?Number(value):28,0,100);
 applyAppearance();
 const out=$("s8-opacity-value");if(out)out.textContent=ui.opacity+"%";
 if(commit)C.save();
}
function selectColor(idValue,value){const n=note(idValue);if(!n)return;const color=safeColor(value);if(!color)throw Error("Cor inválida.");n.color=color;C.save();redraw();}
function pinPanel(){ui.keepOpen=!ui.keepOpen;opened=true;C.save();redraw();}
function visibleNotes(){return sorted().filter(n=>ui.filter==="pinned"?n.pinned:ui.filter==="all"||important(n)===(ui.filter==="high"));}
function syncSelection(){
 const total=notes.filter(n=>selectedNotes.has(n.id)).length;
 const count=$("s8-selection-count");if(count)count.textContent=total+" selecionado"+(total===1?"":"s");
 for(const b of document.querySelectorAll?.("[data-s8=bulkEdit]")||[])b.disabled=total===0;
 const all=document.querySelector?.("[data-s8=selectAll]");all?.setAttribute("aria-pressed",String(notes.length>0&&total===notes.length));
}
function selectAll(){
 if(selecting&&notes.length&&notes.every(n=>selectedNotes.has(n.id))){selectedNotes.clear();selecting=false;}
 else{selecting=true;ui.filter="all";selectedNotes=new Set(notes.map(n=>n.id));C.save();}
 redraw();
}
function bulkPin(value){if(!selectedNotes.size)return;for(const n of notes)if(selectedNotes.has(n.id))n.pinned=value;C.save();redraw();}
function bulkEdit(data){
 const chosen=notes.filter(n=>selectedNotes.has(n.id));if(!chosen.length)throw Error("Selecione ao menos um lembrete.");
 const mode=String(data.get("colorMode")||"keep"),color=safeColor(data.get("color")),priority=String(data.get("priority")||"keep"),pin=String(data.get("pin")||"keep");
 if(!["keep","custom","auto"].includes(mode)||mode==="custom"&&!color)throw Error("Escolha uma cor válida.");
 if(priority!=="keep"&&!["high","medium","low","yes","no"].includes(priority))throw Error("Escolha se os lembretes são importantes.");
 if(!["keep","pin","unpin"].includes(pin))throw Error("Fixação inválida.");
 for(const n of chosen){
  if(mode==="custom")n.color=color;else if(mode==="auto")n.color=null;
  if(priority!=="keep")n.priority=notePriority(priority);
  if(pin!=="keep")n.pinned=pin==="pin";
 }
 C.save();C.closeModal();redraw();C.notify(chosen.length+" lembrete(s) atualizado(s).");
}
function bulkEditMenu(){
 const chosen=notes.filter(n=>selectedNotes.has(n.id));if(!chosen.length){C.notify("Selecione ao menos um lembrete.");return;}
 C.openModal("Editar "+chosen.length+" lembrete"+(chosen.length===1?"":"s"),'<form id="s8-bulk-form" class="section-stack">'+
 '<label class="field"><span>Cor dos papéis</span><select name="colorMode" id="s8-bulk-color-mode"><option value="keep">Manter cores atuais</option><option value="custom">Mesma cor para os selecionados</option><option value="auto">Cor automática</option></select></label>'+
 '<div class="s8-swatches">'+swatches.map(color=>'<button type="button" class="s8-swatch" data-s8="bulkPreset" data-color="'+color+'" style="--swatch:'+color+'" aria-label="Cor '+color+'"></button>').join("")+'<input type="color" name="color" id="s8-bulk-color" value="#f5eecb" aria-label="Escolher qualquer cor"></div>'+
 '<label class="field"><span>Precisam de atenção especial?</span><select name="priority"><option value="keep">Manter atuais</option><option value="high">Sim</option><option value="low">Não</option></select></label>'+
 '<label class="field"><span>Fixação</span><select name="pin"><option value="keep">Manter atual</option><option value="pin">Fixar no topo</option><option value="unpin">Desafixar</option></select></label>'+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button type="submit" class="btn primary">Aplicar aos selecionados</button></div></form>');
}


function closeContext(){const node=document.querySelector?.("#s8-context");node?.remove();contextAnchor=null;}
function showContext(anchor,html){
 closeContext();if(!anchor?.getBoundingClientRect||!document.createElement)return;
 const menu=document.createElement("div");menu.id="s8-context";menu.className="s8-context orb-manage";menu.setAttribute("role","group");menu.setAttribute("aria-label","Opções do mural");menu.innerHTML=html;document.body.appendChild(menu);
 const r=anchor.getBoundingClientRect(),b=bounds(),w=menu.offsetWidth,h=menu.offsetHeight;
 menu.style.left=clamp(r.right-w,8,Math.max(8,b.width-w-8))+"px";
 menu.style.top=clamp(r.bottom+h+5<=b.height-8?r.bottom+5:r.top-h-5,8,Math.max(8,b.height-h-8))+"px";
 contextAnchor=anchor;menu.querySelector("button")?.focus({preventScroll:true});
}
function contextItem(act,ic,label,idValue="",tone=""){return '<button type="button" class="orb-manage-item '+tone+'" data-s8="'+act+'" data-id="'+A(idValue)+'"><span class="orb-manage-icon">'+glyph(ic)+'</span><span><strong>'+E(label)+'</strong></span><span aria-hidden="true">›</span></button>';}
function noteMenu(idValue,anchor){
 const n=note(idValue);if(!n)return;
 showContext(anchor||$("s8-note-"+idValue),'<div class="orb-manage-group">'+
 (n.description?contextItem("observation","note",expandedNotes.has(n.id)?"Recolher observação":"Abrir observação",n.id):"")+
 contextItem("edit","edit","Editar lembrete",n.id)+contextItem("quickColor","edit","Alterar cor",n.id)+contextItem("toggleImportant","sort",important(n)?"Retirar importância":"Marcar como importante",n.id)+contextItem("pinNote","pin",n.pinned?"Desafixar":"Fixar no topo",n.id)+contextItem("convert","arrow","Transformar em atividade",n.id)+contextItem("remove","trash","Excluir",n.id,"orb-risk")+'</div>');
}
function quickNoteOptions(idValue,kind){
 const n=note(idValue),anchor=$("s8-note-"+idValue);if(!n)return;
 showContext(anchor,'<div class="s8-quick-colors"><div class="s8-swatches">'+swatches.map(color=>'<button type="button" class="s8-swatch" data-s8="quickPreset" data-id="'+A(idValue)+'" data-color="'+color+'" style="--swatch:'+color+'" aria-label="Cor '+color+'"></button>').join("")+'<input type="color" data-s8-color="'+A(idValue)+'" value="'+noteColor(n)+'" aria-label="Outra cor"></div><button type="button" class="btn small ghost" data-s8="autoNoteColor" data-id="'+A(idValue)+'">Cor automática</button></div>');
}
function selectionMenu(anchor){showContext(anchor,'<div class="orb-manage-group">'+contextItem("selectAllContext","all","Selecionar todos")+contextItem("clearSelection","select","Desmarcar todos")+contextItem("invertSelection","sort","Inverter seleção")+contextItem("exitSelection","close","Sair da seleção")+'</div>');}
const appearanceKeys=["opacity","blur","background","backgroundColor","paperOpacity","spacing","radius","cardWidth","columns","layoutMode","fontSize","fontWeight","textAlign","shadow","showPriority","showAge","showDate","showLinks","showObservations"];
const ranges={opacity:[0,100],blur:[0,25],paperOpacity:[55,100],spacing:[2,24],radius:[0,20],cardWidth:[120,360],fontSize:[10,22],fontWeight:[400,800],columns:[0,6]};
const choices={background:["glass","transparent","solid","original"],layoutMode:["masonry","uniform","list"],textAlign:["left","center","right"]};
function setAppearance(key,value){
 if(!appearanceKeys.includes(key)&&key!=="keepOpen")return;
 if(ranges[key]){if(!Number.isFinite(Number(value)))return;value=clamp(Number(value),...ranges[key]);}
 else if(choices[key]){if(!choices[key].includes(value))return;}
 else if(key==="backgroundColor"){value=safeColor(value);}
 else value=!!value;
 ui[key]=value;applyAppearance();layoutNotes();
 const out=document.querySelector?.('[data-s8-value="'+key+'"]');if(out)out.textContent=value+(["opacity","paperOpacity"].includes(key)?"%":key==="columns"&&value===0?" (auto)":"");
}
function resetAppearance(){for(const k of appearanceKeys)ui[k]=defaults[k];C.save();redraw();settingsMenu();}
function settingsMenu(){
 const range=(key,label,step=1)=>'<label class="s8-setting"><span>'+label+' <output data-s8-value="'+key+'">'+ui[key]+(["opacity","paperOpacity"].includes(key)?"%":"")+'</output></span><input type="range" data-s8-pref="'+key+'" min="'+ranges[key][0]+'" max="'+ranges[key][1]+'" step="'+step+'" value="'+ui[key]+'"></label>';
 const select=(key,label,opts)=>'<label class="s8-setting"><span>'+label+'</span><select data-s8-pref="'+key+'">'+opts.map(([v,l])=>'<option value="'+v+'" '+(ui[key]===v?"selected":"")+'>'+l+'</option>').join("")+'</select></label>';
 const toggle=(key,label)=>'<label class="s8-setting s8-switch"><span>'+label+'</span><input type="checkbox" data-s8-pref="'+key+'" '+(ui[key]?"checked":"")+'></label>';
 const group=(label,html,open=false)=>'<details class="s8-setting-group" '+(open?"open":"")+'><summary>'+label+'</summary><div>'+html+'</div></details>';
 C.openModal("Configurações do mural",'<div class="section-stack s8-settings">'+
 group("Aparência",select("background","Fundo",[["glass","Vidro translúcido"],["transparent","Transparente"],["solid","Sólido"],["original","Tema original"]])+range("opacity","Opacidade do fundo")+range("blur","Desfoque")+'<label class="s8-setting"><span>Cor do fundo</span><input type="color" data-s8-pref="backgroundColor" value="'+(safeColor(ui.backgroundColor)||"#11132a")+'"></label><button type="button" class="btn small ghost" data-s8="themeColor">Usar cor do tema</button>'+range("paperOpacity","Opacidade dos papéis")+range("radius","Bordas")+toggle("shadow","Sombras dos papéis"),true)+
 group("Organização",select("layoutMode","Distribuição",[["masonry","Compacta"],["uniform","Grade uniforme"],["list","Lista"]])+range("columns","Colunas (0 = automático)")+range("spacing","Espaçamento")+range("cardWidth","Largura dos cartões"))+
 group("Tipografia",range("fontSize","Tamanho do texto")+range("fontWeight","Espessura",50)+select("textAlign","Alinhamento",[["left","Esquerda"],["center","Centro"],["right","Direita"]]))+
 group("Informações visíveis",toggle("showPriority","Indicador de importância")+toggle("showAge","Tempo desde a criação")+toggle("showDate","Data de criação")+toggle("showLinks","Vínculos")+toggle("showObservations","Indicador de observação"))+
 group("Comportamento",toggle("keepOpen","Manter mural aberto ao voltar ao Início"))+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-s8="resetAppearance">Restaurar aparência</button><button type="button" class="btn primary" data-action="closeModal">Fechar</button></div></div>');
}
function applyAppearance(){
 const panel=document.querySelector?.("#s8-panel");if(!panel)return;
 const style=panel.style,vars={"--s8-opacity":(ui.background==="transparent"?0:ui.background==="solid"?100:clamp(Number(ui.opacity),0,100))+"%","--s8-blur":(ui.background==="transparent"||ui.background==="solid"?0:ui.blur)+"px","--s8-base":safeColor(ui.backgroundColor)||"var(--bg2)","--s8-paper-opacity":ui.paperOpacity+"%","--s8-gap":ui.spacing+"px","--s8-radius":ui.radius+"px","--s8-font":ui.fontSize+"px","--s8-weight":ui.fontWeight,"--s8-align":ui.textAlign,"--s8-shadow":ui.shadow?"0 3px 10px #0003":"none"};
 for(const [k,v] of Object.entries(vars))style.setProperty(k,String(v));
 panel.dataset.layout=ui.layoutMode;panel.dataset.showPriority=String(ui.showPriority);panel.dataset.showAge=String(ui.showAge);panel.dataset.showDate=String(ui.showDate);panel.dataset.showLinks=String(ui.showLinks);panel.dataset.showObservations=String(ui.showObservations);
 const list=panel.querySelector(".s8-note-list");list?.style.setProperty("--s8-card-width",Math.round(ui.cardWidth*ui.zoom/100)+"px");
}
function layoutNotes(){
 const panel=document.querySelector?.("#s8-panel"),list=panel?.querySelector(".s8-note-list");if(!list)return;
 const gap=Math.max(0,Number(ui.spacing)||0);
 for(const group of list.querySelectorAll(".s8-note-group")){
  const cards=group.querySelectorAll(".s8-note"),w=group.clientWidth;if(!w)continue;
  const cols=ui.layoutMode==="list"?1:Math.max(1,Math.min(cards.length||1,Math.floor((w+gap)/110),Number(ui.columns)||Math.floor((w+gap)/(ui.cardWidth*ui.zoom/100+gap))||1));
  // Native column/row layout reserves the full intrinsic height, even while
  // descriptions, images, fonts or viewport dimensions change.
  const value=String(cols);
  if(group.style.getPropertyValue("--s8-cols")!==value)group.style.setProperty("--s8-cols",value);
 }
}
function observeLayout(){
 layoutObserver?.disconnect();layoutObserver=null;applyAppearance();layoutNotes();
 const list=document.querySelector?.("#s8-panel .s8-note-list");
 if(list&&typeof ResizeObserver!=="undefined")layoutObserver=new ResizeObserver(()=>layoutNotes()),layoutObserver.observe(list);
}

function markup(){
 if(!opened)return '<div id="s8-floating-root" class="s8-float" aria-label="Lembretes"><button type="button" class="s8-trigger" data-s8="toggle" aria-expanded="false" title="Abrir lembretes" aria-label="Abrir lembretes">'+"<svg width=\"27\" height=\"27\" viewBox=\"0 0 28 28\" fill=\"none\" aria-hidden=\"true\"><path d=\"M5 7h18v17H5z\" fill=\"#f4e5ad\" stroke=\"#aa9860\" stroke-width=\"1.5\"/><path d=\"M7 11h14M7 15h14M7 19h10\" stroke=\"#b4a675\" stroke-width=\"1.3\" stroke-linecap=\"round\"/><path d=\"m15 4 4 5\" stroke=\"#a44950\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><circle cx=\"14\" cy=\"5\" r=\"4\" fill=\"#d96874\" stroke=\"#a44950\" stroke-width=\"1\"/><circle cx=\"13\" cy=\"4\" r=\"1.1\" fill=\"#ffe2e5\"/></svg>"+(notes.length?'<span class="s8-count">'+notes.length+'</span>':"")+'</button></div>';
 const renderNote=n=>{
  const p=important(n)?"high":"low",link=n.link?linkLabel(n.link):n.lastLinkLabel?"Vínculo encerrado · "+n.lastLinkLabel:"";
  return '<article id="s8-note-'+A(n.id)+'" data-s8-card="'+A(n.id)+'" class="s8-note s8-priority-'+p+(highlightIds.includes(n.id)?' s8-highlight':'')+(selecting&&selectedNotes.has(n.id)?' s8-selected':'')+(n.pinned?' s8-pinned':'')+(n.description?' s8-has-observation':'')+(expandedNotes.has(n.id)?' s8-expanded':'')+'" tabindex="0" '+(selecting?'role="checkbox" aria-checked="'+selectedNotes.has(n.id)+'"': 'role="group"')+' aria-label="'+A(n.title)+'" style="--s8-note-bg:'+noteColor(n)+';--s8-note-fg:'+contrastColor(noteColor(n))+'">'+
   '<div class="s8-note-top">'+(selecting&&selectedNotes.has(n.id)?'<span class="s8-selected-mark" aria-hidden="true">'+glyph("check")+'</span>':"")+
   (important(n)?'<span class="s8-note-priority" data-priority="high" title="Precisa de atenção especial">Importante</span>':"")+'<div class="s8-note-tools">'+
   '<small class="s8-age">'+E(age(n.createdAt))+'</small><small class="s8-created">'+E(String(n.createdAt||"").slice(0,10).split("-").reverse().join("/"))+'</small>'+(link?'<span class="s8-link-symbol" title="'+A(link)+'" aria-label="'+A(link)+'">'+glyph("link")+'</span>':"")+
   smallButton("pinNote","pin",n.pinned?"Desafixar lembrete":"Fixar no topo",'data-id="'+A(n.id)+'" aria-pressed="'+!!n.pinned+'"')+
   smallButton("noteMenu","more","Mais opções",'data-id="'+A(n.id)+'"')+'</div></div>'+
   '<button class="s8-note-title" type="button" data-s8="noteMenu" data-id="'+A(n.id)+'">'+E(n.title)+'</button>'+
   (n.description?'<button class="s8-fold" type="button" data-s8="observation" data-id="'+A(n.id)+'" aria-label="Abrir ou recolher observação" aria-expanded="'+expandedNotes.has(n.id)+'"></button>':"")+
   (n.description&&expandedNotes.has(n.id)?'<p class="s8-observation">'+E(n.description)+'</p>':"")+galleryMarkup(n)+'</article>';
 };
 const visible=visibleNotes(),pinned=visible.filter(n=>n.pinned),urgent=visible.filter(n=>!n.pinned&&important(n)),others=visible.filter(n=>!n.pinned&&!important(n));
 const list=(pinned.length?'<div class="s8-note-group s8-pinned-group">'+pinned.map(renderNote).join("")+'</div>':"")+(urgent.length?'<div class="s8-note-group s8-important-group">'+urgent.map(renderNote).join("")+'</div>':"")+(others.length?'<div class="s8-note-group">'+others.map(renderNote).join("")+'</div>':"");
 const z=clamp((Number(ui.zoom)||100)/100,.5,2);
 return '<div id="s8-floating-root" class="s8-float s8-open" aria-label="Lembretes"><section id="s8-panel" class="s8-panel" style="--s8-opacity:'+clamp(Number(ui.opacity),0,100)+'%" aria-label="Mural de lembretes"><header class="s8-panel-head"><div data-s8="movePanel" title="'+(ui.locked?"Mural travado":"Arraste para mover o mural")+'"><strong>Lembretes <small>'+visibleNotes().length+(visibleNotes().length!==notes.length?"/"+notes.length:"")+'</small></strong>'+'</div><div class="s8-head-tools">'+
 smallButton("new","plus","Novo lembrete")+smallButton("lock",ui.locked?"lock":"unlock",ui.locked?"Destravar mural":"Travar posição e tamanho",'aria-pressed="'+!!ui.locked+'"')+smallButton("settings","more","Aparência do mural")+smallButton("close","close","Fechar mural")+'</div></header>'+
 '<div class="s8-toolbar"><div class="s8-toolbar-group">'+smallButton("selectMode","select","Selecionar · botão direito para opções",'aria-pressed="'+selecting+'"')+smallButton("resetOrder","sort","Organizar por importância",'aria-pressed="'+(ui.orderMode==="auto")+'"')+'</div><select id="s8-filter" aria-label="Filtrar lembretes">'+[["all","Todos"],["pinned","Fixados"],["high","Importantes"],["low","Comuns"]].map(([k,l])=>'<option value="'+k+'" '+(ui.filter===k?"selected":"")+'>'+l+'</option>').join("")+'</select></div>'+
 (selecting?'<div class="s8-bulk-tools"><span id="s8-selection-count">'+selectedNotes.size+' selecionado'+(selectedNotes.size===1?"":"s")+'</span><button type="button" class="s8-bulk-edit" data-s8="bulkEdit" '+(!selectedNotes.size?"disabled":"")+'>'+glyph("edit")+' Editar</button>'+smallButton("selectMode","close","Sair da seleção")+'</div>':"")+
 '<div class="s8-note-list" style="--s8-z:'+z+';--s8-card-width:'+Math.round(ui.cardWidth*z)+'px">'+(list||'<p class="s8-empty">'+(notes.length?"Sem lembretes neste filtro.":"Nenhum lembrete.")+'</p>')+'</div>'+
 '<div class="s8-zoom-bar">'+smallButton("reset","reset","Restaurar posição e tamanho")+'<span class="s8-footer-divider"></span>'+smallButton("zoomOut","minus","Diminuir zoom")+'<input id="s8-zoom-slider" type="range" min="50" max="200" step="5" value="'+(Number(ui.zoom)||100)+'" aria-label="Zoom dos lembretes"><output id="s8-zoom-value">'+Math.round(Number(ui.zoom)||100)+'%</output>'+smallButton("zoomIn","plus","Aumentar zoom")+'</div>'+
 (!ui.locked?["nw","n","ne","e","se","s","sw","w"].map(edge=>'<div class="s8-resize-handle s8-edge-'+edge+'" data-s8="resize" data-edge="'+edge+'" title="Redimensionar mural" aria-hidden="true"></div>').join(""):"")+'</section></div>';
}

function redraw(){closeContext();C.render();}
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
 const attachments=noteImages(n).slice();
 C.openModal(n?"Editar lembrete":"Novo lembrete",'<form id="s8-note-form" class="section-stack">'+
 '<input type="hidden" name="id" value="'+A(n?.id||"")+'">'+
 '<div class="field"><label>Título</label><input name="title" maxlength="140" required value="'+A(n?.title||"")+'" placeholder="O que você quer lembrar?"></div>'+
 '<div class="field"><label for="s8-description">Observações (opcional)</label><div class="s8-composer" id="s8-composer"><textarea id="s8-description" name="description" maxlength="1200" rows="3" placeholder="Escreva ou cole uma imagem (Ctrl + V)…">'+E(n?.description||"")+'</textarea>'+
 '<div class="s8-image-edit-list" id="s8-image-edit-list">'+imageEditorMarkup(attachments)+'</div>'+
 '<div class="s8-composer-tools"><small id="s8-image-edit-status" aria-live="polite">'+(attachments.length?attachments.length+'/'+IMAGE_LIMIT+' imagens':'')+'</small><button type="button" class="s8-composer-attach" data-s8="chooseImages" aria-label="Adicionar imagens" title="Adicionar imagens de uma pasta">'+glyph("imageAdd")+'</button><input class="s8-image-file" id="s8-image-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp" multiple tabindex="-1" aria-label="Selecionar arquivos de imagem"></div></div></div>'+
 '<fieldset class="s8-importance-field"><legend>Este lembrete precisa de atenção especial?</legend><div class="s8-importance-choice">'+[["low","Não"],["high","Sim"]].map(([key,label])=>'<label><input type="radio" name="priority" value="'+key+'" '+((important(n)? "high":"low")===key?"checked":"")+'><span>'+label+'</span></label>').join("")+'</div></fieldset>'+
 '<div class="field"><label>Cor do papel</label><div class="s8-swatches">'+swatches.map(color=>'<button type="button" class="s8-swatch" data-s8="presetColor" data-color="'+color+'" style="--swatch:'+color+'" aria-label="Cor '+color+'"></button>').join("")+'<input type="color" name="color" id="s8-note-color" aria-label="Escolher qualquer cor" value="'+noteColor(n||{priority:"medium"})+'"></div><label class="checkline"><input type="checkbox" name="autoColor" '+(!safeColor(n?.color)?"checked":"")+'> Cor automática</label><label class="checkline"><input type="checkbox" name="pinned" '+(n?.pinned?"checked":"")+'> Fixar este lembrete no topo</label></div>'+
 '<div class="field"><label>Ícone quando vinculado</label><select name="icon">'+Object.entries(icons).map(([key,value])=>'<option value="'+key+'" '+((n?.icon||"pin")===key?"selected":"")+'>'+E(value)+'</option>').join("")+'</select></div>'+
 '<div class="field"><label>Onde este lembrete deve aparecer?</label><select name="linkScope" id="s8-link-scope">'+Object.entries(scopeLabel).filter(([k])=>k!=="legacy").map(([k,v])=>'<option value="'+k+'" '+((preselected? (preselected.scope===k) : initialScope(n)===k)?"selected":"")+'>'+E(v)+'</option>').join("")+(initialScope(n)==="legacy"?'<option value="legacy" selected>Vínculo anterior</option>':"")+'</select></div>'+
 '<div class="field" id="s8-target-wrap" '+(scope==="none"?"hidden":"")+'><label id="s8-target-label">Escolher vínculo</label>'+
 '<div id="s8-future-date-wrap" '+(scope==="future"?"":"hidden")+'><label for="s8-future-date">Data da atividade</label><input type="date" id="s8-future-date" value="'+A(targetDate)+'" min="'+A(C.today())+'"></div>'+
 '<label class="s8-search-label" for="s8-target-search">Filtrar opções</label><input type="search" id="s8-target-search" placeholder="Pesquisar atividade ou matéria" autocomplete="off">'+
 '<select name="target" id="s8-link-target">'+targets(target,scope,scope==="future"?targetDate:undefined)+'</select>'+
 '<small id="s8-link-help">Vínculos específicos encerram ao concluir a atividade; o lembrete permanece no mural.</small></div>'+
 '<p class="note">Lembretes não possuem conclusão ou data obrigatória. Ficam aqui até você excluir ou transformar em uma atividade.</p>'+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button type="submit" class="btn primary">Salvar lembrete</button></div></form>');
 imageDraft={id:n?.id||"",items:attachments,busy:false,message:"",form:$("s8-note-form")};refreshImageEditor(imageDraft);
}
function saveNote(data,attachments){
 const title=String(data.get("title")||"").trim().slice(0,140);
 const description=String(data.get("description")||"").trim().slice(0,1200);
 const priority=notePriority(data.get("priority"));
 const icon=String(data.get("icon")||"pin"),scope=String(data.get("linkScope")||"");
 const link=parseTarget(scope==="none"?"none":data.get("target"));
 if(scope&&scope!=="legacy"&&scope!=="none"&&!link)throw Error("Escolha a atividade, matéria ou ciclo para vincular.");
 if(scope==="next"&&link?.scope!=="next")throw Error("Escolha uma matéria válida para a próxima sessão.");
 if(!Object.hasOwn(icons,icon))throw Error("Ícone inválido.");
 if(link&&complete(link))throw Error("A atividade já foi concluída ou removida. Escolha outra.");
 if(!title)throw Error("Informe o título do lembrete.");
 if(!Object.hasOwn(labels,priority))throw Error("Prioridade inválida.");
 const existing=note(String(data.get("id")||""));
 const images=attachments===undefined?noteImages(existing):attachments;
 if(!Array.isArray(images)||images.length>IMAGE_LIMIT||!images.every(validImage)||!imageBudget(images,existing?.id||""))throw Error("Limite de armazenamento de imagens atingido.");
 const old=existing?{...existing}:null;
 const color=data.get("autoColor")?null:safeColor(data.get("color"))||existing?.color||null;
 const pinned=data.get("pinned")!==null;
 if(existing&&link?.scope==="next"&&existing.link?.scope==="next"&&link.id===existing.link.id&&link.cycleId===existing.link.cycleId){
  const old=existing.link,bound=S3?.model?.sessions?.find(x=>x.id===old.boundSessionId);
  if(old.bindingVersion===2&&bound&&!bound.archived&&(bound.status==="progress"||bound.id===root.timing?.active?.sessionId)){link.boundSessionId=old.boundSessionId;link.bindingVersion=2;}
 }
 if(existing)Object.assign(existing,{title,description,priority,icon,link,color,pinned,images:images.slice(),lastLinkLabel:link?null:existing.lastLinkLabel,updatedAt:new Date().toISOString()});
 else notes.push({id:id(),title,description,priority,icon,link,color,pinned,images:images.slice(),createdAt:new Date().toISOString()});
 if(C.save()===false){
  if(existing){for(const k of Object.keys(existing))if(!Object.hasOwn(old,k))delete existing[k];Object.assign(existing,old);}else notes.pop();
  throw Error("Não foi possível salvar. Remova imagens ou libere espaço e tente novamente.");
 }
 bindNextNotes();C.save();imageDraft=null;C.closeModal();redraw();C.notify(existing?"Lembrete atualizado.":"Lembrete adicionado.");
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
 notes.splice(notes.indexOf(n),1);imagePositions.delete(n.id);if(imageViewer?.id===n.id)closeImageViewer();
 C.save();redraw();C.notify("Lembrete excluído.");
}
function convert(idValue){
 const n=note(idValue);if(!n)return C.notify("Lembrete não encontrado.");
 if(!C.availabilityReady())return C.notify("Configure a disponibilidade antes de planejar uma atividade.");
 const date=C.today()>C.state.firstAccess?C.today():C.state.firstAccess;
 C.openModal("Transformar em atividade",'<form id="s8-convert-form" class="section-stack"><input type="hidden" name="id" value="'+A(n.id)+'">'+
 '<p class="note">Crie um foco do dia ou uma tarefa secundária. O lembrete será removido somente após salvar a atividade.</p>'+
 (noteImages(n).length?'<label class="checkline"><input type="checkbox" name="discardImages" required> Entendo que as imagens serão excluídas na conversão.</label>':"")+
 '<div class="field"><label>Transformar em</label><select name="type"><option value="task">Tarefa secundária</option><option value="focus">Foco do dia</option></select></div>'+
 '<div class="field"><label>Atividade</label><input name="title" required maxlength="140" value="'+A(n.title)+'"></div>'+
 '<div class="field"><label>Data</label><input type="date" name="date" required min="'+A(C.state.firstAccess)+'" value="'+A(date)+'"></div>'+
 '<div class="field"><label>Prioridade (para tarefas secundárias)</label><select name="priority">'+Object.entries(labels).map(([k,v])=>'<option value="'+k+'" '+((important(n)?"high":"medium")===k?"selected":"")+'>'+v+'</option>').join("")+'</select></div>'+
 '<div class="field"><label>Objetivo relacionado (opcional)</label><select name="goalId"><option value="">Sem objetivo</option>'+ (root.goals||[]).filter(g=>!g.archived).map(g=>'<option value="'+A(g.id)+'">'+E(g.title)+'</option>').join("")+'</select></div>'+
 '<div class="field"><label>Horário (opcional)</label><input type="time" name="startTime"></div>'+
 '<div class="field"><label>Duração estimada em minutos (opcional)</label><input type="number" name="estimatedMin" min="1" max="1440"></div>'+
 (n.description?'<p class="note">Observação original: '+E(n.description)+'</p>':"")+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button type="submit" class="btn primary">Criar atividade</button></div></form>');
}
function convertSubmit(data){
 const n=note(String(data.get("id")||""));if(!n)throw Error("Lembrete não encontrado.");
 if(noteImages(n).length&&!data.get("discardImages"))throw Error("Confirme a remoção das imagens antes de converter.");
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
 const card=ev.target.closest?.("[data-s8-card]");
 if(card&&Date.now()<skipClickUntil){ev.preventDefault();return;}
 if(card&&selecting){ev.preventDefault();toggleSelection(card.dataset.s8Card);return;}
 const b=ev.target.closest?.("[data-s8]");
 if(!b){if(card){noteMenu(card.dataset.s8Card,card);return;}if(!ev.target.closest?.("#s8-context"))closeContext();return;}
 ev.preventDefault();
 const action=b.dataset.s8;
 if(action!=="noteMenu"&&action!=="selectMode")closeContext();
 try{
  if(action==="toggle"){if(Date.now()<skipClickUntil){ev.stopPropagation?.();return;}openPanel();}
  else if(action==="close")closePanel();
  else if(action==="settings")settingsMenu();
  else if(action==="noteMenu")noteMenu(b.dataset.id,b);
  else if(action==="observation")toggleObservation(b.dataset.id);
  else if(action==="quickColor")quickNoteOptions(b.dataset.id,action);
  else if(action==="quickPreset")selectColor(b.dataset.id,b.dataset.color);
  else if(action==="autoNoteColor"){const n=note(b.dataset.id);if(n){n.color=null;C.save();redraw();}}
  else if(action==="toggleImportant"){const n=note(b.dataset.id);if(n){n.priority=important(n)?"low":"high";C.save();redraw();}}
  else if(action==="resetOrder")resetOrder();
  else if(action==="selectAllContext"||action==="clearSelection"||action==="invertSelection"||action==="exitSelection")selectionAction(action);
  else if(action==="resetAppearance")resetAppearance();
  else if(action==="themeColor"){ui.backgroundColor="";C.save();applyAppearance();settingsMenu();}
  else if(action==="imageOpen")openImageViewer(b.dataset.id);
  else if(action==="imagePrev"||action==="imageNext")moveImage(b.dataset.id,action==="imagePrev"?-1:1);
  else if(action==="viewerPrev"||action==="viewerNext"){if(imageViewer){moveImage(imageViewer.id,action==="viewerPrev"?-1:1);imageViewer?.root.querySelector('[data-s8="'+action+'"]')?.focus();}}
  else if(action==="imageClose")closeImageViewer();
  else if(action==="imageZoomIn"||action==="imageZoomOut"||action==="imageZoomReset")imageZoom(action==="imageZoomIn"?.5:action==="imageZoomOut"?-.5:0);
  else if(action==="chooseImages"){$("s8-image-input")?.click();}
  else if(action==="removeImageDraft"){if(imageDraft&&!imageDraft.busy){imageDraft.items.splice(Number(b.dataset.index),1);imageDraft.message="";refreshImageEditor(imageDraft);}}
  else if(action==="new")edit();
  else if(action==="lock")toggleLock();
  else if(action==="reset"){if(window.confirm("Restaurar posição, tamanho e zoom do mural?"))resetLayout();}
  else if(action==="pinNote"){if(b.closest?.(".modal-card"))C.closeModal();togglePin(b.dataset.id);}
  else if(action==="pinPanel")pinPanel();
  else if(action==="selectMode"){if(selectionHeld){selectionHeld=false;return;}selecting=!selecting;selectedNotes.clear();redraw();}
  else if(action==="selectAll")selectAll();
  else if(action==="bulkEdit")bulkEditMenu();
  else if(action==="bulkPreset"){const input=$("s8-bulk-color"),mode=$("s8-bulk-color-mode");if(input)input.value=b.dataset.color;if(mode)mode.value="custom";}
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
 const select=ev.target.closest?.('[data-s8="selectMode"]');if(select){ev.preventDefault();selectionMenu(select);return;}
 const card=ev.target.closest?.("[data-s8-card]");if(!card)return;ev.preventDefault();
 if(selecting){toggleSelection(card.dataset.s8Card);return;}
 if(note(card.dataset.s8Card)?.description&&!ev.target.closest?.('[data-s8="noteMenu"].s8-mini'))toggleObservation(card.dataset.s8Card);else noteMenu(card.dataset.s8Card,card);
});
document.addEventListener("change",event=>{
 const t=event.target;
 if(t?.id==="s8-image-input"){const files=Array.from(t.files||[]);t.value="";void addDraftImages(files);return;}
 if(t?.dataset?.s8Pref){setAppearance(t.dataset.s8Pref,t.type==="checkbox"?t.checked:t.value);C.save();return;}
 if(t?.dataset?.s8Select){if(t.checked)selectedNotes.add(t.dataset.s8Select);else selectedNotes.delete(t.dataset.s8Select);syncSelection();return;}
 if(t?.id==="s8-zoom-slider"){setZoom(t.value,true);return;}
 if(t?.id==="s8-opacity-slider"){setOpacity(t.value,true);return;}
 if(t?.id==="s8-keep-open"){ui.keepOpen=!!t.checked;C.save();return;}
 if(t?.id==="s8-bulk-color"){const mode=$("s8-bulk-color-mode");if(mode)mode.value="custom";return;}
 if(t?.dataset?.s8Color){selectColor(t.dataset.s8Color,t.value);return;}
 if(t?.id==="s8-filter"){ui.filter=normalizeFilter(t.value);C.save();redraw();return;}
 if(t?.id==="s8-note-color"){const auto=t.closest("form")?.querySelector('[name="autoColor"]');if(auto)auto.checked=false;}
 if(event.target?.id==="s8-link-scope")updateTargetSelect(event.target.value);
 if(event.target?.id==="s8-future-date")updateTargetSelect($("s8-link-scope")?.value||"future");
});
document.addEventListener("paste",event=>{if(!imageDraft?.form?.isConnected||event.target?.id!=="s8-description"||!imageDraft.form.contains(event.target))return;const clip=event.clipboardData;const items=Array.from(clip?.items||[]).filter(x=>x.kind==="file"&&x.type.startsWith("image/")).map(x=>x.getAsFile()).filter(Boolean);const files=items.length?items:Array.from(clip?.files||[]).filter(x=>x.type.startsWith("image/"));if(files.length){event.preventDefault();void addDraftImages(files);}});
document.addEventListener("input",event=>{
 if(event.target?.dataset?.s8Pref&&["range","color"].includes(event.target.type)){setAppearance(event.target.dataset.s8Pref,event.target.value);return;}
 if(event.target?.id==="s8-zoom-slider"){setZoom(event.target.value);return;}
 if(event.target?.id==="s8-opacity-slider"){setOpacity(event.target.value);return;}
 if(event.target?.id==="s8-target-search")updateTargetSelect($("s8-link-scope")?.value||"today",true);
});
document.addEventListener("pointerdown",ev=>{
 const select=ev.target.closest?.('[data-s8="selectMode"]');
 if(select?.dataset?.s8==="selectMode"&&ev.pointerType==="touch"){selectionHeld=false;selectionHold=setTimeout(()=>{selectionHeld=true;selectionMenu(select);},500);}
 const card=ev.target.closest?.("[data-s8-card]");
 if(card?.dataset?.s8Card&&!selecting&&ev.button===0&&!note(card.dataset.s8Card)?.pinned&&!ev.target.closest?.(".s8-mini,.s8-fold,.s8-gallery")){
  cardDrag={id:card.dataset.s8Card,pointer:ev.pointerId,x:ev.clientX,y:ev.clientY,card,moved:false,target:null,after:false};return;
 }
 pointerStart(ev);
});
document.addEventListener("pointermove",ev=>{
 if(!cardDrag||cardDrag.pointer!==ev.pointerId){pointerMove(ev);return;}
 const d=cardDrag;if(!d.moved&&Math.hypot(ev.clientX-d.x,ev.clientY-d.y)<7)return;
 d.moved=true;ev.preventDefault();d.card.classList.add("s8-dragging");
 const target=document.elementFromPoint?.(ev.clientX,ev.clientY)?.closest?.("[data-s8-card]");
 d.target?.classList.remove("s8-drop-before","s8-drop-after");d.target=null;
 if(target&&target!==d.card&&!note(target.dataset.s8Card)?.pinned&&important(note(target.dataset.s8Card))===important(note(d.id))){const r=target.getBoundingClientRect();d.target=target;d.after=ev.clientY>r.top+r.height/2;target.classList.add(d.after?"s8-drop-after":"s8-drop-before");}
},{passive:false});
function endCardDrag(ev){
 if(!cardDrag||cardDrag.pointer!==ev.pointerId)return;
 const d=cardDrag;cardDrag=null;d.card.classList.remove("s8-dragging");d.target?.classList.remove("s8-drop-before","s8-drop-after");
 if(d.moved){skipClickUntil=Date.now()+350;if(ev.type!=="pointercancel"&&d.target)moveNote(d.id,d.target.dataset.s8Card,d.after);}
}
document.addEventListener("pointerup",ev=>{if(selectionHold!==null){clearTimeout(selectionHold);selectionHold=null;}endCardDrag(ev);pointerEnd(ev);});
document.addEventListener("pointercancel",ev=>{if(selectionHold!==null){clearTimeout(selectionHold);selectionHold=null;}endCardDrag(ev);pointerEnd(ev);});

window.addEventListener?.("resize",()=>{closeContext();if($("s8-floating-root")){place();layoutNotes();}});
document.addEventListener("submit",ev=>{
 const formId=ev.target?.getAttribute?.("id")||ev.target?.id;
 if(!["s8-note-form","s8-convert-form","s8-layout-form","s8-bulk-form"].includes(formId))return;
 ev.preventDefault();
 try{
  const data=new FormData(ev.target);
  if(formId==="s8-note-form"){const draft=imageDraft?.form===ev.target?imageDraft:null;if(draft?.busy)throw Error("Aguarde o preparo das imagens.");saveNote(data,draft?.items);}
  else if(formId==="s8-layout-form")applyLayout(data);
  else if(formId==="s8-bulk-form")bulkEdit(data);
  else convertSubmit(data);
 }catch(err){C.notify(err.message||"Verifique os dados informados.");}
});
document.addEventListener("scroll",ev=>{if(contextAnchor&&ev.target.closest?.(".s8-note-list"))closeContext();},true);
document.addEventListener("keydown",ev=>{
 if(imageViewer){
  if(["Escape","ArrowLeft","ArrowRight","+","-","=","0","Tab"].includes(ev.key)){ev.preventDefault();ev.stopImmediatePropagation?.();
   if(ev.key==="Escape")closeImageViewer();
   else if(ev.key==="ArrowLeft"||ev.key==="ArrowRight"){moveImage(imageViewer.id,ev.key==="ArrowLeft"?-1:1);imageViewer?.root.querySelector('[data-s8="imageClose"]')?.focus();}
   else if(ev.key==="Tab"){const bs=Array.from(imageViewer.root.querySelectorAll("button"));const i=bs.indexOf(document.activeElement);bs[(i+(ev.shiftKey?-1:1)+bs.length)%bs.length]?.focus();}
   else imageZoom(ev.key==="0"?0:ev.key==="-"?-.5:.5);
  }else if(!imageViewer.root.contains(ev.target)){ev.preventDefault();ev.stopImmediatePropagation?.();}
 }
},true);
document.addEventListener("keydown",ev=>{
 if(ev.key==="Escape"&&contextAnchor){const anchor=contextAnchor;closeContext();anchor?.focus?.({preventScroll:true});return;}
 if(ev.target.closest?.('[data-s8="selectMode"]')&&["ArrowDown","ContextMenu"].includes(ev.key)){ev.preventDefault();selectionMenu(ev.target.closest('[data-s8="selectMode"]'));return;}
 const card=ev.target.closest?.("[data-s8-card]");if(card&&selecting&&[" ","Enter"].includes(ev.key)){ev.preventDefault();toggleSelection(card.dataset.s8Card);return;}
 if(ev.key==="Escape"&&opened&&!$("modal-host")?.querySelector?.(".modal-layer"))closePanel();
});
window.OrbitaStage8={decorate(route,base){if(route==="inicio"){prune();return base+markup();}return base},indicatorFor:indicators,afterRender(route){
 if(contextAnchor&&!contextAnchor.isConnected)closeContext();
 const incoming=document.querySelector?.('#view #s8-floating-root');
 const detached=document.querySelectorAll?.('body > #s8-floating-root')||[];
 if(route!=="inicio"){closeImageViewer();closeContext();layoutObserver?.disconnect();for(const node of detached)node.remove?.();return;}
 if(incoming&&document.body?.appendChild){
  for(const node of detached)if(node!==incoming)node.remove?.();
  document.body.appendChild(incoming);
 }
 if(contextAnchor&&!contextAnchor.isConnected)closeContext();
 place();observeLayout();
},inspect:{get notes(){return notes},get layout(){return ui},saveNote,noteImages,imageBudget,validImage,galleryMarkup,imageIndex,moveImage,remove,convertSubmit,age,sorted,togglePin,zoomBy,setZoom,setOpacity,selectAll,bulkEdit,moveNote,resetOrder,selectionAction,toggleSelection,toggleObservation,setAppearance,selectColor,panelRect,position,openPanel,closePanel,applyLayout,toggleLock,resetLayout,indicators,prune,jump,parseTarget,nextCandidate,bindNextNotes,targetRows,updateTargetSelect,linkLabel,selectedDateForLink,edit}};
C.render();
})();
