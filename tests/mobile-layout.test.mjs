import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const read=x=>readFileSync(new URL("../"+x,import.meta.url),"utf8");
const elements=new Map(),memory=new Map();
const node=id=>{
 if(!elements.has(id))elements.set(id,{id,innerHTML:"",textContent:"",title:"",dataset:{},style:{},scrollTop:0,
 classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},focus(){},
 querySelector(){return {addEventListener(){},focus(){}}}});
 return elements.get(id);
};
const document={
 body:{dataset:{},classList:{toggle(){}}},
 getElementById:node,querySelectorAll:()=>[],querySelector:()=>({content:""}),
 addEventListener(){}
};
const location={hash:"#inicio"},window={matchMedia:()=>({matches:false}),addEventListener(){}};
const context={document,window,location,localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},
 history:{replaceState(_a,_b,h){location.hash=h}},Date,Intl,console,structuredClone,
 crypto:{randomUUID:()=>String(Date.now())},FormData:class{},setTimeout(){},clearTimeout(){},requestAnimationFrame(){}};
vm.createContext(context);
for(const file of ["app.js","stage2.js"])vm.runInContext(read(file),context,{filename:file});
const C=window.OrbitaCore;
const styles=read("styles.css");
const patch=styles.slice(styles.indexOf("/* Correções restritas ao celular:"));
assert.ok(patch.startsWith("/* Correções restritas ao celular:"));
assert.match(patch,/@media\(max-width:720px\)/,"correção restrita a telas pequenas");
assert.match(patch,/\.view\[data-route="inicio"\] \.view-inner\{min-height:0/,"remove altura mínima que produz scroll residual");
assert.match(patch,/\.day-tile \.day-meta\{display:none\}/,"descrição longa ocultada só no mobile");
assert.match(patch,/\.day-tile \.day-meta-compact\{/,"metadado compacto tem estilo mobile");
assert.doesNotMatch(styles.slice(0,styles.indexOf("/* Correções restritas ao celular:")),/day-meta-compact/,"não altera o CSS anterior");
assert.equal(node("view").dataset.route,"inicio");
C.state.availability.weekly=Array.from({length:7},()=>({mode:"hours",hours:6}));
C.go("planejamento");
assert.equal(node("view").dataset.route,"planejamento");
const markup=node("view").innerHTML;
assert.equal((markup.match(/class="day-meta-compact"/g)||[]).length,7,"sete indicadores compactos");
assert.equal((markup.match(/class="day-meta"/g)||[]).length,7,"texto integral mantido para desktop");
assert.ok((markup.match(/aria-label="/g)||[]).length>=7,"descrição completa para leitores de tela");
assert.ok(markup.includes("6h"),"tempo real disponível convertido em rótulo curto");
const sw=read("sw.js");
assert.match(sw,/orbita-app-method-actions-20261102/,"cache PWA renovado");
console.log("Mobile: calendario compacto acessível, rota isolada, CSS sob media query e cache PWA atualizados.");
