# Órbita

## Gerenciamento de cronometragens e interface contextual — 04/11/2026

- Removida a faixa persistente de "Nenhum estudo ativo" acima do planejamento. O cronômetro, mais compacto, aparece exclusivamente dentro de **Estudos de hoje**, associado à sessão atual. Sem cronômetro ativo, a tela permanece limpa.
- A sessão mantém **Concluir** e **Registrar** independentemente de utilizar o cronômetro; o tempo informado manualmente continua válido.
- O menu `⋯` no cartão da sessão cronometrada permite editar totais, alterar horários/motivos de pausas, excluir uma pausa sem convertê-la em estudo, zerar todas as pausas, zerar o cronômetro ou descartar apenas a cronometragem.
- Permite ainda transferir o registro ou repartir somente o tempo estudado entre sessões abertas do **mesmo dia**, sem duplicar horas, e desfazer a última alteração durante 60 segundos (enquanto a aba permanecer aberta).
- Enquanto pausado, o menu permite desfazer uma pausa acidental, creditando o intervalo como estudo **somente com confirmação explícita**, ou zerar apenas a pausa atual sem acrescentar estudo.
- Edição do histórico requer encerrar a cronometragem como parcial; dias finalizados permanecem somente leitura. Descartar um cronômetro iniciado numa sessão pendente devolve a sessão a pendente quando apropriado, sem apagar o planejamento.
- Nenhuma migração SQL adicional é exigida: dados permanecem no documento sincronizado `orbita_documents.content`. Novos testes de lógica e do navegador foram preparados para validar as operações.


## Alarmes persistentes e notificações do dispositivo — 04/11/2026

- Ao atingir a meta de estudo ou o limite de uma pausa prolongada, o Órbita mostra um aviso persistente no canto da tela, em qualquer seção, até o usuário resolver ou dispensar. Sem alarme, nada ocupa espaço.
- MP3 personalizado é reproduzido com loop, se habilitado (padrão). Sons internos usam buffer Web Audio em repetição. Silenciar interrompe só o áudio e mantém a sessão intacta; é possível reproduzir novamente.
- Botões permitem continuar estudando, finalizar via confirmação, retomar de pausa ou corrigir horário. Avisos de bloco Pomodoro permanecem discretos, sem alarme persistente.
- Nas Preferências é possível configurar repetição de som de meta/pausa, volume, arquivos pessoais e habilitar notificações do Windows ou Android mediante permissão. O site usa Service Worker quando disponível, com alternativa do navegador.
- Notificações do sistema são enviadas enquanto a página executa. A existência do Service Worker **não significa que o site consiga disparar alarmes novos com o navegador fechado**: isso depende de Web Push com subscription, servidor e agendamento, não configurados nesta versão.
- O navegador pode impedir autoplay ou suspender áudio em segundo plano. O aviso visual é recuperado após recarga; se o som não iniciar, o usuário pode usar Reproduzir som.

## Cronômetro inteligente — 04/11/2026

O Órbita agora disponibiliza o botão **Cronometrar** em cada sessão de estudo na tela Início, um indicador global de **ESTUDO EM ANDAMENTO / ESTUDO PAUSADO / NENHUM ESTUDO ATIVO**, contagem circular de progresso, pausas com motivo (descanso, preparação de flashcards, interrupção, pausa programada), correção auditada de horários e salvamento automático local e sincronizável.

Nas Preferências, há modos contínuo, Pomodoro e personalizado, sons distintos de conclusão e pausa prolongada, volume, repetição, áudios próprios pequenos, brilho e notificações mediante permissão. A meta atingida não conclui o ciclo automaticamente; concluir é decisão explícita. O relatório prioriza tempo pausado e contexto, não a quantidade bruta de pausas.

**SQL:** nenhuma migração adicional. Os dados ficam no documento JSON `orbita_documents.content`, usando a sincronização existente `orbita_commit`. A operação com navegador fechado e alertas em segundo plano exige testes reais; o dispositivo pode restringir a emissão de som.


**Organização. Disciplina. Evolução.**

Planejador pessoal e de estudos, independente da Academia CFOP. O objetivo é organizar compromissos, disponibilidade, ciclos, hábitos e evolução com liberdade para editar tudo que não pertence a um dia já encerrado.

## Etapa atual: 5 de 5 — código preparado; conexão real pendente

**Disponível nesta etapa**
- Página inicial zerada no primeiro acesso, com orientação contextual.
- Layout minimalista, tecnológico e responsivo, com tema claro/escuro e luz do cursor.
- Navegação entre Início, Planejamento, Organizar, Perfil, Disponibilidade e Preferências.
- Calendário semanal, setas para navegar entre datas, seletor de data e retorno a Hoje.
- Disponibilidade semanal por horas totais, faixas de horário múltiplas ou descanso; exceções em datas específicas, cópia de disponibilidade para outros dias.
- Objetivos pessoais: criar, editar, definir principal, duplicar, arquivar, reativar e excluir.
- Configurações e alterações salvas localmente neste navegador.

**Disponível na etapa 2**
- Focos obrigatórios, tarefas secundárias e rotinas/hábitos: adicionar, editar, copiar, arquivar, reativar e excluir, com operações por ocorrência quando recorrentes.
- Iniciar, concluir, marcar não realizado ou pendente; registrar tempo efetivo e horário real dos hábitos (opcional).
- Priorização de tarefas secundárias, ordenação de concluídas no fim, idade das tarefas e continuidade de pendências.
- Blocos de organização com cores, edição, cópia e arquivamento.
- Planejamento por semana ou mês com navegação e criação diretamente na data escolhida.
- Recorrência semanal em dias selecionados ou mensal por dia numérico, término definido e numeração mensal opcional.
- Copiar semana, mês ou programação de um bloco para mês-alvo, com prévia e opção para pular duplicatas ou substituir entradas sem registros.
- Focos remanejados preservam a origem e o motivo; pausas registram motivo, momento e carga anterior; eventos mantidos para análises futuras.
- Avisos de conflito entre horários e carga planejada superior à disponibilidade.
- Sem login, esses registros permanecem locais. A etapa 5 acrescenta a integração com banco ao conectar a conta.

**Disponível na etapa 3**
- Múltiplos ciclos de estudos independentes, cada um com área própria e objetivo opcional.
- Matérias ordenáveis, repetição de sessões por etapa, pausa com motivo/retorno manual, arquivamento, cópia e reativação.
- Rotação avança somente após a conclusão do número necessário de sessões; sessões parciais e de reforço não avançam.
- Seleção manual da próxima matéria, correção da última conclusão de etapa e trilha de eventos de mudanças.
- Sessões agendadas com data, início opcional, duração prevista, duração efetiva e situação pendente/em andamento/concluída.
- Classificação independente por área, disciplina, assunto, finalidade, ciclo e modalidade, sem misturar horas de ENEM e Eletrônica.
- Modalidades de estudo criadas pelo usuário, sem opções pré-cadastradas na conta.
- Vínculo opcional entre sessão de estudo e foco obrigatório, evitando dupla soma das horas planejadas.
- Analisador de carga por data, com alerta de sobrecarga e conflitos de horário, sem remanejamento automático.
- Estatísticas reais por área, matéria, assunto, modalidade e ciclo; ausência de duração não é registrada como zero de estudo.
- Painel de estudos acessível pelo Início e por Organizar; ciclos arquivados ficam disponíveis para consulta/reativação.

**Disponível na etapa 4**
- Revisão dos compromissos e estudos por dia, com confirmação explícita `FINALIZAR`.
- Fechamento **definitivo pela interface**: uma vez encerrado, o dia fica apenas para consulta; a versão congelada dos dados não é alterada por edições posteriores em tarefas, ciclos ou disponibilidade.
- Alertas de datas anteriores pendentes e orientação para fechar na ordem, sem impedir registros do dia atual.
- Relatórios diários, semanais, mensais e anuais; diferenciação entre **provisório** e **consolidado**. Semana personalizada respeitada.
- Métricas por focos, hábitos, pontualidade, estudo, descanso e tempo estimado/real. Resultados ausentes não viram horas imaginárias.
- Registros opcionais de questões, acertos e qualidade percebida nas sessões.
- Orientador de desempenho baseado em regras rastreáveis, histórico e amostra; cobra o plano, reconhece constância e evita criticar descansos planejados.
- Lembretes discretos que podem ser adiados ou desativados, e conquistas verificáveis que exigem vários dias de compromissos cumpridos.
- Comparações descritivas entre períodos com pelo menos cinco dias fechados e metas comparáveis em cada período.

**O código da etapa 5 está pronto;** autenticação real, aplicação do SQL e homologação de sincronização dependem de sua configuração no Supabase.

> Importante: a imutabilidade já é aplicada na interface. O SQL da etapa 5 prepara proteção no banco, que só passa a valer após a migração ser executada no Supabase e os dados sincronizados.



### Abrir o site
Quando a publicação automática do GitHub Pages estiver habilitada:

**https://allanghabriell.github.io/orbita/**

A publicação usa `.github/workflows/pages.yml`. **A primeira tentativa falhou:** o GitHub recusou a ativação automática do Pages com o erro `Resource not accessible by integration`. Abra **Settings → Pages → Build and deployment → GitHub Actions** para habilitar o Pages uma única vez, depois execute novamente o workflow **Testar e publicar Órbita**. **Atualização:** um deploy posterior do workflow foi concluído com sucesso. O endereço público ainda precisa de conferência visual em navegador real.

Também é possível abrir `index.html` em um navegador para testar a interface estática.

### Testes
O repositório tem um workflow de verificação e os testes `tests/stage1.test.mjs`, `tests/stage2.test.mjs` e `tests/stage3.test.mjs` e `tests/stage4.test.mjs` e `tests/stage5.test.mjs`, executáveis com Node.js 22:

```bash
node --check app.js
node --check stage2.js
node --check stage3.js
node --check stage4.js
node --check stage5.js
node --check boot.js
node --check sw.js
node --test tests/*.test.mjs
```

### Dados e banco
Durante as etapas 1–4, os registros são provisórios e locais (`localStorage`). A etapa 2 armazena atividades em `state.planner` e a etapa 3 armazena os estudos em `state.studies` e a etapa 4 congela os registros em `state.evolution.closed`; a etapa 5 adiciona um espelho IndexedDB e prepara sincronização Supabase. O histórico de alterações permanece no modelo. Uma migração será necessária na etapa 5. Não há SQL nesta fase. A integração Supabase, login Google, funcionamento offline com sincronização e regras RLS acontecerão **somente na etapa 5**, conforme combinado. Não confie no armazenamento local como backup definitivo; limpar dados do navegador pode apagar as configurações.

### Acompanhamento obrigatório
- [ESCOPO.md](./ESCOPO.md) — requisitos completos do projeto, revisados a cada etapa.
- [CHECKLIST.md](./CHECKLIST.md) — o que está feito, pendente ou em validação.
- [PROGRESSO.md](./PROGRESSO.md) — relatório por etapa, problemas e próximos passos.

## Etapa 5 — banco, contas, offline e aplicativo instalável

O projeto Supabase está **pré-configurado no código público** do Órbita em `config.js`; não existe mais formulário para informar URL ou chave pública. O SQL foi entregue, mas a execução no banco e a habilitação do login Google ainda precisam ser confirmadas.

**[Guia de conexão: CONFIGURAR_SUPABASE.md](./CONFIGURAR_SUPABASE.md)**  
**[SQL completo: supabase/migrations/20261102_000001_orbita.sql](./supabase/migrations/20261102_000001_orbita.sql)**

Implementado no código:
- Login Google com Supabase Auth por OAuth/PKCE (dependente de ativação do provedor).
- Sincronização com versionamento e prevenção de sobrescrita silenciosa, resolução explícita de conflitos e proteção dos dias finalizados no banco.
- IndexedDB como espelho durável dos dados, com acesso local offline e recuperação do estado; não depende de conexão para abrir a agenda já carregada.
- Backup JSON por exportação e importação com validação e alerta de substituição.
- PWA com manifesto, ícones PNG 192/512 e service worker para arquivos estáticos, instalável em navegadores compatíveis.
- Sem chave secreta no GitHub. A URL e a chave pública do Supabase são carregadas automaticamente pelo `config.js` em todos os dispositivos.

**Limitação de validação:** o Google, a aplicação SQL e a sincronização entre aparelhos requerem um projeto Supabase conectado. Não foram testados com dados reais nesta etapa. O funcionamento offline e a instalação também precisam de teste em dispositivos reais.

## Etapas aprovadas
1. **Base e UX:** estrutura, responsividade, navegação, disponibilidade, objetivos, documentação.
2. **Planejamento:** tarefas, focos, blocos, rotinas, calendário e repetição.
3. **Estudos:** ciclos, modalidades, sessões, carga e estudos complementares.
4. **Evolução:** fechamento, estatísticas e orientador exigente.
5. **Integração:** banco, SQL, Google, segurança, offline/PWA e sincronização.

**Regra:** nenhuma etapa posterior começa sem nova autorização.
