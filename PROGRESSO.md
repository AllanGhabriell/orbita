# PROGRESSO — Órbita

## Organizador semanal de estudos e Biblioteca (2026-11-03)

- A área **Estudos → Planejar semana** agora dispõe de calendário visual de sete dias, prévia do Início, edição rápida por seleção, organização por arrastar no computador ou ação Mover no celular, duplicação, exclusão, seleção e edição de várias sessões, desfazer última alteração, copiar dia e semana, salvar/aplicar modelos reutilizáveis.
- A **Biblioteca de estudos** reúne acesso ao cadastro de ciclos, matérias e modalidades, e novo catálogo de assuntos por matéria. O organizador herda a área e o objetivo do ciclo, evitando redigitação.
- Sessões podem seguir a rotação dinâmica do ciclo ou fixar uma matéria específica como reforço, sem avançar a rotação indevidamente. Cópias são sempre pendentes e não transportam conclusões nem tempos realizados; dias finalizados são preservados.
- Concluir/Desfazer/Registrar foram retirados dos cartões de planejamento, permanecendo apenas na tela Início. O analisador continua somando a carga de cada sessão individual.
- Testes unitários e testes no Chromium verificam seleção de matéria/assunto, cópia semanal, duplicação/desfazer e conclusão exclusivamente no Início.

---


## Estudos — Início para execução, ciclos para planejamento (2026-11-02)

- Tela Início exibe todas as sessões planejadas do dia com trilha visual por ciclo, progresso individual, ações Concluir, Desfazer e Registrar, sem controles de configuração. Uma animação discreta indica passagem da etapa à próxima matéria.
- Tela Estudos mantém criação, edição, exclusão e modalidades, além de permitir distribuir sessões entre datas (até 31 dias), quantidade de sessões por dia, seleção de dias ou apenas os dias com disponibilidade. Cada ocorrência é uma sessão real contabilizada separadamente na carga planejada.
- Para semanas futuras, sessões ainda não iniciadas seguem dinamicamente a matéria atual do ciclo ao executar; planejamento por data não avança rotação sozinho. Pausas são respeitadas. A conclusão da última sessão exigida de uma etapa libera a próxima matéria; desfazer a conclusão pode reabrir a etapa se não houver conclusões posteriores.
- A quantidade configurada por matéria indica conclusões necessárias antes do avanço, não cria sessões automaticamente. Duração efetiva permanece independente da previsão; não são inventadas horas.
- Testes de lógica e de navegador abrangem agendamento, carga, progresso, conclusão, desfazer e integração com outras telas.

---



## Complementos finais (2026-11-02)

Implementado `stage6.js` e `stage6.css`: etapas editáveis/concluíveis dos objetivos, vínculo explícito de atividades aos objetivos, aproveitamento do vínculo existente dos ciclos, horários ocupados recorrentes e por data, disponibilidade efetiva descontando apenas interseções com faixas livres (sem descontar duas vezes horas declaradas livres), avisos de colisões, recomendações condicionadas a evidência real de desempenho, tempo desde revisão e modalidade, agendamento voluntário sem avançar ciclos, início da semana configurável em qualquer dia. Novos testes `tests/stage6.test.mjs` e atualização do cache PWA.

**Escopo de verificação:** funcionalidades implementadas no código, teste automatizado no workflow do repositório. Não houve migração SQL nova nem edição de documentos do usuário. O usuário informou que SQL e login Google já funcionam; isso não foi homologado com acesso de duas contas. Permanecem testes manuais reais em PC/celular, PWA e sincronização simultânea.

---



## Etapa 5 — Banco, conta, PWA e integração (2026-11-02)

**Estado:** implementação de frontend, migração SQL e documentação no branch main. Integração real com um projeto Supabase ainda não executada, pois URL, publishable key e ativação do login dependem do proprietário. Não foram solicitados nem usados segredos de outro projeto.

### Implementações realizadas
- **Banco e segurança:** `supabase/migrations/20261102_000001_orbita.sql`, com tabelas `orbita_documents` e `orbita_closed_days`, permissões mínimas, RLS por `auth.uid()`, função `orbita_commit` com versão esperada e proteção transacional contra alteração/remoção de dias finalizados. SQL entregue no repositório, **não aplicado**.
- **Autenticação:** `stage5.js` implementa conexão por Project URL e publishable key do próprio usuário, cliente Supabase Auth, Google OAuth/PKCE, redirecionamento ao domínio do GitHub Pages e acesso anônimo local sem conta.
- **Sincronização offline-first:** `boot.js` carrega documentos no armazenamento local e recupera do IndexedDB; mantém pendência persistida das alterações para posterior sincronização. `stage5.js` envia documento completo via RPC de versão; quando há conflito, exige decisão explícita. Dias finalizados de ambas as cópias são combinados quando idênticos ou não sobrepostos; divergência na mesma data é rejeitada.
- **Proteção de sessão:** logout remove documento local do dispositivo após checar sincronização, com aviso e exportação se houver pendências.
- **Backup:** exportação/importação JSON com validação de formato e proteção de snapshots já finalizados.
- **PWA:** manifesto, service worker com cache de arquivos estáticos, ícones PNG reais de 192×192 e 512×512 gerados e versionamento de cache.
- **Interface:** Preferências adiciona seção de conexão, login, sincronização manual, estado de rede, resolução de conflito e ações de backup; Perfil oferece atalho.
- **Manual:** `CONFIGURAR_SUPABASE.md` contém SQL exato, configuração Google Cloud/Supabase, URL e chave pública e testes de aceitação.

### Testes e evidências
- `tests/stage5.test.mjs` cobre rejeição de chaves secretas e URLs inválidas, preservação dos dados encerrados, hashes determinísticos compatíveis com JSONB, manifesto, ícones, arquivos offline e presença das regras SQL.
- Workflow `Testar e publicar Órbita` executa verificações de sintaxe de `app.js`, `stage2.js`, `stage3.js`, `stage4.js`, `boot.js`, `stage5.js`, `sw.js` e os cinco arquivos de testes `node --test tests/*.test.mjs`.
- O workflow também configura e envia o site estático ao GitHub Pages. Conferir o status do **último commit**, porque execuções anteriores são canceladas automaticamente após novos commits.
- Os testes de frontend são automatizados em ambiente simulado de navegador; verificações estáticas de RLS não substituem a execução SQL em um banco real.

### O que ainda falta para considerar a integração homologada
- O usuário deve criar/conectar projeto Supabase, **executar a migração**, habilitar Google OAuth, configurar URL de callback/redirect e cadastrar URL + chave pública do projeto no Órbita.
- Login Google, isolamento RLS entre duas contas, preservação de snapshots por RPC, sincronização real em dois aparelhos e conflitos precisam de teste com contas reais.
- Revisar visualmente instalação da PWA, modo offline e retorno online em computador e celular; testar acessibilidade e casos extremos de dados e calendários.
- A implementação é uma sincronização do **último estado inteiro com controle de versão**, não uma fusão automática de cada atividade alterada em diferentes dispositivos.
- O banco só oferece garantia de imutabilidade depois da migração; `localStorage`/IndexedDB do usuário não são um armazenamento inviolável.

### Links diretos
- [Site](https://allanghabriell.github.io/orbita/)
- [Guia Supabase](./CONFIGURAR_SUPABASE.md)
- [SQL](./supabase/migrations/20261102_000001_orbita.sql)
- [Checklist](./CHECKLIST.md)
- [Ações do GitHub](https://github.com/AllanGhabriell/orbita/actions)

---

## Etapa 4 — Inteligência, fechamento e evolução (2026-11-02)

**Estado:** código da etapa 4 enviado ao branch `main`, incluindo lógica de fechamento e relatórios com testes automatizados. Verificar o último workflow em `Actions` e concluir inspeção visual em navegadores reais. **Não iniciar etapa 5 sem autorização.**

### Implementado
- Integração de `stage4.js`/`stage4.css`, com telas de fechamento, evolução e acesso a partir de Início e Perfil.
- Confirmação de fechamento por checklist e digitação explícita de `FINALIZAR`; o mesmo dia não pode ser reaberto na interface.
- Fotografia imutável no fluxo de utilização do navegador dos focos, tarefas, hábitos, sessões, tempos informados, pausas, disponibilidade e objetivo principal; preservação independente de alterações futuras nos modelos.
- Passado pendente notificado sem bloquear atividades atuais; ordem de fechamento respeitada. Datas sem compromisso e descansos podem ser encerrados.
- Relatórios diários e agregados de semana/mês/ano; prévias quando período ainda incompleto, indicação de qualidade da amostra, dias sem observação ≠ fracasso.
- Comparação de períodos apenas quando ambos oferecem ao menos cinco dias encerrados e número mínimo de compromissos.
- Horas planejadas e reais distintas, sem duplicar foco vinculado a estudo; estatísticas do sistema de estudos leem snapshots dos dias fechados.
- Questionários opcionais em sessões: número de questões, acertos e qualidade percebida 1–5. Análise não interpreta autoavaliação como prova objetiva de domínio.
- Feedback determinístico de exigência configurável, sem alegações de IA externa; identifica bom cumprimento, compromissos pouco executados, pausas extraordinárias, ausência de tempo real e importância do descanso.
- Lembretes de estatísticas não invasivos, com intervalo mínimo, adiamento e desligamento.
- Reconhecimento por marcos de 5/10/20/50 dias com todos os focos concluídos; sem recompensas por cliques.
- Proteções integradas nas etapas 1–3 para bloquear edições de disponibilidade específica, atividades e sessões de dias já fechados; visualização dos snapshots em Início e Calendário.

### Testes
- Testes `tests/stage4.test.mjs`: ausência de dados artificiais; backlog; impedir fechamento antes de dias pendentes; impedir dupla finalização; preservar foco e tempo em snapshot; proteção de novas sessões; consolidação do relatório; ausência de conclusões inventadas; resultados de questões e autoavaliações registrados.
- Job `Testar e publicar Órbita`: `node --check` para os quatro scripts e execução de `node --test tests/*.test.mjs`. Acompanhar o último resultado no GitHub Actions.
- Etapas 1–3 continuam com testes próprios. Não inferir que testes automatizados validam animações, layout mobile ou sincronização.

### Pendências honestas
- QA visual manual e acessibilidade real (PC e celular), integração entre múltiplas abas, histórico longo e casos extremos de recorrência/cópia.
- A imutabilidade é **lógica e de interface nesta fase**; como dados ainda estão em `localStorage`, alterações externas ao aplicativo podem modificar o conteúdo. Políticas definitivas no Supabase serão aplicadas na etapa 5.
- Não há autenticação Google, sincronização, backups ou banco SQL ainda.
- O motor atual é baseado em regras auditáveis e registros; não usa IA generativa ou fontes externas para inferir personalidade ou capacidade real.
- A qualidade do estudo é analisada apenas quando há evidências registradas; acertos autoanotados podem não refletir provas de dificuldade equivalente.
- Validar meses completos de descanso, datas faltantes e relatórios de semana personalizada em cenários reais.
- O volume de `localStorage` ainda é limitado; a migração para armazenamento robusto integra a etapa 5.

### Próxima fase: Etapa 5, apenas por solicitação
- Supabase: migrações SQL, esquema de dados, Row Level Security e mecanismos de bloqueio de dias finalizados no backend.
- Login Google, persistência online, sincronização offline-first, resolução de conflitos, exportação/importação e instalação PWA.
- Homologação funcional e visual do produto completo após integração real.

---

## Etapa 3 — Sistema de estudos (2026-11-02)

**Estado:** implementação funcional enviada ao GitHub e coberta por testes automatizados. A implantação final e a homologação visual em dispositivos reais devem ser confirmadas. Não iniciar Etapa 4 sem nova autorização.

### Implementado
- Tela própria **Meus estudos**, conectada aos painéis de Início, Organizar e Planejamento; primeiro acesso permanece vazio.
- Criação, edição, duplicação, arquivamento e restauração de ciclos independentes com área, objetivo opcional e duração padrão personalizável.
- Cadastro e ordenação de matérias, etapas com 1–12 sessões requeridas, seleção manual da próxima matéria, pausa opcional com motivo/data de referência, reativação, cópia e arquivamento.
- Avanço condicionado às conclusões das sessões da etapa; não depende da mudança de data. Registros parciais e reforços não avançam.
- Correção de conclusão da última etapa quando não há registros concluídos posteriores; preservação do histórico se correção retroativa se tornar ambígua.
- Agendamento de sessões únicas ou múltiplas; modalidades `cycle`, `reinforcement`, `supplement`; duração e início previstos, tempo efetivo opcional e horários reais opcionais.
- Classificação por área, disciplina, assunto, finalidade e modalidade. Estudos de Matemática para Eletrônica compõem Matemática global mas só contam para a área Eletrônica.
- Modalidades/metodologias sem exemplos pré-cadastrados: criar, editar, duplicar, arquivar, restaurar e excluir.
- Visão de carga diária: horas previstas nas sessões + atividades não vinculadas, disponibilidade, avisos de sobreposição/sobrecarga. Foco vinculado e sessão não duplicam tempo previsto.
- Estatísticas por dia/mês, ciclo, área, disciplina, assunto e método; horas reais somente quando declaradas, sem equiparar não informado a zero.
- Armazenamento provisório no estado local `studies`, com eventos de auditoria para a Etapa 4. SQL e Supabase não foram tocados.
- UI responsiva em `stage3.css`; cadastro de ciclos condicionado à configuração da disponibilidade.

### Testes e verificação
- `tests/stage3.test.mjs` cobre inicialização vazia, pré-requisito de disponibilidade, criação de ciclos/matérias/métodos, duas sessões para avançar, sessão parcial, reabertura da última conclusão, pausas, reforço, edição que preserva tempo real, estatísticas independentes entre ENEM/Eletrônica, vínculo com focos sem contagem duplicada, cópia/arquivamento/reativação e proteção de datas fechadas.
- `node --check` foi incluído no workflow para `stage3.js`; testes das etapas 1–3 executados no GitHub Actions.
- A última execução do GitHub Actions pode ser conferida em https://github.com/AllanGhabriell/orbita/actions.

### Pendências não omitidas
- Revisão visual e de acessibilidade **em navegador real** no desktop e em celular; testes automatizados de lógica não substituem esse teste.
- Testes exploratórios com grandes volumes de matérias/sessões, alterações simultâneas em várias abas, datas-limite de mês e correções complexas de ciclos já avançados.
- O orientador com estratégias adaptativas, indicadores de domínio do conteúdo e relatórios de evolução permanece na Etapa 4.
- A imutabilidade definitiva ao fechar o dia também será implementada na Etapa 4 (os registros atuais respeitam a lista de dias fechados existente no modelo).
- Autenticação, sincronização multi-dispositivo, backup exportável e SQL são da Etapa 5.
- A análise de carga permanece uma projeção informativa, sem replanejamento automático.

### Próxima etapa — apenas com autorização
**Etapa 4:** fechamento definitivo, revisão de dias pendentes, relatórios por período, métricas de consistência/qualidade/descanso e orientador exigente, objetivo e contextualizado.

---

## Etapa 2 — Planejamento e organização pessoal (2026-11-02)

**Estado:** módulos implementados e verificados por testes automatizados de lógica; QA visual manual ainda pendente. **Não iniciar Etapa 3 sem autorização do usuário.**

### Entregue
- `stage2.js` e `stage2.css` adicionados sem substituir a base de navegação da etapa 1.
- Tela Início apresenta compromissos reais, focos obrigatórios, tarefas secundárias e rotinas, sem dados de exemplo.
- CRUD e cópia para atividades e blocos, além de arquivamento/reativação; exclusão de séries com opções de ocorrência, futuras ou abertas.
- Tarefas secundárias persistem nos dias seguintes, com prioridade alta/média/baixa, concluídas ao final e contagem de dias desde criação.
- Focos com estados pendente/em andamento/concluído/não realizado/remanejado; ação rápida, edição e detalhe de tempo real (opcional).
- Remanejamento manual mantém o registro da origem e a nova data; foco já concluído não pode ser remanejado como pendente.
- Hábitos recorrentes com horário-alvo e possibilidade de registrar hora efetiva, sem forçar registro.
- Disponibilidade combinada com pausas: descanso planejado, imprevisto e mudança no próprio dia; preserva carga prevista e evento de alteração.
- Calendário semanal e mensal, repetição por dia da semana ou dia do mês, limite de horizonte, numeração reiniciada mensalmente.
- Prévia para copiar semana, mês e ocorrências de um bloco entre meses; ignorar duplicatas ou substituir apenas atividades sem registros; não copiar estado de conclusão.
- Alertas de sobreposição de horário e possível sobrecarga sem bloquear o usuário.
- Eventos de alterações e registros salvos localmente no modelo `planner`, preparados para alimentar análises na etapa 4.
- SQL, autenticação e banco de dados não foram criados/alterados.

### Verificações
- Workflow executou `node --check app.js && node --check stage2.js` com sucesso.
- Workflow executou `node --test tests/*.test.mjs`: **2 arquivos de testes aprovados, 0 falhas**, incluindo tarefas, recorrência, horários, pausas, remanejamentos, registros e cópias.
- Workflow **Testar e publicar Órbita** teve execução e deploy bem-sucedidos após a ativação do Pages.
- O endereço do site deve ser conferido visualmente em navegador real para considerar a qualidade visual e acessibilidade homologadas.

### Pendências, riscos e próximos passos
- QA visual desktop/mobile e uso com dados reais para confirmar formulários, menus e navegação com teclado.
- Validar cenários extremos de cópia e edição de recorrência em meses com quatro/cinco ocorrências e no dia 31.
- A métrica de pontualidade dos hábitos depende do motor analítico da etapa 4, embora o horário real já seja registrado.
- Otimizar tratamento de séries longas e tarefas secundárias recorrentes com ocorrências antigas antes de utilizar em grande escala.
- **Etapa 3 (aguardando autorização):** múltiplos ciclos de estudos, matérias e assuntos, modalidade, tempo parcial, sessões extras, estudos complementares e analisador real de carga.

### Governança
`ESCOPO.md` permanece como contrato de requisitos, e `CHECKLIST.md` distingue implementado, testado e pendente. A etapa 2 não encerra nem altera o escopo das etapas futuras.

---

## Etapa 1 — Base, navegação e disponibilidade (2026-11-02)

**Repositório:** https://github.com/AllanGhabriell/orbita  
**Situação:** implementação inicial entregue no branch main; testes automatizados de inicialização, navegação, disponibilidade e objetivos aprovados no job de teste do GitHub Actions; a primeira publicação foi bloqueada por permissão, mas a implantação foi liberada e passou posteriormente; QA visual ainda pendente.  
**Próxima etapa:** 2 foi autorizada e realizada, conforme relatório acima.

### Implementado
- Estrutura autônoma em HTML, CSS e JavaScript, sem dependência da Academia CFOP.
- Tela Início sem dados, contas de exemplo ou falsas estatísticas.
- Temas claro/escuro persistentes, fundo com movimento sutil, efeito de luz acompanhando o cursor, opção para desativar movimento e respeito a 'prefers-reduced-motion'.
- Layout de painéis para computador, navegação inferior compacta para celular, menus secundários; conteúdo com rolagem interna quando necessário.
- Navegação Início / Planejamento / Organizar / Perfil / Disponibilidade / Preferências.
- Semana selecionável, setas de dias e semanas, opção Hoje, seletor de data limitado ao primeiro acesso e primeiro dia da semana configurável.
- Disponibilidade semanal em horas, dia amplamente livre com horas indicadas, vários intervalos por dia com validação, descanso, exceções por data e cópia de definição para outros dias.
- Objetivos: criar, editar, duplicar, destacar principal, arquivar, reativar e excluir; objetivo principal aparece no Início.
- Salvamento local provisório com versão de esquema; SQL e autenticação permanecem reservados à etapa 5.
- Fluxo de UX de primeira visita orientado por disponibilidade; telas posteriores não fingem que funcionalidades futuras já estão ativas.
- Documentos ESCOPO.md, CHECKLIST.md, PROGRESSO.md e README.md.
- Workflow para teste automatizado e tentativa de publicação pelo GitHub Pages.

### Testes feitos
- Verificação de sintaxe JavaScript no GitHub Actions: aprovada.
- Testes automatizados de estado vazio, ausência de estatísticas fictícias, criação de disponibilidade com faixas múltiplas, cadastro/objetivo principal e navegação: aprovados no job de teste. O job de deploy falhou por permissão de ativação do Pages, não por falha dos testes.
- Execução em ambiente simulado para confirmar a inicialização da tela sem dados predefinidos.
- Correções efetuadas nos diálogos para evitar fechamento ao interagir dentro dos formulários.

### Pendências de qualidade
- **GitHub Pages não foi publicado:** o job de deploy falhou em actions/configure-pages@v5 com `Resource not accessible by integration` ao tentar ativar o Pages automaticamente. É necessário habilitar Pages em Settings → Pages → Build and deployment → GitHub Actions uma vez na conta proprietária e reexecutar o workflow.
- Revisão visual manual em navegadores desktop/mobile e teste de acessibilidade com teclado/leitor de tela. O CSS responsivo está implementado, mas isso não equivale a uma certificação visual.
- Testar persistência e comportamento com mudanças reais em navegadores/dispositivos distintos. Sincronização multi-dispositivo não pertence à etapa 1.
- Conferir interações de exceções e campos em navegadores reais antes de uso intensivo.

### Funcionalidades não iniciadas — conforme plano
- **Etapa 2:** focos obrigatórios, tarefas secundárias, estados, rotinas, hábitos, blocos, cópias de semana/mês, remanejamentos e histórico.
- **Etapa 3:** ciclos, matérias, sessões, metodologias, estudos complementares, tempo efetivo e analisador de carga.
- **Etapa 4:** fechamento definitivo de dias, estatísticas e motor orientador.
- **Etapa 5:** Supabase, SQL, autenticação Google, políticas de segurança, offline/PWA, sincronização e backups.

### Regras permanentes
- Somente registrar como pronto aquilo que funciona e foi verificado.
- Não misturar Órbita com Academia CFOP.
- Não incluir dados demonstrativos no cadastro de usuários.
- Não produzir SQL nem alterar o banco antes da etapa 5.
- Revisar ESCOPO.md e CHECKLIST.md ao término de cada etapa.
- A próxima etapa depende de nova autorização do usuário.
