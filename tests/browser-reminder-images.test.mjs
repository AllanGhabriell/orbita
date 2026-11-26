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
 await page.setViewport({width:1180,height:850,deviceScaleFactor:1});
 await page.goto("http://127.0.0.1:"+address.port+"/index.html#inicio",{waitUntil:"load"});
 await page.waitForFunction(()=>!!window.OrbitaStage8,{timeout:20000});
 await page.evaluate(()=>{
  const C=window.OrbitaCore,R=window.OrbitaStage8.inspect;
  C.state.availability.weekly=Array.from({length:7},()=>({mode:"hours",hours:6}));
  Object.assign(R.layout,{width:410,height:460,panelX:250,panelY:100,locked:false});
  C.go("inicio");R.openPanel();
 });
 await page.waitForSelector('[data-s8="new"]');
 await page.click('[data-s8="new"]');
 await page.waitForSelector("#s8-note-form");
 await page.type('#s8-note-form input[name="title"]',"Imagens de revisão");
 assert.equal(await page.$eval("#s8-description",el=>el.closest(".s8-composer")?.contains(document.querySelector('[data-s8="chooseImages"]'))),true);
 await page.type("#s8-description","Revisar antes da aula.");
 await page.evaluate(async()=>{
  const make=async(w,h,name,color)=>{
   const c=document.createElement("canvas");c.width=w;c.height=h;
   const ctx=c.getContext("2d");ctx.fillStyle=color;ctx.fillRect(0,0,w,h);
   return new File([await new Promise(resolve=>c.toBlob(resolve,"image/png"))],name,{type:"image/png"});
  };
  const dt=new DataTransfer();
  dt.items.add(await make(300,1200,"vertical.png","#8844cc"));
  const editor=document.querySelector("#s8-description");editor.focus();editor.dispatchEvent(new ClipboardEvent("paste",{clipboardData:dt,bubbles:true,cancelable:true}));
 });
 await page.waitForFunction(()=>document.querySelectorAll(".s8-image-edit-item").length===1&&!document.querySelector('#s8-note-form button[type="submit"]').disabled);
 await page.evaluate(()=>{
  const input=document.querySelector("#s8-image-input");window.filePickerOpened=false;input.addEventListener("click",e=>{window.filePickerOpened=true;e.preventDefault();},{once:true});
 });
 await page.click('[data-s8="chooseImages"]');
 assert.equal(await page.evaluate(()=>window.filePickerOpened),true);
 await page.evaluate(async()=>{
  const c=document.createElement("canvas");c.width=1500;c.height=240;c.getContext("2d").fillRect(0,0,c.width,c.height);
  const dt=new DataTransfer();dt.items.add(new File([await new Promise(r=>c.toBlob(r,"image/png"))],"horizontal.png",{type:"image/png"}));
  const input=document.querySelector("#s8-image-input");input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));
 });
 await page.waitForFunction(()=>document.querySelectorAll(".s8-image-edit-item").length===2&&!document.querySelector('#s8-note-form button[type="submit"]').disabled);
 assert.equal(await page.$eval("#s8-description",el=>el.value),"Revisar antes da aula.");
 await page.click('#s8-note-form button[type="submit"]');
 await page.waitForSelector(".s8-gallery");
 const measure=()=>page.$eval(".s8-gallery",el=>({height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width,fit:getComputedStyle(el.querySelector("img")).objectFit,count:el.querySelector(".s8-image-count").textContent}));
 const first=await measure();
 assert.equal(first.fit,"contain");assert.equal(first.count,"1 / 2");assert.ok(first.height<=180);
 await page.click('.s8-image-next');
 const second=await measure();
 assert.equal(second.count,"2 / 2");assert.equal(first.height,second.height);assert.equal(first.width,second.width);
 await page.click('.s8-image-preview');
 await page.waitForSelector("#s8-image-viewer");
 assert.equal(await page.$eval("#s8-image-viewer",el=>getComputedStyle(el).backgroundColor),"rgb(16, 17, 22)");
 await page.click('[data-s8="imageZoomIn"]');assert.equal(await page.$eval(".s8-viewer-percent",el=>el.textContent),"150%");
 await page.keyboard.press("Escape");assert.equal(await page.$("#s8-image-viewer"),null);
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("orbita:stage1:v1")).reminders.find(n=>n.title==="Imagens de revisão").images);
 assert.equal(stored.length,2);assert.ok(stored.every(x=>x.src.startsWith("data:image/")));
 await page.reload({waitUntil:"load"});
 await page.waitForFunction(()=>!!window.OrbitaStage8,{timeout:20000});
 await page.evaluate(()=>window.OrbitaStage8.inspect.openPanel());
 await page.waitForSelector(".s8-gallery");
 assert.equal((await measure()).count,"1 / 2");
 assert.equal(errors.length,0,errors.join("; "));
 console.log("Chromium: anexos, carrossel sem variação de tamanho, zoom, fechamento e persistência.");
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
