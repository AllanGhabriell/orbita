import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {spawnSync} from "node:child_process";
import puppeteer from "puppeteer-core";

test("cronômetro integrado: iniciar, pausar, recuperar da atualização e finalizar parcial",async()=>{
 const chrome=["google-chrome","google-chrome-stable","chromium","chromium-browser"].map(name=>spawnSync("which",[name],{encoding:"utf8"})).find(r=>r.status===0)?.stdout.trim();
 if(!chrome)throw Error("Chromium não encontrado");
 const root=resolve(new URL("../",import.meta.url).pathname);
 const types={".js":"text/javascript",".css":"text/css",".html":"text/html",".svg":"image/svg+xml",".png":"image/png",".wav":"audio/wav",".webmanifest":"application/manifest+json"};
 const server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,"http://localhost"),path=url.pathname;
   if(path==="/stage5.js"){res.writeHead(200,{"Content-Type":"text/javascript"});return res.end("");}
   const location=resolve(root,"."+path.replace(/\/$/,"/index.html"));
   if(!location.startsWith(root+sep))throw Error("Fora do diretório");
   const content=await readFile(location);
   res.writeHead(200,{"Content-Type":types[extname(location)]||"application/octet-stream"});
   res.end(content);
  }catch(err){if(!res.headersSent)res.writeHead(404);res.end(String(err));}
 });
 await new Promise(r=>server.listen(0,"127.0.0.1",r));
 let browser;
 try{
  browser=await puppeteer.launch({executablePath:chrome,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  const page=await browser.newPage(),errors=[];
  page.on("pageerror",err=>errors.push(err.message));
  await page.goto("http://127.0.0.1:"+server.address().port+"/index.html#inicio",{waitUntil:"load"});
  await page.waitForFunction(()=>!!window.OrbitaStage7,{timeout:20000});
  await page.evaluate(()=>{
   const c=window.OrbitaCore,t=window.OrbitaStage3.inspect,date=c.today();
   c.state.date=date;
   c.state.availability.weekly[new Date().getDay()]={mode:"hours",hours:4};
   t.model.sessions.push({id:"browser-test-study",date,kind:"supplement",cycleId:"",plannedMin:90,status:"pending",discipline:"Matemática",area:"ENEM",archived:false,createdAt:new Date().toISOString()});
   c.save();c.go("inicio");
  });
  await page.waitForSelector('[data-s7="start"][data-id="browser-test-study"]');
  await page.click('[data-s7="start"][data-id="browser-test-study"]');
  await page.waitForSelector(".s7-timer.s7-running");
  assert.match(await page.$eval(".study-home-panel .s7-timer",el=>el.textContent),/Em estudo/);
  assert.equal(await page.evaluate(()=>!!document.querySelector("#s7-global-status")),false,"faixa de inatividade não ocupa o topo");
  await page.click('.s7-timer [data-s7="pause"][data-kind="preparation"]');
  await page.waitForSelector(".s7-timer.s7-paused");
  assert.match(await page.$eval(".study-home-panel .s7-timer",el=>el.textContent),/Pausado/);
  const stateBefore=await page.evaluate(()=>window.OrbitaCore.state.timing.active?.phase);
  assert.equal(stateBefore,"paused");
  await page.reload({waitUntil:"load"});
  await page.waitForFunction(()=>!!window.OrbitaStage7,{timeout:20000});
  await page.waitForSelector(".s7-timer.s7-paused");
  await page.click('.s7-timer [data-s7="resume"]');
  await page.waitForSelector(".s7-timer.s7-running");
  await new Promise(resolve=>setTimeout(resolve,1250)); // garante tempo produtivo não nulo antes do encerramento
  page.once("dialog",dialog=>dialog.accept());
  await page.click('.s7-timer [data-s7="partial"]');
  await page.waitForFunction(()=>window.OrbitaCore.state.timing.active===null);
  const result=await page.evaluate(()=>{
   const s=window.OrbitaCore.state;
   return {status:s.studies.sessions.find(x=>x.id==="browser-test-study").status,
    pauses:s.timing.records["browser-test-study"].pauses.length,
    saved:!!JSON.parse(localStorage.getItem("orbita:stage1:v1")).timing};
  });
  assert.equal(result.status,"progress","encerramento parcial não conclui matéria");
  assert.equal(result.pauses,1);
  assert.equal(result.saved,true);
  assert.equal(await page.evaluate(()=>document.querySelector(".study-home-panel .s7-timer")===null),true,"timer desaparece após encerramento");
  // Gerenciamento está acessível no cartão da sessão, sem ocupar cabeçalho global.
  await page.click('[data-s7="manage"][data-id="browser-test-study"]');
  await page.waitForSelector("#modal-host [data-s7='editTotals']");
  await page.click("#modal-host [data-s7='editTotals']");
  await page.waitForSelector("#s7-edit-totals");
  await page.$eval('#s7-edit-totals [name="study"]',el=>{el.value="45";});
  await page.$eval('#s7-edit-totals [name="paused"]',el=>{el.value="10";});
  await page.click('#s7-edit-totals button[type="submit"]');
  await page.waitForFunction(()=>window.OrbitaCore.state.timing.records["browser-test-study"].studyMs===45*60000);
  assert.equal(await page.evaluate(()=>window.OrbitaCore.state.studies.sessions.find(x=>x.id==="browser-test-study").actualMin),45);
  await page.click('[data-s7="manage"][data-id="browser-test-study"]');
  page.once("dialog",dialog=>dialog.accept());
  await page.click('#modal-host [data-s7="reset"]');
  await page.waitForFunction(()=>window.OrbitaCore.state.timing.records["browser-test-study"].studyMs===0);
  assert.equal(await page.evaluate(()=>window.OrbitaCore.state.studies.sessions.find(x=>x.id==="browser-test-study").status),"progress");
  await page.click('[data-s7="manage"][data-id="browser-test-study"]');
  await page.click('#modal-host [data-s7="undo"]');
  await page.waitForFunction(()=>window.OrbitaCore.state.timing.records["browser-test-study"].studyMs===45*60000);
  // Conclusão manual sem cronômetro continua válida no fluxo existente.
  await page.evaluate(()=>{
   const c=window.OrbitaCore,t=window.OrbitaStage3.inspect,date=c.today();
   t.model.sessions.push({id:"manual-study",date,kind:"supplement",cycleId:"",plannedMin:90,status:"pending",discipline:"Física",area:"ENEM",archived:false,createdAt:new Date().toISOString()});
   c.save();c.render();
  });
  await page.click('[data-s3="recordSession"][data-id="manual-study"]');
  await page.waitForSelector("#s3-record");
  await page.select('#s3-record [name="status"]',"done");
  await page.$eval('#s3-record [name="actualMin"]',el=>{el.value="90";});
  await page.click('#s3-record button[type="submit"]');
  // Alarme de meta: notificação persistente, silenciar, continuar e reabrir após recarga.
  await page.evaluate(()=>{
   const c=window.OrbitaCore,t=window.OrbitaStage3.inspect,date=c.today();
   t.model.sessions.push({id:"alarm-case",date,kind:"supplement",cycleId:"",plannedMin:1,status:"pending",discipline:"História",area:"ENEM",archived:false,createdAt:new Date().toISOString()});
   c.save();c.render();
  });
  await page.click('[data-s7="start"][data-id="alarm-case"]');
  await page.evaluate(()=>{
   const t=window.OrbitaCore.state.timing;
   t.records["alarm-case"].studyMs=60000;
   window.OrbitaStage7.inspect.tick();
  });
  await page.waitForSelector('#s7-alarm-host:not([hidden]) .s7-alarm-card');
  assert.match(await page.$eval("#s7-alarm-host",x=>x.textContent),/Meta de estudo atingida/);
  await page.click('#s7-alarm-host [data-s7="alarmSilence"]');
  assert.equal(await page.evaluate(()=>window.OrbitaCore.state.timing.alarm.silenced),true);
  await page.reload({waitUntil:"load"});
  await page.waitForFunction(()=>!!window.OrbitaStage7,{timeout:20000});
  await page.waitForSelector('#s7-alarm-host:not([hidden])');
  assert.equal(await page.evaluate(()=>window.OrbitaCore.state.timing.alarm.silenced),true);
  await page.click('#s7-alarm-host [data-s7="alarmContinue"]');
  assert.equal(await page.evaluate(()=>window.OrbitaCore.state.timing.alarm),null);
  assert.equal(await page.evaluate(()=>window.OrbitaCore.state.timing.active.sessionId),"alarm-case");
  page.once("dialog",dialog=>dialog.accept());
  await page.click('.s7-timer [data-s7="partial"]');
  await page.waitForFunction(()=>window.OrbitaCore.state.timing.active===null);
  await page.waitForFunction(()=>window.OrbitaCore.state.studies.sessions.find(x=>x.id==="manual-study").status==="done");
  assert.deepEqual(await page.evaluate(()=>{
   const s=window.OrbitaCore.state;
   return {minutes:s.studies.sessions.find(x=>x.id==="manual-study").actualMin,hasTimer:!!s.timing.records["manual-study"]};
  }),{minutes:90,hasTimer:false},"registro manual não depende de iniciar o cronômetro");

  // Testar notificação deve mostrar o aviso dentro do site e sinalizar a aba.
  await page.evaluate(()=>window.OrbitaCore.go("configuracoes"));
  await page.waitForSelector('[data-s7="testNotification"]');
  await page.click('[data-s7="testNotification"]');
  await page.waitForSelector('#s7-alarm-host:not([hidden])');
  assert.match(await page.$eval('#s7-alarm-host',el=>el.textContent),/Teste de alarme/);
  assert.match(await page.title(),/TESTE DE ALARME/);
  assert.match(await page.$eval('link[rel="icon"]',el=>el.getAttribute("href")) , /^data:image\/svg\+xml/);
  await page.click('#s7-alarm-host [data-s7="alarmSilence"]');
  assert.match(await page.$eval('#s7-alarm-host',el=>el.textContent),/Reproduzir som/);
  await page.click('#s7-alarm-host [data-s7="alarmDismiss"]');
  assert.equal(await page.$eval('#s7-alarm-host',el=>el.hidden),true);
  assert.doesNotMatch(await page.title(),/TESTE DE ALARME/);

  // O som incluído pode ser carregado sem upload.
  const bundled=await page.evaluate(async()=>{
   const response=await fetch("./assets/orbita-alarm.wav");
   const bytes=await response.arrayBuffer();
   return {ok:response.ok,size:bytes.byteLength,header:String.fromCharCode(...new Uint8Array(bytes.slice(0,4)))};
  });
  assert.equal(bundled.ok,true);
  assert.equal(bundled.header,"RIFF");
  assert.ok(bundled.size>40000);
  // Dois uploads do MESMO arquivo — sem travar seleção nem misturar conclusão/pausa.
  await page.evaluate(async()=>{
   const bytes=await (await fetch("./assets/orbita-alarm.wav")).arrayBuffer();
   window.__uploadedSound=new File([bytes],"alarme-repetido.wav",{type:"audio/wav"});
   window.__uploadChoice=which=>{
    const input=document.getElementById("s7-upload-"+which);
    const dt=new DataTransfer();dt.items.add(window.__uploadedSound);
    input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));
   };
   window.__uploadChoice("finish");
  });
  await page.waitForFunction(()=>window.OrbitaCore.state.timing.settings.finishSound==="custom");
  const first=await page.evaluate(()=>window.OrbitaCore.state.timing.settings.finishUpload);
  await page.evaluate(()=>window.__uploadChoice("finish"));
  await page.waitForFunction(()=>document.getElementById("s7-upload-status-finish")?.textContent.includes("alarme-repetido"));
  await page.evaluate(()=>window.__uploadChoice("pause"));
  await page.waitForFunction(()=>window.OrbitaCore.state.timing.settings.pauseSound==="custom");
  const uploads=await page.evaluate(()=>{
   const q=window.OrbitaCore.state.timing.settings;
   return {finish:q.finishUpload,pause:q.pauseUpload,finishBytes:q.finishUploadBytes,pauseBytes:q.pauseUploadBytes,finishName:q.finishUploadName,pauseName:q.pauseUploadName};
  });
  assert.equal(uploads.finish,first);
  assert.equal(uploads.pause,first);
  assert.ok(uploads.finishBytes<=120*1024);
  assert.ok(uploads.pauseBytes<=120*1024);
  assert.equal(uploads.finishName,"alarme-repetido.wav");
  assert.equal(uploads.pauseName,"alarme-repetido.wav");

  // Conversão de entrada mais longa limita a cinco segundos.
  const compressed=await page.evaluate(()=>{
   const ctx=new (window.AudioContext||window.webkitAudioContext)();
   const longer=ctx.createBuffer(2,ctx.sampleRate*7,ctx.sampleRate);
   return window.OrbitaStage7.inspect.compactWav(longer);
  });
  assert.ok(compressed.bytes<=120*1024);
  assert.ok(compressed.seconds<=5);
  assert.ok(compressed.seconds>=4.9);

  // Mesmo objetivo longo mostrado nas capturas: a largura do texto não pode cair
  // para uma coluna de letras quando os botões coexistem no cartão.
  await page.setViewport({width:390,height:850,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await page.evaluate(()=>{
   const c=window.OrbitaCore;
   c.state.goals=[
    {id:"browser-main-goal",title:"INGRESSAR EM ENGENHARIA DA COMPUTAÇÃO NA UFPB EM 2027",description:"Conquistar uma vaga no curso de Engenharia da Computação. Desenvolver rotina sustentável de estudos em Matemática, Ciências e redação.",area:"Estudos",deadline:"2027-11-08",archived:false},
    {id:"browser-secondary-goal",title:"DESENVOLVIMENTO PROFISSIONAL EM TECNOLOGIA E ELETRÔNICA",area:"Carreira",archived:false}
   ];
   c.state.primaryGoalId="browser-main-goal";
   c.go("perfil");
  });
  await page.waitForSelector('.view[data-route="perfil"] .goal-list-entry .goal-actions');
  const profileBox=await page.evaluate(()=>{
   const rect=selector=>document.querySelector(selector)?.getBoundingClientRect();
   const list=document.querySelector('.view[data-route="perfil"] .goal-list-entry');
   const title=rect('.view[data-route="perfil"] .goal-list-entry .list-main');
   const actions=rect('.view[data-route="perfil"] .goal-list-entry .goal-actions');
   const card=rect('.view[data-route="perfil"] .goal-list-entry');
   const primaryTitle=rect('.view[data-route="perfil"] .profile-primary-goal .hero-content');
   const primary=rect('.view[data-route="perfil"] .profile-primary-goal');
   return {
    cardWidth:card.width,titleWidth:title.width,actionsWidth:actions.width,
    titleBottom:title.bottom,actionsTop:actions.top,
    primaryWidth:primary.width,primaryTextWidth:primaryTitle.width,
    anyHorizontalOverflow:document.getElementById("view").scrollWidth>document.getElementById("view").clientWidth+2,
    secondGoalText:document.querySelectorAll(".view[data-route='perfil'] .goal-list-entry .list-main strong")[1]?.textContent
   };
  });
  assert.ok(profileBox.titleWidth>220,"título do objetivo deve ocupar largura legível no celular");
  assert.ok(profileBox.titleWidth>=profileBox.cardWidth-38,"texto tem praticamente a largura total do cartão");
  assert.ok(profileBox.actionsTop>=profileBox.titleBottom-2,"ações ficam abaixo do texto");
  assert.ok(profileBox.primaryTextWidth>=profileBox.primaryWidth-10,"ícone não comprime objetivo principal");
  assert.ok(!profileBox.anyHorizontalOverflow,"perfil não cria rolagem horizontal");
  assert.match(profileBox.secondGoalText,/DESENVOLVIMENTO PROFISSIONAL/);
  assert.deepEqual(errors,[],"nenhum erro JavaScript no navegador");
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
