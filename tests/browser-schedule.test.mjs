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
 console.log("Chromium: Biblioteca, cadastro de assunto, sessão por seleção, duplicação/desfazer e cópia semanal passaram.");


 assert.equal(errors.length,0,"nenhum erro JavaScript em fluxo de salvar e reabrir: "+errors.join("; "));
 console.log("Chromium: clique de salvar, cinco dias, persistência após recarga e edição passaram.");
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
