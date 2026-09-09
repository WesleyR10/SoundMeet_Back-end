# Revisão de segurança — SoundMeet (backend + web + mobile)

**Data:** 28/ago/2026
**Escopo:** `soundmeet-backend`, `soundmeet-web`, `soundmeet-mobile` — foco no caminho do
dinheiro (gorjeta, custódia/escrow, saque PIX), autenticação/autorização e superfície HTTP.
**Método:** leitura do código-fonte atual + análise da config do Keycloak + pesquisa de vetores
atuais (OWASP API 2023, MED 2.0 / Resolução BCB 493/2025) + testes dinâmicos contra a stack local.

> ⚠️ **O container `soundmeet-app` roda um build de 14/ago; o código-fonte está em 27/ago (13 dias
> defasado).** Os testes dinâmicos refletem o build antigo (ex.: `POST /webhooks/mercadopago`
> respondeu 404 porque o controller foi criado em 20/ago e não está no build). A fonte de verdade
> desta revisão é a **análise estática do código atual**. Rebuild antes de qualquer teste de
> aceitação de segurança.

---

## Status das correções (28/ago/2026)

| # | Severidade | Status |
|---|-----------|--------|
| A1 (núcleo) | 🔴 | ✅ **Aplicado** — saque usa só a chave cadastrada; `pix_key` removido do corpo. |
| A1 (camada 2) | 🔴 | ✅ **Aplicado** — carência de 24h (`PIX_KEY_CHANGE_COOLDOWN_HOURS`) + notificação push/email + **teto diário por tier (2k/5k) e velocity (5/24h)**, omitidos do catálogo público. Ver seção A1 abaixo. |
| A2 | 🟠 | ✅ **Aplicado** — `default` no switch do VO, `isValidType` guard nos mappers, `as any` removido, teste de regressão. |
| A3a | 🟠 | ✅ **Aplicado** — `@Throttle` dedicado em saque (5/min), troca de chave (5/min), gorjeta (20/min). |
| A3b | 🟠 | ✅ **Aplicado** — `RedisThrottlerStorage` (fail-open) ligado em produção; memória em test/dev. ⚠️ **Validar em staging com Redis real + rebuild** (não exercitável nesta sessão). |
| A4 | 🟡 | ✅ **Aplicado** — `KEYCLOAK_VERIFY_AUDIENCE` travado em `true` em produção. |
| A5 | 🟡 | ✅ **Aplicado** — `queryRawUnsafe`/`executeRawUnsafe` wrappers removidos. |
| A6–A9 | 🟢 | ⏳ Pendentes (menores). |
| M-1 (mobile) | 🟢 | ✅ **Aplicado** — `SaveToSpotifyAction` abre via `openExternalHref` + allowlist do Spotify. |
| A-10 (workers IA) | 🟠 | ✅ **Aplicado** — auth fail-closed (`x-ai-worker-token`) nos dois workers de IA; antes eram abertos a qualquer um na rede. |
| W-1 (web) | 🟠 | ✅ **Aplicado** — headers de segurança (CSP `frame-ancestors`/`X-Frame-Options`/nosniff/Referrer/Permissions/HSTS/COOP) no `next.config.ts`; app antes iframável (clickjacking) sem nenhum header. Ver seção Web abaixo. |

Verificação: `tsc --noEmit` limpo, ESLint limpo, seedcheck limpo; suítes de payment/config/auth/database/throttler
verdes (novos testes: `pix-key.vo.spec.ts`, `redis-throttler.storage.spec.ts`, caso "sem chave cadastrada" no saque).

---

## Veredito geral

A base é **madura em segurança** — muito acima da média. Estão corretos e verificados:

- **Verificação de JWT** (`auth-jwt.verifier.ts`): `alg` fixado em RS256, `kid`/`issuer`/`aud`
  checados, `azp` allowlist, JWKS com cache. Sem downgrade para HS256 em produção (Joi trava
  `AUTH_JWT_VALIDATION_MODE=keycloak`).
- **Claims não forjáveis**: nenhum protocol-mapper do realm emite `roles`; `establishment_ids`/
  `band_ids` vêm de atributos escritos server-side, e o realm não expõe user-profile self-service.
- **Webhooks de pagamento**: Asaas (token constant-time, fail-closed) e Mercado Pago (HMAC
  `x-signature` constant-time, fail-closed, **valor lido da API, nunca do corpo**). Idempotência
  atômica em Postgres (`ProcessedEvent`).
- **Saque PIX** (`WithdrawToPixUseCase`): ordem reserva→provedor, lock `FOR UPDATE`, idempotência
  UNIQUE, aritmética em centavos inteiros, distinção recusa-vs-timeout. Concorrência verificada
  contra Postgres real.
- **BFF web**: 31/31 rotas com `requireEstablishmentAccess`; sessão HttpOnly + SameSite=Lax;
  open-redirect sanitizado; decode otimista só para UI.
- **Mobile**: tokens em `SecureStore` com `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`; sem segredos
  embarcados; allowlist de URL externa com parser manual (RN `URL` diverge da WHATWG).
- **SQL**: todo raw é `Prisma.sql` parametrizado; `ORDER BY` de destaque é expressão constante.
- **CORS/Helmet/Swagger**: allowlist obrigatória em produção, sem localhost; Swagger 404 em prod;
  CSP `default-src 'none'` fora do Swagger.
- ~~**Git**: nenhum `.env`/chave/service-account no histórico dos três repos.~~
  🔴 **ERRADO — corrigido em 29/ago/2026.** `envs/.env.e2e` esteve rastreado de
  `552cec6` (30/dez/2025) a `79ef798` (07/ago/2026), com **sete** valores reais
  (o mais grave é `KEYCLOAK_CLIENT_SECRET`, do client cujo service account tem
  `manage-users`), e os commits estão em `origin/develop` de um repositório
  público. A varredura desta revisão provavelmente olhou `git ls-files`
  (rastreamento atual) em vez do histórico; um `grep` de `re_[A-Za-z0-9]`
  ancorado no início do valor também falharia, porque **há um espaço depois do
  `=`**. Detalhes e plano de rotação em `Docs/ops/incident-response.md` §2.1.

Os achados abaixo são **refinamentos sobre uma base sólida**, não buracos abertos. O nº 1, porém,
é uma decisão de arquitetura de saque que merece atenção antes de ligar dinheiro real.

---

## 🔴 A1 — Saque PIX aceita a chave de destino do corpo da requisição

**Onde:** [`withdraw-to-pix.use-case.ts`](../../src/core/payment/application/use-cases/withdraw-to-pix/withdraw-to-pix.use-case.ts) (`tryReserve`) · [`payment.controller.ts:307`](../../src/nest-modules/payment-module/payment.controller.ts) · [`withdraw-to-pix.dto.ts`](../../src/nest-modules/payment-module/dto/withdraw-to-pix.dto.ts)

**O quê:** o `POST /musicians/:id/wallet/withdraw` recebe `pix_key` no corpo, e o use-case faz:

```ts
wallet.updatePixKey(input.pix_key.key, input.pix_key.type);  // sobrescreve a chave cadastrada
wallet.withdrawFunds(input.amount);                          // e saca para ela, no mesmo request
```

Ou seja: **o destino do dinheiro é definido pela própria requisição de saque**, e ainda sobrescreve
a chave que estava cadastrada. Não há: verificação de titularidade da chave, período de carência ao
trocar de chave, autenticação step-up, teto por saque, nem notificação de "novo destino".

**Cenário de falha:** um token de músico comprometido (device roubado/desbloqueado, token vazado em
log de proxy, malware) vira um único `POST` com `pix_key` = chave do atacante → o cachê custodiado
liberado (`held_balance`→`balance`) é drenado para a conta dele, e a chave legítima é apagada no
caminho. O ownership guard não protege: o atacante **é** o dono do token.

**Contexto que atenua a severidade:** o saldo sacável vem só do **escrow de cachê** — a gorjeta
liquida direto na conta MP do músico e não passa pela carteira. O valor em risco é o cachê retido,
não a receita toda. Ainda assim é dinheiro real, e é exatamente o padrão que a Resolução BCB
493/2025 (MED 2.0) obriga os participantes a mitigar: verificar CPF/CNPJ e consistência do nome
cadastral **antes de registrar/alterar** chave PIX.

**Solução aplicada (28/ago/2026):**
1. ✅ **Saque sempre para a chave já cadastrada na carteira.** `pix_key` removido do corpo do saque;
   o destino é `wallet.pix_key`. Sem chave cadastrada → erro acionável. (`withdraw-to-pix.use-case.ts`,
   `withdraw-to-pix.dto.ts`, `payment.controller.ts`.)
2. ✅ **Carência + notificação ao trocar a chave.** Nova coluna `musician_wallets.pixKeyChangedAt`
   (migration `20260828120000_add_wallet_pix_key_changed_at`); `updatePixKey` grava a data **só quando
   a chave muda** e emite `PixKeyChangedEvent`. O saque bloqueia enquanto a chave está dentro da
   janela `PIX_KEY_CHANGE_COOLDOWN_HOURS` (default 24h; 0 desliga). A notificação sai por **push**
   (`notifications-module`, canal primário do músico) e **email** (`mail-module`, cobre o app fechado),
   com o texto centrado no "se não foi você…".
3. ⏳ **Step-up** (reautenticação/biometria) na troca de chave — recomendado para quando a UI de saque
   entrar; depende do fluxo mobile.
4. ✅ **Teto diário de valor + velocity** (28/ago, decisão de negócio pesquisada — ver
   `Docs/withdrawal-limits-research-2026-08.md`). Por tier em `plan-features.config.ts`:
   `max_withdrawal_per_day_brl` (FREE R$2.000; ESSENTIAL/PRO R$5.000 = limite do Asaas PF) e
   `max_withdrawals_per_day` (5). Aplicado em janela deslizante de 24h, **dentro da transação com o
   lock** (senão dois saques concorrentes furam o teto juntos); conta `PENDING`+`COMPLETED`. 🔴 Os
   dois campos são **omitidos do catálogo público `GET /plans`** (`toPublicMusicianFeatures`) — expô-los
   entregaria o teto exato a quem quer drenar logo abaixo; regressão em `list-plans.use-case.spec.ts`.

> **Contexto:** a rota de saque ainda não tem UI (mobile/web não a chamam), então a camada 2 protege
> um cenário que só fica plenamente alcançável quando a tela de saque virar produto — mas já está de
> pé para quando isso acontecer.

---

## 🟠 A2 — `PixKey` VO não valida titularidade e tem bypass de tipo

**Onde:** [`pix-key.vo.ts`](../../src/core/payment/domain/value-objects/pix-key.vo.ts) · [`musician-wallet.aggregate.ts:127`](../../src/core/payment/domain/musician-wallet.aggregate.ts) · [`withdraw-to-pix.dto.ts`](../../src/nest-modules/payment-module/dto/withdraw-to-pix.dto.ts)

**O quê:**
- O `switch (this.type)` **não tem `default`**: um `type` fora do enum não cai em nenhum `case` e a
  chave passa **sem validação nenhuma**. E o agregado chama `new PixKey(key, type as any)` — o `as
  any` desliga a checagem de tipo do TS que barraria isso em compilação.
- A rota de saque valida `pix_key` com `@IsString()` (fraco), enquanto a rota dedicada usa
  `@IsIn(["cpf","cnpj","email","phone","random"])`. Duas portas para o mesmo dado, com força
  diferente.
- Mesmo com formato válido, a validação confere só **sintaxe** (regex), nunca se a chave pertence ao
  músico. Uma chave de terceiro válida passa.

**Solução recomendada:**
1. `default: throw new InvalidArgumentError("Tipo de chave PIX inválido")` no `switch`, e trocar
   `type as any` por coerção validada (parse do enum, lançando em valor desconhecido).
2. Unificar a validação: a rota de saque deve usar o mesmo `@IsIn` da rota dedicada — ou, seguindo
   A1, deixar de aceitar `pix_key` no saque.
3. Titularidade: quando houver integração de verificação (DICT/consulta de chave), validar que o
   nome/CPF da chave bate com o do músico antes de aceitar. Enquanto não houver, restringir a chave
   a tipos amarrados à identidade (CPF do próprio músico) é a mitigação pragmática.

---

## 🟠 A3 — Rate limit em memória e sem regra dedicada nas rotas de dinheiro

**Onde:** [`app.module.ts:66`](../../src/app.module.ts) (ThrottlerModule sem storage) · [`user-throttler.guard.ts`](../../src/nest-modules/shared-module/guards/user-throttler.guard.ts) · [`payment.controller.ts`](../../src/nest-modules/payment-module/payment.controller.ts) (sem `@Throttle`)

**O quê:**
- O `ThrottlerModule` não define `storage` → usa o **armazenamento em memória do processo**. Com
  mais de uma instância do NestJS (o próprio projeto já usa Redis IO adapter para escalar Socket.io
  horizontalmente — ver memória `project-websocket-redis-note`), cada instância tem seu próprio
  balde: o limite efetivo vira `RATE_LIMIT_MAX × Nº de instâncias`, e um reinício zera as contagens.
- As rotas de dinheiro (`withdraw`, `tips`, `pix-key`) herdam só o limite **global** (100/min). Não
  há `@Throttle` mais estrito nelas, como há em `login`/`register` (5–10/min).

**Solução recomendada:**
1. Trocar o storage do throttler por Redis (`@nest-lab/throttler-storage-redis` ou o storage do
   `@nestjs/throttler` sobre o Redis que já existe). Torna o limite real em cluster.
2. `@Throttle` dedicado e apertado nas rotas de dinheiro (ex.: saque 3/min, troca de chave 3/min).
3. O `UserThrottlerGuard` (por `sub` verificado, fallback IP) já é bom — mantê-lo; o ganho é o
   storage compartilhado.

---

## 🟡 A4 — `KEYCLOAK_VERIFY_AUDIENCE` pode ser desligado em produção

**Onde:** [`config-module.module.ts`](../../src/nest-modules/config-module/config-module.module.ts) (`CONFIG_AUTH_SCHEMA`)

**O quê:** em produção o `default` de `KEYCLOAK_VERIFY_AUDIENCE` é `true`, mas nada **impede** setar
`false`. Diferente de `AUTH_JWT_VALIDATION_MODE`, que é travado em `keycloak` via `.valid(...)`.
Com a checagem de audience desligada, qualquer client do realm (inclusive um de integração) emite
token aceito por esta API — token confusion, exatamente o que `assertKeycloakClient` existe para
barrar.

**Solução recomendada:** em produção, forçar `Joi.boolean().valid(true)` (não só default), como já
é feito com o modo de validação. Mesmo tratamento para garantir que `KEYCLOAK_AUDIENCE` esteja
presente quando a verificação está ligada.

---

## 🟡 A5 — Helpers `queryRawUnsafe`/`executeRawUnsafe` públicos sem chamadores

**Onde:** [`prisma.service.ts:135`](../../src/nest-modules/database-module/prisma/prisma.service.ts)

**O quê:** `executeRaw(sql, ...values)` e `queryRaw(sql, ...values)` expõem
`$executeRawUnsafe`/`$queryRawUnsafe` como API pública do `PrismaService`. **Nenhum código de
produção os chama** hoje (só testes). É uma arma carregada: o próximo dev que precisar de SQL cru
tem, ao alcance, o caminho que concatena string — e o resto do repo usa `Prisma.sql` justamente para
nunca fazer isso.

**Solução recomendada:** remover os dois métodos (ninguém usa) ou, se houver intenção de mantê-los,
torná-los privados/`@internal` e documentar que só aceitam SQL sem interpolação de input. Diff
mínimo: apagar.

---

## 🟢 Menores / informativos

- **A6 — Gorjeta sem teto.** `SendTipDto.amount` é `@Min(1)` sem `@Max`. É o próprio fã pagando
  (baixo risco), mas um `@Max` razoável evita typo de R$ 9.999.999 e abuso. `pix-key.vo`/`Money` já
  barram frações de centavo.
- **A7 — Código de verificação de contrato.** Confirmar que o `verification_code` (ex.:
  `SM7K2Q9XPT`) é gerado com entropia suficiente e não é sequencial/enumerável — a rota é `@Public()`
  e, mesmo com nomes mascarados, enumerar revela quem contratou quem e datas. (Não verifiquei a
  geração nesta passada.)
- **A8 — Dependências.** Backend: `deepmerge-ts` (via `@prisma/config`) — advisory de stack
  exhaustion, **build-time**, não exposto a request; baixo. Mobile: `postcss`/`js-yaml`/`image-size`
  — todas **build-time** (Metro/Expo), não rodam no dispositivo; baixo. `npm audit fix` quando
  conveniente, sem `--force`.
- **A9 — Operacional (não é do código): container defasado 13 dias.** Rebuild do `soundmeet-app`
  antes de qualquer validação. Reforça a nota de memória `project-backend-runtime-pitfalls`.

---

## Sugestão de ordem de ação

1. **A1 + A2** juntos (é o mesmo fluxo de saque/chave) — decisão de produto primeiro, depois código.
2. **A3** (Redis no throttler) — pequeno e alto retorno.
3. **A4** (travar audience em prod) — uma linha de Joi.
4. **A5** (apagar helpers raw) — diff mínimo.
5. **A6–A9** — oportunístico.

---

## Auditoria do mobile (`soundmeet-mobile`) — 28/ago/2026

Mesma metodologia (ler → analisar → vetores → tentar explorar). **Veredito: superfície de segurança
excepcional** — a maioria dos vetores tem defesa de altíssima qualidade e documentada. Verificados e
sólidos:

- **Canal (SM-017):** `config/env.ts` é gate de boot — HTTPS/WSS obrigatório fora de dev, allowlist
  de host em **constante de código** (não env), parser de origem manual (não `new URL()`) que
  descarta `user:senha@` e usa `endsWith('.'+domain)`. `__DEV__` é o piso; ausência resolve para o
  ambiente mais restrito.
- **Auth (Keycloak):** Authorization Code + **PKCE** (`expo-auth-session`), refresh com fila de
  concorrentes e logout reativo, `revoke` best-effort. `decodeJwt` sem verificar assinatura é
  **decode otimista só para UI** — token vem do Keycloak por TLS e o backend revalida via JWKS a cada
  chamada.
- **Tokens:** `SecureStore` com `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`; nenhum `AsyncStorage`/`MMKV`
  para dado sensível (só SecureStore em todo o app); zero segredo embarcado (client Keycloak é
  público).
- **Deep links / QR universal:** `qr-link.ts` valida host por **igualdade exata** e é anti-userinfo;
  App Links com `autoVerify` restritos a `/musico` e `/local`; `useDeepLinkListener` roteia por
  relay sem confiar no payload.
- **Links externos (SM-025):** `external-url.ts` é defesa de primeira linha — bloqueia downgrade
  `http:`, `javascript:`/`intent:`/`file:`/`data:`, userinfo, homógrafos e `%`-encoding no host;
  `openExternalUrl` é o único ponto que entrega URL ao SO, com confirmação nomeando host desconhecido.
- **OAuth de dinheiro (Mercado Pago / Spotify):** a `authorization_url` vem da API (com `state`
  assinado) e é aberta em Chrome Custom Tab — o app **não constrói** a URL.
- **Sockets:** token lido por callback a cada (re)conexão (nunca stale), `transports: ['websocket']`
  (wss em prod); backend valida o handshake.
- **Sem WebView** (o contrato é renderizado nativamente) e **sem logs de dado sensível**
  (token/senha/PIX/CPF).

### 🟢 M-1 — um `Linking.openURL` escapa da allowlist (defesa-em-profundidade)

**Onde:** `soundmeet-mobile/src/features/audience/ui/components/SaveToSpotifyAction.tsx` (`openInSpotify`).

**O quê:** é o **único** `Linking.openURL` do app que não passa por `resolveExternalUrl`/
`openExternalUrl`. A URL (`song.spotify_url`) vem da nossa API (resolvida via Spotify oficial →
`https://open.spotify.com/...`), então o risco real é **baixo** — mas quebra o invariante que o
próprio `external-url.ts` afirma ("nenhuma URL de terceiro chega ao SO sem passar por aqui"). Se um
dia o `spotify_url` do "tocando agora" vier adulterado, abriria destino arbitrário no SO.

**Correção recomendada (diff mínimo):** abrir via
`openExternalUrl(buildSocialUrl('spotify', spotifyUrl))` — ou `openExternalHref(spotifyUrl,
SOCIAL_DOMAINS.spotify)` —, alinhando ao padrão do resto do app.

### Consideração (não é achado)

- **Certificate pinning ausente.** Para um app que trafega senha (Direct Access Grant no login) e
  JWT, pinning é uma camada extra contra MITM com CA comprometida/instalada. TLS + allowlist de host
  já dão boa proteção e muitos apps financeiros BR não fazem pinning; fica como melhoria opcional, a
  pesar contra o custo de manutenção (rotação de cert quebra o app se o pin não for atualizado).

---

## Backend não-dinheiro — workers de IA (A-10) — 28/ago/2026

### 🟠 A-10 — os workers de IA não tinham autenticação de entrada

**Onde:** `ai-cifra-mir-worker/app/main.py` (`/v1/analyze`, `/v2/analyze`, `/v1/align-lyrics`) e
`soundmeet-audio-separation/app/main.py` (`/v1/separate`).

**O quê:** ambos os serviços FastAPI aceitavam requisições de processamento **sem nenhuma
autenticação** (nenhum `Depends`/`Header`/token/middleware). Cada endpoint recebe um
`input_object_key` do corpo e baixa esse objeto do bucket (`soundmeet-media`) com as **credenciais
S3/MinIO do próprio worker** — sem verificar quem chamou nem se o key pertence a quem chamou. O
worker é **HTTP-only** (não consome RabbitMQ; o default de transport é `http`), então esse endpoint
é o único caminho de processamento em qualquer configuração.

**Exposição:** o `docker-compose.yml` de dev **publica as portas** dos workers em `0.0.0.0`
(`8001:8000`, `8002:8000`, `8000:8000`). Em produção os workers vivem num host de GPU configurado
**à mão** (não versionado) — nada no código impede publicar as portas como o dev faz.

**Cenário de falha:** qualquer um com acesso à rede (ou um SSRF/container comprometido do lado de
dentro) faz `POST /v1/analyze {"input_object_key":"<key arbitrário>"}` e:
- confirma existência e deriva informação (acordes) de **qualquer** objeto do bucket — mídia de
  outros usuários, etc.;
- no ai-audio, dispara separação de stems e **grava** stems de volta no bucket (`output_prefix`);
- esgota GPU/CPU (DoS) com jobs pesados ilimitados.

**Correção aplicada:** shared secret `AI_WORKER_TOKEN` (header `x-ai-worker-token`).
- **Backend** (`config.schema.ts` + Joi *required em produção*): os dois HTTP clients
  (`ai-cifra-analysis-http.client.ts`, `ai-audio-separation-http.client.ts`) enviam o header quando
  o token está configurado; providers passam o valor da config. Teste de regressão em
  `ai-cifra-analysis-http.client.spec.ts`.
- **Workers** (`require_worker_token`, FastAPI dependency): validam o header com **comparação
  constant-time** (`hmac.compare_digest`), aplicado aos endpoints de processamento (não a `/health`).
  🔴 **Fail-closed:** sem `AI_WORKER_TOKEN` no ambiente, o worker recusa todo processamento (503) em
  vez de ficar aberto — mesmo princípio dos webhooks. O erro é visível (a IA para), nunca silencioso.
- **Infra:** `docker-compose.yml` injeta o mesmo valor nos 4 serviços (default de dev
  `dev-worker-token`, funciona out-of-the-box); `.env.example`/`.env.production.example` e o
  `smoke-test-prod.sh` atualizados.

**Notas de defesa que já estavam certas (não eram o furo):**
- `execFile`/`subprocess.run` usam **arrays de argumentos** (sem shell) em todo o caminho de
  produção — `nvidia-smi`, `ffmpeg` e `yt-dlp` não são vetores de command injection.
- O `youtube_video_id` vai por `encodeURIComponent` numa URL `https://` fixa do YouTube: não vira
  flag nem argumento separado (sem argument injection).
- `object_key` vai como `Key` do boto3 (parâmetro de API S3), não como caminho de shell/URL — o
  problema era **autorização**, não injeção.
- ⚠️ **Deploy:** ao compor o host de GPU em produção, setar `AI_WORKER_TOKEN` (igual ao do backend).
  Sem ele, os workers respondem 503 — de propósito.

---

## Auditoria do web (`soundmeet-web`) — 29/ago/2026

Cobertura: camada BFF (`/api/bff/*`), rotas públicas (`/api/public/audience/*`,
`register-establishment`), fluxo OAuth (`/api/auth/*`), o `proxy.ts` (ex-middleware), a sessão
(estabelecimento e audience) e as páginas SSR públicas (`/musico/[id]`, `/local/[id]`,
`/evento/[id]`, `/contrato/[codigo]`).

**Veredito: superfície excepcionalmente sólida.** O desenho do BFF é o que uma revisão espera e
raramente encontra:

- **Token só do cookie httpOnly, nunca de input.** `withAuth` injeta o `Authorization` **depois** do
  spread — um `Authorization` vindo do chamador é descartado, não sobrescreve a sessão. O
  `serverHttpClient` é `server-only` (quebra o build se importado no cliente) e a `baseURL` é fixa da
  env — sem SSRF por base controlada pelo cliente.
- **`requireEstablishmentAccess` em 30/30 rotas** `/api/bff/establishments/[id]/**` (verificado por
  varredura). Lança em vez de retornar booleano — um esquecimento falha fechado, não aberto.
- **Escopo de sub-recurso cruzado onde há PII/dinheiro:** contrato (`loadScopedContract` → 404 se
  `establishment_id` não bate) nas 5 rotas de contrato, e conversa no `GET`. Onde a rota confia no
  backend (events/campaigns/inquiries/menu-pdf), o use-case do NestJS deriva o `establishment_id` do
  JWT e responde `NotFound` por escopo — e cada rota **documenta** essa dependência.
- **OAuth Authorization Code + PKCE impecável:** `state` de 256 bits gerado no servidor, guardado em
  cookie httpOnly, **uso único** (limpo no retorno) e comparado; `code_verifier` nunca vê o browser;
  `sanitizeReturnTo` barra open-redirect (`//`, `/\`, absoluto) **na escrita e no uso**; erro de
  login não vaza mensagem do Keycloak. Refresh single-flight. Logout **revoga** o token + encerra SSO.
- **Sessão de audience** curta, cookie próprio (`sm_audience_at`), sem refresh — decisão consciente e
  documentada (o token nasce para o client `soundmeet-mobile`, refresh por `soundmeet-web` daria
  `invalid_grant`). `httpOnly`, `secure` derivado do protocolo, `sameSite=lax` — que também é a
  defesa de CSRF das rotas POST do BFF.
- **IDs do corpo validados como `z.uuid()`** antes de virarem path/payload upstream (tips,
  music-requests) — o cliente HTTP arbitrário não injeta caminho.
- **Sem sink de XSS:** o único `dangerouslySetInnerHTML` (JSON-LD) escapa `<`→`<`; o resto é
  auto-escapado pelo React. Links externos passam por allowlist (`external-url.ts`, gêmeo do mobile:
  bloqueia downgrade `http:`, `javascript:`, userinfo `@`, homógrafo) e toda âncora `target="_blank"`
  tem `rel` com `noopener`.
- **Upload de menu-pdf:** o backend valida a **assinatura** do arquivo (magic bytes via `file-type`);
  as checagens do BFF são conveniência e estão rotuladas como tal.

### 🟠 W-1 — Ausência total de cabeçalhos de segurança HTTP ✅ Aplicado

**O furo.** O `next.config.ts` não enviava **nenhum** header de segurança em nenhuma rota: sem CSP,
sem `X-Frame-Options`, sem `nosniff`, sem `Referrer-Policy`, sem HSTS. O `soundmeet-web` é um
dashboard **autenticado por cookie** que executa ações sensíveis e de efeito jurídico — **assinar
contrato**, cancelar assinatura, excluir evento, enviar mensagem. Sem `frame-ancestors`/
`X-Frame-Options`, qualquer página de terceiro podia colocar o dashboard num `<iframe>` e sobrepor um
chamariz: **clickjacking** dessas ações de um clique. Não havia sink de XSS hoje, mas também não havia
CSP para conter um amanhã — e um XSS neste app permite chamar o próprio BFF como o usuário (ler
contrato com CPF/cachê, cancelar plano), já que o cookie é `sameSite=lax` e as chamadas são
same-origin.

**Correção aplicada** (`next.config.ts`, `headers()` para `/:path*`, com regressão em
`src/shared/config/__tests__/security-headers.spec.ts`):

- `Content-Security-Policy: base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'`
- `X-Frame-Options: DENY` (reforço legado do anti-clickjacking)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains`
- `Cross-Origin-Opener-Policy: same-origin`

> 🔴 **CORREÇÃO (01/set/2026) — a premissa do parágrafo abaixo estava ERRADA.**
> Ele afirma que a CSP com nonce "torna as páginas do funil público dinâmicas,
> revertendo a otimização estática que o código fez de propósito". **Não existe
> otimização estática a reverter.** O `next build` marca `/musico/[id]`,
> `/local/[id]`, `/evento/[id]` e `/contrato/[codigo]` como
> `ƒ (Dynamic) — server-rendered on demand`: elas buscam dado por requisição,
> sem `generateStaticParams` e sem `revalidate`. As únicas rotas estáticas do
> app são `/robots.txt` e `/sitemap.xml`, e o `matcher` do `proxy.ts` já as
> excluía. O que confundiu foi o JSDoc de `MusicianProfilePage`, que fala em
> fetch bloqueante **para o `notFound()` produzir 404 real** — isso é sobre
> streaming e `loading.tsx`, não sobre geração estática.
>
> W-2 foi implementado em 01/set/2026 como mudança normal, **sem nenhuma
> alteração de modo de render**. Ver `shared/config/csp.ts`.
>
> É o segundo veredito desta revisão que não sobreviveu à verificação (o outro é
> o do histórico git, §"Veredito geral").

🔴 **O que a CSP deliberadamente NÃO faz (e por quê).** Não há `script-src`/`default-src` restritivo.
O Next injeta `<script>` **inline** de hidratação (`self.__next_f`); travar `script-src 'self'` sem
nonce quebraria a hidratação da página inteira, e `default-src 'self'` bloquearia os avatares do
CloudFront (host por deploy) e os estilos inline. A defesa completa de script exige **CSP com nonce
por requisição** gerada no `proxy.ts` — o que torna as páginas do funil público (`/musico/[id]`)
**dinâmicas**, revertendo a otimização estática que o código fez de propósito (JSDoc de
`MusicianProfilePage`: fetch bloqueante para `notFound()` dar 404 real ao Google). Isso é uma decisão
de arquitetura de render, não um ajuste de header — ficou registrada como **próximo passo (W-2)** — implementado em
01/set/2026, ver a correção acima. As diretivas aplicadas agora fecham o clickjacking (o risco concreto) sem
tocar no modo de render.

### Consideração (não é achado novo)

- **Rate limit por IP colapsa no IP do servidor web** para as rotas **anônimas** (`register-establishment`,
  audience) — toda chamada sai deste servidor, então o `@Throttle` do backend vira global do app. Já
  está **documentado no próprio código** (comentário em `register-establishment/route.ts`) e é a
  mesma classe do SM-027; a correção é de deploy (backend `trust proxy` + `getTracker`), e por serem
  rotas anônimas não há `sub` de JWT para chavear (diferente do SM-027). Decisão de deploy em aberto,
  não regressão.

**Verificação:** `next typegen && tsc --noEmit` limpo, ESLint limpo, `security-headers.spec.ts` 4/4
verdes.
