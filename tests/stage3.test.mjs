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
assert.throws(()=>T.saveCycle({title:"Sem disponibilidade",area:"ENEM",defaultMin:90}),/disponibilidade/,"sem disponibilidade não cria ciclos");
assert.ok(element("view").innerHTML.includes("Primeiro, sua disponibilidade"));
for(let i=0;i<7;i++)C.state.availability.weekly[i]={mode:"hours",hours:8};
C.save();C.render();
assert.ok(element("view").innerHTML.includes("Estudos de hoje"));

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
assert.ok(element("view").innerHTML.includes("Horas reais no ciclo"),"métricas específicas do ciclo");
T.actions.copyCycle({dataset:{id:c.id}});
assert.equal(T.model.cycles.length,3,"cópia preserva ciclos originais");
const copiedCycle=T.model.cycles.at(-1);
assert.equal(T.model.subjects.filter(x=>x.cycleId===copiedCycle.id).length,2,"duplicação inclui matérias");
assert.equal(T.model.sessions.filter(x=>x.cycleId===copiedCycle.id).length,0,"histórico não é copiado");
T.actions.archiveCycle({dataset:{id:copiedCycle.id}});
assert.equal(T.cycle(copiedCycle.id).archived,true);
C.go("estudos");
assert.ok(element("view").innerHTML.includes("Ciclos arquivados"),"ciclos arquivados podem ser encontrados");
T.actions.restoreCycle({dataset:{id:copiedCycle.id}});
assert.equal(T.cycle(copiedCycle.id).archived,false,"ciclo pode ser reativado");
T.actions.chooseNext({dataset:{id:physics.id}});
assert.equal(T.cycleState(c).id,physics.id,"próxima matéria pode ser alterada manualmente");
P.model.closedDays.push(following);
assert.throws(()=>T.addSessions({kind:"supplement",date:following,area:"Pessoal",discipline:"Leitura",plannedMin:"30"}),/Data fechada|finalizado/);
P.model.closedDays.pop();


// Planejamento rápido de 3 sessões reais de Matemática — 4h30 no analisador.
const batchCycle=T.saveCycle({title:"Ciclo semanal",area:"ENEM",defaultMin:90});
const batchMath=T.saveSubject({cycleId:batchCycle.id,title:"Matemática",targetSessions:3});
const batchPhysics=T.saveSubject({cycleId:batchCycle.id,title:"Física",targetSessions:1});
const planned=T.addBatchSessions({cycleId:batchCycle.id,fromDate:date,toDate:date,count:3,plannedMin:90,weekdays:[C.parse(date).getDay()]});
assert.equal(planned.length,3,"três sessões distintas agendadas no dia");
assert.equal(planned.filter(x=>x.rotationSlot).length,3,"matéria futura não é fixada prematuramente");
assert.equal(T.loadFor(date).studyPlanned,240+60+90+270,"três sessões de 90min entram separadamente na carga do dia");
C.go("inicio");
assert.match(element("view").innerHTML,/Estudos de hoje/);
assert.match(element("view").innerHTML,/3 de|0 de 3/,"total de sessões é exibido no Início");
assert.ok((element("view").innerHTML.match(/data-s3="quickDone"/g)||[]).length>=3,"concluir diretamente no Início");
assert.doesNotMatch(element("view").innerHTML,/data-s3="newSession"/,"o Início não oferece configuração de sessões");
T.setSessionStatus(planned[0].id,"done",null,"");
T.setSessionStatus(planned[1].id,"done",null,"");
assert.equal(T.cycleState(batchCycle).id,batchMath.id,"matéria não avança antes das três conclusões");
T.setSessionStatus(planned[2].id,"done",null,"");
assert.equal(T.cycleState(batchCycle).id,batchPhysics.id,"conclusão da terceira sessão avança Física");
assert.equal(T.summarize().actualRecorded < T.summarize().sessions,true,"concluir sem duração não inventa horas reais");
C.render();
assert.match(element("view").innerHTML,/Física/,"a próxima matéria aparece no Início");
T.setSessionStatus(planned[2].id,"pending",null,"");
assert.equal(T.cycleState(batchCycle).id,batchMath.id,"desfazer última conclusão reabre Matemática");
assert.equal(planned[2].status,"pending");
T.setSessionStatus(planned[2].id,"done",50,"");
assert.equal(T.cycleState(batchCycle).id,batchPhysics.id);
const weekEnd=C.addDays(date,6);
const batch=T.addBatchSessions({cycleId:batchCycle.id,fromDate:date,toDate:weekEnd,count:2,plannedMin:90,weekdays:[1,2,3,4,5]});
const expected=Array.from({length:7},(_,i)=>C.addDays(date,i)).filter(d=>[1,2,3,4,5].includes(C.parse(d).getDay()));
assert.equal(batch.length,expected.length*2,"segunda a sexta cria duas sessões por dia");
assert.equal(batch.reduce((a,x)=>a+x.plannedMin,0),expected.length*180);
assert.ok(batch.every(x=>x.status==="pending"&&x.subjectId===""),"planejar semana não altera o ciclo");
assert.equal(T.cycleState(batchCycle).id,batchPhysics.id);
assert.throws(()=>T.addBatchSessions({cycleId:batchCycle.id,fromDate:date,toDate:date,count:0,weekdays:[1]}),/quantidade|válida|inteira/i);
assert.throws(()=>T.addBatchSessions({cycleId:batchCycle.id,fromDate:date,toDate:date,count:2,weekdays:[]}),/dia da semana/i);
assert.throws(()=>T.addBatchSessions({cycleId:batchCycle.id,fromDate:date,toDate:C.addDays(date,32),count:1,weekdays:[1]}),/31 dias/);
const nextOpen=expected.find(d=>d>date);
if(nextOpen){
 const dynamic=batch.find(x=>x.date===nextOpen);
 T.setSessionStatus(dynamic.id,"done",null,"");
 assert.equal(dynamic.discipline,"Física","a matéria futura assume o assunto ativo só quando concluída");
 assert.equal(T.cycleState(batchCycle).id,batchMath.id,"próxima vaga segue a rotação real");
}


// Reforma de planejamento: sessões selecionadas, duplicação, cópia, modelo e desfazer.
const planCycle=T.saveCycle({title:"Rotação IFPB",area:"Eletrônica",defaultMin:90});
const electrical=T.saveSubject({cycleId:planCycle.id,title:"Eletricidade Básica",targetSessions:1});
const circuits=T.saveSubject({cycleId:planCycle.id,title:"Circuitos",targetSessions:1});
T.model.topics.push({id:"topic-1",title:"Leis de Kirchhoff",subjectId:circuits.id,archived:false});
const beforePlan=T.loadFor(date).studyPlanned;
const planPair=T.planCreate({cycleId:planCycle.id,date,mode:"rotation",plannedMin:"90",count:2});
assert.equal(planPair.length,2);
assert.equal(T.loadFor(date).studyPlanned,beforePlan+180,"duas sessões de 90min adicionam três horas");
assert.ok(planPair.every(x=>x.rotationSlot&&x.status==="pending"&&x.subjectId===""));
C.go("estudos");
T.actions.openPlanner();
assert.match(element("view").innerHTML,/Planejamento de estudos/);
assert.match(element("view").innerHTML,/Copiar semana/);
assert.doesNotMatch(element("view").innerHTML,/data-s3="quickDone"|data-s3="recordSession"/,"planejamento não executa sessões");
const specific=T.planCreate({cycleId:planCycle.id,date,mode:"specific",subjectId:circuits.id,topicId:"topic-1",plannedMin:"45",count:1});
assert.equal(specific[0].kind,"reinforcement");
assert.equal(specific[0].discipline,"Circuitos");
assert.equal(specific[0].topic,"Leis de Kirchhoff");
assert.equal(T.cycleState(planCycle).id,electrical.id,"exceção não altera matéria atual");
assert.throws(()=>T.planDelete([sessions[0].id]),/iniciada|concluída/,"conclusão fica protegida");
T.planEdit(specific[0].id,{cycleId:planCycle.id,date:following,mode:"specific",subjectId:electrical.id,plannedMin:"60"});
assert.equal(specific[0].date,following);
assert.equal(specific[0].discipline,"Eletricidade Básica");
T.planMove(specific[0].id,date);
assert.equal(specific[0].date,date);
const copied=T.planCopyRange(date,C.addDays(date,7),1,false);
assert.ok(copied.length>=3);
assert.ok(copied.every(x=>x.status==="pending"&&x.actualMin===null),"cópia não herda conclusão nem tempo");
const lenAfterCopy=T.model.sessions.length;
T.planUndo();
assert.equal(T.model.sessions.length,lenAfterCopy-copied.length,"desfazer reverte a cópia recente");
const template=T.planSaveTemplate("Semana foco",date);
assert.ok(template.items.length>=3);
const monday=T.planWeekStart(C.addDays(date,14));
const result=T.planApplyTemplate(template.id,monday,false);
assert.equal(result,template.items.length);
assert.ok(T.model.sessions.filter(x=>x.date>=monday&&x.date<=C.addDays(monday,6)).every(x=>x.status==="pending"));
T.planUndo();
assert.equal(T.model.sessions.filter(x=>x.date>=monday&&x.date<=C.addDays(monday,6)).length,0,"desfazer remove aplicação de modelo");
T.planBulk([planPair[0].id,planPair[1].id],{date:following,plannedMin:60,mode:"specific",cycleId:planCycle.id,subjectId:circuits.id});
assert.equal(T.session(planPair[0].id).discipline,"Circuitos");
assert.equal(T.session(planPair[1].id).date,following);
assert.equal(T.cycleState(planCycle).id,electrical.id,"alterar planejamento não avança o ciclo");
T.planUndo();
assert.equal(T.session(planPair[0].id).discipline,"Próxima matéria do ciclo","edição em lote desfeita preserva estado anterior");
// As referências de objetos anteriores ao desfazer devem ser reobtidas do modelo atual.
assert.ok(T.planDayEntries(date).some(x=>x.id===planPair[0].id&&x.rotationSlot));
assert.throws(()=>T.planCopyRange(date,date,1,false),/diferente da origem/);
assert.throws(()=>T.planCreate({cycleId:planCycle.id,date,mode:"specific",subjectId:"missing",plannedMin:90}),/matéria cadastrada/);


// A sessão é a unidade principal; o rótulo da matéria é informação subordinada.
// A previsão de uma matéria futura simula conclusões, sem alterar o ciclo real.
const visualCycle=T.saveCycle({title:"Ciclo de teste visual",area:"ENEM",defaultMin:45});
const visualMath=T.saveSubject({cycleId:visualCycle.id,title:"Álgebra",targetSessions:2});
const visualPhysics=T.saveSubject({cycleId:visualCycle.id,title:"Física II",targetSessions:1});
const visualDay=T.planCreate({cycleId:visualCycle.id,date,mode:"rotation",plannedMin:45,count:2});
const visualFuture=T.planCreate({cycleId:visualCycle.id,date:following,mode:"rotation",plannedMin:45,count:1});
assert.equal(T.plannerLabel(visualDay[0]),"Álgebra");
assert.equal(T.plannerLabel(visualDay[1]),"Álgebra");
assert.equal(T.plannerLabel(visualFuture[0]),"Física II","a previsão considera a conclusão hipotética das duas sessões anteriores");
assert.equal(T.cycleState(visualCycle).id,visualMath.id,"prévia de matéria não avança o ciclo real");
const visualExtra=T.planCreate({cycleId:visualCycle.id,date,mode:"specific",subjectId:visualPhysics.id,plannedMin:30});
assert.equal(T.sessionModeLabel(visualExtra[0]),"Matéria específica do ciclo","exceção do ciclo não é classificada como avulsa");
assert.ok(T.sessionOrdinal(visualExtra[0])>=1);
C.go("inicio");
const homeVisual=element("view").innerHTML;
assert.match(homeVisual,/study-session-progress/,"Início usa uma barra discreta de progresso");
assert.doesNotMatch(homeVisual,/study-daily-track/,"não duplica a matéria em uma longa reta");
assert.match(homeVisual,/<strong>Sessão \d+<\/strong>/,"sessão em primeiro plano");
assert.match(homeVisual,/study-daily-subject/,"matéria como contexto da sessão");
C.go("estudos");
T.actions.openPlanner();
const plannerVisual=element("view").innerHTML;
assert.match(plannerVisual,/study-plan-item-subject/);
assert.match(plannerVisual,/Previsão do ciclo/,"projeção é identificada como não definitiva");
assert.doesNotMatch(plannerVisual,/>Avulsa</,"sessão vinculada a ciclo não aparece como avulsa");
T.setSessionStatus(visualDay[0].id,"done",null,"");
T.setSessionStatus(visualDay[1].id,"done",null,"");
assert.equal(T.cycleState(visualCycle).id,visualPhysics.id);
assert.equal(T.plannerLabel(visualFuture[0]),"Física II","previsão é consistente com o avanço real");
T.setSessionStatus(visualDay[1].id,"pending",null,"");
assert.equal(T.cycleState(visualCycle).id,visualMath.id,"desfazer reabre a etapa");
assert.equal(T.plannerLabel(visualFuture[0]),"Física II","projeção continua condicional à sessão pendente");

console.log("Etapa 3: ciclos, etapa multi-sessão, correção, pausa, reforço, vínculo com foco, estatísticas por dimensão e editor preservado.");
