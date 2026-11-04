// Fluxo real de DOM/HTML5 no Chromium. Os testes de VM não executam validação nativa de formulários.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,stat} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import {resolve,extname,sep} from "node:path";
import puppeteer from "puppeteer-core";

const chrome=["google-chrome","google-chrome-stable","chromium","chromium-browser"].map(name=>spawnSync("which",[name],{encoding:"utf8"})).find(r=>r.status===0)?.stdout.trim();
if(!chrome)throw Error("É necessário Chrome/Chromium para validar o clique real de salvamento.");
const root=resolve(new URL("../",import.meta.url).pathname);
const types={".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".html":"text/html; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".webmanifest":"application/manifest+json"};
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
  // A conexão real com o Supabase não é necessária para verificar o formulário.
  if(path==="/stage5.js"){res.writeHead(200,{"Content-Type":"text/javascript"});return res.end("");}
  const dest=resolve(root,"."+path.replace(/\/$/,"/index.html"));
  if(!dest.startsWith(root+sep))throw Error("path invalid");
  const body=await readFile(dest);
  res.writeHead(200,{"Content-Type":types[extname(dest)]||"application/octet-stream"});
  res.end(body);
 }catch(err){res.writeHead(404);res.end(String(err));}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const address=server.address();
let browser;
try{
 browser=await puppeteer.launch({executablePath:chrome,headless:true,args:["--no-sandbox","--disable-dev-shm-usage","--disable-gpu"]});
 const page=await browser.newPage();
 const errors=[];
 page.on("pageerror",err=>errors.push(err.message));
 await page.goto("http://127.0.0.1:"+address.port+"/index.html#disponibilidade",{waitUntil:"load"});
 await page.waitForFunction(()=>!!window.OrbitaStage6,{timeout:20000});
 await page.waitForSelector('[data-s6="newBusy"]');
 await page.click('[data-s6="newBusy"]');
 await page.waitForSelector("#s6-busy-form");
 const initial=await page.evaluate(()=>{
  const form=document.getElementById("s6-busy-form");
  return {noValidate:form.noValidate,hiddenDateDisabled:document.getElementById("s6-busy-date").disabled};
 });
 assert.deepEqual(initial,{noValidate:true,hiddenDateDisabled:true},"não bloquear salvamento por data oculta");
 await page.$eval("#s6-busy-title",el=>{el.value="IFPB - ELETRÔNICA";el.dispatchEvent(new Event("input",{bubbles:true}));});
 await page.click('[data-s6="weekBusiness"]');
 await page.$eval("#s6-busy-start",el=>{el.value="18:20";el.dispatchEvent(new Event("input",{bubbles:true}));});
 await page.$eval("#s6-busy-end",el=>{el.value="21:30";el.dispatchEvent(new Event("input",{bubbles:true}));});
 const setup=await page.evaluate(()=>{
  const form=document.getElementById("s6-busy-form");
  const data=new FormData(form);
  return {valid:form.checkValidity(),weekdays:data.getAll("weekdays"),title:data.get("title"),start:data.get("start"),end:data.get("end")};
 });
 assert.equal(setup.valid,true);
 assert.equal(setup.weekdays.join(","),"1,2,3,4,5");
 await page.click('#s6-busy-form button[type="submit"]');
 console.log("BROWSER SUBMIT DIAGNOSTIC",JSON.stringify({details:await page.evaluate(()=>({
  modalOpen:!!document.getElementById("s6-busy-form"),
  errorMessage:document.getElementById("s6-form-error")?.textContent,
  toast:document.getElementById("toast")?.textContent,
  groups:window.OrbitaStage6?.inspect?.groupedWeekly?.().map(x=>({title:x.title,days:x.days}))||[],
  hasStorage:!!localStorage.getItem("orbita:stage1:v1"),
  route:document.getElementById("view")?.dataset?.route,
  validity:document.getElementById("s6-busy-form")?.checkValidity(),
  status:document.getElementById("storage-indicator")?.title
 })),errors}));
 await page.waitForFunction(()=>document.querySelector(".s6-busy-row")?.textContent.includes("IFPB - ELETRÔNICA"),{timeout:5000});
 assert.equal(await page.$eval(".s6-busy-row",el=>el.textContent.includes("Segunda a sexta")),true,"lista apresenta os cinco dias");
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("orbita:stage1:v1")).extension.busyWeekly);
 assert.equal(stored.filter((a,i)=>i>=1&&i<=5).every(list=>list.some(x=>x.title==="IFPB - ELETRÔNICA")),true,"persistência real no navegador");
 assert.equal(stored[0].some(x=>x.title==="IFPB - ELETRÔNICA"),false);
 await page.reload({waitUntil:"load"});
 await page.waitForFunction(()=>!!window.OrbitaStage6,{timeout:20000});
 await page.waitForFunction(()=>document.querySelector(".s6-busy-row")?.textContent.includes("IFPB - ELETRÔNICA"),{timeout:10000});
 await page.click('.s6-busy-row [data-s6="editBusy"]');
 await page.waitForSelector("#s6-busy-form");
 assert.equal(await page.$eval("#s6-busy-form",form=>new FormData(form).getAll("weekdays").join(",")),"1,2,3,4,5");

 // Regressão visual: ações de modalidades com texto não podem sobrepor-se.
 await page.evaluate(()=>{
  window.OrbitaCore.closeModal();
  const methods=window.OrbitaStage3.inspect.model.methods;
  methods.splice(0,methods.length,
   {id:"m1",title:"ESTUDO PASSIVO",description:""},
   {id:"m2",title:"REVISÃO ATIVA",description:""},
   {id:"m3",title:"QUESTÕES",description:""},
   {id:"m4",title:"EXERCÍCIOS",description:""});
  window.OrbitaCore.go("organizar");
 });
 await page.waitForSelector('[data-s3="openMethods"]');
 await page.click('[data-s3="openMethods"]');
 await page.waitForSelector(".study-method-row");
 async function verifyMethods(width){
  await page.setViewport({width,height:850,deviceScaleFactor:1});
  const measurements=await page.evaluate(()=>{
   const rows=[...document.querySelectorAll(".study-method-row")];
   return rows.map(row=>{
    const parent=row.getBoundingClientRect();
    const buttons=[...row.querySelectorAll(".study-method-actions .btn")];
    const rects=buttons.map(btn=>btn.getBoundingClientRect());
    const overlap=rects.some((a,i)=>rects.slice(i+1).some(b=>
      Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 &&
      Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1
    ));
    return {count:buttons.length,overlap,clipped:rects.some(r=>r.left<parent.left-1||r.right>parent.right+1||r.top<parent.top-1||r.bottom>parent.bottom+1),labels:buttons.map(x=>x.textContent.trim()),width:parent.width};
   });
  });
  assert.equal(measurements.length,4,"deve haver quatro modalidades");
  for(const row of measurements){
   assert.equal(row.count,4,"quatro ações por modalidade com "+width+"px");
   assert.equal(row.overlap,false,"nenhuma sobreposição com "+width+"px: "+JSON.stringify(row));
   assert.equal(row.clipped,false,"ações contidas na linha com "+width+"px: "+JSON.stringify(row));
   assert.equal(row.labels.join(","),"Editar,Copiar,Arquivar,Excluir");
  }
 }
 await verifyMethods(1440);
 await verifyMethods(900);
 await verifyMethods(390);
 console.log("Chromium: botões de modalidades sem sobreposição em 1440, 900 e 390px.");

 // Agendamento em lote e execução diária: validar ações no browser real.
 const testCycle=await page.evaluate(()=>{
  const C=window.OrbitaCore,T=window.OrbitaStage3.inspect;
  for(let i=0;i<7;i++)C.state.availability.weekly[i]={mode:"hours",hours:8};
  const cycle=T.saveCycle({title:"Meu ciclo ENEM",area:"ENEM",defaultMin:90});
  T.saveSubject({cycleId:cycle.id,title:"Matemática",targetSessions:3});
  T.saveSubject({cycleId:cycle.id,title:"Física",targetSessions:1});
  C.save();T.actions.backStudies();C.go("estudos");return cycle.id;
 });
 await page.waitForSelector('[data-s3="openPlanner"]');
 await page.click('[data-s3="openPlanner"]');
 await page.waitForSelector('[data-s3="planBatch"]');
 await page.click('[data-s3="planBatch"]');
 await page.waitForSelector("#s3-batch");
 await page.$eval('#s3-batch [name="cycleId"]',(el,id)=>{el.value=id},testCycle);
 await page.$eval('#s3-batch [name="toDate"]',(el)=>{el.value=document.querySelector('#s3-batch [name="fromDate"]').value});
 await page.$eval('#s3-batch [name="count"]',el=>{el.value="3"});
 await page.$eval('#s3-batch [name="plannedMin"]',el=>{el.value="90"});
 await page.$eval('#s3-batch [name="onlyAvailable"]',el=>{el.checked=true});
 await page.click('#s3-batch [type="submit"]');
 await page.waitForFunction(()=>!document.querySelector("#s3-batch"),{timeout:5000});
 let state=await page.evaluate(id=>{
  const C=window.OrbitaCore,T=window.OrbitaStage3.inspect;
  const sessions=T.model.sessions.filter(x=>x.cycleId===id&&x.date===C.state.date);
  return {sessions:sessions.length,minutes:T.loadFor(C.state.date).studyPlanned,curr:T.cycleState(T.cycle(id)).title};
 },testCycle);
 assert.equal(state.sessions,3,"três sessões foram criadas pelo formulário em lote");
 assert.equal(state.minutes,270,"três sessões somam 4h30");
 assert.equal(state.curr,"Matemática");
 await page.evaluate(()=>window.OrbitaCore.go("inicio"));
 await page.waitForSelector(".study-daily-entry");
 assert.equal(await page.evaluate(()=>document.querySelectorAll(".study-daily-entry").length),3);

 const sessionView=await page.evaluate(()=>({
  titles:[...document.querySelectorAll(".study-daily-entry .study-daily-label > strong")].map(e=>e.textContent.trim()),
  subjects:[...document.querySelectorAll(".study-daily-entry .study-daily-subject")].map(e=>e.textContent.trim()),
  progressBars:document.querySelectorAll(".study-session-progress").length,
  oldRails:document.querySelectorAll(".study-daily-track").length
 }));
 assert.deepEqual(sessionView.titles,["Sessão 1","Sessão 2","Sessão 3"],"o cartão destaca a sessão e sua ordem");
 assert.ok(sessionView.subjects.every(x=>x.includes("Matemática")),"matéria mantida como contexto");
 assert.equal(sessionView.progressBars,1,"progresso compacto por ciclo");
 assert.equal(sessionView.oldRails,0,"não duplicar matérias em trilha enorme");

 for(let i=0;i<3;i++){
  await page.click('.study-daily-entry:nth-child('+(i+1)+') [data-s3="quickDone"]');
  await page.waitForFunction((n)=>[...document.querySelectorAll('.study-daily-entry.is-done')].length===n,{timeout:5000},i+1);
 }
 state=await page.evaluate(id=>{
  const T=window.OrbitaStage3.inspect;
  return {next:T.cycleState(T.cycle(id)).title,done:T.model.sessions.filter(x=>x.cycleId===id&&x.status==="done").length};
 },testCycle);
 assert.equal(state.done,3);
 assert.equal(state.next,"Física","concluir última sessão na tela inicial avança a matéria");
 await page.click('.study-daily-entry:nth-child(3) [data-s3="quickDone"]');
 await page.waitForFunction(()=>document.querySelectorAll(".study-daily-entry.is-done").length===2,{timeout:5000});
 assert.equal(await page.evaluate(id=>{
  const T=window.OrbitaStage3.inspect;return T.cycleState(T.cycle(id)).title;
 },testCycle),"Matemática","desfazer última conclusão reabre etapa anterior");

 await page.evaluate(()=>window.OrbitaCore.go("planejamento"));
 await page.waitForSelector(".day-tile.selected .day-meta");
 assert.match(await page.$eval(".day-tile.selected .day-meta",el=>el.textContent),/3 sessão\(ões\) de estudo/,"calendário semanal conta sessões");
 await page.click('[data-s2="switchCalendar"][data-mode="month"]');
 await page.waitForSelector(".month-day.selected");
 assert.match(await page.$eval(".month-day.selected span",el=>el.textContent),/3 ses\./,"calendário mensal conta sessões");
 await page.evaluate(()=>window.OrbitaCore.go("inicio"));

 console.log("Chromium: planejamento 3x90min, três conclusões no Início, avanço e desfazer passaram.");

 // Nova agenda real: cadastro de assunto, planejamento por seleção e cópia de semana.
 await page.evaluate(()=>window.OrbitaStage3.inspect.actions.openPlanner());
 await page.waitForSelector(".study-plan-week");
 assert.equal(await page.evaluate(()=>document.querySelectorAll('.study-plan-day').length),7);
 assert.equal(await page.evaluate(()=>document.querySelectorAll('[data-s3="quickDone"],[data-s3="recordSession"]').length),0,
  "as telas de planejamento não podem executar sessões");
 await page.click('[data-s3="openLibrary"]');
 await page.waitForSelector(".study-library-section");
 const physicsId=await page.evaluate(id=>{
  const T=window.OrbitaStage3.inspect;
  return T.model.subjects.find(x=>x.cycleId===id&&x.title==="Física").id;
 },testCycle);
 await page.click('[data-s3="newTopic"][data-subject="'+physicsId+'"]');
 await page.waitForSelector("#s3-topic");
 await page.$eval('#s3-topic [name="title"]',el=>{el.value="Cinemática"});
 await page.click('#s3-topic [type="submit"]');
 await page.waitForFunction(()=>!document.querySelector("#s3-topic"));
 assert.equal(await page.evaluate(()=>window.OrbitaStage3.inspect.model.topics.some(x=>x.title==="Cinemática")),true);
 await page.click('[data-s3="openPlanner"]');
 await page.waitForSelector(".study-plan-week");
 // Layout regressivo: impedir nova página sem os estilos correspondentes.
 for(const [width,columns] of [[1796,3],[1180,2],[390,1]]){
  await page.setViewport({width,height:850,deviceScaleFactor:1});
  const visual=await page.evaluate(()=>{
   const grid=document.querySelector(".study-plan-week");
   const day=document.querySelector(".study-plan-day");
   const nav=document.querySelector(".study-plan-toolbar");
   const title=document.querySelector(".study-plan-day-title");
   const rect=grid.getBoundingClientRect();
   const dayStyle=getComputedStyle(day),gridStyle=getComputedStyle(grid);
   const firstTwo=[...grid.children].slice(0,2).map(x=>x.getBoundingClientRect());
   return {columns:gridStyle.gridTemplateColumns.split(" ").filter(Boolean).length,
    display:gridStyle.display,cardDisplay:dayStyle.display,cardRadius:dayStyle.borderRadius,
    cardBackground:dayStyle.backgroundColor,titleColor:getComputedStyle(title).color,
    toolbarDisplay:getComputedStyle(nav).display,width:rect.width,scrollWidth:grid.scrollWidth,
    cardWidth:firstTwo[0]?.width||0};
  });
  assert.equal(visual.display,"grid","estilo da grade semanal carregado com "+width+"px");
  assert.equal(visual.columns,columns,"colunas adaptativas em "+width+"px: "+JSON.stringify(visual));
  assert.equal(visual.cardDisplay,"flex","dias renderizados como cartões");
  assert.ok(parseFloat(visual.cardRadius)>=12,"cartões com bordas");
  assert.equal(visual.toolbarDisplay,"flex","barra de ações organizada");
  assert.ok(visual.cardWidth>180,"cartões legíveis e sem compressão");
  assert.ok(visual.scrollWidth<=visual.width+2,"grade sem transbordamento horizontal");
 }
 await page.setViewport({width:1180,height:850,deviceScaleFactor:1});
 await page.click('.study-plan-day.is-today [data-s3="planAdd"]');
 await page.waitForSelector("#s3-quick");
 await page.$eval('#s3-quick [name="cycleId"]',(el,id)=>{el.value=id;el.dispatchEvent(new Event("change",{bubbles:true}));},testCycle);
 await page.$eval('#s3-quick [name="mode"]',el=>{el.value="specific";el.dispatchEvent(new Event("change",{bubbles:true}));});
 await page.$eval('#s3-quick [name="subjectId"]',(el,id)=>{el.value=id;el.dispatchEvent(new Event("change",{bubbles:true}));},physicsId);
 const topicId=await page.evaluate(()=>window.OrbitaStage3.inspect.model.topics.find(x=>x.title==="Cinemática").id);
 await page.$eval('#s3-quick [name="topicId"]',(el,id)=>{el.value=id},topicId);
 await page.$eval('#s3-quick [name="plannedMin"]',el=>{el.value="45"});
 const quickData=await page.$eval("#s3-quick",el=>Object.fromEntries(new FormData(el).entries()));
 assert.equal(quickData.mode,"specific");
 assert.equal(quickData.subjectId,physicsId);
 assert.equal(quickData.topicId,topicId);
 await page.click('#s3-quick [type="submit"]');
 await page.waitForFunction(()=>!document.querySelector("#s3-quick"),{timeout:5000});
 const planned=await page.evaluate(id=>{
  const C=window.OrbitaCore,T=window.OrbitaStage3.inspect;
  const entries=T.model.sessions.filter(x=>x.cycleId===id&&x.date===C.state.date);
  return {count:entries.length,minutes:T.loadFor(C.state.date).studyPlanned,
   specific:entries.find(x=>x.subjectId===T.model.subjects.find(y=>y.title==="Física"&&y.cycleId===id)?.id&&x.kind==="reinforcement")?.id,
   next:T.cycleState(T.cycle(id)).title};
 },testCycle);
 assert.equal(planned.count,4,"nova sessão específica entra na agenda");
 assert.equal(planned.minutes,315,"três sessões de 90min mais 45min");
 assert.ok(planned.specific,"seleção por matéria salvou o vínculo");
 assert.equal(planned.next,"Matemática","exceção específica não avança o ciclo");
 assert.equal(await page.evaluate(()=>document.querySelectorAll(".study-plan-item").length>=4),true);

 assert.ok(await page.evaluate(()=>[...document.querySelectorAll(".study-plan-item-body > strong")].every(x=>/^Sessão \d+$/.test(x.textContent.trim()))),"planejamento destaca sessão, não matéria");
 const previewText=await page.$eval(".study-plan-preview",el=>el.textContent);
 assert.match(previewText,/Sessão 1/,"prévia também enumera sessões");
 assert.match(previewText,/Matemática|Física/,"conteúdo de cada sessão permanece visível");
 assert.equal(await page.evaluate(()=>[...document.querySelectorAll(".study-plan-status")].some(x=>x.textContent.trim()==="Avulsa")),false,"sessões do ciclo não são rotuladas como avulsas");

 await page.click('[data-plan-id="'+planned.specific+'"] .study-plan-more > summary');
 await page.click('[data-plan-id="'+planned.specific+'"] [data-s3="planDuplicate"]');
 assert.equal(await page.evaluate(id=>window.OrbitaStage3.inspect.model.sessions.filter(x=>x.cycleId===id&&x.status==="pending").length>=3,testCycle),true);
 await page.click('[data-s3="planUndo"]');
 assert.equal(await page.evaluate(id=>{
  const C=window.OrbitaCore,T=window.OrbitaStage3.inspect;
  return T.model.sessions.filter(x=>x.cycleId===id&&x.date===C.state.date).length;
 },testCycle),4,"desfazer duplicação reverte mudança");
 await page.click('[data-s3="planCopyWeek"]');
 await page.waitForSelector("#s3-plan-copy");
 await page.click('#s3-plan-copy [type="submit"]');
 await page.waitForFunction(()=>!document.querySelector("#s3-plan-copy"),{timeout:5000});
 assert.ok(await page.evaluate(id=>{
  const C=window.OrbitaCore,T=window.OrbitaStage3.inspect;
  const future=C.addDays(C.state.date,7);
  return T.model.sessions.some(x=>x.cycleId===id&&x.date===future&&x.status==="pending"&&x.actualMin===null);
 },testCycle),"cópia semanal não herda conclusão nem tempo estudado");
 await page.setViewport({width:390,height:860,deviceScaleFactor:1});
 assert.equal(await page.$eval(".study-plan-week",el=>getComputedStyle(el).gridTemplateColumns.split(" ").length),1,"no celular exibir um dia por coluna");
 assert.equal(await page.evaluate(()=>document.querySelectorAll('[data-s3="quickDone"],[data-s3="recordSession"]').length),0);
 console.log("Chromium: layout adaptativo 3/2/1 colunas, cards estilizados e botões agrupados passaram.");
 console.log("Chromium: Biblioteca, cadastro de assunto, sessão por seleção, duplicação/desfazer e cópia semanal passaram.");



 // Prioridades das tarefas secundárias: rótulo, cores e conclusão inalterada.
 await page.evaluate(()=>{
  const C=window.OrbitaCore,S=window.OrbitaStage2.inspect,date=C.state.date;
  for(const [key,label] of [["high","Alta"],["medium","Média"],["low","Baixa"]]){
   S.model.entries.push({
    id:"browser-priority-"+key,type:"task",title:"Tarefa "+label,date,
    createdAt:new Date().toISOString(),blockId:"",priority:key,
    goalId:"",startTime:"",estimatedMin:15,dueDate:"",
    recurrence:{kind:"none"},archivedAt:"",origin:null
   });
  }
  C.save();C.go("inicio");
 });
 await page.waitForSelector(".task-priority-high");
 const priorityBadges=await page.evaluate(()=>{
  return [...document.querySelectorAll(".task-priority")].map(el=>({
   label:el.textContent.trim(),
   color:getComputedStyle(el).color,
   dot:getComputedStyle(el.querySelector(".task-priority-dot")).backgroundColor,
   inTask:!!el.closest(".task-row"),
   title:el.getAttribute("title")
  }));
 });
 assert.equal(priorityBadges.length,3,"somente as três tarefas exibem prioridade");
 assert.deepEqual(priorityBadges.map(x=>x.label),["Alta","Média","Baixa"],"prioridades ordenadas e legíveis");
 assert.equal(new Set(priorityBadges.map(x=>x.color)).size,3,"baixa, média e alta têm cores distintas");
 assert.ok(priorityBadges.every(x=>x.inTask&&x.dot===x.color&&x.title==="Prioridade "+x.label),"cor, texto e dica acessível são consistentes");
 await page.click(".task-row:has(.task-priority-high) [data-s2='status'][data-value='done']");
 await page.waitForFunction(()=>document.querySelector(".task-priority-high")?.closest(".task-row")?.classList.contains("task-done"));
 assert.equal(await page.evaluate(()=>document.querySelector(".task-priority-high")?.closest(".task-row")?.querySelector("[data-value='pending']")!=null),true,"conclusão continua reversível");
 await page.click(".task-row:has(.task-priority-high) [data-s2='status'][data-value='pending']");
 await page.waitForFunction(()=>!document.querySelector(".task-priority-high")?.closest(".task-row")?.classList.contains("task-done"));
 await page.setViewport({width:390,height:850,deviceScaleFactor:1});
 const badgesOnMobile=await page.evaluate(()=>[...document.querySelectorAll(".task-priority")].map(el=>{
  const badge=el.getBoundingClientRect(),row=el.closest(".task-row").getBoundingClientRect();
  return {fits:badge.left>=row.left-1&&badge.right<=row.right+1,visible:badge.width>25&&badge.height>12};
 }));
 assert.ok(badgesOnMobile.every(x=>x.fits&&x.visible),"indicadores de prioridade legíveis no celular");
 console.log("Chromium: prioridade baixa/média/alta com cores distintas, conclusão e desfazer preservados no mobile.");


 // Regressão transversal: Organizar NÃO pode usar os 30px dos botões de ícone.
 await page.evaluate(()=>{
  const C=window.OrbitaCore,S=window.OrbitaStage2.inspect;
  const today=C.state.date;
  for(let i=0;i<5;i++)S.model.entries.push({
   id:"layout-focus-"+i,type:"focus",title:"FAZER O TRABALHO DE SISTEMAS ELÉTRICOS - IFPB "+i,
   date:today,createdAt:new Date().toISOString(),blockId:"",priority:"medium",
   goalId:"",startTime:"",estimatedMin:60,dueDate:"",recurrence:{kind:"none"},archivedAt:"",origin:null
  });
  S.model.entries.push({
   id:"layout-habit",type:"habit",title:"TREINAR OLIMPÍADAS",
   date:today,createdAt:new Date().toISOString(),blockId:"",priority:"medium",
   goalId:"",startTime:"",estimatedMin:30,dueDate:"",
   recurrence:{kind:"none"},archivedAt:"",origin:null
  });
  S.model.blocks.push({id:"layout-block",title:"IFPB / ELETRÔNICA",color:"#7d6ee3",archived:false});
  C.save();C.go("organizar");
 });
 await page.waitForSelector(".organize-row");
 const widths=[1366,1024,768,600,390,360,320];
 for(const theme of ["dark","light"]){
  await page.evaluate(value=>{
   const C=window.OrbitaCore;C.state.settings.theme=value;C.render();
  },theme);
  for(const type of ["focus","task","habit","block"]){
   await page.click('[data-s2="organizeTab"][data-type="'+type+'"]');
   await page.waitForSelector(".organize-row");
   for(const width of widths){
    await page.setViewport({width,height:850,deviceScaleFactor:1});
    const result=await page.evaluate(()=>{
     const items=[...document.querySelectorAll(".organize-row")];
     const view=document.getElementById("view");
     const details=items.map(row=>{
      const bounds=row.getBoundingClientRect();
      const actions=row.querySelector(".organize-actions");
      const buttons=[...actions.querySelectorAll("button")];
      const buttonsRects=buttons.map(button=>button.getBoundingClientRect());
      const intersects=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1
        &&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
      return {
       width:bounds.width,actionsDisplay:getComputedStyle(actions).display,
       labels:buttons.map(button=>button.textContent.trim()),
       overlap:buttonsRects.some((a,i)=>buttonsRects.slice(i+1).some(b=>intersects(a,b))),
       clipped:buttonsRects.some(r=>r.left<bounds.left-2||r.right>bounds.right+2||r.top<bounds.top-2||r.bottom>bounds.bottom+2),
       truncated:buttons.some(button=>button.scrollWidth>button.clientWidth+1),
       textVisible:buttons.every(button=>getComputedStyle(button).fontSize!=="0px")
      };
     });
     const bodyStyle=getComputedStyle(document.body);
     const cardStyle=getComputedStyle(document.querySelector(".organize-row"));
     return {rows:details,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
      viewScroll:view.scrollWidth,viewClient:view.clientWidth,
      bodyColor:bodyStyle.color,theme:document.body.dataset.theme,
      cardBg:cardStyle.backgroundColor,scheme:bodyStyle.colorScheme};
    });
    assert.ok(result.rows.length,"Organizar deve exibir itens na aba "+type);
    for(const row of result.rows){
     assert.deepEqual(row.labels.map((x,i)=>i===2?"Ação de arquivar":x),["Editar","Copiar","Ação de arquivar","Excluir"],
      "quatro botões com texto na aba "+type);
     assert.ok(!row.overlap,"sem colisão "+theme+" "+type+" "+width+": "+JSON.stringify(row));
     assert.ok(!row.clipped,"sem recorte "+theme+" "+type+" "+width+": "+JSON.stringify(row));
     assert.ok(!row.truncated,"texto de botão completo "+theme+" "+type+" "+width+": "+JSON.stringify(row));
     assert.equal(row.actionsDisplay,"flex");
    }
    assert.ok(result.scrollWidth<=result.viewport+2,"sem rolagem horizontal global "+theme+" "+type+" "+width);
    assert.ok(result.viewScroll<=result.viewClient+2,"sem conteúdo cortado no Organizar "+theme+" "+type+" "+width);
    if(theme==="light"){
     assert.equal(result.scheme,"light","campos nativos respeitam o tema claro");
     assert.equal(result.bodyColor,"rgb(36, 41, 65)","texto principal escuro no tema claro");
    }
   }
  }
 }
 // O modo claro precisa manter a legibilidade em várias telas, inclusive modal.
 await page.setViewport({width:390,height:850,deviceScaleFactor:1});
 for(const route of ["inicio","planejamento","organizar","estudos","disponibilidade","perfil"]){
  await page.evaluate(r=>window.OrbitaCore.go(r),route);
  const result=await page.evaluate(()=>{
   const header=document.querySelector(".top-title strong");
   const main=document.querySelector(".main-shell");
   return {body:document.body.dataset.theme,text:getComputedStyle(header).color,
    bg:getComputedStyle(main).backgroundColor,
    viewW:document.getElementById("view").scrollWidth,
    viewClient:document.getElementById("view").clientWidth};
  });
  assert.equal(result.body,"light");
  assert.ok(result.viewW<=result.viewClient+2,"conteúdo adaptado no mobile: "+route);
  assert.equal(result.text,"rgb(36, 41, 65)","título contrastante no modo claro: "+route);
 }
 await page.evaluate(()=>window.OrbitaCore.go("organizar"));
 await page.click('[data-s2="organizeTab"][data-type="focus"]');
 await page.click(".hero-row [data-s2='newEntry']");
 await page.waitForSelector("#s2-entry");
 const formLight=await page.evaluate(()=>{
  const modal=document.querySelector(".modal-card"),input=document.querySelector("#s2-entry input[name='title']");
  return {bg:getComputedStyle(modal).backgroundColor,inputColor:getComputedStyle(input).color,
   inputBg:getComputedStyle(input).backgroundColor};
 });
 assert.equal(formLight.bg,"rgb(255, 255, 255)","modal legível no tema claro");
 assert.equal(formLight.inputBg,"rgb(255, 255, 255)","campo claro no tema claro");
 assert.equal(formLight.inputColor,"rgb(36, 41, 65)","entrada com texto escuro");
 await page.evaluate(()=>window.OrbitaCore.closeModal());
 console.log("Chromium: Organizar sem sobreposição, 4 abas, 7 tamanhos e 2 temas; telas mobile e modal no claro passaram.");

 assert.equal(errors.length,0,"nenhum erro JavaScript em fluxo de salvar e reabrir: "+errors.join("; "));
 console.log("Chromium: clique de salvar, cinco dias, persistência após recarga e edição passaram.");
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
