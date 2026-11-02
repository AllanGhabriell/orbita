import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=name=>fs.readFileSync(new URL("../"+name,import.meta.url),"utf8");
const store=new Map(),elements=new Map(),handlers={};
let idSeq=0;
function element(id){
 if(!elements.has(id))elements.set(id,{
  id,innerHTML:"",textContent:"",title:"",scrollTop:0,dataset:{},style:{},isConnected:true,
  classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},focus(){},
  querySelector(){return {addEventListener(){},focus(){},value:""}}
 });
 return elements.get(id);
}
const doc={
 body:{dataset:{},classList:{toggle(){}}},
 getElementById:element,querySelectorAll(){return []},
 querySelector(){return {content:""}},
 addEventListener(type,fn){(handlers[type]??=[]).push(fn)}
};
const window={matchMedia:()=>({matches:false}),addEventListener(){}};
const location={hash:"#inicio"};
const fakeFormData=class{constructor(form){return form;}};
const context={document:doc,window,location,
 localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},
 history:{replaceState(_a,_b,hash){location.hash=hash}},
 crypto:{randomUUID:()=>("test-"+(++idSeq))},FormData:fakeFormData,
 setTimeout:()=>1,clearTimeout(){},requestAnimationFrame(){},
 console,Date,Intl,structuredClone};
vm.createContext(context);
for(const file of ["app.js","stage2.js","stage3.js"])vm.runInContext(read(file),context,{filename:file});
const C=window.OrbitaCore, P=window.OrbitaStage2.inspect,T=window.OrbitaStage3.inspect;
const date=C.today(),following=C.addDays(date,1);
const form=values=>({get:k=>values[k]??null,getAll:k=>Array.isArray(values[k])?values[k]:values[k]===undefined?[]:[values[k]],has:k=>Object.hasOwn(values,k)});
assert.equal(T.model.cycles.length,0,"nenhum ciclo de exemplo");
assert.equal(T.model.sessions.length,0,"nenhuma sessão de exemplo");
assert.equal(T.model.methods.length,0,"nenhuma modalidade de exemplo");
assert.ok(element("view").innerHTML.includes("Primeiro, sua disponibilidade"));
for(let i=0;i<7;i++)C.state.availability.weekly[i]={mode:"hours",hours:8};
C.save();C.render();
assert.ok(element("view").innerHTML.includes("Ciclos e estudos"));

const c=T.saveCycle({title:"Eletrônica",area:"Eletrônica",defaultMin:90});
const math=T.saveSubject({cycleId:c.id,title:"Matemática",targetSessions:2});
const physics=T.saveSubject({cycleId:c.id,title:"Física",targetSessions:1});
assert.equal(T.cycleState(c).id,math.id);
assert.equal(T.requiredSessions(c),2);
const modality=T.saveMethod({title:"Exercícios",description:"Prática"});
assert.equal(T.model.methods.length,1);

const sessions=T.addSessions({
 kind:"cycle",cycleId:c.id,subjectId:math.id,date,
 area:"Eletrônica",discipline:"Matemática",topic:"Trigonometria",purpose:"Corrente alternada",
 methodId:modality.id,plannedMin:"90",startTime:"09:00",focusId:""
},2);
assert.equal(sessions.length,2);
assert.equal(T.loadFor(date).studyPlanned,180);
assert.equal(T.requiredSessions(c),2);
T.setSessionStatus(sessions[0].id,"progress",45,"09:10");
assert.equal(T.cycleState(c).id,math.id,"sessão parcial não avança");
assert.equal(T.summarize().actualMin,45);
T.setSessionStatus(sessions[0].id,"done",45,"09:10");
assert.equal(T.cycleState(c).id,math.id,"uma de duas sessões não avança");
T.setSessionStatus(sessions[1].id,"done",60,"10:40");
assert.equal(T.cycleState(c).id,physics.id,"duas conclusões liberam Física");
assert.equal(c.stepNo,2);
assert.equal(T.summarize().actualMin,105);
assert.equal(T.summarize().groups.disciplines["Matemática"].minutes,105);
assert.equal(T.summarize().groups.areas["Eletrônica"].minutes,105);
assert.equal(T.summarize().groups.methods["Exercícios"].minutes,105);

T.setSessionStatus(sessions[1].id,"pending",null,"");
assert.equal(T.cycleState(c).id,math.id,"correção reabre a etapa anterior");
assert.equal(c.stepNo,1);
assert.equal(T.summarize().actualMin,45);
T.setSessionStatus(sessions[1].id,"done",60,"10:40");
assert.equal(T.cycleState(c).id,physics.id);

const supplement=T.addSessions({
 kind:"reinforcement",cycleId:c.id,subjectId:math.id,date,
 area:"Eletrônica",discipline:"Matemática",topic:"Trigonometria",
 purpose:"Base para Física",plannedMin:"45",focusId:""
})[0];
T.setSessionStatus(supplement.id,"done",30,"");
assert.equal(T.cycleState(c).id,physics.id,"reforço não avança");
assert.equal(T.summarize().actualMin,135);
T.updateSession(supplement.id,{...supplement,topic:"Seno e cosseno",plannedMin:"60"});
assert.equal(T.session(supplement.id).actualMin,30,"editar plano preserva duração real");
assert.equal(T.loadFor(date).studyPlanned,240);

T.pauseSubject(physics.id,true,"Reforçar matemática",following);
assert.equal(T.cycleState(c).id,math.id,"matéria pausada é ignorada");
assert.equal(T.subject(physics.id).returnDate,following);
T.pauseSubject(physics.id,false);
assert.equal(T.subject(physics.id).paused,false);

const second=T.saveCycle({title:"ENEM",area:"ENEM",defaultMin:60});
const otherMath=T.saveSubject({cycleId:second.id,title:"Matemática",targetSessions:1});
const enem=T.addSessions({kind:"cycle",cycleId:second.id,subjectId:otherMath.id,date,
 area:"ENEM",discipline:"Matemática",topic:"Funções",purpose:"ENEM",plannedMin:"60"})[0];
T.setSessionStatus(enem.id,"done",40,"");
assert.equal(T.summarize().groups.disciplines["Matemática"].minutes,175);
assert.equal(T.summarize().groups.areas["ENEM"].minutes,40);
assert.equal(T.summarize().groups.areas["Eletrônica"].minutes,135);
assert.equal(T.summarize({cycleId:second.id}).actualMin,40);

P.submission("s2-entry",form({type:"focus",title:"Estudar matemática",date,estimatedMin:"90",priority:"high",repeat:"none"}));
const focus=P.model.entries.find(x=>x.type==="focus");
const linked=T.addSessions({kind:"supplement",date,cycleId:"",subjectId:"",area:"ENEM",discipline:"Matemática",plannedMin:"90",focusId:focus.id})[0];
assert.equal(T.loadFor(date).linkedFocuses,1);
assert.equal(T.loadFor(date).totalPlanned,T.loadFor(date).studyPlanned,"foco associado não é contado em dobro");
assert.throws(()=>T.addSessions({kind:"supplement",date,area:"ENEM",discipline:"Matemática",plannedMin:"90",focusId:focus.id}),/já está vinculado/);
assert.throws(()=>T.addSessions({kind:"cycle",cycleId:c.id,subjectId:physics.id,date,area:"Eletrônica",discipline:"Física",plannedMin:"90"}),/matéria atual/);
const local=T.addSessions({kind:"supplement",date:following,area:"Pessoal",discipline:"Leitura",plannedMin:"30"})[0];
assert.equal(local.kind,"supplement");
assert.ok(!T.summarize({from:date,to:date}).groups.areas.Pessoal);
assert.ok(T.summarize({from:following,to:following}).groups.areas.Pessoal);

C.go("estudos");
assert.ok(element("view").innerHTML.includes("Meus estudos"),"tela de estudos disponível");
T.actions.selectCycle({dataset:{id:c.id}});
assert.ok(element("view").innerHTML.includes("Sequência das matérias"),"detalhes do ciclo disponíveis");

console.log("Etapa 3: ciclos, etapa multi-sessão, correção, pausa, reforço, vínculo com foco, estatísticas por dimensão e editor preservado.");
