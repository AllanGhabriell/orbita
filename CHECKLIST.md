# CHECKLIST — Órbita

Legenda: [x] concluído e verificado; [ ] pendente. Itens entregues sem validação completa são explicitamente indicados em PROGRESSO.md. Esta lista é auditada ao fim de toda etapa.

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
- [ ] Validação da pontualidade como métrica nos relatórios (etapa 4; o horário real já pode ser registrado)
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
- [ ] Sincronização e persistência entre dispositivos (Etapa 5)

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
- [ ] Bloqueio de escrita **no servidor** para dias finalizados: somente na Etapa 5 com RLS/funções SQL
- [ ] IA generativa opcional não foi integrada: o orientador atual usa regras verificáveis sem serviço externo
- [ ] Testar um mês inteiro de fechamento diário com registros reais, inclusive semanas iniciadas em diferentes dias

## Etapa 5 — Integração
- [ ] Migrações SQL completas e políticas RLS
- [ ] Login Google + Supabase funcional
- [ ] Offline-first, fila de sincronização e conflitos
- [ ] Exportação/importação/backups
- [ ] PWA instalável e funcionamento offline
- [ ] GitHub Pages ativo e testado em domínio real (workflow de implantação aprovado; navegador real ainda não verificado)
- [ ] Testes e ajustes finais com dados reais
- [ ] Revisão completa de 100% dos requisitos com evidências
