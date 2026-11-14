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
 let saved=0,notifications=[],lastModal="";
 const callbacks={};
 class ClockDate extends Date{constructor(...args){super(...(args.length?args:[time]));}static now(){return time;}}
 const alarmHost={innerHTML:"",hidden:true};
 const fakeDocument={
  title:"Órbita",hidden:false,
  addEventListener(type,fn,capture){(callbacks[type]||=[]).push({fn,capture});},
  getElementById(id){return id==="s7-alarm-host"?alarmHost:null;},
  querySelector(){return null;},
  body:{classList:{add(){},remove(){}},offsetWidth:10}
 };
 const ctx={
  Date:ClockDate,console,
  window:{
   OrbitaCore:{
    state,esc:x=>String(x),attr:x=>String(x),today:()=> "2026-11-04",
    save(){saved++;},render(){},notify:x=>notifications.push(x),
    openModal(title,html){lastModal=html;},closeModal(){lastModal="";},settings:{},confirm:()=>true,
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
 return {state,item,target,stage,decorate:ctx.window.OrbitaStage7.decorate,callbacks,notifications,alarmHost,setTime:ms=>time=baseTime+ms, get saved(){return saved},get modal(){return lastModal}};
}
test("correção principal usa totais da sessão mesmo com pausa atual de dois segundos",()=>{
 const h=harness();
 h.stage.start("math-1");
 h.setTime(416*60000+33000);
 h.stage.pause("rest");
 h.setTime(417*60000+55000);
 h.stage.correctModal();
 assert.match(h.modal,/totais de toda a sessão/);
 assert.match(h.modal,/name="studyMinutes"/);
 assert.match(h.modal,/name="restMinutes"/);
 assert.doesNotMatch(h.modal,/name="studySec"|name="restSec"/,"sem campo de segundos");
 assert.ok(!h.modal.includes('max="1" step="1"'),"não limitar estudo a apenas um minuto da pausa");
 h.stage.correctSessionTotals(90,1,"paused");
 const r=h.state.timing.records["math-1"];
 assert.equal(r.studyMs,90*60000);
 assert.equal(r.pauseMs,60000);
 assert.ok(r.unaccountedMs>300*60000,"horas excedentes não viram descanso");
 assert.equal(h.state.timing.active.phase,"paused");
 assert.equal(r.corrections.at(-1).type,"session_totals_corrected");
 h.stage.finish(false);
 assert.equal(h.item.actualMin,90,"tempo total corrigido é salvo na sessão");
});
test("correção de totais em estudo ativo preserva tempos e permite desfazer",()=>{
 const h=harness();h.stage.start("math-1");h.setTime(120*60000);
 h.stage.correctSessionTotals(90,0,"running");
 let r=h.state.timing.records["math-1"];
 assert.equal(r.studyMs,90*60000);
 assert.equal(r.unaccountedMs,30*60000);
 assert.equal(h.stage.studyMs(r),90*60000);
 h.setTime(120*60000+30000);
 assert.equal(h.stage.studyMs(r),90*60000+30000,"a contagem prossegue normalmente");
 h.stage.undo();
 r=h.state.timing.records["math-1"];
 assert.equal(h.stage.studyMs(r),120*60000,"desfazer restaura contagem registrada");
 assert.equal(r.unaccountedMs||0,0);
});
test("correção de totais impede inventar tempo superior ao registrado",()=>{
 const h=harness();h.stage.start("math-1");h.setTime(10*60000);
 assert.throws(()=>h.stage.correctSessionTotals(90,0,"running"),/ultrapassam/);
 assert.equal(h.stage.studyMs(h.state.timing.records["math-1"]),10*60000);
});
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
test("correção simples separa descanso real do estudo e mantém auditoria",()=>{
 const h=harness();
 h.stage.start("math-1");
 h.setTime(60*60000);h.stage.pause("rest");
 h.setTime(70*60000);
 h.stage.correctRestMinutes(2,0);
 const r=h.state.timing.records["math-1"];
 assert.equal(r.studyMs,68*60000);
 assert.equal(r.pauseMs,2*60000);
 assert.equal(h.state.timing.active.phase,"running");
 assert.equal(r.pauses.at(-1).endedAt-r.pauses.at(-1).startedAt,2*60000);
 assert.equal(r.corrections.at(-1).type,"simplified_rest");
 assert.equal(r.corrections.at(-1).studyAddedMs,8*60000);
 h.setTime(75*60000);
 assert.equal(h.stage.studyMs(r),73*60000,"contagem continua depois do ajuste");
 h.stage.finish(false);
 assert.equal(h.item.actualMin,73);
});
test("ajuste simples não permite descanso maior que a pausa atual",()=>{
 const h=harness();
 h.stage.start("math-1");h.setTime(10*60000);h.stage.pause();
 h.setTime(13*60000);
 assert.throws(()=>h.stage.correctRestMinutes(4,0),/não pode ultrapassar/);
 assert.equal(h.state.timing.active.phase,"paused");
 assert.equal(h.stage.pauseMs(h.state.timing.records["math-1"]),3*60000);
});
test("redistribuir estudo ativo entre estudo descanso e tempo desconsiderado",()=>{
 const h=harness();
 h.stage.start("math-1");
 h.setTime(40*60000);
 h.stage.reallocateCurrent(15,0,10,0,"running");
 const r=h.state.timing.records["math-1"];
 assert.equal(r.studyMs,15*60000);
 assert.equal(r.pauseMs,10*60000);
 assert.equal(r.unaccountedMs,15*60000);
 assert.equal(h.state.timing.active.phase,"running");
 assert.equal(r.corrections.at(-1).type,"time_reallocated");
 h.setTime(50*60000);
 assert.equal(h.stage.studyMs(r),25*60000);
 h.stage.finish(false);
 assert.equal(h.item.actualMin,25,"registro final considera somente estudo real");
});
test("redistribuir pausa preserva histórico e estado pausado",()=>{
 const h=harness();h.stage.start("math-1");h.setTime(20*60000);
 h.stage.pause("rest");h.setTime(30*60000);
 h.stage.reallocateCurrent(6,0,2,0,"paused");
 const r=h.state.timing.records["math-1"];
 assert.equal(r.studyMs,26*60000);
 assert.equal(r.pauseMs,2*60000);
 assert.equal(r.unaccountedMs,2*60000);
 assert.equal(h.state.timing.active.phase,"paused");
 assert.equal(r.pauses.length,2,"pausa original corrigida e nova pausa aberta");
 h.setTime(32*60000);
 assert.equal(h.stage.pauseMs(r),4*60000);
});
test("não aceita redistribuir mais tempo que o registrado e permite desfazer",()=>{
 const h=harness();h.stage.start("math-1");h.setTime(10*60000);
 assert.throws(()=>h.stage.reallocateCurrent(11,0,0,0,"running"),/ultrapassar/);
 assert.equal(h.stage.model.records["math-1"].studyMs,0);
 h.stage.reallocateCurrent(5,0,2,0,"running");
 assert.equal(h.stage.model.records["math-1"].unaccountedMs,3*60000);
 h.stage.undo();
 assert.equal(h.stage.model.records["math-1"].unaccountedMs||0,0);
 assert.equal(h.stage.studyMs(h.stage.model.records["math-1"]),10*60000);
});
test("alarme silencia após 15 minutos sem ação sem alterar sessão",()=>{
 const h=harness();
 h.stage.start("math-1");
 h.stage.alertUser("Alarme prolongado","finish");
 assert.equal(h.stage.model.alarm.silenced,false);
 h.setTime(14*60000);
 assert.equal(h.stage.autoSilenceAlarm(),false);
 h.setTime(16*60000);
 assert.equal(h.stage.autoSilenceAlarm(),true);
 assert.equal(h.stage.model.alarm.silenced,true);
 assert.equal(h.stage.model.active.phase,"running");
 assert.equal(h.stage.studyMs(h.stage.model.records["math-1"]),16*60000);
});
test("interação adia desligamento do som e opção configurável modifica prazo",()=>{
 const h=harness();h.stage.start("math-1");h.stage.alertUser("Alarme","finish");
 h.setTime(12*60000);h.stage.noteActivity();
 h.setTime(20*60000);assert.equal(h.stage.autoSilenceAlarm(),false);
 h.setTime(28*60000);assert.equal(h.stage.autoSilenceAlarm(),true);
 const second=harness();second.stage.model.settings.alarmIdleMinutes=5;
 second.stage.start("math-1");second.stage.alertUser("Alarme","finish");
 second.setTime(6*60000);
 assert.equal(second.stage.autoSilenceAlarm(),true);
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

test("meta dispara aviso persistente, que pode ser silenciado sem terminar a sessão",()=>{
 const h=harness();
 h.stage.start("math-1");
 h.setTime(90*60000);
 h.stage.tick();
 assert.equal(h.state.timing.alarm.which,"finish");
 assert.equal(h.alarmHost.hidden,false);
 assert.match(h.alarmHost.innerHTML,/Meta de estudo atingida/);
 h.stage.silenceAlarm();
 assert.equal(h.state.timing.alarm.silenced,true);
 assert.equal(h.item.status,"progress");
 assert.equal(h.alarmHost.hidden,false);
 h.stage.dismissAlarm();
 assert.equal(h.state.timing.alarm,null);
 assert.equal(h.alarmHost.hidden,true);
 assert.equal(h.item.status,"progress");
 h.stage.tick();
 assert.equal(h.state.timing.alarm,null,"meta já notificada não dispara novamente");
});
test("pausa prolongada mostra aviso e retomar encerra o alarme sem alterar estudo",()=>{
 const h=harness();
 h.stage.start("math-1");h.setTime(12*60000);h.stage.pause("preparation");
 h.setTime(23*60000);
 h.stage.tick();
 assert.equal(h.state.timing.alarm.which,"pause");
 h.stage.resume();
 assert.equal(h.state.timing.alarm,null);
 assert.equal(h.state.timing.records["math-1"].studyMs,12*60000);
 assert.equal(h.state.timing.records["math-1"].pauseMs,11*60000);
});

test("teste de alarme abre aviso no Órbita sem criar nem concluir sessão",()=>{
 const h=harness();
 h.stage.showDemoAlarm("test");
 assert.equal(h.alarmHost.hidden,false);
 assert.match(h.alarmHost.innerHTML,/Teste de alarme/);
 assert.equal(h.state.timing.active,null);
 assert.equal(h.state.timing.alarm,undefined);
 assert.match(h.stage.model.settings.finishSound,/orbita/);
 h.stage.silenceAlarm();
 assert.match(h.alarmHost.innerHTML,/Reproduzir som/);
 h.stage.dismissAlarm();
 assert.equal(h.alarmHost.hidden,true);
 assert.equal(h.item.status,"pending");
});

test("preferências do cronômetro têm grupos, alternâncias acessíveis e arquivo sem caixa nativa",()=>{
 const h=harness();
 const markup=String(h.decorate("configuracoes",""));
 assert.match(markup,/s7-settings-grid/);
 assert.match(markup,/Ritmo de estudo/);
 assert.match(markup,/Sons e efeitos/);
 assert.match(markup,/Notificações/);
 assert.match(markup,/s7-file-action/);
 assert.match(markup,/id="s7-upload-finish"/);
 assert.match(markup,/id="s7-upload-pause"/);
 assert.match(markup,/id="s7-setting-loopFinish"/);
 assert.match(markup,/data-s7="testNotification"/);
 assert.match(markup,/data-s7="testPauseNotification"/);
 assert.doesNotMatch(markup,/O alarme permanece na tela até ser resolvido/);
});
