import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const original=readFileSync(new URL("../app.js",import.meta.url),"utf8");
const stage2=readFileSync(new URL("../stage2.js",import.meta.url),"utf8");
const store=new Map(),elements=new Map(),listeners={};
const element=id=>{
 if(!elements.has(id))elements.set(id,{id,innerHTML:"",textContent:"",title:"",scrollTop:0,dataset:{},style:{},isConnected:true,
 classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},focus(){},
 querySelector(){return {addEventListener(){},focus(){}}}});
 return elements.get(id);
};
const document={
 body:{dataset:{},classList:{toggle(){}}},
 getElementById:element,querySelectorAll(){return[]},querySelector(){return {content:""}},
 addEventListener(key,cb){(listeners[key]||=[]).push(cb);}
};
const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
const window={matchMedia:()=>({matches:false}),addEventListener(){}};
const location={hash:"#inicio"};
const context={document,localStorage,window,location,history:{replaceState(_a,_b,h){location.hash=h}},
 crypto:{randomUUID:(()=>{let seq=0;return()=>"id-"+(++seq)})()},FormData:class{constructor(f){return f}},
 requestAnimationFrame(){},clearTimeout(){},setTimeout(){},console,Date,Intl,structuredClone};
vm.createContext(context);
vm.runInContext(original,context,{filename:"app.js"});
vm.runInContext(stage2,context,{filename:"stage2.js"});
const C=window.OrbitaCore,S=window.OrbitaStage2.inspect;
const form=values=>({get:k=>values[k]??null,has:k=>Object.hasOwn(values,k),getAll:k=>Array.isArray(values[k])?values[k]:values[k]==null?[]:[values[k]]});
const today=C.today();
function submit(id,values){S.submission(id,form(values))}
const html=()=>element("view").innerHTML;

assert.equal(S.model.entries.length,0);
assert.equal(S.model.blocks.length,0);
assert.ok(html().includes("Primeiro, sua disponibilidade"),"primeiro acesso sem itens");

C.state.availability.weekly[0]={mode:"hours",hours:8};
C.state.availability.weekly[1]={mode:"hours",hours:8};
C.state.availability.weekly[2]={mode:"hours",hours:8};
C.state.availability.weekly[3]={mode:"hours",hours:8};
C.state.availability.weekly[4]={mode:"hours",hours:8};
C.state.availability.weekly[5]={mode:"hours",hours:8};
C.state.availability.weekly[6]={mode:"rest"};
C.save();C.render();
assert.ok(html().includes("Focos do dia"));

submit("s2-block",{title:"Trabalho",color:"#9c84f7"});
assert.equal(S.model.blocks.length,1);
const b=S.model.blocks[0];

submit("s2-entry",{type:"focus",title:"Fazer relatório",date:today,blockId:b.id,estimatedMin:"90",startTime:"09:00",priority:"medium",repeat:"none"});
assert.equal(S.model.entries.length,1);
const focus=S.model.entries[0];
assert.equal(S.kindOn(today,"focus").length,1);
assert.equal(S.hoursFor(today),90);
S.quickRecord(focus.id,today,"done");
assert.equal(S.model.records[focus.id+"@"+today].status,"done");
assert.equal(S.model.records[focus.id+"@"+today].actualMin,undefined);

submit("s2-entry",{type:"task",title:"Comprar caderno",date:today,blockId:"",estimatedMin:"15",priority:"high",repeat:"none"});
assert.equal(S.kindOn(C.addDays(today,1),"task").length,1,"tarefa pendente continua acessível no dia seguinte");
const task=S.model.entries.find(x=>x.type==="task");
S.quickRecord(task.id,C.addDays(today,1),"done");
assert.equal(S.kindOn(C.addDays(today,2),"task").length,0,"tarefa concluída deixa de aparecer");

submit("s2-entry",{type:"habit",title:"Correr",date:today,estimatedMin:"30",repeat:"weekdays",repeatEnd:C.addDays(today,28),weekday:[String(C.parse(today).getDay())],numbered:"on"});
const habit=S.model.entries.find(x=>x.type==="habit");
assert.ok(S.occurrence(habit,C.addDays(today,7)),"rotina semanal no dia equivalente");
assert.equal(S.occurrence(habit,C.addDays(today,7)).displayTitle,"Correr 2");

submit("s2-pause",{date:today,kind:"imprevisto",reason:"Compromisso familiar"});
assert.equal(S.model.dayPauses[today].kind,"imprevisto");
assert.ok(S.model.events.some(x=>x.kind==="pause_change"),"registra auditoria da pausa");
assert.ok(S.model.dayPauses[today].originalPlannedMinutes>0);

assert.throws(()=>submit("s2-move",{id:focus.id,date:today,target:C.addDays(today,3),reason:"Imprevisto"}),/já foi concluído/,"não remanejar foco já concluído");
S.quickRecord(focus.id,today,"pending");
submit("s2-move",{id:focus.id,date:today,target:C.addDays(today,3),reason:"Imprevisto"});
assert.equal(S.model.records[focus.id+"@"+today].status,"moved");
assert.ok(S.model.events.some(x=>x.kind==="focus_rescheduled"),"preserva histórico do remanejamento");
assert.equal(S.model.entries.filter(x=>x.type==="focus").length,2);
assert.equal(S.model.entries.find(x=>x.origin?.type==="rescheduled").origin.fromId,focus.id);

submit("s2-record",{id:habit.id,date:today,status:"done",actualMin:"22",actualTime:"06:40"});
assert.equal(S.model.records[habit.id+"@"+today].actualMin,22);
assert.equal(S.model.records[habit.id+"@"+today].actualTime,"06:40");

const draft=S.copyPlanDraft(form({kind:"week",origin:today,target:C.addDays(today,7),conflict:"skip"}));
assert.ok(Array.isArray(draft.changes));
assert.ok(draft.changes.every(x=>x.recurrence.kind==="none"));
assert.ok(draft.changes.every(x=>x.date>=C.state.firstAccess));

C.go("organizar");
assert.ok(html().includes("Organizar"));
C.go("planejamento");
assert.ok(html().includes("SEU CALENDÁRIO"));
// O calendário considera sessões de estudo mesmo sem foco ou hábito.
C.state.studies={sessions:[
 {id:"session-calendar-1",date:today,plannedMin:90,archived:false},
 {id:"session-calendar-2",date:today,plannedMin:90,archived:false},
 {id:"session-calendar-hidden",date:today,plannedMin:90,archived:true}
]};
C.state.date=today;
C.go("planejamento");
assert.ok(html().includes("2 sessão(ões) de estudo"),"indicador semanal inclui sessões de estudo não arquivadas");
assert.ok(html().includes("2 ses."),"rótulo compacto apresenta sessões");

console.log("Etapa 2: verificações de tarefas, focos, conclusão, blocos, recorrência, continuidade, pausa, remanejamento, tempo real e cópias passaram.");
