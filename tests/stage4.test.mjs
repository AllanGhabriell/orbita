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
study.evidence={questions:20,correct:16,quality:4};
P.quickRecord(focus.id,previous,"done");
assert.equal(V.pendingDates().length,1);
assert.throws(()=>V.finalize(date),/Finalize primeiro/,"não fecha hoje antes do dia pendente");
const snap=V.finalize(previous);
assert.equal(snap.activities[0].title,"Estudar Matemática");
assert.equal(snap.studies[0].actualMin,65);
assert.equal(snap.studies[0].evidence.correct,16);
assert.equal(snap.studies[0].evidence.quality,4);
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
assert.equal(T.summarize({from:previous,to:previous}).actualMin,65,"estatísticas do estudo não lêem valores mutados após fechamento");
assert.equal(V.model.closed[previous].availableMin,360,"disponibilidade anterior preservada");
C.state.date=previous;C.go("inicio");
assert.ok(el("view").innerHTML.includes("Estudar Matemática"),"dia bloqueado exibe snapshot original");
assert.match(el("view").innerHTML,/data-action="goToday"/,"dia encerrado oferece retorno direto para Hoje");
assert.match(el("view").innerHTML,/data-action="prevDay"/,"dia encerrado permite navegar ao dia anterior");
assert.match(el("view").innerHTML,/data-action="nextDay"/,"dia encerrado permite avançar no calendário");
assert.match(el("view").innerHTML,/data-action="jumpDate"/,"dia encerrado permite escolher data");
assert.match(el("view").innerHTML,/Sessão 1/,"dia finalizado distingue a sessão da matéria");
assert.match(el("view").innerHTML,/study-review-context/,"matéria e modalidade aparecem como contexto do histórico");
C.go("fechamento");
assert.match(el("view").innerHTML,/Revisão dos estudos/);
assert.match(el("view").innerHTML,/Sessão 1/,"a revisão do dia mantém identidade de cada sessão");
C.go("inicio");
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
assert.equal(report.count.questions,20);
assert.equal(report.count.correct,16);
assert.equal(report.count.qualityRated,1);
assert.equal(V.model.milestones.length,0,"não cria conquistas artificiais nos primeiros dias");
assert.ok(report.count.focus>=2);
const guid=V.guidance(report);
assert.ok(guid.length>=1,"orientador produz feedback sem extrapolar amostra");
assert.ok(guid.some(x=>x.title==="Histórico em formação"),"amostra pequena não gera análise rígida");
const a=V.capture(C.addDays(date,1));
assert.equal(a.activities.length,0,"dia futuro pode ser visto como prévia sem pré-preencher");
assert.throws(()=>V.finalize(C.addDays(date,1)),/Só é possível/);
assert.ok(store.has("orbita:stage1:v1"),"persistido localmente");

// Ausência por vários dias: visitas sem movimentação não exigem fechamento.
const emptyDay=C.addDays(date,-5),firstRoutineDay=C.addDays(date,-4),performedDay=C.addDays(date,-3),unperformedDay=C.addDays(date,-2);
C.state.firstAccess=emptyDay;
V.model.visitedDays[emptyDay]=true;
P.submission("s2-entry",form({type:"habit",title:"Leitura diária",date:firstRoutineDay,repeat:"daily",repeatTermination:"never"}));
const routine=P.model.entries.find(x=>x.title==="Leitura diária");
P.quickRecord(routine.id,performedDay,"done");
assert.equal(V.pendingDates().includes(emptyDay),false,"dia visitado mas sem compromisso não pede revisão");
assert.equal(V.dayHasMovement(firstRoutineDay),false,"planejamento sem execução não configura movimentação");
assert.equal(V.dayHasMovement(performedDay),true,"registro real exige revisão");
assert.equal(V.pendingDates().length,3,"somente datas com planejamento ou execução aguardam fechamento");
const closedBatch=V.finalizeBatch();
assert.equal(closedBatch.length,3,"fechamento em lote resolve todas as datas pendentes");
assert.equal(V.model.closed[performedDay].activities[0].status,"done","conclusão real preservada no snapshot");
assert.equal(V.model.closed[unperformedDay].activities[0].status,"pending","ausência não vira conclusão");
assert.equal(V.pendingDates().length,0,"sem pendências depois do lote");
assert.equal(V.isClosed(emptyDay),false,"dia vazio nunca foi encerrado artificialmente");

// Orientador geral independente dos filtros de estatísticas.
const mentor=V.mentorAnalysis();
assert.ok(mentor.items.length>=1,"orientador geral gera parecer mesmo com poucos dados");
assert.ok(V.mentorPanel().includes("Meu Orientador"),"painel do supervisor disponível");
assert.match(V.mentorPanel(),/NOTA DE EXECUÇÃO/,"avaliação destaca a nota de execução");
assert.match(V.mentorPanel(),/Pontos positivos/,"painel reconhece avanços");
assert.match(V.mentorPanel(),/Pontos de melhoria/,"painel deixa cobranças exploráveis");
assert.match(V.mentorPanel(),/Minha evolução/,"histórico visual disponível");
assert.match(V.mentorPanel(),/type="range" id="s4-mentor-target"/,"a meta semanal pode ser negociada");
assert.match(V.mentorPanel(),/id="s4-mentor-target" min="0" max="100" step="1"/,"meta pode ser ajustada com precisão de um ponto");
assert.match(V.mentorPanel(),/--mentor-progress:\d+%/,"preenchimento inicial acompanha a meta");
let sliderFill="",sliderAria="";
for(const handler of handlers.input||[])handler({target:{id:"s4-mentor-target",value:"48",style:{setProperty(k,v){if(k==="--mentor-progress")sliderFill=v}},setAttribute(k,v){if(k==="aria-valuetext")sliderAria=v}}});
assert.equal(el("s4-mentor-target-value").textContent,"48%","percentual muda enquanto arrasta");
assert.equal(sliderFill,"48%","trilho muda enquanto arrasta");
assert.equal(sliderAria,"48%","valor acessível acompanha o controle");
assert.match(V.mentorPanel(),/value="48" style="--mentor-progress:48%"/,"meta renderizada corresponde ao valor escolhido");
assert.equal(V.mentorVisualData().current.score!==null,true,"registros encerrados produzem pontuação calculada");
V.actions.mentorAcceptGoal();
assert.ok(Number.isInteger(V.model.mentor.goal.target),"meta aceita persiste no modelo");
assert.equal(V.model.mentor.goal.weekStart,C.addDays(C.firstDayOfWeek(date),7),"meta vale para a próxima semana");
assert.ok(V.mentorPanel().includes("Compromisso registrado"),"Orientador relembra o compromisso assumido");

assert.match(el("view").innerHTML,/./,"interface permanece operante");
const oldRead=V.model.mentor.lastReadSignature;
V.actions.mentorOpen();
assert.equal(V.model.mentor.lastReadSignature,V.mentorAnalysis().digest,"ler orientação marca análise como vista");
V.model.mentor.lastReadSignature=oldRead;
V.model.mentor.lastViewed="2020-01-01T12:00:00.000Z";
C.state.firstAccess=C.addDays(date,-30);
P.model.events.push(...Array.from({length:4},(_,i)=>({kind:"entry_deleted",id:"synthetic-"+i,at:new Date().toISOString()})));
P.model.events.push(...Array.from({length:4},(_,i)=>({kind:"entry_created",id:"new-"+i,at:new Date().toISOString()})));
assert.ok(V.mentorAnalysis().items.some(x=>x.key==="deleted"),"exclusões repetidas geram aviso contextual");
assert.equal(V.mentorNoticeEligible(),true,"alerta importante aparece após ausência prolongada");
assert.equal(V.mentorUnreadCount(),1,"um único lembrete, independente das análises");
assert.match(V.mentorPanel(),/Meu Orientador/,"painel permanece disponível");
V.actions.mentorSnooze({dataset:{min:"10"}});
assert.equal(V.mentorNoticeEligible(),false,"adiamento silencia recado");
V.model.mentor.snoozeUntil="";
V.actions.mentorDismiss();
assert.equal(V.mentorNoticeEligible(),false,"dispensar silencia a mesma análise");
V.model.mentor.dismissedSignature="";
V.actions.mentorDisableNotices();
assert.equal(V.mentorNoticeEligible(),false,"avisos podem ser desativados independentemente do orientador");
assert.ok(V.mentorPanel().includes("Meu Orientador"),"desativar avisos não desativa análise");
V.model.settings.mentorEnabled=false;
assert.ok(V.mentorPanel().includes("Orientador desativado"),"orientador também pode ser desativado por inteiro");
V.model.settings.mentorEnabled=true;
console.log("Etapa 4: snapshots, irreversibilidade, precedência de fechamento, feedback por amostra, descanso e bloqueio.");

V.model.settings.mentorNotices=true;
V.actions.mentorOpen();
assert.equal(V.mentorUnreadCount(),0);
P.model.events.push({kind:"entry_created",at:new Date().toISOString()});
assert.equal(V.mentorUnreadCount(),0,"criar atividade não gera aviso após consulta");
const savedClosed=V.model.closed;const savedEntries=P.model.entries;const savedRecords=P.model.records;
const day=C.addDays(C.firstDayOfWeek(date),-7),end=C.addDays(day,6);
const mk=(d,studied=120,habit="done",available=480)=>({date:d,availability:{mode:"hours",hours:available/60},availableMin:available,pause:null,activities:[{id:"h",title:"Organizar material",type:"habit",status:habit},{id:"f",type:"focus",title:"Foco",status:"done"}],studies:[{id:"s"+d,status:"done",actualMin:studied,plannedMin:studied}],plan:{studyMin:studied,otherMin:0,totalMin:studied},result:{actualStudyMin:studied,actualOtherMin:0}});
V.model.closed={};
for(let i=0;i<35;i++){const d=C.addDays(end,-i);V.model.closed[d]=mk(d);}
C.state.firstAccess=C.addDays(end,-35);
V.model.settings.strictness="strict";
const before=V.mentorWeek(end);
assert.equal(before.load.kind,"stagnation");
V.model.closed[day].activities[0].status="notdone";
const after=V.mentorWeek(end);assert.ok(after.score<before.score,"rotina não realizada afeta nota");
assert.equal(after.habitsMiss,1);
for(const snap of Object.values(V.model.closed)){snap.result.actualStudyMin=360;snap.plan.studyMin=360;snap.studies[0].actualMin=360;snap.studies[0].plannedMin=360;}
assert.equal(V.loadAssessment(end).kind,"sustain","carga elevada estável não exige aumento");
for(const snap of Object.values(V.model.closed)){snap.result.actualStudyMin=480;snap.plan.studyMin=480;snap.studies[0].actualMin=480;snap.studies[0].plannedMin=480;}
assert.equal(V.loadAssessment(end).kind,"overload","sobrecarga recorrente identificada");
// An ordinary increase is a positive development; substantial growth near capacity is attention only.
for(const snap of Object.values(V.model.closed)){const n=snap.date>=C.addDays(end,-13)?180:120;snap.result.actualStudyMin=n;snap.plan.studyMin=n;snap.studies[0].actualMin=n;snap.studies[0].plannedMin=n;}
assert.equal(V.loadAssessment(end).kind,"growth","2h para 3h é evolução");
assert.equal(V.loadAssessment(end).rate,1,"crescimento normal não perde pontos");
for(const snap of Object.values(V.model.closed)){const n=snap.date>=C.addDays(end,-13)?190:120;snap.result.actualStudyMin=n;snap.plan.studyMin=n;snap.studies[0].actualMin=n;snap.studies[0].plannedMin=n;}
assert.equal(V.loadAssessment(end).kind,"growth","aumento moderado acima de 50% continua positivo");
for(const snap of Object.values(V.model.closed)){const n=snap.date>=C.addDays(end,-13)?330:120;snap.result.actualStudyMin=n;snap.plan.studyMin=n;snap.studies[0].actualMin=n;snap.studies[0].plannedMin=n;}
assert.equal(V.loadAssessment(end).kind,"rapid","aumento grande próximo da capacidade merece atenção");
assert.equal(V.loadAssessment(end).rate,1,"atenção por aumento não reduz nota");
assert.match(V.mentorPanel(),/Pontos de atenção/);
const taskDate=C.addDays(todayForTest(),-12);
function todayForTest(){return C.today();}
P.model.entries=[{id:"low",type:"task",title:"Baixa antiga",date:taskDate,priority:"low",dueDate:"",recurrence:{kind:"none"}},{id:"high",type:"task",title:"Alta antiga",date:taskDate,priority:"high",dueDate:"",recurrence:{kind:"none"}},{id:"future",type:"task",title:"Prazo distante",date:taskDate,priority:"high",dueDate:C.addDays(date,30),recurrence:{kind:"none"}}];
P.model.records={};
const task=V.taskAssessment(C.addDays(date,-7),date,true);
assert.ok(task.issues.some(i=>i.x.id==="high"));
assert.ok(!task.issues.some(i=>["low","future"].includes(i.x.id)));
P.model.records["high@"+date]={status:"done"};
assert.ok(!V.taskAssessment(C.addDays(date,-7),date,true).issues.some(i=>i.x.id==="high"));
assert.ok(!V.mentorPanel().includes("Execução ="));
V.model.closed=savedClosed;P.model.entries=savedEntries;P.model.records=savedRecords;

for(const profile of ["gentle","firm","strict","hard"]){
 const warning={key:"habits",action:"Você quer resultados consistentes com hábitos inconsistentes?"};
 for(const score of [85,87,95,100]){
  const result=V.mentorCommunication(score,"stable",0,profile,warning,"2026-11-26");
  assert.equal(result.group,"steady","nota alta não recebe frase de cobrança");
  assert.ok(!result.summary.includes(warning.action),"diagnóstico geral não contradiz resultado");
 }
 assert.equal(V.mentorCommunication(87,"growth",5,profile,warning,"2026-11-26").group,"growth");
 assert.equal(V.mentorCommunication(87,"overload",5,profile,warning,"2026-11-26").group,"sustain");
}
assert.equal(V.mentorCommunication(45,"stable",-8,"hard",{action:"Corrigir"},"2026-11-26").group,"challenge");
const quoteIds=new Set(Array.from({length:7},(_,i)=>V.mentorCommunication(87,"growth",5,"strict",null,"2026-11-"+(10+i)).quote.id));
assert.equal(quoteIds.size,7,"variedade diária, sem troca a cada renderização");
