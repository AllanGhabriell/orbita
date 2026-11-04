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
 const types={".js":"text/javascript",".css":"text/css",".html":"text/html",".svg":"image/svg+xml",".png":"image/png",".webmanifest":"application/manifest+json"};
 const server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,"http://localhost"),path=url.pathname;
   if(path==="/stage5.js"){res.writeHead(200,{"Content-Type":"text/javascript"});return res.end("");}
   const location=resolve(root,"."+path.replace(/\/$/,"/index.html"));
   if(!location.startsWith(root+sep))throw Error("Fora do diretório");
   res.writeHead(200,{"Content-Type":types[extname(location)]||"application/octet-stream"});
   res.end(await readFile(location));
  }catch(err){res.writeHead(404);res.end(String(err));}
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
  assert.match(await page.$eval("#s7-global-status",el=>el.textContent),/ESTUDO EM ANDAMENTO/);
  await page.click('.s7-timer [data-s7="pause"][data-kind="preparation"]');
  await page.waitForSelector(".s7-timer.s7-paused");
  assert.match(await page.$eval("#s7-global-status",el=>el.textContent),/ESTUDO PAUSADO/);
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
  assert.deepEqual(errors,[],"nenhum erro JavaScript no navegador");
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
