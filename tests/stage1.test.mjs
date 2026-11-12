import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const script=readFileSync(new URL("../app.js",import.meta.url),"utf8");
const store=new Map();
const elements=new Map();
const handlers={};
const makeElement=(id)=>{
  if(!elements.has(id))elements.set(id,{
    id,innerHTML:"",textContent:"",title:"",scrollTop:0,dataset:{},style:{},isConnected:true,
    classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},focus(){},
    querySelector(sel){return {addEventListener(){},focus(){}}}
  });
  return elements.get(id);
};
const doc={
  body:{dataset:{},classList:{toggle(){}}},
  getElementById:makeElement,
  querySelectorAll(){return[]},
  querySelector(){return {content:""}},
  addEventListener(type,handler){handlers[type]=handler}
};
const memory={
  getItem:(key)=>store.get(key)??null,
  setItem:(key,val)=>store.set(key,val)
};
const location={hash:"#inicio"};
const window={matchMedia(){return {matches:false}},addEventListener(){}};
let mockFields={};
class MockFormData {
  constructor(){this.fields=mockFields;}
  get(k){return this.fields[k]??null;}
  getAll(k){return Array.isArray(this.fields[k])?this.fields[k]:this.fields[k]==null?[]:[this.fields[k]];}
  has(k){return Object.hasOwn(this.fields,k);}
}
const localIso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const previousDate=new Date();previousDate.setDate(previousDate.getDate()-3);
store.set("orbita:stage1:v1",JSON.stringify({schema:1,firstAccess:localIso(previousDate),date:localIso(previousDate),settings:{theme:"dark",motion:true,weekStart:0},availability:{weekly:[null,null,null,null,null,null,null],overrides:{}},goals:[],primaryGoalId:null}));
vm.runInNewContext(script,{document:doc,localStorage:memory,window,location,history:{replaceState(_a,_b,h){location.hash=h}},FormData:MockFormData,crypto:{randomUUID:()=>String(Date.now())},requestAnimationFrame(){},setTimeout(){return 1},clearTimeout(){},console,Date,Intl,structuredClone}, {filename:"app.js"});
const html=()=>makeElement("view").innerHTML;
assert.equal(JSON.parse(store.get("orbita:stage1:v1")).date,localIso(new Date()),"retomar o Órbita abre no dia atual, não na última data visitada");
assert.ok(script.includes('document.addEventListener("visibilitychange"'),"mudança do dia é observada ao voltar ao aplicativo");
const clickAction=(action,attributes={})=>{
  const target={dataset:{action,...attributes},closest(selector){return selector==="[data-action]"?this:null;}};
  handlers.click({target});
};
const navigate=(name)=>{
  const target={dataset:{nav:name},closest(selector){return selector==="[data-nav]"?this:null;}};
  handlers.click({target});
};
const submit=(id,fields)=>{
  mockFields=fields;
  handlers.submit({target:{id},preventDefault(){}});
};
assert.ok(html().includes("Primeiro, sua disponibilidade"),"primeiro acesso pede disponibilidade");
assert.ok(!html().includes("4h30"),"nunca cria uma estatística fictícia");
assert.equal(JSON.parse(store.get("orbita:stage1:v1")).goals.length,0);
assert.ok(!JSON.parse(store.get("orbita:stage1:v1")).availability.weekly.some(Boolean));

navigate("disponibilidade");
assert.ok(html().includes("Minha disponibilidade"));
submit("availability-form",{day:"1",exception:"no",mode:"slots",slotStart:["08:00","14:00"],slotEnd:["12:00","18:00"]});
let saved=JSON.parse(store.get("orbita:stage1:v1"));
assert.equal(saved.availability.weekly[1].slots.length,2);
assert.equal(saved.availability.weekly[1].mode,"slots");
navigate("inicio");
assert.ok(!html().includes("Primeiro, sua disponibilidade"),"disponibilidade libera estrutura do início");

navigate("perfil");
submit("goal-form",{title:"Engenharia da Computação",description:"UFPB",area:"Estudos",deadline:"",primary:"on"});
saved=JSON.parse(store.get("orbita:stage1:v1"));
assert.equal(saved.goals.length,1);
assert.equal(saved.primaryGoalId,saved.goals[0].id);
navigate("inicio");
assert.ok(html().includes("Engenharia da Computação"),"objetivo principal aparece no início");

navigate("planejamento");
assert.ok(html().includes("VISÃO SEMANAL"));
navigate("configuracoes");
assert.ok(html().includes("Preferências"));
clickAction("goToday");

console.log("Etapa 1: 10 verificações de inicialização, armazenamento, disponibilidade, objetivos, calendário e navegação passaram.");
