import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const code=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const store=new Map(),nodes=new Map(),handlers={},calls=[];
let counter=0;
function el(id){
 if(!nodes.has(id))nodes.set(id,{id,innerHTML:"",textContent:"",title:"",scrollTop:0,dataset:{},style:{},isConnected:true,
 classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},focus(){},
 querySelector(){return {addEventListener(){},focus(){},value:""}}});
 return nodes.get(id);
}
const document={body:{dataset:{},classList:{toggle(){}}},getElementById:el,querySelectorAll(){return[]},
querySelector(){return {content:""}},addEventListener(name,fn){(handlers[name]??=[]).push(fn);}};
const window={matchMedia:()=>({matches:false}),addEventListener(){}},location={hash:"#inicio"};
const ctx={document,window,location,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
history:{replaceState(a,b,h){location.hash=h}},crypto:{randomUUID:()=>("generated-"+(++counter))},
setTimeout:()=>1,clearTimeout(){},requestAnimationFrame(){},structuredClone,FormData:class{},Date,Intl,console};
vm.createContext(ctx);
for(const file of ["app.js","stage2.js","stage3.js","stage4.js"])vm.runInContext(code(file),ctx,{filename:file});
const C=window.OrbitaCore, P=window.OrbitaStage2.inspect, T=window.OrbitaStage3.inspect, V=window.OrbitaStage4.inspect;
const date=C.today(),previous=C.addDays(date,-1);
const form=x=>({get:k=>x[k]??null,getAll:k=>Array.isArray(x[k])?x[k]:x[k]===undefined?[]:[x[k]],has:k=>Object.hasOwn(x,k)});
assert.equal(Object.keys(V.model.closed).length,0,"nada pré-fechado");
assert.equal(V.pendingDates().length,0,"primeiro dia da conta não tem backlog");
assert.ok(el("view").innerHTML.includes("Primeiro, sua disponibilidade"),"onboarding permanece vazio");

C.state.availability.weekly=Array.from({length:7},()=>({mode:"hours",hours:6}));
C.state.firstAccess=previous;
C.state.date=previous;
V.model.visitedDays[previous]=true;
C.save();C.render();
P.submission("s2-entry",form({type:"focus",title:"Estudar Matemática",date:previous,estimatedMin:"90",repeat:"none"}));
const focus=P.model.entries[0];
const study=T.addSessions({kind:"supplement",date:previous,area:"ENEM",discipline:"Matemática",topic:"Funções",plannedMin:"90",focusId:focus.id})[0];
T.setSessionStatus(study.id,"done",65,"");
P.quickRecord(focus.id,previous,"done");
assert.equal(V.pendingDates().length,1);
assert.throws(()=>V.finalize(date),/Finalize primeiro/,"não fecha hoje antes do dia pendente");
const snap=V.finalize(previous);
assert.equal(snap.activities[0].title,"Estudar Matemática");
assert.equal(snap.studies[0].actualMin,65);
assert.equal(snap.plan.totalMin,90,"foco vinculado não conta em dobro");
assert.equal(V.isClosed(previous),true);
assert.throws(()=>V.finalize(previous),/já foi finalizado/,"fechamento irreversível");
assert.throws(()=>T.setSessionStatus(study.id,"pending",null,""),/finalizado/,"não alterar sessão antiga");
assert.throws(()=>T.addSessions({kind:"supplement",date:previous,area:"ENEM",discipline:"Física",plannedMin:"60"}),/finalizado|Data fechada/);
assert.equal(V.periodData("day",previous).count.studyActualMin,65);

focus.title="Título alterado fora do histórico";
study.actualMin=300;
C.state.availability.weekly[C.parse(previous).getDay()].hours=3;
assert.equal(V.model.closed[previous].activities[0].title,"Estudar Matemática","snapshot não muda ao editar modelo vivo");
assert.equal(V.model.closed[previous].studies[0].actualMin,65);
assert.equal(V.model.closed[previous].availableMin,360,"disponibilidade anterior preservada");
C.state.date=previous;C.go("inicio");
assert.ok(el("view").innerHTML.includes("Estudar Matemática"),"dia bloqueado exibe snapshot original");
assert.ok(!el("view").innerHTML.includes("Título alterado fora do histórico"),"não exibe título mutável no dia fechado");
C.go("planejamento");
assert.ok(el("view").innerHTML.includes("Dia finalizado · somente leitura"));

C.state.date=date;
P.submission("s2-entry",form({type:"focus",title:"Compromisso ainda não concluído",date,estimatedMin:"30",repeat:"none"}));
const daySnap=V.finalize(date);
assert.equal(daySnap.activities.some(x=>x.status==="pending"),true,"não inventa conclusão");
assert.equal(V.periodData("week",date).count.missingStudyTimes,0);
assert.equal(V.periodData("day",previous).final,true);
const report=V.periodData("week",date);
assert.equal(report.count.doneFocus,1);
assert.ok(report.count.focus>=2);
const guid=V.guidance(report);
assert.ok(guid.length>=1,"orientador produz feedback sem extrapolar amostra");
assert.ok(guid.some(x=>x.title==="Histórico em formação"),"amostra pequena não gera análise rígida");
const a=V.capture(C.addDays(date,1));
assert.equal(a.activities.length,0,"dia futuro pode ser visto como prévia sem pré-preencher");
assert.throws(()=>V.finalize(C.addDays(date,1)),/Só é possível/);
assert.ok(store.has("orbita:stage1:v1"),"persistido localmente");

console.log("Etapa 4: snapshots, irreversibilidade, precedência de fechamento, feedback por amostra, descanso e bloqueio.");
