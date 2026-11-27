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
 await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});
 await page.goto("http://127.0.0.1:"+address.port+"/index.html#inicio",{waitUntil:"load"});
 await page.waitForFunction(()=>!!window.OrbitaStage8,{timeout:20000});
 await page.evaluate(()=>{
  const C=window.OrbitaCore,T=window.OrbitaStage3.inspect,R=window.OrbitaStage8.inspect,date=C.today();
  C.state.availability.weekly=Array.from({length:7},()=>({mode:"hours",hours:8}));
  const ca=T.saveCycle({title:"ENEM",area:"ENEM",defaultMin:90}),cb=T.saveCycle({title:"Eletrônica",area:"Eletrônica",defaultMin:90});
  const ma=T.saveSubject({cycleId:ca.id,title:"Matemática",targetSessions:3}),ph=T.saveSubject({cycleId:cb.id,title:"Física",targetSessions:1});
  const row=(id,sub,cy,status,order)=>({id,date,cycleId:cy.id,subjectId:sub.id,discipline:sub.title,area:cy.area,kind:"supplement",status,planOrder:order,plannedMin:90,actualMin:status==="done"?60:null,archived:false,createdAt:new Date().toISOString()});
  T.model.sessions.push(row("fixed",ma,ca,"done",1),row("math1",ma,ca,"pending",2),row("physics",ph,cb,"pending",3),row("math2",ma,ca,"pending",4));
  R.saveNote({get:k=>({title:"Lembrar matemática",priority:"low",linkScope:"next",target:"next|"+encodeURIComponent(ma.id)+"|"+encodeURIComponent(ca.id)})[k]??null});
  C.go("inicio");C.save();C.render();
 });
 await page.waitForSelector('[data-home-session="math2"]');
 const order=()=>page.$$eval("[data-home-queue] [data-home-session]",rows=>rows.map(x=>x.dataset.homeSession));
 assert.deepEqual(await order(),["fixed","math1","physics","math2"]);
 const aligned=()=>page.evaluate(()=>{
  const rows=[...document.querySelectorAll("[data-home-queue] [data-home-session]")];
  return ["[data-s7-slot=timer]",'[data-s3=quickDone]','[data-s3=recordSession]'].every(sel=>{
   const a=rows.map(r=>r.querySelector(sel).getBoundingClientRect());return a.every(x=>Math.abs(x.left-a[0].left)<1&&Math.abs(x.width-a[0].width)<1);
  })&&rows.every(r=>r.querySelector(".study-control-pin").getBoundingClientRect().right<=r.querySelector(".study-control-timer").getBoundingClientRect().left);
 });
 assert.equal(await aligned(),true,"fixed controls align across pinned and unpinned rows");
 assert.ok(await page.$('[data-home-session="math1"] .s8-linked-pin'));
 const drag=async(from,to,after=false)=>{
  const a=await page.$eval('[data-home-session="'+from+'"] .study-daily-label',el=>{el.scrollIntoView({block:"nearest"});const r=el.getBoundingClientRect();return {x:r.left+15,y:r.top+r.height/2};});
  const b=await page.$eval('[data-home-session="'+to+'"]',el=>{const r=el.getBoundingClientRect();return {x:r.left+45,y:r.top+r.height*(after?.8:.2)};});
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();
 };
 await drag("math2","math1");
 await page.waitForFunction(()=>document.querySelectorAll("[data-home-queue] [data-home-session]")[1]?.dataset.homeSession==="math2");
 assert.deepEqual(await order(),["fixed","math2","math1","physics"]);
 assert.ok(await page.$('[data-home-session="math2"] .s8-linked-pin'),"next subject reminder follows queue");
 assert.equal(await page.$('[data-home-session="math1"] .s8-linked-pin'),null);
 await drag("fixed","physics",true);
 assert.deepEqual(await order(),["fixed","math2","math1","physics"],"completed card is locked");
 await page.click('[data-home-session="physics"] [data-s7=start]');
 await page.waitForFunction(()=>document.querySelector('[data-home-session="physics"]')?.dataset.sessionState==="running");
 assert.deepEqual(await order(),["fixed","physics","math2","math1"],"starting an out-of-order session promotes it");
 assert.equal(await aligned(),true);
 await drag("physics","math1",true);
 assert.deepEqual(await order(),["fixed","physics","math2","math1"],"active card is locked");
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("orbita:stage1:v1")).studies.sessions.sort((a,b)=>a.planOrder-b.planOrder).map(x=>x.id));
 assert.deepEqual(stored,["fixed","physics","math2","math1"]);
 await page.setViewport({width:390,height:844,deviceScaleFactor:1});
 await page.waitForFunction(()=>innerWidth===390);
 assert.equal(await aligned(),true,"mobile controls stay aligned");
 assert.equal(errors.length,0,errors.join("; "));
 console.log("Chromium: fila global, arraste real, lembretes, promoção, bloqueio, alinhamento e persistência.");
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
