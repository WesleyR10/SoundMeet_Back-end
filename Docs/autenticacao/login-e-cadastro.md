# Login e cadastro — os fluxos de entrada

> Pasta [autenticacao/](./): [keycloak.md](keycloak.md) (realm, clients, papéis, claims) ·
> [autorizacao-e-ownership.md](autorizacao-e-ownership.md) (proteger uma rota) ·
> [login-e-cadastro.md](login-e-cadastro.md) (os fluxos de entrada) ·
> [usuarios-de-teste.md](usuarios-de-teste.md) (logins do seed).

## Registro de usuarios (`POST /api/v1/auth/register`)

Como `registrationAllowed: false`, este endpoint e a unica porta de entrada para novos usuarios musico/publico. Implementacao: `src/core/auth/` (domain, sem aggregate proprio) + `src/nest-modules/auth-module/` (wiring).

Fluxo do `RegisterUseCase`:

1. Valida que o email nao existe localmente (`Musician`/`Audience`, conforme `role`) — falha rapida antes de tocar o Keycloak.
2. Cria o usuario no Keycloak via Admin API (`KeycloakAdminGateway`, `client_credentials` grant com `soundmeet-api`) com `emailVerified: true` e `requiredActions: []`.
3. Atribui a realm role (`musician` ou `audience`) ao novo usuario.
4. Cria o aggregate `Musician`/`Audience` usando o **mesmo UUID** do `sub` retornado pelo Keycloak como ID primario (ver invariante em [regras-de-negocio/cadastro-e-login.md](../regras-de-negocio/cadastro-e-login.md)).
5. Emite (best-effort, nao bloqueante) um token de verificacao de email via `VerifyEmailService.issueVerificationToken()` — reaproveita os campos `email_token`/`email_token_expires_at` ja existentes e `MailService.sendEmailVerification()`.
6. Autentica o usuario via grant de senha no client **confidencial** `soundmeet-registration` (`KEYCLOAK_REGISTRATION_CLIENT_SECRET`, so no backend) e retorna `access_token`/`refresh_token`.

   > 🔴 **AUTH-1 (31/ago/2026):** ate essa data o passo 6 usava o client **publico** `soundmeet-mobile`. Como o `client_id` publico esta dentro do APK, qualquer script batia direto no `/token` do Keycloak e pulava o `@Throttle` do Nest inteiro. Hoje `soundmeet-mobile` tem `directAccessGrantsEnabled: false` e o grant vive num client cujo secret nunca sai do servidor — o rate limit do Nest voltou a ser inescapavel. O grant de senha **continua existindo aqui de proposito**: o usuario acabou de escolher a senha, e manda-lo para a tela de login em seguida seria pedir para digitar duas vezes. ~~Para LOGIN nao ha grant de senha em lugar nenhum: e Authorization Code + PKCE.~~ **Mudou em AUTH-3 (25/set/2026):** o login por senha voltou, no MESMO client confidencial — ver a secao "AUTH-3" no fim deste documento.

Qualquer falha entre os passos 2 e 4 aciona compensacao (`deleteUser` best-effort no Keycloak) para nao deixar conta orfa. Falha no passo 6 (autenticacao) **nao** aciona compensacao, pois a conta ja foi criada com sucesso — o cliente recebe 503 e deve cair para a tela de login normal.

**Por que `emailVerified: true` na criacao, e nao o fluxo nativo `VERIFY_EMAIL` do Keycloak:** o realm tem `verifyEmail: false` e precisa continuar assim. Se o Keycloak exigisse a verificacao (required action `VERIFY_EMAIL`), ou se o usuario fosse criado sem `emailVerified: true`, o grant de senha do passo 6 falharia com `invalid_grant: Account is not fully set up` (Keycloak bloqueia password grant com required actions pendentes) — o que quebraria o requisito de retornar tokens imediatamente (sem redirect de browser). A verificacao de posse do email passa a ser responsabilidade da aplicacao (mecanismo `email_token` ja existente), nao do Keycloak.

~~**Risco residual:** `POST /audiences` continua `@Public()` no NestJS, permitindo criar um `Audience` sem usuario Keycloak correspondente.~~ ✅ **Resolvido em 26/ago/2026 (SM-021):** a rota, o `CreateAudienceUseCase`, o input e o DTO foram **removidos**. O caminho criava o agregado com UUID aleatorio enquanto o canonico faz `new AudienceId(externalId)` (o `sub`), produzindo perfil orfao. Restringir a `admin` nao resolveria: uma capacidade que so sabe produzir agregado violando a invariante de identidade nao fica melhor com autorizacao, fica mais discreta. Ha regressao em `audiences.controller.spec.ts`.

## Login por email/senha (`POST /api/v1/auth/login`) — removido no AUTH-1, de volta no AUTH-3

> ✅ **De volta em 25/set/2026, em outro desenho** — ver a seção "AUTH-3" no fim
> deste documento. O que segue descreve a versão REMOVIDA (grant no client
> público) e fica como histórico.
>
> 🔴 **(AUTH-1, 31/ago/2026)** Esta rota, o `LoginUseCase` e o `LoginDto` deixaram de existir. O login passou a ser
> Authorization Code + PKCE contra o Keycloak, aberto dentro do app em Chrome
> Custom Tab / `ASWebAuthenticationSession`. Ver a seção "AUTH-1 — fim do Direct
> Access Grant" no fim deste documento.
>
> A descrição abaixo fica como registro do que existia e por quê — o passo 3 em
> especial (resolver papel consultando o repositório, nunca decodificando o JWT)
> explica por que a checagem de papel teve de migrar para o cliente: com PKCE não
> há corpo de resposta, e a verdade passou a ser a role do JWT.

### Como era (histórico)

Espelha o `RegisterUseCase`, mas sem criar nada — so autentica e resolve o papel/perfil ja existente. Implementacao: `src/core/auth/application/use-cases/login/`.

Fluxo do `LoginUseCase`:

1. Autentica via Direct Access Grant (`grant_type=password`, client `soundmeet-mobile`) usando `KeycloakAdminGateway.authenticateWithPassword()`.
2. Credencial invalida (Keycloak responde `400 invalid_grant`) vira `IdentityProviderInvalidCredentialsError` no gateway e `UnauthorizedError` (401) no use case.
3. Com o token emitido, resolve `role`/`profile_id` consultando `MusicianRepository.findByEmail()`/`AudienceRepository.findByEmail()` — **nunca** decodificando o JWT no backend, pois o token so carrega o que o realm ja sabe no momento da emissao.
4. Anomalia (Keycloak autenticou mas nao existe `Musician`/`Audience` local com esse email) tambem retorna 401 generico ao cliente, com log server-side — esse estado nao deveria ocorrer no fluxo de senha (so é possivel via o caminho de login social sem completar o cadastro).

Sem validacao de complexidade de senha aqui (essa politica e de criacao de conta, nao de autenticacao).

## Login social e cadastro pendente (`POST /api/v1/auth/social-signup`)

Cobre o caso em que um usuario se autentica no Keycloak via provedor externo (ex.: Google, broker do realm) e recebe um JWT valido, mas **ainda nao tem role nem aggregate no SoundMeet** — o broker cria o usuario no Keycloak automaticamente, porem sem nenhuma role de realm atribuida. Implementacao: `src/core/auth/application/use-cases/social-signup/`.

Diferencas-chave em relacao ao `/auth/register`:

- **Nao e `@Public()`** — exige Bearer token valido (o usuario ja passou pelo login social). `userId` e as `roles` atuais vem de `@CurrentUser()` (claim do token via `CurrentUserContextGuard`), nunca do body.
- O client so envia `{ role, cpf?, phone? }` — nome e email vem de `IIdentityProviderGateway.getUser(userId)` (Admin API), pois o Keycloak ja os importou do provedor social.
- Se o token ja tiver `musician` ou `audience` em `roles`, o endpoint responde 409 (`ConflictError`, "ja cadastrado") confiando no claim do token — mesma fonte de verdade que o `RolesGuard` ja usa em todo o resto da API.
- Sem emissao de verificacao de email: o provedor social ja verificou a posse do email (`trustEmail: true` no identity provider do realm).
- **Compensacao diferente do registro por senha:** se a criacao do aggregate falhar depois do `assignRealmRole` ter tido sucesso, o rollback chama `removeRealmRole` (nunca `deleteUser`) — essa conta Keycloak nao foi criada por nos, existe por um login social real do usuario, entao so desfazemos a role que atribuimos.
- Invariante `musician_id == sub` / `audience_id == sub` continua valendo aqui, ver [regras-de-negocio/cadastro-e-login.md](../regras-de-negocio/cadastro-e-login.md).

O mobile trata o caso "login social sem role" numa store transiente (nunca grava em `auth.store` com roles vazias) ate o usuario escolher o papel e este endpoint responder com sucesso.

---

## AUTH-1 — fim do Direct Access Grant (31/ago/2026)

O login por senha saiu da API. Hoje é Authorization Code + PKCE, aberto **dentro
do app** (Chrome Custom Tab / `ASWebAuthenticationSession`).

### Clients do realm depois da mudança

| Client | Público? | Direct Grant | Standard Flow | Para quê |
|--------|----------|--------------|---------------|----------|
| `soundmeet-api` | não | não | não | service account (`manage-users`, `view-realm`) |
| `soundmeet-web` | sim | não | sim | painel do estabelecimento (PKCE via BFF) |
| `soundmeet-mobile` | sim | **não** (era `true`) | sim | app (PKCE) |
| `soundmeet-registration` | **não** | **sim** | não | auto-login pós-cadastro, só pelo backend |
| `soundmeet-admin` | sim | não | sim | painel admin |

🔴 **Por que o Direct Grant migrou para um client confidencial em vez de sumir:**
o cadastro precisa devolver sessão — o usuário acabou de escolher a senha, e
mandá-lo à tela de login em seguida seria pedir para digitar duas vezes. O que
não podia continuar era o grant morar num client **público**, cujo `client_id`
viaja dentro do APK: qualquer script batia direto no `/token` do Keycloak e
pulava o `@Throttle` do Nest inteiro. Com secret, o grant só é alcançável de
dentro do backend, onde o rate limit é inescapável.

Verificado contra o Keycloak local:

```
POST /token client_id=soundmeet-mobile grant_type=password
  -> 400 "Client not allowed for direct access grants"
POST /token client_id=soundmeet-registration (sem secret)
  -> 401 "Invalid client or Invalid client credentials"
POST /token client_id=soundmeet-registration + client_secret
  -> 200
```

### Variáveis novas

- `KEYCLOAK_REGISTRATION_CLIENT_ID` (default `soundmeet-registration`)
- `KEYCLOAK_REGISTRATION_CLIENT_SECRET` — **obrigatória** (Joi). Precisa casar
  com `KEYCLOAK_REGISTRATION_CLIENT_SECRET` do `scripts/keycloak-sync.mjs`.
- `KEYCLOAK_MOBILE_CLIENT_ID` foi **removida** — virou config morta quando o
  grant deixou de usar o client do app.

⚠️ **`npm run keycloak:sync` é obrigatório antes de subir a API**, senão o
cadastro responde **503**: o client confidencial existe no `realm-soundmeet.json`
mas ainda não no Keycloak em execução.

### Armadilhas registradas

- **Descrição de client tem limite de 255 caracteres** (coluna do Keycloak). Uma
  descrição longa derruba o sync com `500 unknown_error`, e a causa real só
  aparece no log do container: `value too long for type character varying(255)`.
- **`loginTheme` precisou entrar no `pickDefined` de `upsertRealm`** — o script
  usa lista fixa de propriedades do realm, então sem a linha o tema compila, o
  container sobe e a tela de login continua a padrão, sem erro em lugar nenhum.
- **`authenticateWithPassword` tinha TRÊS chamadores**, não um: `login`,
  `register` e `register-establishment` (o `/cadastro` do web). Desligar o DAG
  sem tratar os dois cadastros derrubaria o cadastro da web junto.

## AUTH-3 — login por senha dentro do app (25/set/2026)

Decisão de produto: a tela de e-mail e senha volta para **dentro** do app
(nativa, com o visual do SoundMeet). O Google continua pelo navegador (Custom
Tab) — o Google recusa login em WebView e o consentimento tem de ser a tela dele.

**Não é a volta ao desenho anterior ao AUTH-1.** Dos três problemas que o AUTH-1
apontou, só um era explorável — e ele é resolvido de outro jeito:

| Problema do AUTH-1 | Como fica no AUTH-3 |
|---|---|
| 🔴 Grant no client **público** (`client_id` no APK): script ia direto ao `/token` e pulava o `@Throttle` | Grant no client **confidencial** `soundmeet-registration`. Sem o secret, o `/token` recusa — a única porta é `POST /auth/login`, com throttle |
| Senha passa pelo app e pelo Nest | Aceito — é o normal de qualquer app first-party. Mitigado: senha não é logada, e o **Sentry filtra o corpo** (ver abaixo) |
| MFA não cabe num POST só | Aceito por ora. MFA/passkey não estão no roadmap; quando entrarem, o caminho é passkey nativa ou o "OAuth 2.0 for First-Party Apps" (draft IETF) — que o Keycloak **ainda não suporta oficialmente** (discussão #25014, só extensão da comunidade) |

A RFC 9700 diz que o grant de senha "MUST NOT be used"; o argumento dela é
sobre expor a credencial a um **client de terceiro** e treinar o usuário a
digitá-la fora do servidor de identidade. Aqui app, API e Keycloak são todos
nossos. A violação do texto é consciente e está registrada aqui.

### Rotas (todas `@Public()`, todas no client confidencial)

| Rota | Throttle | Observação |
|---|---|---|
| `POST /auth/login` | 20/min por IP | Recusa **uniforme**: senha errada, conta inexistente, bloqueada ou desabilitada → mesmo 401 "E-mail ou senha incorretos" |
| `POST /auth/refresh` | 30/min | 401 = sessão vencida (app sai); 503 = provedor fora (app **não** sai) |
| `POST /auth/logout` | 30/min | `/revoke` do Keycloak — derruba também a sessão **offline**. Sempre 204 |
| `POST /auth/forgot-password` | 3/min | `execute-actions-email` (UPDATE_PASSWORD, link de 30 min). Resposta idêntica em **todos** os casos, inclusive falha de envio |

- 🔴 **O Keycloak só aceita refresh token do client que o emitiu** ("Unmatching
  clients"). Por isso refresh e logout **também** passam pela API.
  **Isso consertou um defeito latente do cadastro:** desde o AUTH-1 a sessão do
  `POST /auth/register` nascia no client confidencial e o app a renovava no
  público — quem criava conta era deslogado na primeira renovação (~15 min), sem
  erro na tela. O app decide o canal pelo `azp` do próprio access token
  (`session-channel.ts`), então sessões já gravadas funcionam sem migração.
- **`scope=openid offline_access`** no grant de senha, igual ao PKCE do app. Sem
  isso a sessão morre com `ssoSessionIdleTimeout` (30 min parado).
- **Rate limit em duas camadas, cada uma cobre o que a outra não vê:** o throttle
  é por IP (volume de uma origem); o brute force do Keycloak (`failureFactor: 5`,
  bloqueio temporário) é por **conta** — o Keycloak não tem limite por IP.
  ⚠️ 20/min e não 5 porque CGNAT de operadora e o Wi-Fi do bar põem centenas de
  pessoas atrás do mesmo IP. ⚠️ **Em produção atrás de proxy**, `req.ip` é o IP
  do proxy e o balde vira global — mesma limitação já registrada em
  `user-throttler.guard.ts`; resolver exige decidir a topologia de deploy.
- ⚠️ **Bloqueio de conta é vetor de DoS** (quem sabe o e-mail de alguém tranca a
  conta por até 15 min). É o preço do brute force por conta; `permanentLockout`
  fica `false` de propósito. O app, a partir da 3ª recusa seguida, avisa que a
  conta "fica protegida por alguns minutos" — texto igual exista a conta ou não.
- **Conta de estabelecimento no app:** o backend emite a sessão; o app lê as
  roles, recusa **antes** de gravar e revoga a sessão no provedor.
- **Porta separada no core:** `IIdentitySessionGateway` (login, refresh,
  revogação, e-mail de redefinição), implementada pelo mesmo
  `KeycloakAdminGateway`. Separada de `IIdentityProviderGateway` para os mocks de
  cadastro não precisarem conhecer sessão.

### 🔴 Sentry recebia a senha

O `@sentry/nestjs` 10 anexa o **corpo da requisição** a todo evento
(`maxIncomingRequestBodySize: 'medium'`, até 10 KB, é o default — e
`sendDefaultPii: false` **não** desliga isso). Qualquer 500 inesperado em
`POST /auth/register` já mandava senha, CPF e celular para o Sentry. Hoje
`beforeSend`/`beforeSendTransaction` passam por `sentry-event-scrubber.ts`, que
filtra por **nome de campo** (senha, token, secret, authorization, cookie, CPF,
CNPJ, telefone) em corpo JSON, form-urlencoded, query e headers.

### Pendente de deploy

- `npm run keycloak:sync` (só a descrição do client mudou — o grant já existia).
- Rebuild do `soundmeet-app` (rotas novas).
- SMTP do Keycloak (`RESEND_API_KEY` no container dele) para o "Esqueci a senha"
  enviar de fato; sem ele a rota responde a mensagem genérica e registra a falha
  no log.
