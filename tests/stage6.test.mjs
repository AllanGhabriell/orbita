import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=file=>fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");
const store=new Map(),nodes=new Map(),handlers={};
let counter=0;
function node(id){
 if(!nodes.has(id))nodes.set(id,{id,innerHTML:"",textContent:"",title:"",scrollTop:0,dataset:{},style:{},hidden:false,isConnected:true,
 classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},focus(){},
 querySelector(){return {addEventListener(){},focus(){},value:""}}});
 return nodes.get(id);
}
const document={body:{dataset:{},classList:{toggle(){}}},getElementById:node,querySelectorAll(){return []},querySelector(){return {content:""}},addEventListener(name,fn){(handlers[name]??=[]).push(fn);}};
const window={matchMedia:()=>({matches:false}),addEventListener(){},confirm:()=>true};
const location={hash:"#inicio"};
const context={document,window,location,localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},
 history:{replaceState(a,b,h){location.hash=h}},crypto:{randomUUID:()=>("s6-"+(++counter))},
 setTimeout:()=>1,clearTimeout(){},requestAnimationFrame(){},structuredClone,Date,Intl,console,FormData:class{}};
vm.createContext(context);
for(const file of ["app.js","stage2.js","stage3.js","stage4.js","stage6.js"])vm.runInContext(read(file),context,{filename:file});
const C=window.OrbitaCore,P=window.OrbitaStage2.inspect,T=window.OrbitaStage3.inspect,V=window.OrbitaStage4.inspect,Z=window.OrbitaStage6.inspect;
const date=C.today(),dow=C.parse(date).getDay();
C.state.availability.weekly[dow]={mode:"slots",slots:[{start:"08:00",end:"12:00"},{start:"13:00",end:"18:00"}]};
assert.equal(C.availableForDate(date),540);
const b=Z.addBusy({kind:"weekly",weekday:dow,title:"Curso",start:"09:00",end:"10:00"});
Z.addBusy({kind:"date",date,title:"Transporte",start:"10:30",end:"11:30"});
assert.equal(Z.occupied(date).length,2);
assert.equal(C.availableForDate(date),420,"desconta interseções de faixas livres sem dupla contagem");
assert.equal(T.loadFor(date).available,420,"o analisador de estudos usa a disponibilidade descontada");
assert.equal(C.state.availability.weekly[dow].slots.length,2,"horários livres declarados não foram apagados");
C.state.availability.weekly[dow]={mode:"hours",hours:4};
assert.equal(C.availableForDate(date),240,"horas já declaradas livres não são descontadas novamente");
Z.removeBusy("weekly",dow,b.id);
assert.equal(Z.occupied(date).length,1);
const g={id:"goal1",title:"Aprender eletrônica",archived:false};C.state.goals.push(g);
Z.saveStep(g.id,"Estudar fundamentos");
assert.equal(g.steps.length,1);
Z.toggleStep(g.id,g.steps[0].id);
assert.equal(g.steps[0].done,true);
assert.ok(g.steps[0].doneAt);
Z.toggleStep(g.id,g.steps[0].id);
assert.equal(g.steps[0].done,false);
Z.saveStep(g.id,"Resolver exercícios",g.steps[0].id);
assert.equal(g.steps[0].title,"Resolver exercícios");
P.submission("s2-entry",{get:k=>({type:"focus",title:"Revisão",date,estimatedMin:"30",repeat:"none",goalId:g.id})[k]??null,getAll:()=>[],has:()=>false});
assert.equal(P.model.entries[0].goalId,g.id,"atividades podem pertencer a objetivos");
const c=T.saveCycle({title:"Ciclo",area:"Eletrônica",goalId:g.id,defaultMin:60});
assert.equal(Z.currentGoalRelations(g).tasks.length,1);
assert.equal(Z.currentGoalRelations(g).cycles.length,1);
const ss=T.addSessions({kind:"supplement",date,area:"Eletrônica",discipline:"Matemática",topic:"Frações",plannedMin:40})[0];
T.setSessionStatus(ss.id,"done",35,"");
ss.evidence={questions:15,correct:6,quality:2};
const advice=Z.analyzeStudy().recommendations;
assert.ok(advice.some(x=>x.title.includes("Retomar exercícios")),"indicador usa erros registrados");
C.go("planejamento");
assert.match(node("view").innerHTML,/Compromissos fixos/);
assert.match(read("boot.js"),/"stage6\.js"/);
assert.match(read("sw.js"),/stage6\.css/);
assert.match(read("index.html"),/stage6\.css/);
C.state.evolution.closed[date]={date,confirmed:new Date().toISOString(),activities:[],studies:[],plan:{totalMin:0},result:{actualStudyMin:0}};
assert.throws(()=>Z.addBusy({kind:"date",date,title:"Outro",start:"13:00",end:"14:00"}),/finalizado/i);
assert.equal(g.steps[0].done,false);
console.log("Etapa 6: objetivos, vínculos, agenda ocupada, desconto preciso, feedback de aprendizagem e imutabilidade verificados.");
