# PROGRESSO — Órbita

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
