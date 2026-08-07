# Keycloak - SoundMeet

## Decisao

O SoundMeet usa um unico realm Keycloak chamado `soundmeet`, com roles globais, roles granulares no client da API e groups/attributes para representar contexto de permissao.

Esta decisao foi escolhida porque o SoundMeet e uma plataforma multi-lado:

- publico (`audience`) interage com QR Code, pedidos, votos e gorjetas;
- musicos (`musician`) gerenciam perfil, catalogo, IA musical, agenda e bandas;
- estabelecimentos (`establishment`) gerenciam perfil, eventos, contratacao e analytics;
- administradores (`admin`) operam a plataforma;
- o mesmo usuario pode acumular papeis, por exemplo musico e dono de estabelecimento.

Realm separado por tenant foi evitado por enquanto porque aumentaria complexidade operacional antes do produto precisar de isolamento enterprise forte.

## Arquivos

- Realm export: `infra/keycloak/realm-soundmeet.json`
- Script idempotente: `scripts/keycloak-sync.mjs`
- Compose local: `docker-compose.yml`

## Como aplicar localmente

1. Suba Keycloak e banco:

```bash
docker compose up -d postgres-keycloak keycloak
```

2. Sincronize a configuracao versionada:

```bash
npm run keycloak:sync:local
```

3. Acesse:

- Admin console: `http://localhost:8080`
- Usuario admin local: `admin`
- Senha local: `admin123`

## Clients

### `soundmeet-api`

Client confidencial usado como resource server da API NestJS.

Responsabilidades:

- concentrar roles granulares da API;
- expor mappers de claims usados pelo backend;
- permitir service account apenas para automacoes internas controladas.

A service account deste client tem as roles `manage-users` e `view-realm` do client de sistema `realm-management` atribuidas via `infra/keycloak/service-account-role-assignments.json` (sincronizada por `scripts/keycloak-sync.mjs`, funcao `assignServiceAccountRoles`). `manage-users` permite criar/atribuir role/deletar usuarios; `view-realm` e necessaria a parte porque ler a representacao de uma realm role (`GET /admin/realms/{realm}/roles/{nome}`, passo intermediario antes de atribuir a role a um usuario) e um endpoint de leitura de *realm*, nao de *usuario* — testado e confirmado empiricamente (sem `view-realm` a chamada retorna 403 mesmo com `manage-users` presente). Sem rodar `npm run keycloak:sync:local` (ou equivalente em staging/producao) apos alterar essa configuracao, qualquer chamada a Admin API retorna 403.

> **Atencao ao token cacheado:** o `KeycloakAdminGateway` cacheia o token de admin (`client_credentials`) em memoria por ate ~14 min. Se voce alterar as roles da service account com o backend ja rodando, o processo precisa ser reiniciado para obter um token novo com as roles atualizadas — o token antigo, ja emitido, nao reflete permissoes concedidas depois da sua emissao.

> **Atencao:** este arquivo e deliberadamente separado do `realm-soundmeet.json`. O container do Keycloak roda com `--import-realm` e monta `realm-soundmeet.json` diretamente (parser nativo do Keycloak, que rejeita campos desconhecidos com `UnrecognizedPropertyException`). Qualquer configuracao consumida apenas pelo `keycloak-sync.mjs` (nao nativa do Keycloak) deve ficar em um arquivo separado como este, nunca dentro de `realm-soundmeet.json`.

Em desenvolvimento, o secret padrao aplicado pelo script e:

```bash
KEYCLOAK_API_CLIENT_SECRET=soundmeet-api-local-secret
```

Em staging/producao, esse valor deve vir de secret manager/env seguro.

### `soundmeet-web`

Client publico para frontend web com Authorization Code + PKCE.

### `soundmeet-mobile`

Client publico para app mobile com deep links e Authorization Code + PKCE.

### `soundmeet-admin`

Client publico para console administrativo.

## Roles

### Realm roles

- `audience`
- `musician`
- `establishment`
- `admin`
- `support`

Essas roles definem o tipo principal de usuario e sao consumidas pelo `RolesGuard`.

### Client roles de `soundmeet-api`

- `establishment_owner`
- `establishment_staff`
- `band_manager`
- `band_member`
- `event_manager`
- `payment_manager`
- `analytics_viewer`
- `ai_operator`

Essas roles devem ser usadas para autorizacoes mais finas, quando a role global for insuficiente.

## Multi-tenancy e permissionamento contextual

O modelo atual e single realm com groups e attributes.

Claims suportadas nos tokens:

- `tenant_id`
- `organization_id`
- `establishment_ids`
- `band_ids`
- `groups`

O script `scripts/keycloak-sync.mjs` replica os mappers de contexto do client `soundmeet-api` para `soundmeet-web`, `soundmeet-mobile` e `soundmeet-admin`, e adiciona audience mapper para `soundmeet-api`. Isso permite que tokens emitidos pelos clients publicos carreguem contexto suficiente para o backend.

Uso esperado:

- `tenant_id`: fronteira logica principal do usuario. No MVP pode ser `soundmeet`.
- `organization_id`: organizacao comercial/operacional quando houver B2B.
- `establishment_ids`: estabelecimentos que o usuario pode operar.
- `band_ids`: bandas que o usuario pode gerenciar ou integrar.
- `groups`: trilha hierarquica do Keycloak para auditoria e suporte.

O backend nao deve confiar apenas em role global. Para rotas sensiveis, o fluxo recomendado e:

1. validar JWT com issuer/JWKS;
2. validar role minima com `RolesGuard`;
3. validar ownership/escopo no use case ou guard especifico usando IDs do dominio.

Exemplo:

- `establishment` permite acessar superficie de estabelecimento;
- `establishment_ids` decide quais estabelecimentos aquele usuario realmente pode alterar.

## Estrutura de groups

Base versionada:

```text
/soundmeet
  /audiences
  /musicians
  /establishments
    /_template
      /owners
      /staff
      /analytics
  /bands
    /_template
      /managers
      /members
  /admins
  /support
```

Para entidades reais, a convencao futura deve ser:

```text
/soundmeet/establishments/{establishment_id}/owners
/soundmeet/establishments/{establishment_id}/staff
/soundmeet/bands/{band_id}/managers
/soundmeet/bands/{band_id}/members
```

Os grupos `_template` nao representam entidades reais; servem como padrao operacional para automacoes futuras.

## Backend NestJS

O backend valida tokens em `auth-module`:

- `AUTH_JWT_VALIDATION_MODE=local`: usa `JWT_SECRET`, adequado para testes/dev isolado.
- `AUTH_JWT_VALIDATION_MODE=keycloak`: valida RS256 via JWKS, issuer do realm e opcionalmente audience/`azp`.

Variaveis relevantes:

```bash
AUTH_JWT_VALIDATION_MODE=keycloak
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=soundmeet
KEYCLOAK_CLIENT_ID=soundmeet-api
KEYCLOAK_INTERNAL_URL=http://keycloak:8080
KEYCLOAK_JWKS_URI=http://localhost:8080/realms/soundmeet/protocol/openid-connect/certs
KEYCLOAK_JWKS_CACHE_TTL_SECONDS=300
KEYCLOAK_VERIFY_AUDIENCE=false
```

Quando a API roda dentro do Docker, `KEYCLOAK_URL` deve continuar representando o issuer publico do token (`http://localhost:8080` no ambiente local) — ele precisa bater exatamente com o `iss` do JWT. Ja `KEYCLOAK_JWKS_URI` e `KEYCLOAK_INTERNAL_URL` podem apontar para o host interno Docker (`http://keycloak:8080/...`) para evitar acesso via host bridge. `KEYCLOAK_INTERNAL_URL` e usado pelo `KeycloakAdminGateway` (Admin API + Direct Access Grant do fluxo de registro, ver secao abaixo) — sem ele, dentro de um container o backend tentaria acessar `KEYCLOAK_URL` (`localhost`) e cairia nele mesmo, nao no container do Keycloak.

### Validacao de audience

`KEYCLOAK_VERIFY_AUDIENCE` agora tem **default `true` em producao** e `false` nos demais ambientes. Quando ligado, a checagem e um E logico:

1. `aud` precisa conter exatamente `KEYCLOAK_AUDIENCE` (ou `KEYCLOAK_CLIENT_ID`, se aquele nao estiver setado);
2. se `KEYCLOAK_ALLOWED_AZP` estiver preenchido, o `azp` precisa estar na lista.

Antes era um OU (`aud` contem o client **ou** `azp` bate), o que fazia um token emitido para outro client do mesmo realm ser aceito pela API.

> **Atencao ao ligar:** `KEYCLOAK_AUDIENCE` e `KEYCLOAK_CLIENT_ID` sao coisas diferentes. O mapper criado por `scripts/keycloak-sync.mjs` injeta o audience fixo `soundmeet-api`, enquanto `envs/.env` local usa `KEYCLOAK_CLIENT_ID=soundmeet-backend`. Ligar a verificacao sem setar `KEYCLOAK_AUDIENCE=soundmeet-api` rejeitaria todo token valido.

Migracao em duas etapas, como recomendado:

1. **Telemetria** — com `KEYCLOAK_VERIFY_AUDIENCE=false` a API loga uma vez por combinacao observada:
   ```json
   {"event":"auth.audience_check_disabled","expected_audience":"soundmeet-api","token_aud":["account","soundmeet-api"],"token_azp":"soundmeet-mobile","would_reject_if_enabled":false}
   ```
   Confirme `would_reject_if_enabled: false` para todos os clients em uso.
2. **Obrigatorio** — rode `node scripts/keycloak-sync.mjs` (garante o audience mapper nos clients) e ligue `KEYCLOAK_VERIFY_AUDIENCE=true`.

## Seguranca

- Nao versionar secrets reais de clients.
- Usar HTTPS e `sslRequired=external` fora do ambiente local.
- Usar PKCE nos clients publicos.
- Manter access token curto (`900s` no export).
- Validar ownership no backend; roles nao substituem regras de dominio.
- Evitar realm por tenant ate existir necessidade enterprise real.

## Mapeamento groups → claims JWT

O Keycloak popula as claims `establishment_ids` e `band_ids` via **Group Membership Mapper** configurado no client `soundmeet-api`. O script `scripts/keycloak-sync.mjs` cria esses mappers automaticamente.

Quando um usuario pertence ao group `/soundmeet/establishments/{establishment_id}/owners`, o mapper extrai o UUID do penultimo segmento do caminho e o insere no array `establishment_ids` do access token. O mesmo vale para `/soundmeet/bands/{band_id}/members` → `band_ids`.

Exemplo de payload JWT com contexto de ownership:

```json
{
  "sub": "user-uuid",
  "realm_access": { "roles": ["musician", "establishment"] },
  "establishment_ids": ["est-uuid-1", "est-uuid-2"],
  "band_ids": ["band-uuid-1"],
  "organization_id": null,
  "groups": [
    "/soundmeet/musicians",
    "/soundmeet/establishments/est-uuid-1/owners",
    "/soundmeet/establishments/est-uuid-2/staff",
    "/soundmeet/bands/band-uuid-1/members"
  ]
}
```

> **Estado atual (jun/2026):** o preenchimento de `establishment_ids` e `band_ids` no Keycloak e feito manualmente via Admin Console para desenvolvimento. A automacao (chamar Keycloak Admin API ao criar establishment/band) e item da secao "Evolucao futura".

---

## Fluxo de autorizacao — 3 camadas

```
Request HTTP
    │
    ▼
[AuthGuard]  ──── valida JWT assinado (RS256/JWKS ou HS256 local)
    │               extrai sub, roles, establishment_ids, band_ids
    ▼
[RolesGuard]  ─── verifica role minima da rota (@Roles("musician", "admin"))
    │               rejeita com 403 se role ausente
    ▼
[CurrentUserContextGuard]  ─── normaliza request.currentUser
    │                           (userId, roles, establishmentIds, bandIds, isAdmin)
    ▼
[OwnershipGuard ou use-case]  ─── decide se ESTE usuario pode operar ESTE recurso
    │
    ▼
  Controller → Use Case
```

**Quando usar guard vs use-case para ownership:**

| Situacao | Abordagem |
|----------|-----------|
| ID do recurso esta no path param e o JWT ja carrega os IDs do usuario | Guard no metodo (`@UseGuards(MusicianOwnershipGuard)`) |
| Precisa carregar a entidade do banco para saber o dono (ex.: bookings tem `establishment_id` que nao esta no JWT) | Use-case recebe `requesting_user_id` + `is_admin` do `@CurrentUser()` e valida internamente |

---

## Guards de ownership disponiveis

| Guard | Arquivo | Path params aceitos | Modulos aplicados |
|-------|---------|--------------------|--------------------|
| `MusicianOwnershipGuard` | `ownership/musician-ownership.guard.ts` | `id`, `musicianId`, `musician_id` | MusiciansController, PaymentController, AvailabilityController |
| `EstablishmentOwnershipGuard` | `ownership/establishment-ownership.guard.ts` | `id`, `establishmentId` | EstablishmentsController, PaymentController |

Ambos os guards:
- Permitem `isAdmin` sem restricao de ownership (bypass total)
- Lancam `ForbiddenException` quando `currentUser` nao esta presente ou o ID nao corresponde
- Ignoram silenciosamente rotas sem o path param esperado (retornam `true`)

---

## Como adicionar ownership a uma nova rota

Siga este checklist de 5 passos:

**1.** Confirmar que o controller ja tem na classe:
```typescript
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
```

**2.** Escolher o guard correto:
- Recurso pertence a um musico → `MusicianOwnershipGuard`
- Recurso pertence a um estabelecimento → `EstablishmentOwnershipGuard`

**3.** Verificar que o path param usa nome suportado pelo guard (ver tabela acima). Se necessario, renomear o param na rota.

**4.** Adicionar o guard no metodo:
```typescript
@Patch(":musician_id/profile")
@UseGuards(MusicianOwnershipGuard)
async updateProfile(...) { ... }
```

**5.** Se o recurso nao esta no path param (ex.: um booking nao expoe o `establishment_id` na URL), use a validacao no use-case:

```typescript
// No controller:
async confirm(
  @Param("id") id: string,
  @CurrentUser() user: AuthenticatedUser,
) {
  await this.useCase.execute({
    booking_id: id,
    requesting_user_id: user.userId,
    is_admin: user.isAdmin,
  });
}

// No use-case, apos findById:
if (!input.is_admin) {
  const isOwner =
    entity.establishment_id.id === input.requesting_user_id ||
    entity.musician_id?.id === input.requesting_user_id;
  if (!isOwner) throw new ForbiddenException();
}
```

Este padrao ja esta implementado em: `ConfirmBookingUseCase`, `CancelBookingUseCase`, `AcceptInquiryUseCase`, `RejectInquiryUseCase`.

---

## Convencao de groups para novas entidades

Quando o sistema criar um novo establishment ou banda, o backend DEVE adicionar o usuario responsavel ao group correspondente via **Keycloak Admin API**:

```
POST /admin/realms/soundmeet/users/{user_id}/groups/{group_id}
```

Convencao de nomes:

```text
/soundmeet/establishments/{establishment_id}/owners   ← dono (pode alterar tudo)
/soundmeet/establishments/{establishment_id}/staff    ← operador (acesso limitado)
/soundmeet/bands/{band_id}/managers                   ← gerente da banda
/soundmeet/bands/{band_id}/members                    ← membro (agenda, cifra)
```

Isso popula `establishment_ids` e `band_ids` automaticamente no proximo token emitido pelo Keycloak sem necessidade de alterar o backend.

> **Estado atual (jun/2026):** criacao de groups por entidade e manual via Admin Console. Automacao via `scripts/keycloak-sync.mjs` esta planejada mas nao implementada.

---

## Registro de usuarios (`POST /api/v1/auth/register`)

Como `registrationAllowed: false`, este endpoint e a unica porta de entrada para novos usuarios musico/publico. Implementacao: `src/core/auth/` (domain, sem aggregate proprio) + `src/nest-modules/auth-module/` (wiring).

Fluxo do `RegisterUseCase`:

1. Valida que o email nao existe localmente (`Musician`/`Audience`, conforme `role`) — falha rapida antes de tocar o Keycloak.
2. Cria o usuario no Keycloak via Admin API (`KeycloakAdminGateway`, `client_credentials` grant com `soundmeet-api`) com `emailVerified: true` e `requiredActions: []`.
3. Atribui a realm role (`musician` ou `audience`) ao novo usuario.
4. Cria o aggregate `Musician`/`Audience` usando o **mesmo UUID** do `sub` retornado pelo Keycloak como ID primario (ver invariante em [business-rules.md](../business-rules.md)).
5. Emite (best-effort, nao bloqueante) um token de verificacao de email via `VerifyEmailService.issueVerificationToken()` — reaproveita os campos `email_token`/`email_token_expires_at` ja existentes e `MailService.sendEmailVerification()`.
6. Autentica o usuario via Direct Access Grant (`grant_type=password`, client publico `soundmeet-mobile`) e retorna `access_token`/`refresh_token`.

Qualquer falha entre os passos 2 e 4 aciona compensacao (`deleteUser` best-effort no Keycloak) para nao deixar conta orfa. Falha no passo 6 (autenticacao) **nao** aciona compensacao, pois a conta ja foi criada com sucesso — o cliente recebe 503 e deve cair para a tela de login normal.

**Por que `emailVerified: true` na criacao, e nao o fluxo nativo `VERIFY_EMAIL` do Keycloak:** o realm tem `verifyEmail: true` com `VERIFY_EMAIL` como required action padrao. Se o usuario fosse criado sem `emailVerified: true`, o Direct Access Grant do passo 6 falharia com `invalid_grant: Account is not fully set up` (Keycloak bloqueia password grant com required actions pendentes) — o que quebraria o requisito de retornar tokens imediatamente (sem redirect de browser). A verificacao de posse do email passa a ser responsabilidade da aplicacao (mecanismo `email_token` ja existente), nao do Keycloak.

**Risco residual:** `POST /audiences` continua `@Public()` no NestJS, permitindo criar um `Audience` sem usuario Keycloak correspondente. Fora do escopo desta implementacao — considerar restringir a admin/interno numa iteracao futura.

## Login por email/senha (`POST /api/v1/auth/login`)

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
- Invariante `musician_id == sub` / `audience_id == sub` continua valendo aqui, ver [business-rules.md](../business-rules.md).

O mobile trata o caso "login social sem role" numa store transiente (nunca grava em `auth.store` com roles vazias) ate o usuario escolher o papel e este endpoint responder com sucesso.

## Evolucao futura

Quando o produto evoluir para B2B/enterprise, reavaliar:

- Keycloak Organizations em versoes mais novas;
- realm por tenant apenas para clientes com isolamento contratual forte;
- automacao de criacao de groups por estabelecimento/banda;
- guards especificos de ownership usando `establishment_ids` e `band_ids`;
- mappers de audience estritos para producao.
