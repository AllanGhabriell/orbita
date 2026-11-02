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
 assert.equal(errors.length,0,"nenhum erro JavaScript em fluxo de salvar e reabrir: "+errors.join("; "));
 console.log("Chromium: clique de salvar, cinco dias, persistência após recarga e edição passaram.");
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
