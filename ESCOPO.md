# ESCOPO MESTRE — Órbita

Referência obrigatória para todas as etapas. Atualize este documento quando o usuário decidir alterar alguma regra. A Academia CFOP é OUTRO projeto; nenhuma dependência funcional dela.

## Princípios não negociáveis
- Site de planejamento pessoal e estudos, não apenas preparação para provas; usuário sempre controla suas decisões.
- Novo usuário começa completamente vazio: sem metas, hábitos, estudos, exemplos ou métricas preenchidas.
- Início orientado por contexto; configurar disponibilidade antes de criar ciclos de estudo; nada de tutorial intrusivo.
- UI escura por padrão, tema claro opcional; tecnológica, discreta e acessível; efeitos de blur animado e cursor glow com redução de movimento; menus avançados contextuais; desktop e mobile.
- Todas as entidades criadas são editáveis, copiáveis, arquiváveis/reativáveis e excluíveis conforme histórico; dados de dias finalizados são imutáveis.
- Dados declarados, medidos, estimados e não registrados são categorias separadas. Não inventar tempo real ou produtividade.
- Confiabilidade das análises depende da amostra real, não apenas da idade da conta. Consistência elevada é sucesso, não estagnação.
- Cada etapa tem testes e auditoria de pendências. SQL e banco de dados exclusivamente na etapa 5.

## 1. Navegação e visual
- Áreas principais: Início, Planejamento, Organizar, Perfil e Evolução.
- Detalhes de disponibilidade, objetivos, ciclos e hábitos em telas/painéis contextuais.
- No desktop explorar espaço lateral; no mobile compactar, agrupar e mostrar uma função por vez. Evitar rolagem vertical extensa, mas permitir rolagem localizada para acessibilidade.
- Navegar dias com setas; seletor de data discreto; mínimo = primeiro acesso; botão Hoje. Visualização não altera dados.
- Objetivo principal destacado no topo do Início, sem porcentagem artificial; secundários no painel de objetivos.
- Focos do dia e ciclos de estudo com destaque equivalente; tarefas secundárias e rotinas abaixo. Ações rápidas de iniciar, concluir e marcar em andamento.
- Feedback em poucas palavras; não exibir textos longos nem indicadores irrelevantes. Lembretes discretos e dispensáveis.

## 2. Disponibilidade e calendário
- Disponibilidade por dia da semana: horas livres totais, intervalos horários múltiplos, ou dia amplamente livre com horas utilizáveis; dia de descanso; exceções por data.
- Permitir períodos ocupados, curso/estágio/deslocamento/sono; não contar 'dia todo' como 24h de estudo.
- Alterações futuras não reescrevem histórico anterior. Horários sobrepostos nas tarefas são permitidos, com aviso, nunca bloqueio automático.
- Planejamento semanal com primeiro dia da semana configurável (domingo ou segunda/outra data); planejar antecipadamente e navegar entre semanas/meses.
- Descanso fixo, pausa extraordinária com justificativa opcional e descanso declarado no próprio dia são situações distintas; preservar planejamento original.

## 3. Focos obrigatórios
- Compromissos vinculados a data específica, inegociáveis no sentido de prioridade, mas com remanejamento manual permitido.
- Criar/editar/copiar/excluir, status pendente/em andamento/concluído/não realizado/remanejado, prazo e horário/duração opcionais.
- Foco não realizado não migra automaticamente; mantém histórico na data original.
- Remanejamento registra data de origem/destino, motivo e momento; não melhora artificialmente indicadores.
- Foco conectado a sessão de estudo não conta em dobro.

## 4. Tarefas secundárias
- Prioridades alta/média/baixa; ordenadas por prioridade enquanto pendentes. Concluídas vão abaixo, riscadas.
- Pendências seguem para dias posteriores sem desaparecer; idade em dias desde criação e indicador discreto de antiguidade.
- Podem ter bloco/pasta, horário previsto, estimativa, prazo, duração real opcional; não se tornam obrigatórias apenas por terem prazo.
- Criar/editar/copiar/arquivar/excluir e registrar status com ações rápidas.

## 5. Organização e cópia
- Blocos/pastas personalizados, cores e nomes; atividades com borda/identificador, sem bloco = sem etiqueta.
- Copiar foco para todas as ocorrências de dia da semana no mês; numeração 'Correr 1, Correr 2...' reinicia no mês, incluindo quinta ocorrência.
- Copiar semana para outras semanas, bloco para outro mês, mês inteiro para mês futuro.
- Respeitar dia da semana versus dia do mês; lidar com dia 31; operação tem horizonte mensal, prévia e prevenção de duplicidade.
- Status de conclusão nunca copiado; pendências secundárias existentes não duplicam por padrão.
- Editar uma ocorrência, próximas ocorrências ou modelo recorrente; histórico antigo intocado.

## 6. Ciclos de estudos
- Múltiplos ciclos independentes (ENEM, Eletrônica etc), com área/objetivo obrigatoriamente identificado.
- Sequência circular por matéria; datas não avançam o ciclo. Concluir efetivamente uma etapa avança.
- Planejar quantidade de sessões por matéria/dia (ex.: Matemática 2 × 1h30), duração e horário individuais; etapa só avança conforme regra definida.
- Sessão complementar ou reforço pode ocorrer fora do ciclo, sem avançar rotação por padrão; permitir seguir matéria diferente da próxima, sem bloquear.
- Pausar/inativar com justificativa e retorno opcional, reativar, arquivar e excluir disciplinas/ciclos; durante pausa, matéria é ignorada e não classificada como negligência.
- Disciplina transversal: área, matéria, assunto e finalidade independentes (Trigonometria da Eletrônica conta globalmente em Matemática, não automaticamente como ENEM). Sem horas duplicadas.
- Metodologias/modalidades editáveis pelo usuário (teoria, questões, revisão, flashcards, misto, laboratório, Feynman etc.); biblioteca opcional sem pré-registro.
- Sessão parcial salva tempo real sem concluir matéria indevidamente.
- Estatísticas específicas por ciclo/matéria/assunto/modalidade, horas previstas e registradas, última revisão, metas; sugestões de recuperação ativa, prática distribuída, revisões adaptativas e teoria/prática/revisão, sempre opcionais.

## 7. Tempo, carga e hábitos
- Duração prevista e real independentes para todos os tipos de atividade, com horário opcional; não inferir tempo real da conclusão.
- Analisador usa sessões reais: 3×90min=4h30; adicionar uma sessão para chegar a 6h; duração específica por sessão.
- Disponibilidade limita recomendações, mas não proíbe planejamento; alertas por carga incompatível e conflitos, com simulação e confirmação.
- Rotinas/hábitos de horário-alvo (dormir, correr, acordar etc.), recorrência, status de cumprimento e pontualidade distintos. Sem registro ≠ não realizado.
- Dias de pausa/descanso não são falha; avaliar recorrência de mudanças de última hora de forma contextualizada.

## 8. Fechamento diário e relatórios
- Dia aberto / passado aguardando fechamento / finalizado e bloqueado para sempre.
- Antes de finalizar, revisão obrigatória: atividades pendentes, sem registro, sessões, tempos e consequências. Confirmar explicitamente.
- Fechamento não exige cumprir tudo; descanso e dia vazio podem ser finalizados.
- Dia fechado é somente leitura, sem reabertura; tarefas secundárias abertas continuam futuramente.
- Aviso discreto de dias anteriores sem fechamento; ações atuais de estudo continuam acessíveis, mas relatórios definitivos e fechamento em sequência podem ser restringidos.
- Ao finalizar: balanço diário, pontos fortes/fracos e recomendação prática; último dia ativo da semana mostra prévia semanal; definitivo após fechamento de todos os dias.
- Períodos: dia, semana, mês, ano; métricas de execução, qualidade, estudos, carga, consistência, descanso, hábitos, objetivos, evolução e confiabilidade de planejamento.

## 9. Objetivos e orientador
- Objetivos ilimitados, hierarquia principal/secundários, prazo opcional, etapas e relações com blocos/atividades.
- Objetivo principal no Início; progresso detalhado no Perfil. Meta ENEM depende da prova e preparação anterior, sem percentual inventado.
- Motor interno: planejamento, execução, evolução, estratégias, qualificação de tempo, horários de registro/execução, adiamentos, consistência, carga, disponibilidade, padrões.
- Reconhecer bom desempenho mantido. Não exigir crescimento infinito. Cobrar quando houver fatos sustentados e caminho de ação.
- Postura de chefe exigente, justa, sem hostilidade, usando feedback SBI/GROW e reconhecimento. Avisos no Início sobre ações imediatas; análises completas em Perfil.
- Sem estudos suficientes, apenas fatos e orientação inicial; primeira semana cautela; comparações após histórico confiável; nunca anunciar 'recorde' na primeira medida.
- Metas semanais/mensais, desafios graduais opcionais, recompensas por eventos reais, sem gamificação por clique repetido.
- Lembrete gentil e dispensável quando houver relatório relevante ainda não visto; sem interrupção durante estudo.

## 10. Persistência, segurança, implantação
- Repositório próprio AllanGhabriell/orbita; site estático responsivo para GitHub Pages; PWA instalável.
- Offline-first com IndexedDB e fila de sincronização; login Google/Supabase e isolamento RLS por usuário; conflitos de edição tratados.
- Exportar/importar backups, tema/movimento preferidos sincronizáveis.
- Nunca incluir chave secreta Supabase no front-end. SQL e configuração de banco SOMENTE após etapas 1-4.
- Testes unitários/integração/visual e validação em PC e celular em todas etapas.

## Plano aprovado
1. Base, design, navegação, disponibilidade, objetivos; escopo/checklist/progresso.
2. Planejamento, tarefas, blocos, cópias, rotinas e descansos.
3. Ciclos, modalidades, sessões e analisador de carga.
4. Fechamento, estatísticas, orientador e avaliações.
5. Login, Supabase, SQL, segurança, offline e publicação definitiva.

Em cada etapa: listar pronto, testado, parcial, não feito, defeitos, mudanças no GitHub e próxima etapa. Somente avançar com ordem expressa do usuário.

## 11. Cronômetro integrado e notificações (04/11/2026)
- Cronometrar a sessão planejada no Início, respeitando duração prevista e permitindo pausas livres, retomar, encerrar parcial e concluir apenas por confirmação.
- Manter indicador global permanente de ESTUDO EM ANDAMENTO, ESTUDO PAUSADO ou NENHUM ESTUDO ATIVO, além de anel regressivo.
- Registrar milissegundos estudados e pausados separadamente, motivo de cada pausa (descanso, preparação de flashcards, intervalo programado ou interrupção) e histórico auditado de correções de horário.
- Salvar transições no documento offline e na sincronização já existente, recuperando após recarregamento por timestamps.
- Modos contínuo, Pomodoro 25/5 e personalizado; avisos de meta, pausa longa e blocos com sons configuráveis (inclusive áudios próprios pequenos), volume, brilho opcional e notificação do dispositivo mediante permissão.
- Dar preferência ao tempo total pausado, sua finalidade e contexto na orientação, sem penalizar a contagem bruta de pausas.
- Não alterar dia finalizado: bloquear encerramento com cronômetro ativo e congelar o registro da sessão no snapshot.
- Não inferir estudo real por atividade ou inatividade do navegador, nem garantir sons com app fechado.
- Persistir no objeto timing do JSON existente, sem migração SQL complementar.
