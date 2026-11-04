# CHECKLIST — Órbita

## Controles avançados do cronômetro — 04/11/2026
- [x] Remover faixa de inatividade do topo e mostrar o timer dentro de Estudos de hoje
- [x] Manter registro/conclusão manual sem cronometragem
- [x] Menu de três pontos por sessão com cronômetro
- [x] Editar tempo estudado, pausado, categoria e horários de pausas
- [x] Excluir/zerar pausas sem transformar descanso em estudo
- [x] Zerar ou descartar apenas a cronometragem, preservando a sessão planejada
- [x] Cancelar pausa acidental com confirmação explícita e zerar apenas pausa atual
- [x] Transferir/dividir tempo sem duplicar horas entre sessões do mesmo dia
- [x] Desfazer última alteração em até 60 segundos, dentro da aba aberta
- [x] Impedir editar dias finalizados e remover registros órfãos ao excluir sessões
- [x] Atualizar testes automatizados e versão do cache offline
- [ ] Verificar visualmente menu, modais, responsividade e sons em Windows e Android
- [ ] Homologar a sincronização simultânea entre dispositivos reais


## Cronômetro de estudos — 04/11/2026
- [x] Botão Cronometrar nas sessões da tela Início
- [x] Indicadores globais de estado ativo, pausado e inativo
- [x] Pausa com descanso, preparação de flashcards, interrupção e intervalo programado
- [x] Correção de horários com histórico e salvamento automático
- [x] Timer circular e opções contínuo, Pomodoro e personalizado
- [x] Sons, upload compacto, volume, notificação e destaque de conclusão
- [x] Tempo produtivo e pausado separados e histórico por sessão
- [x] Proteção do dia finalizado e conclusão manual da etapa
- [x] Dados no JSON do Supabase existente, sem SQL adicional
- [x] Testes unitários de contagem, correção e proteção
- [ ] Validar notificações, áudio, sincronização em dispositivos reais e acessibilidade


Legenda: [x] concluído e verificado; [ ] pendente. Itens entregues sem validação completa são explicitamente indicados em PROGRESSO.md. Esta lista é auditada ao fim de toda etapa.

## Uso diário dos ciclos — 02/11/2026
- [x] Início como painel de execução: sessões, progresso, Concluir / Desfazer / Registrar
- [x] Avanço automático da matéria após número exigido de conclusões, com destaque visual discreto
- [x] Configuração de matérias, sessões, modalidades e ciclos concentrada em Estudos
- [x] Planejamento em lote de até 31 dias, por dia de semana ou dias com disponibilidade
- [x] Cada sessão aumenta a carga prevista individualmente (3 × 1h30 = 4h30)
- [x] Sessões futuras de rotação só assumem a matéria ao serem executadas
- [x] Testes automatizados cobrindo planejamento e execução
- [ ] Validação do fluxo de trabalho em dispositivos reais e sincronização multiaparelho

## Complementos de conclusão — 02/11/2026
- [x] Etapas dos objetivos, concluídas manualmente, e vínculo de atividades/ciclos ao objetivo
- [x] Períodos ocupados semanais e pontuais com avisos de conflitos e desconto em faixas livres
- [x] Preservar horas livres declaradas sem descontá-las duas vezes
- [x] Recomendações contextuais de revisão, exercícios e reforço conforme evidências; agendamento opcional
- [x] Escolha de qualquer dia da semana como primeiro no calendário
- [x] Testes automatizados de integração dos complementos incluídos no workflow
- [ ] Testes manuais em navegador e dispositivos reais, incluindo múltiplos aparelhos e acessibilidade
- [ ] Teste integral de sincronização e RLS com contas reais; implantação do SQL e OAuth informada pelo usuário

## Etapa 1 — Base e UX
- [x] Estrutura inicial do site estático no repositório
- [x] Layout escuro e claro com preferência persistida
- [x] Fundo animado com luz do cursor e preferência de movimento reduzido
- [ ] Revisar navegação e acessibilidade em navegador real no computador e celular (estrutura e CSS responsivo já implementados)
- [x] Tela Início vazia, sem qualquer meta/tarefa demonstrativa
- [x] Disponibilidade semanal por horas e múltiplos intervalos
- [x] Descanso semanal e exceções por data
- [x] Orientação inicial contextual e desbloqueio dependente de disponibilidade
- [x] Objetivos: criar, editar, definir principal, arquivar e excluir
- [x] Calendário semanal, navegação entre dias, saltar data e Hoje
- [x] Documentos ESCOPO/CHECKLIST/PROGRESSO/README
- [ ] Testes visuais e de interação em navegador real, especialmente em telas pequenas (pendência de QA; ver PROGRESSO.md)

### Verificação técnica da Etapa 1
- [x] Teste automatizado de inicialização vazia e armazenamento local
- [x] Teste de criação de disponibilidade e objetivo principal
- [x] Checagem sintática de JavaScript pelo workflow
- [ ] Verificação visual final no domínio publicado (depende do Pages e revisão em dispositivos)

## Etapa 2 — Organização
- [x] Focos obrigatórios com estados e remanejamento auditável
- [x] Tarefas secundárias, prioridade, idade, concluídas no fim, continuidade
- [x] Blocos com cores e operações CRUD/arquivamento
- [x] Calendário com criação/edição diária/semanal/mensal
- [x] Repetições semanal/mensal, numeração das ocorrências e prévia
- [x] Cópias de tarefa/semana/bloco/mês sem duplicidade/status
- [x] Duração estimada, horário opcional e duração real
- [x] Rotinas/hábitos recorrentes, pontualidade, repouso e pausas de última hora
- [x] Auditoria contra ESCOPO.md
- [x] Testes automatizados dos módulos de planejamento passaram no GitHub Actions
- [ ] Testes visuais e ações completas em navegador real no PC e no celular
- [x] Pontualidade de hábitos registrada e representada nos relatórios da etapa 4
- [ ] Revisar casos extremos de repetição e cópia em mudanças de mês após teste real

## Etapa 3 — Estudos
- [x] Múltiplos ciclos e rotações independentes
- [x] Matérias e assuntos editáveis/pausáveis/arquiváveis
- [x] Sessões extras, repetidas e parciais, tempo e avanço correto
- [x] Estudos complementares e área/matéria/assunto/finalidade
- [x] Modalidades personalizadas e métodos opcionais
- [x] Analisador de carga baseado em sessões, disponibilidade e horas reais
- [x] Estatísticas detalhadas por ciclo
- [x] Auditoria contra ESCOPO.md

### QA e integração futura da Etapa 3
- [x] Testes automatizados de sequência, sessões parciais, pausas, reforços, horas e vínculo com focos
- [ ] Testes manuais com mouse/toque, calendário em meses diferentes e aparelhos reais
- [ ] Validação de acessibilidade/teclado do fluxo completo de cadastro e sessões
- [ ] Recomendações adaptativas de método e revisão contextual (motor orientador da Etapa 4)
- [x] Código de sincronização entre dispositivos preparado; [ ] integração real entre dispositivos com login

## Etapa 4 — Evolução
- [x] Fechamento com revisão obrigatória, confirmação por texto e bloqueio no aplicativo
- [x] Snapshot histórico independente do planejamento vivo, preservando títulos, horas, pausas e situação
- [x] Aviso consolidado de dias pendentes com acesso direto e bloqueio de fechamento fora da ordem
- [x] Dias de descanso ou sem atividade podem ser finalizados sem inventar desempenho
- [x] Análises diárias, semanais, mensais e anuais com consolidação dependente de dias fechados
- [x] Comparação descritiva entre períodos com dados suficientes, sem equiparar percentuais a qualidade
- [x] Estatísticas de focos, rotinas, pontualidade registrada, estudos, planejamento, descanso e tempo real sem dupla contagem
- [x] Registro opcional de questões/acertos e autoavaliação, distinguindo qualidade declarada de aprendizagem comprovada
- [x] Motor de feedback por amostra e contexto: elogio, cobrança fundamentada, consistência e pausa
- [x] Avisos discretos de estatísticas, com adiar e desativar
- [x] Conquistas por cinco ou mais dias de cumprimento real, sem recompensas por clique
- [x] Auditoria de requisitos com comparação ao ESCOPO.md

### Verificação e pendências
- [x] Testes automatizados de fechamento imutável no aplicativo, precedência entre dias e relatórios congelados
- [ ] Verificação visual e de teclado em navegador real (desktop e celular)
- [ ] Análise exploratória de calendários antigos/extensos, recorrências e múltiplas abas
- [x] Função SQL com snapshots protegidos preparada; [ ] aplicar e validar no Supabase real
- [ ] IA generativa opcional não foi integrada: o orientador atual usa regras verificáveis sem serviço externo
- [ ] Testar um mês inteiro de fechamento diário com registros reais, inclusive semanas iniciadas em diferentes dias

## Etapa 5 — Integração
- [x] Migração SQL pronta em `supabase/migrations/20261102_000001_orbita.sql`, com tabelas, RLS e função transacional de sincronização
- [x] Chaves secretas proibidas no frontend; URL e chave pública pré-configuradas em `config.js`, sem formulário de conexão
- [x] Implementação do login Google com Supabase Auth OAuth/PKCE
- [x] Armazenamento offline IndexedDB, ponte de compatibilidade localStorage e recuperação de dados locais
- [x] Controle otimista de versão da nuvem, prevenção de sobrescrita silenciosa e escolha manual em conflitos
- [x] Preservação de dias encerrados em ambas as cópias, com rejeição de fechamentos divergentes
- [x] Exportação/importação de backup JSON com validação e confirmação
- [x] Manifesto PWA, service worker e ícones reais PNG 192×192/512×512
- [x] Workflow atualizado para validar scripts das cinco etapas; testes automatizados de configuração, conflitos e PWA
- [x] Guia de ativação SQL, Google Cloud, Supabase e testes em `CONFIGURAR_SUPABASE.md`
- [ ] Executar SQL no projeto Supabase real — depende do proprietário
- [ ] Configurar e validar o provedor Google no Supabase/Google Cloud — depende do proprietário
- [ ] Testar autenticação e sincronização ponta a ponta com contas reais
- [ ] Confirmar instalação e funcionamento PWA/offline em dispositivos reais
- [ ] Validar isolamento de duas contas, RLS e bloqueio de dias fechados no banco real
- [ ] Testar resolução de conflitos com dois dispositivos em simultâneo
- [ ] QA visual e acessibilidade PC/celular, inclusive casos extremos dos ciclos e repetições
- [ ] Verificar edição/fechamento de um mês de dados reais e concluir homologação final

### Estado da entrega
**Código e SQL preparados.** A ativação e o teste final da nuvem ainda dependem da conexão de um projeto real. SQL *não foi executado*, credenciais privadas *não foram armazenadas* e banco real *não foi alterado*.

