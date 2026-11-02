# Órbita

**Organização. Disciplina. Evolução.**

Planejador pessoal e de estudos, independente da Academia CFOP. O objetivo é organizar compromissos, disponibilidade, ciclos, hábitos e evolução com liberdade para editar tudo que não pertence a um dia já encerrado.

## Etapa atual: 1 de 5

**Disponível nesta etapa**
- Página inicial zerada no primeiro acesso, com orientação contextual.
- Layout minimalista, tecnológico e responsivo, com tema claro/escuro e luz do cursor.
- Navegação entre Início, Planejamento, Organizar, Perfil, Disponibilidade e Preferências.
- Calendário semanal, setas para navegar entre datas, seletor de data e retorno a Hoje.
- Disponibilidade semanal por horas totais, faixas de horário múltiplas ou descanso; exceções em datas específicas, cópia de disponibilidade para outros dias.
- Objetivos pessoais: criar, editar, definir principal, duplicar, arquivar, reativar e excluir.
- Configurações e alterações salvas localmente neste navegador.

**Ainda não disponível:** tarefas, focos, ciclos operacionais, rotinas, cronômetros, fechamento de dia, estatísticas reais, login e sincronização. Estes recursos estão reservados para as etapas posteriores e não são simulados.

### Abrir o site
Quando a publicação automática do GitHub Pages estiver habilitada:

**https://allanghabriell.github.io/orbita/**

A publicação usa `.github/workflows/pages.yml`. Caso o workflow falhe na configuração inicial do Pages, abra **Settings → Pages → Build and deployment → GitHub Actions**, e execute novamente o workflow. Essa configuração depende das permissões da conta.

Também é possível abrir `index.html` em um navegador para testar a interface estática.

### Testes
O repositório tem um workflow de verificação e o teste `tests/stage1.test.mjs` que pode ser executado com Node.js 22:

```bash
node --check app.js
node --test tests/stage1.test.mjs
```

### Dados e banco
Durante as etapas 1–4, os registros são provisórios e locais (`localStorage`). Não há SQL nesta fase. A integração Supabase, login Google, funcionamento offline com sincronização e regras RLS acontecerão **somente na etapa 5**, conforme combinado. Não confie no armazenamento local como backup definitivo; limpar dados do navegador pode apagar as configurações.

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
