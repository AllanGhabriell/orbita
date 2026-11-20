/* Órbita v5.11 — relatório factual de 30 dias, sem integração externa. */
(function(){
"use strict";
const C=window.OrbitaCore;
if(!C)return;
const e=C.esc;
let textCache="",createdAt=null;
const pad=x=>String(x).padStart(2,"0");
const fmtMinutes=x=>x==null?"não informado":(Math.round(x*100)/100).toLocaleString("pt-BR")+" min";
const hours=x=>x==null?"não informado":(x/60).toFixed(2).replace(".",",")+" h";
const pct=(n,d)=>d>0?(100*n/d).toFixed(1).replace(".",",")+"%":"não calculável (sem registros aplicáveis)";
const value=x=>x===null||x===undefined||x===""?"não informado":String(x);
const dateOf=x=>typeof x==="string"?x.slice(0,10):"";
const known=x=>x!==null&&x!==undefined&&x!==""&&Number.isFinite(Number(x));
const sum=(xs,key)=>xs.reduce((a,x)=>a+(Number(x[key])||0),0);
const formatDate=x=>value(x);
function make(){
 const s=C.state,plan=s.planner||{},studies=s.studies||{},evo=s.evolution||{},timing=s.timing||{};
 const stage2=window.OrbitaStage2?.inspect,stage7=window.OrbitaStage7?.inspect;
 const today=C.today(),start=C.addDays(today,-29),dates=Array.from({length:30},(_,i)=>C.addDays(start,i));
 const closed=evo.closed||{},records=plan.records||{},overrides=plan.overrides||{},pauses=plan.dayPauses||{},timer=timing.records||{};
 const sessions=studies.sessions||[],cycles=studies.cycles||[],methods=studies.methods||[],entries=plan.entries||[];
 const relevant=x=>dateOf(x)>=start&&dateOf(x)<=today;
 const allEvents=[...(plan.events||[]).map(x=>({...x,source:"planejamento"})),...(studies.events||[]).map(x=>({...x,source:"estudos"}))];
 const eventDates=x=>[x.date,x.target,dateOf(x.at),dateOf(x.createdAt),dateOf(x.registeredAt)].filter(Boolean);
 const events=allEvents.filter(x=>eventDates(x).some(relevant));
 const corrections=Object.entries(timer).flatMap(([id,r])=>(r.corrections||[]).filter(x=>relevant(x.registeredAt||x.at||r.startedAt)).map(x=>({sessionId:id,...x})));
 const lines=[],line=t=>lines.push(String(t)),sep=()=>line("=".repeat(72));
 const byDay=[];
 const activeId=timing.active?.sessionId;
 function readTimer(x){
  const t=timer[x.id];if(!t)return null;
  let study=Number(t.studyMs)||0,rest=Number(t.pauseMs)||0;
  if(activeId===x.id&&timing.active?.phase==="running")study=Math.max(0,study+Math.max(0,Date.now()-Number(timing.active.since||Date.now())));
  if(activeId===x.id&&timing.active?.phase==="paused")rest=Math.max(0,rest+Math.max(0,Date.now()-Number(timing.active.since||Date.now())));
  return {studyMs:study,pauseMs:rest,record:t,live:activeId===x.id};
 }
 function activityOn(d){
  if(closed[d])return (closed[d].activities||[]).map(x=>({...x,source:"fechamento definitivo"}));
  return stage2?.allOn?.(d)?.map(x=>({...x,source:"planejamento e registros atuais"}))||[];
 }
 function studiesOn(d){
  if(closed[d])return (closed[d].studies||[]).map(x=>({...x,source:"fechamento definitivo"}));
  return sessions.filter(x=>x.date===d&&!x.archived).map(x=>({...x,source:"sessão em aberto"}));
 }
 for(const d of dates){
  const snap=closed[d],activities=activityOn(d),ss=studiesOn(d);
  let planned=0,actual=0,actualKnown=0,done=0,notdone=0,partial=0,studyPause=0;
  const enriched=ss.map(x=>{
   const tr=readTimer(x);
   const duration=known(x.actualMin)?Number(x.actualMin):tr&&tr.studyMs>0?tr.studyMs/60000:null;
   const status=x.status||"pending";
   const est=known(x.plannedMin)?Number(x.plannedMin):null;
   if(est!==null)planned+=est;
   if(duration!==null){actual+=duration;actualKnown++;}
   if(status==="done")done++;
   if(status==="notdone")notdone++;
   if(status==="progress")partial++;
   studyPause+=(tr?.pauseMs||0)/60000;
   return {...x,duration,planned:est,tr,status};
  });
  const rest=pauses[d]||snap?.pause||null;
  const availability=snap?.availability||s.availability?.overrides?.[d]||s.availability?.weekly?.[C.parse(d).getDay()]||null;
  const dayEvents=events.filter(x=>eventDates(x).includes(d));
  const dayCorrections=corrections.filter(x=>dateOf(x.registeredAt||x.at)===d);
  byDay.push({date:d,closed:!!snap,activities,ss:enriched,planned,actual,actualKnown,done,notdone,partial,studyPause,rest,availability,dayEvents,dayCorrections});
 }
 const all=byDay.flatMap(x=>x.ss),acts=byDay.flatMap(x=>x.activities);
 const dayWithStudy=byDay.filter(x=>x.actual>0).length,withoutTime=byDay.filter(x=>x.actualKnown===0).length;
 const doneActivities=acts.filter(x=>x.status==="done").length;
 const doneStudies=all.filter(x=>x.status==="done").length;
 const plannedSessions=all.length;
 const tasks=acts.filter(x=>x.type==="task"),foci=acts.filter(x=>x.type==="focus"),habits=acts.filter(x=>x.type==="habit");
 const plannedTotal=sum(byDay,"planned"),actualTotal=sum(byDay,"actual"),pauseTotal=sum(byDay,"studyPause");
 const distribution=new Map();
 for(const x of all){const key=[x.discipline||"Não informada",cycles.find(c=>c.id===x.cycleId)?.title||x.area||"Sem ciclo"].join(" / ");const z=distribution.get(key)||{planned:0,actual:0,known:0,sessions:0,done:0};z.planned+=x.planned||0;z.actual+=x.duration||0;z.known+=x.duration!==null?1:0;z.sessions++;z.done+=x.status==="done"?1:0;distribution.set(key,z);}
 const weeks=[];for(let i=0;i<30;i+=7){const chunk=byDay.slice(i,i+7);weeks.push({from:chunk[0].date,to:chunk.at(-1).date,days:chunk.length,planned:sum(chunk,"planned"),actual:sum(chunk,"actual"),studyDays:chunk.filter(x=>x.actual>0).length});}
 const generated=new Date();
 sep();line("RELATÓRIO DE DESEMPENHO — CONSELHO SOBERANO DE ALLAN (CSA)");sep();
 line("Gerado em: "+generated.toLocaleString("pt-BR"));line("Período inclusivo: "+start+" a "+today+" (30 dias corridos)");
 line("Origem: registros locais/sincronizados disponíveis no Órbita no momento da geração.");
 line("Finalidade: documentação factual para análise externa, sem julgamento ou atribuição de culpa.");
 line("Cobertura: "+byDay.filter(x=>x.closed).length+" dias finalizados; "+(30-byDay.filter(x=>x.closed).length)+" dias não finalizados.");
 line("Nota: ausências de registros não comprovam ausência de estudo ou descumprimento.");
 line("Nota: horas previstas e realizadas são medidas diferentes; conclusão sem tempo registrado não cria minutos fictícios.");
 line("Nota: tarefas recorrentes são contadas por ocorrência; tarefas secundárias não recorrentes podem aparecer pendentes em vários dias e NÃO representam novas obrigações independentes.");
 line("Nota: tempos derivados de registros de cronometragem em andamento são provisórios.");
 line("Nota: edições anteriores só podem ser recuperadas quando existe histórico/evento documentado.");
 line("Nota: registros atuais de dias não finalizados podem ser alterados após este relatório.");
 line("");
 sep();line("1. RESUMO EXECUTIVO");sep();
 line("Horas de estudo previstas: "+hours(plannedTotal));
 line("Horas de estudo efetivamente informadas/registradas: "+hours(actualTotal));
 line("Diferença aritmética previsto menos registrado: "+hours(plannedTotal-actualTotal)+" (não equivale automaticamente a descumprimento).");
 line("Média de estudo registrado por dia corrido: "+hours(actualTotal/30));
 line("Média semanal normalizada (7 dias): "+hours(actualTotal/30*7));
 line("Dias com tempo de estudo registrado: "+dayWithStudy+"/30");
 line("Dias sem duração de estudo registrada: "+withoutTime+"/30");
 line("Sessões planejadas encontradas: "+plannedSessions+"; concluídas: "+doneStudies+"; não realizadas: "+all.filter(x=>x.status==="notdone").length+"; parciais/em andamento: "+all.filter(x=>x.status==="progress").length);
 line("Sessões com duração efetiva disponível: "+all.filter(x=>x.duration!==null).length);
 line("Sessões com cronômetro registrado: "+all.filter(x=>!!x.tr).length);
 line("Tempo registrado de pausas de cronômetro: "+hours(pauseTotal));
 line("Ocorrências de tarefas/focos/rotinas no período: "+acts.length+"; concluídas: "+doneActivities);
 line("Percentual de conclusão de ocorrências de atividades: "+pct(doneActivities,acts.length));
 line("Percentual de conclusão das sessões: "+pct(doneStudies,plannedSessions));
 line("Focos: "+foci.length+" ocorrências; "+foci.filter(x=>x.status==="done").length+" concluídas.");
 line("Tarefas secundárias: "+tasks.length+" aparições; "+new Set(tasks.map(x=>x.id)).size+" identificadores únicos; "+tasks.filter(x=>x.status==="done").length+" aparições concluídas.");
 line("Rotinas: "+habits.length+" ocorrências; "+habits.filter(x=>x.status==="done").length+" concluídas.");
 line("Dias com descanso registrado ou configurado: "+byDay.filter(x=>!!x.rest||x.availability?.mode==="rest").length);
 line("Eventos documentados no período: "+events.length+"; correções manuais do cronômetro: "+corrections.length);
 line("");
 sep();line("2. DESEMPENHO POR MATÉRIA E CICLO");sep();
 for(const [name,z] of [...distribution.entries()].sort((a,b)=>b[1].actual-a[1].actual))line(name+": planejado "+hours(z.planned)+"; registrado "+hours(z.actual)+"; "+z.known+"/"+z.sessions+" com tempo; "+z.done+" concluídas.");
 if(!distribution.size)line("Nenhuma sessão disponível no período.");
 line("Ciclos cadastrados: "+(cycles.length?cycles.map(c=>c.title+" ["+(c.archived?"arquivado":"ativo")+"]").join("; "):"nenhum cadastrado"));
 line("");
 sep();line("3. COMPARAÇÃO ENTRE SEMANAS (BLOCOS CRONOLÓGICOS)");sep();
 for(let i=0;i<weeks.length;i++){const w=weeks[i];line("Bloco "+(i+1)+" ("+w.from+" a "+w.to+", "+w.days+" dias): planejado "+hours(w.planned)+"; registrado "+hours(w.actual)+"; média diária "+hours(w.actual/w.days)+"; dias com estudo "+w.studyDays+".");if(i)line("Variação de duração registrada em relação ao bloco anterior: "+hours(w.actual-weeks[i-1].actual)+" (blocos podem ter durações distintas).");}
 line("");
 sep();line("4. HISTÓRICO CRONOLÓGICO COMPLETO");sep();
 for(const d of byDay){
  line("");line("-".repeat(64));line("DATA "+d.date+" | "+(d.closed?"FINALIZADA":"NÃO FINALIZADA"));
  line("Estudo previsto: "+hours(d.planned)+" | realizado registrado: "+hours(d.actual)+" | pausas de cronômetro: "+hours(d.studyPause));
  line("Disponibilidade: "+(d.availability?JSON.stringify(d.availability):"não informada"));
  line("Descanso ou pausa excepcional: "+(d.rest?JSON.stringify(d.rest):"sem registro"));
  line("Sessões ("+d.ss.length+"):");
  if(!d.ss.length)line("  Nenhuma sessão identificada.");
  for(const x of d.ss){
   line("  • "+(x.discipline||"Matéria não informada")+" | tópico: "+value(x.topic)+" | ciclo: "+value(cycles.find(c=>c.id===x.cycleId)?.title||x.area)+" | modalidade: "+value(methods.find(m=>m.id===x.methodId)?.title)+" | estado: "+value(x.status));
   line("    Planejado: "+fmtMinutes(x.planned)+" | realizado: "+fmtMinutes(x.duration)+" | horário previsto: "+value(x.startTime)+" | horário real de início: "+value(x.tr?.record?.startedAt)+" | encerramento: "+value(x.tr?.record?.finishedAt));
   line("    Pausas: "+(x.tr?fmtMinutes(x.tr.pauseMs/60000):"não registradas")+" | origem: "+x.source+(x.tr?.live?" (cronômetro ativo, duração provisória)":""));
   if(x.evidence)line("    Evidências acadêmicas declaradas: "+JSON.stringify(x.evidence));
   if(x.tr?.record?.pauses?.length)for(const p of x.tr.record.pauses)line("    Intervalo: "+JSON.stringify(p));
  }
  line("Atividades ("+d.activities.length+"):");
  if(!d.activities.length)line("  Nenhuma atividade identificada.");
  for(const a of d.activities){
   const rec=records[a.id+"@"+d.date]||a.record||{};
   line("  • "+(a.type||"atividade")+" | "+value(a.displayTitle||a.title)+" | estado: "+value(rec.status||a.status)+" | prioridade: "+value(a.priority));
   line("    Criada em: "+value(a.createdAt)+" | data de origem: "+value(a.date)+" | previsão de início: "+value(a.startTime)+" | execução registrada: "+value(rec.actualTime||a.actualTime)+" | duração planejada: "+fmtMinutes(a.estimatedMin)+" | duração realizada: "+fmtMinutes(known(rec.actualMin)?rec.actualMin:a.actualMin));
   line("    Prazo: "+value(a.dueDate)+" | registro em: "+value(rec.markedAt||a.recordedAt)+" | recorrência: "+JSON.stringify(a.recurrence||{kind:"none"})+" | observações: "+value(a.description||a.notes||rec.reason));
  }
  if(d.dayEvents.length){line("Alterações e eventos do dia:");for(const ev of d.dayEvents)line("  • "+JSON.stringify(ev));}
  if(d.dayCorrections.length){line("Correções de cronometragem registradas neste dia:");for(const x of d.dayCorrections)line("  • "+JSON.stringify(x));}
  if(!d.ss.length&&!d.activities.length&&!d.rest)line("Sem compromissos ou execução identificados; não é possível concluir se houve inatividade real.");
 }
 line("");sep();line("5. OCORRÊNCIAS QUE PODEM MERECER ESCLARECIMENTO");sep();
 for(const d of byDay){
  const miss=d.ss.filter(x=>x.status==="notdone").length;
  const missing=d.ss.filter(x=>x.status==="done"&&x.duration===null).length;
  const unfinished=d.activities.filter(x=>x.status==="notdone").length;
  if(miss||missing||unfinished)line(d.date+": "+miss+" sessões declaradas não realizadas; "+missing+" sessões concluídas sem duração informada; "+unfinished+" atividades marcadas como não realizadas.");
 }
 line("Possíveis dificuldades ou procrastinação não podem ser afirmadas com base apenas nas horas ou na falta de registro.");
 line("Motivações, justificativas, saúde, disponibilidade real e circunstâncias não registradas devem ser esclarecidas diretamente com o usuário.");
 line("Reconhecimentos objetivos: "+dayWithStudy+" dias com duração de estudo registrada e "+doneActivities+" ocorrências de atividades concluídas.");
 line("");
 sep();line("6. ALTERAÇÕES DOCUMENTADAS E FONTES");sep();
 if(!events.length)line("Nenhum evento de edição disponível para este período.");
 for(const ev of events)line("EVENTO "+JSON.stringify(ev));
 if(!corrections.length)line("Nenhuma correção manual de cronômetro encontrada neste período.");
 for(const c of corrections)line("CORREÇÃO "+JSON.stringify(c));
 line("Fontes: planner.entries, planner.records, planner.overrides, planner.events, planner.dayPauses, studies.sessions, studies.cycles, studies.events, timing.records, evolution.closed, availability.");
 line("Limitação: o aplicativo não preserva obrigatoriamente todas as versões anteriores de cada campo, portanto não se deve presumir reconstituição completa de planos originais.");
 line("Limitação: atividades sem registro de duração não são convertidas em zero minutos confirmados.");
 line("Fim do relatório.");
 return lines.join("\n");
}
function panel(){
 return '<section class="card" id="csa-export"><details><summary style="cursor:pointer;display:flex;align-items:center;gap:10px;min-height:36px"><span aria-hidden="true">▤</span><strong>Relatório para o Conselho</strong><small style="margin-left:auto">30 dias · Abrir ▾</small></summary>'+
 '<div class="section-stack" style="padding-top:16px"><p class="note">Gere um retrato dos registros dos últimos 30 dias para consulta ou análise externa. Nenhuma informação será enviada automaticamente.</p>'+
 '<div class="row"><button type="button" class="btn small primary" data-csa="generate">Gerar relatório</button><button type="button" class="btn small ghost" data-csa="copy" disabled>Copiar texto</button><button type="button" class="btn small ghost" data-csa="download" disabled>Baixar TXT</button></div>'+
 '<label for="csa-preview" class="note">Prévia do documento</label><textarea id="csa-preview" readonly rows="11" spellcheck="false" placeholder="O relatório aparecerá aqui depois de gerado." style="width:100%;min-height:220px;resize:vertical"></textarea><small id="csa-status" class="note" role="status">Nenhum relatório gerado.</small></div></details></section>';
}
function decorate(route,html){
 if(route!=="perfil")return html;
 // Exibir o acesso logo após o cabeçalho do Perfil, antes dos relatórios longos.
 const start=html.indexOf('<section class="hero-row">');
 if(start<0)return panel()+html;
 const end=html.indexOf("</section>",start);
 if(end<0)return panel()+html;
 return html.slice(0,end+10)+panel()+html.slice(end+10);
}
document.addEventListener("click",async event=>{
 const b=event.target.closest?.("[data-csa]");if(!b)return;
 const box=document.getElementById("csa-export");if(!box)return;
 const preview=box.querySelector("#csa-preview"),status=box.querySelector("#csa-status");
 try{
  const action=b.dataset.csa;
  if(action==="generate"){
   textCache=make();createdAt=new Date();
   preview.value=textCache;box.querySelectorAll('[data-csa="copy"],[data-csa="download"]').forEach(x=>x.disabled=false);
   status.textContent="Relatório gerado agora. "+textCache.length.toLocaleString("pt-BR")+" caracteres. Gere novamente após modificar os registros.";
  }else if(action==="copy"){
   if(!textCache)throw Error("Gere um relatório primeiro.");
   try{await navigator.clipboard.writeText(textCache);}catch{
    preview.focus();preview.select();if(!document.execCommand("copy"))throw Error("Cópia automática indisponível. Selecione e copie o texto manualmente.");
   }
   status.textContent="Texto copiado.";
  }else if(action==="download"){
   if(!textCache)throw Error("Gere um relatório primeiro.");
   const blob=new Blob(["\uFEFF",textCache],{type:"text/plain;charset=utf-8"});
   const url=URL.createObjectURL(blob),a=document.createElement("a");
   a.href=url;a.download="orbita-relatorio-csa-"+C.today()+".txt";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   status.textContent="Arquivo TXT solicitado ao navegador.";
  }
 }catch(error){status.textContent=error?.message||"Falha ao gerar relatório.";C.notify(status.textContent);}
});
window.OrbitaCouncilExport={decorate,makeReport:make};
C.render();
})();