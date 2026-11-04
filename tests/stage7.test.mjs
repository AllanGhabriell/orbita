import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../stage7.js",import.meta.url),"utf8");
const baseTime=Date.parse("2026-11-04T12:00:00.000Z");
function harness(){
 let time=baseTime;
 const item={id:"math-1",date:"2026-11-04",plannedMin:90,status:"pending",actualMin:null,kind:"cycle",discipline:"Matemática",archived:false};
 const target={id:"physics-2",date:"2026-11-04",plannedMin:90,status:"pending",actualMin:null,kind:"supplement",discipline:"Física",archived:false};
 const items=[item,target];
 const state={settings:{motion:false},date:"2026-11-04",studies:{sessions:items,events:[]},evolution:{closed:{}}};
 let saved=0,notifications=[];
 const callbacks={};
 class ClockDate extends Date{constructor(...args){super(...(args.length?args:[time]));}static now(){return time;}}
 const fakeDocument={
  title:"Órbita",hidden:false,
  addEventListener(type,fn,capture){(callbacks[type]||=[]).push({fn,capture});},
  getElementById(){return null;},
  querySelector(){return null;},
  body:{classList:{add(){},remove(){}},offsetWidth:10}
 };
 const ctx={
  Date:ClockDate,console,
  window:{
   OrbitaCore:{
    state,esc:x=>String(x),attr:x=>String(x),today:()=> "2026-11-04",
    save(){saved++;},render(){},notify:x=>notifications.push(x),
    openModal(){},closeModal(){},settings:{},confirm:()=>true,
   },
   OrbitaStage3:{inspect:{
    session:id=>items.find(x=>x.id===id)||null,
    model:state.studies,
    setSessionStatus(id,status,min){assert.equal(id,item.id);item.status=status;item.actualMin=min;},
   }},
   OrbitaStage4:{inspect:{isClosed:date=>!!state.evolution.closed[date]}},
   addEventListener(){},
   matchMedia:()=>({matches:false}),
   confirm:()=>true,
   isSecureContext:true,
  },
  document:fakeDocument,
  setInterval(){},
  setTimeout(){return 1;},
  clearTimeout(){},
  Notification:{permission:"default"},
 };
 vm.runInNewContext(source,ctx,{filename:"stage7.js"});
 const stage=ctx.window.OrbitaStage7.inspect;
 return {state,item,target,stage,callbacks,notifications,setTime:ms=>time=baseTime+ms, get saved(){return saved}};
}
test("cronômetro conta estudo e pausas separadamente; término não avança automaticamente",()=>{
 const h=harness();
 h.stage.start("math-1");
 h.setTime(30*60000);
 h.stage.pause("preparation");
 assert.equal(h.stage.studyMs(h.state.timing.records["math-1"]),30*60000);
 h.setTime(36*60000);
 h.stage.resume();
 h.setTime(96*60000);
 assert.equal(h.stage.studyMs(h.state.timing.records["math-1"]),90*60000);
 assert.equal(h.stage.pauseMs(h.state.timing.records["math-1"]),6*60000);
 assert.equal(h.item.status,"progress");
 h.stage.finish(true);
 assert.equal(h.item.status,"done");
 assert.equal(h.item.actualMin,90);
 assert.equal(h.state.timing.active,null);
 const m=h.stage.metrics();
 assert.equal(m.studyMs,90*60000);
 assert.equal(m.pauseMs,6*60000);
 assert.equal(m.preparationMs,6*60000);
 assert.equal(h.state.timing.records["math-1"].pauses.length,1);
});
test("correção do horário de retomada preserva trilha de auditoria",()=>{
 const h=harness();
 h.stage.start("math-1");
 h.setTime(20*60000);
 h.stage.pause("rest");
 h.setTime(35*60000);
 h.stage.correction(baseTime+30*60000);
 h.setTime(40*60000);
 h.stage.finish(false);
 const r=h.state.timing.records["math-1"];
 assert.equal(r.studyMs,30*60000);
 assert.equal(r.pauseMs,10*60000);
 assert.equal(r.corrections.length,1);
 assert.equal(r.corrections[0].type,"resume");
 assert.equal(h.item.status,"progress");
 assert.equal(h.item.actualMin,30);
});
test("dia encerrado impede iniciar, sem produzir sessão falsa",()=>{
 const h=harness();
 h.state.evolution.closed["2026-11-04"]={confirmed:"2026-11-04"};
 assert.throws(()=>h.stage.start("math-1"),/finalizado/);
 assert.equal(h.state.timing.active,null);
 assert.equal(h.item.status,"pending");
});
test("interface possui indicadores e alertas configuráveis",()=>{
 const h=harness();
 assert.equal(h.stage.model.settings.mode,"continuous");
 assert.match(source,/Pausado/);
 assert.match(source,/Em estudo/);
 assert.doesNotMatch(source,/NENHUM ESTUDO ATIVO/,"não deve existir a faixa de inatividade");
 assert.match(source,/pauseMinutes/);
 assert.match(source,/upload\(/);
 assert.match(source,/data-s7="correct"/);
});

test("pausas podem ser editadas, excluídas e restauradas sem criar estudo fictício",()=>{
 const h=harness();
 h.stage.start("math-1");h.setTime(20*60000);
 h.stage.pause("rest");h.setTime(25*60000);
 h.stage.resume();h.setTime(35*60000);h.stage.finish(false);
 const r=h.state.timing.records["math-1"];
 assert.equal(r.studyMs,30*60000);
 assert.equal(r.pauseMs,5*60000);
 h.stage.editPause("math-1",0,baseTime+20*60000,baseTime+22*60000,"preparation");
 assert.equal(r.pauseMs,2*60000);
 h.stage.deletePause("math-1",0);
 assert.equal(r.pauseMs,0);
 assert.equal(r.studyMs,30*60000);
 assert.equal(r.pauses.length,0);
 h.stage.undo();
 assert.equal(h.state.timing.records["math-1"].pauseMs,2*60000);
 assert.equal(h.state.timing.records["math-1"].pauses.length,1);
 h.stage.clearPauses("math-1");
 assert.equal(h.state.timing.records["math-1"].pauseMs,0);
 assert.equal(h.state.timing.records["math-1"].studyMs,30*60000);
});
test("zerar, descartar e desfazer preservam o planejamento",()=>{
 const h=harness();
 h.stage.start("math-1");h.setTime(20*60000);h.stage.finish(false);
 assert.equal(h.item.actualMin,20);
 h.stage.resetTimer("math-1");
 assert.equal(h.state.timing.records["math-1"].studyMs,0);
 assert.equal(h.item.actualMin,null);
 assert.equal(h.item.status,"progress");
 h.stage.undo();
 assert.equal(h.state.timing.records["math-1"].studyMs,20*60000);
 assert.equal(h.item.actualMin,20);
 h.stage.discardTimer("math-1");
 assert.equal(h.state.timing.records["math-1"],undefined);
 assert.equal(h.item.status,"pending","descarte devolve ao planejamento quando o timer foi o único início");
 h.stage.undo();
 assert.equal(h.item.actualMin,20);
 assert.equal(h.state.timing.records["math-1"].studyMs,20*60000);
});
test("dividir e transferir não duplicam o tempo nem apagam conclusão",()=>{
 const h=harness();
 h.stage.start("math-1");h.setTime(30*60000);h.stage.finish(false);
 h.stage.moveRecord("math-1","physics-2",true,10);
 assert.equal(h.state.timing.records["math-1"].studyMs,20*60000);
 assert.equal(h.state.timing.records["physics-2"].studyMs,10*60000);
 assert.equal(h.item.actualMin+h.target.actualMin,30);
 assert.equal(h.target.status,"pending");
 h.stage.undo();
 assert.equal(h.state.timing.records["math-1"].studyMs,30*60000);
 assert.equal(h.state.timing.records["physics-2"],undefined);
 h.stage.moveRecord("math-1","physics-2",false);
 assert.equal(h.state.timing.records["math-1"],undefined);
 assert.equal(h.state.timing.records["physics-2"].studyMs,30*60000);
 assert.equal(h.item.actualMin,null);
 assert.equal(h.target.actualMin,30);
});

test("pausa atual pode ser zerada sem estudar ou cancelada com confirmação",()=>{
 const h=harness();
 h.stage.start("math-1");
 h.setTime(10*60000);h.stage.pause("rest");
 h.setTime(15*60000);h.stage.resetCurrentPause();
 assert.equal(h.state.timing.records["math-1"].studyMs,10*60000);
 assert.equal(h.stage.pauseMs(h.state.timing.records["math-1"]),0);
 h.setTime(18*60000);
 h.stage.cancelAccidentalPause();
 assert.equal(h.state.timing.records["math-1"].studyMs,13*60000);
 assert.equal(h.state.timing.records["math-1"].pauseMs,0);
 assert.equal(h.state.timing.records["math-1"].pauses.length,0);
 assert.equal(h.state.timing.active.phase,"running");
});

test("tempo corrigido pelo formulário manual atualiza o histórico do cronômetro",()=>{
 const h=harness();
 h.stage.start("math-1");h.setTime(30*60000);h.stage.finish(false);
 h.item.actualMin=45;
 h.stage.syncManualRecord("math-1",45);
 assert.equal(h.state.timing.records["math-1"].studyMs,45*60000);
 assert.equal(h.state.timing.records["math-1"].recordedActualMin,45);
 assert.equal(h.state.timing.records["math-1"].corrections.at(-1).type,"manual_time_adjustment");
});
