# Órbita

**Organização. Disciplina. Evolução.**

Planejador pessoal e de estudos, independente da Academia CFOP. O objetivo é organizar compromissos, disponibilidade, ciclos, hábitos e evolução com liberdade para editar tudo que não pertence a um dia já encerrado.

## Etapa atual: 3 de 5

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
- Todos esses registros são **locais**, ainda sem banco ou sincronização.

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

**Ainda não disponíveis:** fechamento definitivo, relatório semanal/mensal/anual completo, motor de orientação com avaliação de aprendizado e recomendações adaptativas (etapa 4); autenticação Google, Supabase, SQL, PWA e sincronização (etapa 5).

### Abrir o site
Quando a publicação automática do GitHub Pages estiver habilitada:

**https://allanghabriell.github.io/orbita/**

A publicação usa `.github/workflows/pages.yml`. **A primeira tentativa falhou:** o GitHub recusou a ativação automática do Pages com o erro `Resource not accessible by integration`. Abra **Settings → Pages → Build and deployment → GitHub Actions** para habilitar o Pages uma única vez, depois execute novamente o workflow **Testar e publicar Órbita**. **Atualização:** um deploy posterior do workflow foi concluído com sucesso. O endereço público ainda precisa de conferência visual em navegador real.

Também é possível abrir `index.html` em um navegador para testar a interface estática.

### Testes
O repositório tem um workflow de verificação e os testes `tests/stage1.test.mjs`, `tests/stage2.test.mjs` e `tests/stage3.test.mjs`, executáveis com Node.js 22:

```bash
node --check app.js
node --check stage2.js
node --check stage3.js
node --test tests/*.test.mjs
```

### Dados e banco
Durante as etapas 1–4, os registros são provisórios e locais (`localStorage`). A etapa 2 armazena atividades em `state.planner` e a etapa 3 armazena os estudos em `state.studies`; ambos possuem eventos de modificação. Uma migração será necessária na etapa 5. Não há SQL nesta fase. A integração Supabase, login Google, funcionamento offline com sincronização e regras RLS acontecerão **somente na etapa 5**, conforme combinado. Não confie no armazenamento local como backup definitivo; limpar dados do navegador pode apagar as configurações.

### Acompanhamento obrigatório
- [ESCOPO.md](./ESCOPO.md) — requisitos completos do projeto, revisados a cada etapa.
- [CHECKLIST.md](./CHECKLIST.md) — o que está feito, pendente ou em validação.
- [PROGRESSO.md](./PROGRESSO.md) — relatório por etapa, problemas e próximos passos.

## Etapas aprovadas
1. **Base e UX:** estrutura, responsividade, navegação, disponibilidade, objetivos, documentação.
2. **Planejamento:** tarefas, focos, blocos, rotinas, calendário e repetição.
3. **Estudos:** ciclos, modalidades, sessões, carga e estudos complementares.
4. **Evolução:** fechamento, estatísticas e orientador exigente.
5. **Integração:** banco, SQL, Google, segurança, offline/PWA e sincronização.

**Regra:** nenhuma etapa posterior começa sem nova autorização.
