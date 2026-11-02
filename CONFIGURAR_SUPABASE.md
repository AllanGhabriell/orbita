# CONFIGURAÇÃO FINAL DO SUPABASE — ÓRBITA

O site e o código estão no GitHub. Esta página descreve **somente** o que depende das suas contas. A aplicação continua utilizável sem login, com registros locais.

## 1. Criar o projeto no Supabase
Acesse https://supabase.com/dashboard e crie um novo projeto **exclusivo para o Órbita** (não utilize o banco da Academia CFOP).

O projeto deverá disponibilizar **Project URL**, **publishable key** (`sb_publishable_...`) e o **SQL Editor**. Nunca use `sb_secret_...`, `service_role`, senha PostgreSQL ou segredos do Google no site.

## 2. Aplicar o SQL completo
Abra **SQL Editor → New query** e execute integralmente:

**[20261102_000001_orbita.sql](./supabase/migrations/20261102_000001_orbita.sql)**

Esse arquivo cria:

- `public.orbita_documents`: um documento por conta, com `version` para controle de alterações concorrentes.
- `public.orbita_closed_days`: snapshots de dias finalizados, sem permissões diretas de gravação para os usuários.
- RLS: cada usuário autenticado só consegue consultar os próprios dados.
- `public.orbita_commit`: única entrada de gravação autorizada. Compara a versão da nuvem antes de aceitar novos dados; preserva dias finalizados.

Não execute o SQL de outro projeto nem adicione políticas `USING (true)` para facilitar o acesso.

## 3. Habilitar o login Google
No Supabase, abra **Authentication → Sign In / Providers → Google** e habilite o provedor.

Configure o cliente OAuth no Google Cloud com a URL de retorno do Supabase:

```text
https://SEU-PROJECT-REF.supabase.co/auth/v1/callback
```

Insira o **Client ID** e o **Client Secret** do Google **somente no painel seguro do Supabase**, não no GitHub. As credenciais devem estar associadas ao projeto Google Cloud que você criou.

No Supabase, em **Authentication → URL Configuration**, informe:

**Site URL**
```text
https://allanghabriell.github.io/orbita/
```

**Redirect URLs**: adicione também
```text
https://allanghabriell.github.io/orbita/
```

Esses caminhos devem corresponder exatamente ao endereço do site. O app utiliza OAuth com fluxo PKCE e redireciona para o próprio Órbita.

## 4. Acessar o site já conectado ao projeto

A URL do Supabase e a chave **pública** estão incorporadas ao código do Órbita em `config.js`. O formulário "Conectar Supabase" foi removido: não é necessário copiar os dados novamente em outro navegador ou dispositivo.

1. Abra **https://allanghabriell.github.io/orbita/**.
2. Em **Preferências → Dados e sincronização**, clique em **Continuar com Google**.
3. Autentique-se e permita o retorno ao Órbita.
4. Caso tenha históricos locais e na nuvem diferentes, exporte um backup e escolha explicitamente qual versão usar. Os dias finalizados são preservados.

**Ainda é necessário** executar o SQL da etapa 2 e configurar o login Google na etapa 3 deste guia. A chave pública no site não ativa automaticamente a autenticação ou as tabelas.

## 5. Testes finais obrigatórios

- **Conta A:** crie um foco e uma sessão, feche um dia e confira se os relatórios não mudam após novas edições.
- **Conta B (outro Google):** confira se não acessa os dados da Conta A.
- **Offline:** abra o site conectado, desconecte da internet, cadastre um item e recarregue. Ele deve continuar aparecendo localmente.
- **Reconexão:** volte à internet, sincronize e confirme os dados na mesma conta em outro navegador/dispositivo.
- **Conflito:** altere dados em dois aparelhos desconectados; o app deve pedir decisão, sem substituir automaticamente a nuvem.
- **Dias finalizados:** a RPC não pode aceitar alteração nem exclusão de snapshot previamente confirmado.
- **Backup:** exporte JSON, confira se é um arquivo válido e teste a recuperação em um contexto seguro.

## Limites e transparência
- A sincronização usa documento JSON por conta com **controle de versão**. Não faz fusão automática de atividades simultâneas; a escolha entre dispositivo e nuvem é explícita. Os fechamentos das duas versões são conciliados quando não há divergência de conteúdo para a mesma data.
- Armazenamento offline: a aplicação usa `localStorage` para acesso imediato e IndexedDB como cópia persistente no mesmo navegador. Não é banco remoto sem conexão.
- Os testes automatizados não provam que seu projeto Google OAuth e Supabase já estejam configurados; a integração real depende dos passos acima.
- O SQL e a interface devem ser homologados antes de armazenar informações importantes exclusivamente na nuvem.
- A PWA pode ser instalada pelo navegador compatível após abrir o site online. Se a instalação não aparecer imediatamente, recarregue depois que o service worker concluir o cache.

## Referências técnicas
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/database/postgres/row-level-security

Consulte também [CHECKLIST.md](./CHECKLIST.md) e [PROGRESSO.md](./PROGRESSO.md).
