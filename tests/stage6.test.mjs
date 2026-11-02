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
// Testes do mesmo fluxo do formulário: segunda a sexta é UMA agenda recorrente.
const recurring=Z.updateBusy({kind:"weekly",title:"IFPB - ELETRÔNICA",start:"18:20",end:"21:30",weekdays:["1","2","3","4","5"]});
assert.equal(Z.groupedWeekly().filter(g=>g.title==="IFPB - ELETRÔNICA").length,1,"cinco dias no mesmo cadastro");
const initialGroup=Z.groupedWeekly().find(g=>g.title==="IFPB - ELETRÔNICA");
assert.equal(initialGroup.days.join(","),"1,2,3,4,5");
assert.equal(initialGroup.members.length,5);
assert.equal(Z.busyDaysLabel(initialGroup.days),"Segunda a sexta");
assert.equal(Z.model.busyWeekly[0].filter(x=>x.title==="IFPB - ELETRÔNICA").length,0);
assert.equal(Z.model.busyWeekly[6].filter(x=>x.title==="IFPB - ELETRÔNICA").length,0);
assert.equal(JSON.parse(store.get("orbita:stage1:v1")).extension.busyWeekly[1].some(x=>x.title==="IFPB - ELETRÔNICA"),true,"registro salvo no navegador");
const prior=JSON.stringify(Z.model.busyWeekly);
assert.throws(()=>Z.updateBusy({kind:"weekly",title:"Inválido",start:"18:20",end:"17:00",weekdays:[1,2]}),/fim/i);
assert.throws(()=>Z.updateBusy({kind:"weekly",title:"Nenhum dia",start:"18:20",end:"21:30",weekdays:[]}),/Selecione/);
assert.equal(JSON.stringify(Z.model.busyWeekly),prior,"formulário inválido não altera os compromissos");
Z.updateBusy({kind:"weekly",title:"IFPB - ELETRÔNICA",start:"19:00",end:"22:00",weekdays:[1,3,5]},
 {kind:"weekly",day:initialGroup.members[0].day,id:initialGroup.members[0].id});
const edited=Z.groupedWeekly().find(g=>g.title==="IFPB - ELETRÔNICA");
assert.equal(edited.days.join(","),"1,3,5","edição retira dias não selecionados e mantém os demais");
assert.equal(edited.start,"19:00");
assert.equal(Z.model.busyWeekly[2].filter(x=>x.title==="IFPB - ELETRÔNICA").length,0);
Z.deleteBusyGroup("weekly",edited.members[0].day,edited.members[0].id);
assert.equal(Z.groupedWeekly().some(x=>x.title==="IFPB - ELETRÔNICA"),false,"exclusão remove o grupo inteiro");
const readded=Z.updateBusy({kind:"weekly",title:"Curso novo",start:"18:20",end:"21:30",weekdays:[1,2,3,4,5]});
C.go("disponibilidade");
assert.match(node("view").innerHTML,/Segunda a sexta/,"lista mostra o grupo como um compromisso");
const existingGroup=Z.groupedWeekly().find(g=>g.title==="Curso novo");
const old=existingGroup.members[0];
Z.updateBusy({kind:"date",date,title:"Curso excepcional",start:"18:20",end:"21:30"},
 {kind:"weekly",day:old.day,id:old.id});
assert.equal(Z.groupedWeekly().some(x=>x.title==="Curso novo"),false,"troca semanal por data não deixa duplicatas");
assert.ok(Z.model.busyDates[date].some(x=>x.title==="Curso excepcional"));

// Integração: o SUBMIT real do formulário chama o salvamento e grava um único grupo.
context.FormData=class{
 constructor(form){this.data=form.data;}
 get(key){return this.data[key]??null;}
 getAll(key){return this.data[key] instanceof Array?this.data[key]:(this.data[key]==null?[]:[this.data[key]]);}
 has(key){return Object.hasOwn(this.data,key);}
};
let submitted=false;
const fakeForm={id:"s6-busy-form",data:{kind:"weekly",oldKind:"weekly",oldDay:"1",id:"",title:"IFPB - ELETRÔNICA",start:"18:20",end:"21:30",weekdays:["1","2","3","4","5"]}};
for(const callback of handlers.submit||[])callback({target:fakeForm,preventDefault(){submitted=true;}});
assert.equal(submitted,true,"formulário de compromisso tratado pelo event listener");
assert.equal(Z.groupedWeekly().filter(x=>x.title==="IFPB - ELETRÔNICA").length,1,"submit salva o grupo semanal");
assert.equal(Z.groupedWeekly().find(x=>x.title==="IFPB - ELETRÔNICA").days.join(","),"1,2,3,4,5");
assert.equal(JSON.parse(store.get("orbita:stage1:v1")).extension.busyWeekly[5].some(x=>x.title==="IFPB - ELETRÔNICA"),true,"submit persistiu no navegador");
const submittedGroup=Z.groupedWeekly().find(x=>x.title==="IFPB - ELETRÔNICA");
Z.deleteBusyGroup("weekly",submittedGroup.members[0].day,submittedGroup.members[0].id);

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
