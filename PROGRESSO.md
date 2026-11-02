# PROGRESSO — Órbita

## Etapa 1 — Base, navegação e disponibilidade (2026-11-02)

**Repositório:** https://github.com/AllanGhabriell/orbita  
**Situação:** implementação inicial entregue no branch main; testes automatizados de inicialização, navegação, disponibilidade e objetivos aprovados no job de teste do GitHub Actions; publicação e QA visual ainda devem ser confirmados.  
**Próxima etapa:** 2, somente após autorização expressa.

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
- Testes automatizados de estado vazio, ausência de estatísticas fictícias, criação de disponibilidade com faixas múltiplas, cadastro/objetivo principal e navegação: aprovados no job de teste.
- Execução em ambiente simulado para confirmar a inicialização da tela sem dados predefinidos.
- Correções efetuadas nos diálogos para evitar fechamento ao interagir dentro dos formulários.

### Pendências de qualidade
- Verificar publicação real do GitHub Pages e acesso público ao endereço. A configuração depende das permissões do GitHub.
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
