# Roadmap de Implementação — SoundMeet

Documento de consulta contínua: **próxima tarefa = primeiro item `[ ]` da lista abaixo**.  
Estado detalhado por regra de negócio: [business-rules.md](business-rules.md).

---

## Estado atual (jun/2026)

### Core (`src/core`) — ✅ sólido

`musician` · `establishment` · `audience` · `request` · `gamification` · `payment` · `scheduling` · `events` · `music-library` · `synced-lyrics` · `ai-audio` · `ai-cifra` · `shared`

### NestJS — parcial

| Módulo                                                                                                                              | Status                                       |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| config, database, shared, musicians, audiences, requests, gamification, establishments, scheduling, events, ai-cifra, synced-lyrics | ✅                                           |
| ai-audio-module                                                                                                                     | ✅ registrado em `app.module.ts`, onModuleDestroy implementado |
| rabbitmq-module                                                                                                                     | ✅ backoff exponencial, DLX logging, x-delayed-message health check, soundmeet.events exchange |
| **payment-module**                                                                                                                  | ✅ HTTP completo + testes de integração      |
| **auth-module**                                                                                                                     | ✅ JWT/JWKS validado, guards aplicados — falta enforcement ownership (Bloco 4B) |
| **music-library-module**                                                                                                            | ✅ controller, providers, service, DTOs e testes criados |
| **plans-module**                                                                                                                    | ✅ `PlanCheckService`, `PlansModule`, `SubscriptionPrismaRepository`, `plan-features.config.ts` |
| **campaign-module**                                                                                                                 | ✅ domínio + repositórios + `CreateCampaignUseCase` + controller + Prisma schema |

---

## Passo a passo — próximas tarefas

Marque `[x]` conforme concluir. **Não pule a ordem** dentro de cada bloco salvo dependência explícita.

### Bloco 1 — Pagamentos (bloqueio de produto) 🔴

> Gorjetas existem no domínio, mas sem API HTTP o fluxo público→músico não fecha em produção.

- [x] **1.1** Criar `src/nest-modules/payment-module/` (module, providers, controller, presenter, DTOs)
- [x] **1.2** Endpoints: `POST /tips` (SendTip), `POST /tips/:id/confirm` (ConfirmTipPayment)
- [x] **1.3** Endpoints: `GET /musicians/:id/wallet`, `POST /musicians/:id/wallet/withdraw` (WithdrawToPix)
- [x] **1.4** Registrar `PaymentModule` em `app.module.ts`
- [x] **1.5** Testes de integração dos endpoints (happy path + validação 422)
- [~] **1.6** Substituir `PixGatewayMock` por gateway PIX real (adapter + env vars) — 🟡 **gorjeta
      redecidida e implementada em 19/ago/2026.**
  - **Gateway da gorjeta virou o Mercado Pago**, não o Asaas. Quando o Asaas foi escolhido a taxa PIX
    era **R$0,99 fixos**; hoje é **R$1,99**, e taxa fixa sobre ticket de R$5–60 inverte a economia:
    no plano FREE (9%) o ponto de equilíbrio vai para **R$22**, então toda gorjeta de bar dá
    prejuízo. O MP cobra **0,99% sem piso**. A Iugu nunca liberou a conta
  - **Roteamento é POR VÉRTICE, nunca por valor.** O cruzamento MP × Asaas é R$201 e o ticket é
    R$5–100 — rotear por valor economizaria centavos ao custo de onboarding dobrado (dois KYC no
    momento da monetização) e dois saldos em dois lugares
  - 🔴 **A Woovi era a mais barata e foi descartada por um motivo REGULATÓRIO, não comercial:** a
    "subconta" dela é **saldo virtual dentro da conta da plataforma** — a doc é literal (*"transações
    de split para sub contas são transações virtuais... somente será debitado no momento do saque"*),
    e não exige KYC do beneficiário. É exatamente o caminho (i) recusado em
    `payment-gateway-decisions.md`, e tornaria falsa a cláusula `papel_da_plataforma.com_custodia`
  - **Implementado:** `MercadoPagoPixGateway` (cobrança criada na conta DO músico via OAuth, comissão
    por `marketplace_fee` na Orders API), vínculo OAuth cifrado em repouso na `MusicianWallet` (`mpUserId` +
    access/refresh tokens, infra de SM-016), `WalletMercadoPagoAccountResolver`, e o roteamento no
    provider `PixGateway` com fallback para o mock — nunca para o Asaas, porque cair em silêncio num
    gateway que perde dinheiro por transação é pior que cair num mock que grita
  - **`splitAmountInCents` virou util compartilhado** entre gorjeta e cachê: 9% de R$333,33 em ponto
    flutuante dá 29,999700000000004 e o `Money` recusa
  - **Vínculo OAuth completo (19/ago/2026):** `POST /musicians/:id/mercadopago/connect` (URL de
    autorização com `state` **assinado**), callback `@Public()` em **controller separado**
    (`MercadoPagoCallbackController` — a armadilha do `@Public()` solto já registrada no contrato),
    `DELETE /musicians/:id/mercadopago`, e `RefreshMercadoPagoTokensJob` diário com **15 dias de
    folga** sobre os 180 do token
  - **`OAuthStateService` virou compartilhado** (`core/shared/infra/crypto/`), com o Google Calendar
    migrado junto — duas cópias de uma verificação de assinatura divergiriam na primeira correção
    que só uma recebesse. O `purpose` (`mp_connect` × `gcal_connect`) é o que impede um `state`
    emitido no fluxo de agenda de ser aceito no fluxo que vincula conta que **recebe dinheiro**
  - **Webhook `payment.updated`** (`POST /webhooks/mercadopago`): valida `x-signature` (HMAC com
    manifesto `id;request-id;ts`, comparação constant-time, **fail-closed** sem segredo), resolve
    `user_id` → carteira → token do músico, e **lê o valor da API** — nunca do corpo, senão qualquer
    POST confirmaria gorjeta de R$1.000. Idempotente pelo ledger `ProcessedEvent`
  - 🔴 **`marketplace_fee` = percentual do plano MENOS a taxa do gateway.** No marketplace do MP a
    taxa dele sai do bruto **antes** da nossa comissão — pedir os 9% cheios debitaria 9,99% do
    músico num plano que anuncia 9%. A tabela promete "(1% gateway incluso)", e agora o código
    cumpre: em R$20, `marketplace_fee` = R$1,60 e o total retido é exatamente R$1,80
  - ⚠️ **Correção (19/ago/2026): NÃO falta "UI de vínculo no web".** O `soundmeet-web` é exclusivo do
    persona **estabelecimento** (decisão de produto — o `CLAUDE.md` dele é explícito, e o
    `/dashboard` inteiro é do dono do bar). Vincular Mercado Pago é ação do **músico**, que não tem
    área autenticada no web; o `/musico/[slug]` é só perfil público SSR. Construir isso ali exigiria
    criar um dashboard de músico deliberadamente excluído do produto
  - 🔴 **Duas correções feitas em 20/ago/2026, achadas ao revisar se "o pagamento está correto":**
    - **Crédito duplo.** `ConfirmTipPaymentUseCase` fazia `wallet.receiveFunds()` sempre. Com o
      split do MP o dinheiro **já está** na conta do músico — creditar `balance` criava saldo
      sacável de valor que a plataforma nunca recebeu, e o saque sai do `AsaasGatewayAdapter`, ou
      seja, **do nosso caixa**. Um músico com R$1.000 em gorjetas sacaria R$1.000 nossos. Agora o
      input exige `settlement: "beneficiary" | "platform"` (obrigatório, sem default — o `tsc`
      forçou os 3 chamadores a declarar), e `"beneficiary"` usa
      `MusicianWallet.recordExternalEarning()`, que cresce `total_earned` **sem tocar `balance`**
    - **Gorjeta de banda quebrada.** `beneficiary_musician_id` ia `input.musician_id ?? null`, que
      é `null` em gorjeta de banda → o adapter recusava **toda** gorjeta de banda. O comentário
      prometia "liquida na conta do líder" e o código não entregava. `SendTipUseCase` ganhou
      `bandRepo` e resolve o líder (`resolveBeneficiary`) — banda não tem conta no provedor, o
      vínculo OAuth é sempre de uma pessoa. A **divisão** entre integrantes segue na confirmação

#### 🔴 Pré-condição do bloco MP — rebuildar o container (achado em 29/ago/2026)

O `soundmeet-app` roda **imagem buildada**, não o código do disco. Em 29/ago a imagem em execução
era de **14/ago** e `POST /api/v1/webhooks/mercadopago` respondia **404** — a rota existia no código
e no `payment.module.ts`, mas não no container. Qualquer tentativa anterior de "testar a gorjeta"
mediu código de duas semanas atrás, o que é **pior que não testar**: dá resultado, e o resultado é
falso. `docker compose build app && docker compose up -d app` antes de qualquer item MP.4–MP.8.

#### Depois de pegar as chaves da API do Mercado Pago

> Credenciais em [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers).
> App canônica: **SoundMeetPIX (`7348187308113120`)**, homologada em 29/ago/2026.
> A app **SoundMeet (`2780871563698928`)** ficou leftover — produção inativa; o
> vendedor de teste `3629491815` nasceu nela. Não misturar `client_id` /
> `webhook_secret` / token entre as duas. Mapa: [ops/domain-soundmeet-com-br.md](ops/domain-soundmeet-com-br.md).
>
> 🔴 **`soundmeet.com.br` comprado na Hostinger em 29/ago/2026** (apex resolve
> para parking `2.57.91.91`). Desde 07/set/2026 é **também o host do QR** — o
> `soundmeet.app` anterior é de terceiro e saiu. Rebuildar o mobile só depois de
> o DNS responder e o `assetlinks.json` sair 200.

- [x] **MP.1a** `MERCADOPAGO_CLIENT_ID` da SoundMeetPIX no `envs/.env`.
      `MERCADOPAGO_PLATFORM_ACCESS_TOKEN` e `MERCADOPAGO_PUBLIC_KEY` estão
      preenchidos com credenciais **TEST-** e **não são lidos pelo código** —
      a cobrança usa o token OAuth do músico. Public Key só serviria para
      tokenizar CARTÃO no cliente; a gorjeta é PIX puro.
- [x] **MP.1b** `MERCADOPAGO_CLIENT_SECRET` da SoundMeetPIX (só existe em
      credenciais de produção; o OAuth de sandbox também usa esse secret — desenho
      do MP). `MERCADOPAGO_WEBHOOK_SECRET` é o da **PIX** (`13e799e…`), não o da
      app SoundMeet (`b2a8882…`) — a sessão anterior deixou o secret velho no
      `.env` e todo HMAC caía em `signature_mismatch`.
- [ ] **MP.1c** Cadastrar `MERCADOPAGO_REDIRECT_URI` em "Suas integrações" →
      SoundMeetPIX → Configurações da aplicação → URLs de redirecionamento
      (**não é IPN**). 🔴 O MP exige HTTPS; `http://localhost` não salva.
      Túnel vivo em 29/ago:
      `https://default-andreas-patterns-suspension.trycloudflare.com/api/v1/musicians/mercadopago/callback`.
      ⚠️ Quick tunnel sorteia hostname a cada start. Túnel nomeado
      (`api.soundmeet.com.br`) exige zona na Cloudflare — passo a passo no doc
      do domínio. **Não há MCP que edite redirect URI de app já criada.**
- [x] **MP.2** Webhook sandbox da SoundMeetPIX →
      `POST /api/v1/webhooks/mercadopago`, tópicos **`payment` + `order`**.
      `order` é ignorado com 200 (o controller só confirma `type=payment`).
      **IPN não se configura** — a doc do MP descontinua e não valida secret.
      Produção do webhook: **não** apontar para o túnel.
      ✅ HMAC conferido: sem assinatura / assinatura de outro secret → 403;
      secret da PIX → passa da assinatura.
- [x] **MP.3** 🔴 **Bug real encontrado e corrigido em 20/ago/2026** — o comentário em
      `mercadopago-oauth.gateway.ts` já dizia que faltava `offline_access` e o parâmetro nunca
      chegou a existir em `buildAuthorizationUrl`: nenhum músico conseguiria vincular a conta
      (`toTokens` falha alto sem `refresh_token`, então TODO vínculo quebraria no `exchangeCode`).
      Corrigido com `scope: "offline_access"` no `URLSearchParams`; zero testes cobriam esse
      adapter, então o bug não aparecia em nenhuma suíte — `mercadopago-oauth.adapter.spec.ts`
      criado, cobrindo URL, troca de código, refresh e leitura de pagamento
- [ ] **MP.4** Fluxo ponta a ponta em sandbox: conectar conta → gorjeta → webhook → gorjeta
      `completed`. **Conferir na conta de teste do músico que o valor caiu lá**, e na nossa que
      entrou só o `marketplace_fee` — é a prova de que o dinheiro não passa pela plataforma.
      ⚠️ O vendedor `3629491815` tem que **autorizar a SoundMeetPIX** (OAuth). Reusar o
      `APP_USR-` antigo da app SoundMeet como se fosse da PIX é a identidade errada.
      ⚠️ `POST /v1/orders` recusa credencial `TEST-` da app (`invalid_credentials`).
      Provado 29/ago: o mesmo endpoint com `APP_USR-` de test user devolveu **201 + QR PIX**.
      Não migrar o gateway para Payments API por causa disso.
- [x] **MP.5** Aritmética no código, R$20: FREE `marketplace_fee` **R$1,60** (total
      retido R$1,80 = 9%); ESSENTIAL **R$1,20**; PRO **R$0,80**. Testes em
      `mp-marketplace-fee.spec.ts` e `send-tip.use-case.spec.ts`. Falta o gateway
      confirmar o mesmo número num pagamento real (MP.4).
- [ ] **MP.6** Testar **gorjeta de banda** — é o caminho que estava quebrado até 20/ago e o único
      que depende de resolver o líder
- [ ] 🟡 **MP.6a** (achado em 20/ago, decisão de produto pendente, não é bug de código) Na gorjeta de
      banda via MP, o valor inteiro cai **só na conta do líder** — banda não tem conta própria no
      provedor. `ConfirmTipPaymentUseCase.confirm` mesmo assim roda `recordExternalEarning(share)`
      para **cada** integrante, como se cada um tivesse recebido dinheiro externo de verdade. O
      resultado é um `held`/`total_earned` por integrante que não corresponde a nenhum PIX real
      recebido por ele — é o líder quem tem de repassar manualmente. Sob o modelo antigo
      (`settlement: "platform"`) isso era inofensivo porque a plataforma de fato detinha o valor e
      podia honrar o saque de cada um; sob o split do MP não há essa garantia. Decidir: (a) manter
      como está e deixar claro na UI que é "sua parte a cobrar do líder", (b) só registrar o
      `recordExternalEarning` para o próprio líder e mostrar aos demais membros um aviso separado,
      ou (c) bloquear gorjeta de banda no MP até existir um mecanismo de repasse
- [ ] **MP.7** Testar **músico sem conta vinculada**: a gorjeta deve falhar com
      `MercadoPagoAccountNotLinkedError` (mensagem acionável), não com erro genérico
- [ ] **MP.8** Confirmar a renovação do token: adiantar `mpTokenExpiresAt` no banco para dentro dos
      15 dias de folga e rodar o `RefreshMercadoPagoTokensJob`
- [ ] 🔴 **MP.9** Levar ao advogado as perguntas de
      [contract/legal-checklist.md](contract/legal-checklist.md) §10 "Antes da gorjeta em produção"
      — enquadramento do split, limiar de volume e natureza da comissão
- [~] **1.7** Webhook/callback de confirmação PIX + idempotência — gorjeta: `MercadoPagoWebhookController` (`POST /webhooks/mercadopago`) com `x-signature` fail-closed + `processOnce`. Asaas: `AsaasWebhookController` (`POST /webhooks/asaas`) com `TRANSFER_DONE`/`TRANSFER_FAILED`; handler de escrow `PAYMENT_RECEIVED` ainda pendente
- [x] **1.8** Evento de domínio `TipCompleted` → handler gamificação (pontos por gorjeta) — `PaymentEventsHandlers` com `processOnce()`, `DomainEventMediator` injetado no use case, `TipCompletedIntegrationEvent` publicado no exchange `soundmeet.events`

**Referência:** core em `src/core/payment/`, regras em [business-rules.md](business-rules.md).

---

### Bloco 2 — QR Code (segurança antes de gamificação real) ✅

> Hoje `validateQRCode` só checa string não-vazia; `musician_id` não valida UUID.

- [x] **2.1** Parser `soundmeet://musician/<uuid>` e `soundmeet://establishment/<uuid>`
- [x] **2.2** Validar UUID (`IsUUID` no DTO + rejeitar formatos inválidos)
- [x] **2.3** Exigir que `musician_id` do body seja **igual** ao UUID extraído do QR
- [x] **2.4** Injetar `IMusicianRepository` — rejeitar id inexistente/inativo antes de pontuar
- [x] **2.5** Unit of Work / transação: `update(audience)` + `insert(userInteraction)` atômicos
- [x] **2.6** Migrar testes de `musician_123` para UUIDs reais; casos: esquema errado, UUID inválido, id divergente, músico inexistente

**Referência:** [qr-code.md](qr-code.md) · rule `.cursor/rules/qr-code-validation.mdc`

---

### Bloco 3 — Módulos Nest órfãos ✅

- [x] **3.1** Registrar `AiAudioModule` em `app.module.ts`
- [x] **3.2** Smoke test: DI wiring de todos os use cases de ai-audio validado
- [x] **3.3** Criar `music-library-module`: CRUD catálogo + ligação com `synced-lyrics-module`
- [x] **3.4** Endpoints mínimos: list/search/get `music-library`, ingest por músico

**Referência:** [AI-musician/chord-sheet.md](AI-musician/chord-sheet.md)

---

### Bloco 4 — Autenticação (antes de escalar) ✅

> Endpoints internos de bulk LRC e ai-cifra precisam guard/token consistente.

- [x] **4.1** Criar `auth-module` com integração Keycloak (JWT/JWKS)
- [x] **4.2** Guards por role: `public`, `musician`, `establishment`, `admin`
- [x] **4.3** Proteger rotas de escrita (POST/PATCH/DELETE) em todos os módulos
- [x] **4.4** Token interno para callbacks de worker (ai-cifra, synced-lyrics bulk, ai-audio)
- [x] **4.5** Rate limit global — `@nestjs/throttler` global via `APP_GUARD`; 100 req/60s por IP (env `RATE_LIMIT_TTL/MAX`); `@SkipThrottle` em `HealthController` e callbacks `@InternalToken` (ai-cifra, ai-audio, synced-lyrics); `@Throttle(10/60s)` nos endpoints de preload pesado

**Referência:** [chord-sheet.md](AI-musician/chord-sheet.md) (Rate limiting e segurança)

---

### Bloco 4B — Enforcement multi-tenant e ownership ✅

> Keycloak já consegue emitir roles e claims de contexto, mas isso ainda não substitui validação de ownership no backend. Role responde “que tipo de usuário é”; ownership responde “quais recursos esse usuário pode operar”.

- [x] **4B.1** `CurrentUserContextGuard` normaliza `userId`, `establishmentIds`, `bandIds`, `organizationId` e `isAdmin` do JWT; decorator `@CurrentUser()` disponível nos controllers. Aplicado como 3º guard na classe de `MusiciansController`, `EstablishmentsController` e `PaymentController`.
- [x] **4B.2** `EstablishmentOwnershipGuard` criado e aplicado nas rotas de escrita de `EstablishmentsController` (PATCH /:id, POST/PATCH/DELETE /:id/profile, DELETE /:id, GET /:id/hiring-dashboard, GET /:id/analytics).
- [x] **4B.3** `MusicianOwnershipGuard` criado e aplicado nas rotas de escrita de `MusiciansController` (PATCH /:id, PATCH /:id/profile, DELETE /:id) e `PaymentController` (POST /musicians/:id/wallet/withdraw).
- [x] **4B.4** Validar `requesting_user_id` nos use cases sensíveis de agenda (`ConfirmBooking`, `CancelBooking`, `AcceptInquiry`, `RejectInquiry`). Pendente: `WithdrawToPix`, eventos, IA, analytics.
- [x] **4B.5** Testes de ownership criados: `ownership.int-spec.ts` cobre 5 cenários por guard (admin bypass, owner ok, acesso cruzado bloqueado, sem id, sem currentUser).
- [x] **4B.6** Documentar convenção de groups no Keycloak em `Docs/auth/keycloak.md` — seções: mapeamento groups→claims JWT, fluxo de autorização 3 camadas, tabela de guards, checklist para nova rota com ownership, convenção de groups por entidade.

**Referência:** [auth/keycloak.md](auth/keycloak.md)

---

### Bloco 4C — Feature Gating (planos premium) 🔒

> **Infraestrutura:** `PlanCheckService`, `PlansModule`, `SubscriptionPrismaRepository`, `plan-features.config.ts`.  
> **Planos fechados (jun/2026):** 3 tiers — FREE / ESSENTIAL (R$34,90/mês) / PRO (R$74,90/mês) para músicos e FREE / GROWTH (R$34,90/mês) / PRO (R$74,90/mês) para estabelecimentos. Preços de lançamento; grandfathered nos planos atuais.  
> **Decisões de design:** pedidos ilimitados em todos os planos (removido gate de request); busca e chat com músicos ilimitados para estabelecimentos.  
> **Taxa de gorjeta:** 9% FREE / 7% ESSENTIAL / 5% PRO (1% gateway incluso). Saque mínimo: R$110 / R$70 / R$50. Prazo: 5 / 3 / 1 dia útil.

- [~] **4C.1** Analytics em tempo real — endpoint `GET /musicians/:id/analytics` ✅. **⚠️ Correção (06/ago/2026, auditoria de gates):** a descrição anterior afirmava que `GetMusicianAnalyticsUseCase` chama `assertMusicianFeature(musician_id, "realtime_analytics")` — **isso nunca foi verdade**. O use-case chama `getMusicianFeatures()` e apenas **reporta** `realtime_available` no output; não há `assert` e nenhum dado é retido. O músico FREE recebe os mesmos `accepted_requests_count`/`rejected_requests_count`/`total_tips_amount`/`top_requested_songs` do PRO. Na prática é um **soft gate**: o diferencial prometido é o stream em tempo real, que também não existe (não há WebSocket de analytics). Decidir se o gate deve ser aplicado de fato ou se a promessa sai da tabela de preços — ver Bloco 9.7
- [x] **4C.2** Saque (withdrawal) — `getMusicianWithdrawalConfig(musician_id)` em `WithdrawToPixUseCase`; mínimos por plano: FREE R$110/5d · ESSENTIAL R$70/3d · PRO R$50/1d
- [x] **4C.3** ~~Busca de músicos por estabelecimento (gate removido — busca ilimitada em todos os planos por decisão de produto jun/2026)~~
- [x] **4C.4** QR Code personalizado — `CustomizeQRCodeUseCase` com `assertMusicianFeature(musician_id, "custom_qr_code")`; `QRCustomization` VO (cores, logo, label); endpoint `POST /musicians/:id/qr-code/customize` (PRO only). **jul/2026: corrigido** — a customização não persistia (coluna faltando no Prisma), não era devolvida no output/presenter, `customizeQRCode()` substituía em vez de fazer merge (perdia logo ao trocar só a cor), e o gate de plano (`PlanLimitExceededError`) caía em HTTP 500 genérico por não ser tratado no `GlobalExceptionFilter` (agora mapeado para 402). Endpoint de upload de logo dedicado adicionado: `POST /musicians/:id/qr-code/logo`. **jul/2026 (2ª rodada, auditoria):** `QRCode.validate()` agora rejeita pares foreground/background de contraste insuficiente (`hasSufficientQrContrast`, fórmula WCAG, `InvalidArgumentError` → 422) — antes nada impedia salvar um QR permanente ilegível; `customizeQRCode()` passou a aceitar `QRCustomizationPatch` (semântica JSON merge patch — `null` remove a chave/reverte ao padrão, ausente mantém), já que o merge-sempre anterior não deixava reverter um campo isoladamente; `CustomizeQRCodeDto.logo_url` só aceita `null` agora (setar uma URL string é rejeitado) — antes o DTO aceitava qualquer URL externa via `@IsUrl()`, contornando a validação de tamanho/mimetype do upload dedicado.
- [x] **4C.5** ~~Acesso à biblioteca musical — `music_library_access: true` em todos os planos por decisão de produto (cifra é core feature)~~
- [x] **4C.6** Gestão de split de banda — `assertMusicianFeature(leader_id, "auto_split_management")` em `AddBandMemberUseCase` ao detectar `role === "leader"` (PRO → até 8 membros)
- [x] **4C.7** Multi-estabelecimento — `assertEstablishmentFeature(establishment_id, "multi_establishment")` em `CreateEstablishmentUseCase` quando `existing_establishment_ids` presentes; hard-limit 3 unidades; PRO only
- [x] **4C.8** Testes de domínio por gate: `CustomizeQRCode`, `GetMusicianAnalytics`, `AddBandMember`, `WithdrawToPix`, `CreateEstablishment`, `CreateCampaign` — (a) FREE bloqueado com `PlanLimitExceededError`, (b) plano pago permitido, (c) subscription cancelada = volta ao FREE
- [x] **4C.9** Debate e fechamento de valores/tiers — concluído jun/2026 (ver decisões no cabeçalho deste bloco)
- [x] **4C.10** Campanhas promocionais — domínio `src/core/campaign/` completo (aggregate, repository, in-memory, Prisma, `CreateCampaignUseCase`); `assertEstablishmentFeature(establishment_id, "promotional_campaigns")` (FREE bloqueado · GROWTH/PRO permitido); `CampaignModule` + controller + Prisma schema (`campaigns` table)


---

### Bloco 4D — Novas funcionalidades premium (implementação)

> Features que diferenciam os planos no produto, decididas no debate de planos (jun/2026).

- [x] **4D.1** **Repertório/Setlist** — domínio `src/core/repertoire/`:
  - [x] **4D.1a** Aggregate `Repertoire` + `RepertoireSong` (id, musician_id, name, songs ordenadas, position, custom_notes, duration_override_seconds)
  - [x] **4D.1b** Use-cases: criar, listar, buscar, editar nome, excluir, adicionar/remover/reordenar músicas; duração estimada via `duration_seconds` real (null se pipeline ainda não populou)
  - [x] **4D.1c** Use-case: compartilhar — link read-only temporário UUID 7 dias (ESSENTIAL) e convite nominal (PRO)
  - [x] **4D.1d** Gate: `max_repertoires` e `max_songs_per_repertoire` via `PlanCheckService` (FREE 1×20 / ESSENTIAL 3×80 / PRO ∞)
  - [x] **4D.1e** NestJS module + controller (14 endpoints) + presenter + DTOs; registrado em app.module.ts

> ⚠️ **Bug corrigido (jul/2026, durante o Bloco 7 mobile):** `MusicianOwnershipGuard` resolvia `resourceId` via `params["id"] ?? params["musicianId"] ?? params["musician_id"]` — como as rotas de repertório são `musicians/:musician_id/repertoires/:id/...`, `params["id"]` sempre existia e apontava pro UUID do **repertório**, não do músico, então rename/delete/add-song/remove-song/reorder/share/unshare/invite/revoke-invite retornavam 403 pra qualquer músico real (não-admin). Nenhum teste cobria isso. Corrigido renomeando o param `:id` → `:repertoire_id` em `repertoire.controller.ts` (não mexeu no guard compartilhado — nenhum outro controller colide com esse precedence bug). Teste de regressão em `ownership.int-spec.ts`. Também adicionado `MusicianOwnershipGuard` em `findAll`/`findOne`/`RepertoireInvitesController.listMyInvites`, que não tinham enforcement nenhum antes (qualquer músico autenticado podia listar repertório de outro trocando o `musician_id` na URL).
- [x] **4D.3** **Tempo estimado de show** — absorvido em 4D.1:
  - [x] **4D.3a** `duration_override_seconds` por `RepertoireSong`; `duration_seconds` em `MusicLibrary` populado pelo pipeline ai-cifra/ai-audio (Bloco 6)
  - [x] **4D.3b** `estimated_show_duration_minutes` no output — null se alguma música não tiver duração real
- [x] **4D.4** **Compartilhamento de Repertório** — absorvido em 4D.1:
  - [x] **4D.4a** ESSENTIAL: token UUID armazenado no DB com expiração 7 dias
  - [x] **4D.4b** PRO: endpoint de convite nominal; tabela `RepertoireInvitee`; gate `repertoire_nominal_invite`
  - [x] **4D.4c** *(jul/2026, Bloco 7 mobile)* Endpoints novos pra servir a CIFRA (não só a lista de músicas) de um repertório compartilhado: `GET /musicians/:musician_id/repertoires/:repertoire_id/songs/:music_library_id/chord-sheet` (dono ou convidado nominal, via `CheckRepertoireSongAccessUseCase`) e `GET /repertoires/shared/:token/songs/:music_library_id/chord-sheet` (público, via `CheckSharedSongAccessUseCase` + `isShareTokenValid()`). Ambos reaproveitam `GetChordSheetForMusicLibraryUseCase` sem tocar em `core/synced-lyrics`. Resolve o gap onde convidado via a lista de músicas mas não conseguia abrir a cifra pra realmente tocar.

> ⚠️ **Enforcement de gate não é revalidado na leitura** — se o dono perder o plano ESSENTIAL/PRO depois de compartilhar/convidar, o link e o convite continuam ativos indefinidamente (não é bug, é o modelo de enforcement do `PlanCheckService` inteiro). Detalhado em [`Docs/plans/musician-plans.md`](plans/musician-plans.md#️-enforcement-de-gates-ação-vs-leitura-ler-antes-de-mexer-em-qualquer-gate-de-plano).
- [ ] **4D.5** **Banner Generation (templates)** — `src/nest-modules/banner-module/`:
  - [ ] **4D.5a** 5–10 templates SVG/HTML (logo, foto músico/estabelecimento, nome, data, QR do evento)
  - [ ] **4D.5b** Gate: `assertMusicianCanGenerateBanner` / `assertEstablishmentCanGenerateBanner` (FREE ❌ / ESSENTIAL 3/mês / PRO 15/mês)
  - [ ] **4D.5c** Geração server-side PNG via `sharp` ou `canvas`; retorno como link para download
- [ ] **4D.6** **Banner Generation (AI) — roadmap futuro** (pré-requisito: 4D.5):
  - [ ] **4D.6a** Geração via API (DALL-E ou Stability AI) para plano PRO
- [x] **4D.8** **Plano Anual** — billing cycle anual no `Subscription`:
  - [x] **4D.8a** `BillingCycle` enum (`"monthly" | "annual"`) + campo no aggregate; `create()` auto-computa `expires_at`; `isActive()` respeita `expires_at`; `toJSON()` inclui campo; validator rejeita valores inválidos
  - [x] **4D.8b** `prisma/schema.prisma` + `billing_cycle String @default("monthly")`; `PlanPricing` interface + `MUSICIAN_PLAN_PRICING` + `ESTABLISHMENT_PLAN_PRICING` em `plan-features.config.ts`; mapper atualizado; 4 novos métodos em `PlanCheckService` (`getBillingCycle`, `getPlanPricing`); 33 novos testes

---

### Bloco 4E — Registro de usuários (Keycloak Admin API) ✅

> Movido de `soundmeet-mobile/Docs/roadmap-mobile.md` (item 1.9, Bloco 1.5). `registrationAllowed` permanece `false` no realm — este endpoint é a única porta de entrada para novos usuários músicos/público.
> **Invariante crítica:** `musician_id`/`audience_id` do aggregate criado é sempre igual ao `sub` do usuário no Keycloak — dependência direta do sistema de ownership (Bloco 4B). Ver [business-rules.md](business-rules.md).

- [x] **4E.1** Infra Keycloak: `infra/keycloak/service-account-role-assignments.json` (arquivo separado do `realm-soundmeet.json` — este é montado nativamente pelo container via `--import-realm` e rejeita campos desconhecidos, testado e corrigido após quebrar o boot do Keycloak) + função `assignServiceAccountRoles` em `scripts/keycloak-sync.mjs` — concede `manage-users` + `view-realm` (`realm-management`) à service account de `soundmeet-api`; `KEYCLOAK_INTERNAL_URL` adicionado para o `KeycloakAdminGateway` funcionar quando a API roda dentro do Docker (mesma necessidade do `KEYCLOAK_JWKS_URI`)
- [x] **4E.2** `KEYCLOAK_MOBILE_CLIENT_ID` (default `soundmeet-mobile`) em `config.schema.ts`/`config-module.module.ts`/`.env.example` — client público usado no Direct Access Grant pós-registro
- [x] **4E.3** Domínio `src/core/auth/` (sem aggregate próprio): `IIdentityProviderGateway` + `KeycloakAdminGateway` (axios, cache de admin token via `client_credentials`), `IEmailVerificationIssuer`, `RegisterUseCase` (`application/use-cases/register/`)
- [x] **4E.4** `RegisterUseCase`: valida duplicidade local antes de tocar o Keycloak → cria usuário (`emailVerified: true`, `requiredActions: []`, necessário para o Direct Access Grant não falhar) → atribui role → cria aggregate `Musician`/`Audience` com ID == `sub` do Keycloak → emite token de verificação de email (não bloqueante) → autentica via Direct Access Grant (`soundmeet-mobile`). Compensação (rollback do usuário Keycloak) em toda falha após a criação, exceto na etapa final de autenticação (conta já commitada)
- [x] **4E.5** `Audience.create()` passou a aceitar `audience_id` explícito em `AudienceCreateCommand` (paridade com `Musician.create()`, pré-requisito para o registro)
- [x] **4E.6** `ExternalServiceError` (novo `DomainError`) → 503 no `GlobalExceptionFilter`, para falhas do provedor de identidade
- [x] **4E.7** `VerifyEmailService` implementa `IEmailVerificationIssuer.issueVerificationToken()` — reaproveita `email_token`/`email_token_expires_at` já existentes em `Musician`/`Audience` e `MailService.sendEmailVerification()` (template já existente, não utilizado até então)
- [x] **4E.8** `POST /api/v1/auth/register` (`@Public()`, `@Throttle` 5/60s) — `RegisterDto extends RegisterInput`, `AuthController`, `auth.providers.ts`
- [x] **4E.9** Testes: `register.use-case.spec.ts` (9 cenários incl. compensação e falha de compensação), `keycloak-admin.gateway.spec.ts`, `register.controller.int-spec.ts`

- [x] **4E.10** CPF + celular no cadastro do músico (jul/2026, anti multi-conta): VO `CPF` compartilhado (`src/core/shared/domain/value-objects/cpf.vo.ts`, espelho do `CNPJ`); migration `cpf String? @unique` + `phone String? @unique` em `Musician`; `findByCpf`/`findByPhone` no repositório (prisma + in-memory). `RegisterInput` exige `cpf`/`phone` só quando `role === "musician"` (`@ValidateIf`); `RegisterUseCase` checa duplicidade de CPF/celular **antes** de criar o usuário no Keycloak (409 dedicado, sem tocar o provedor de identidade em caso de conflito). `Audience` não coleta esses campos — sem fricção no fluxo casual de QR. **Privacidade:** `cpf` nunca exposto em `MusicianPresenter` (rota pública)
- [x] **4E.11** Upload de avatar do músico: `POST /musicians/:id/avatar` (multipart, jpeg/png/webp ≤5MB, magic-byte check via `file-type`) — espelha o padrão de upload de menu PDF do establishment (`IMusicianStorage`/`S3MusicianStorage`, mesmo bucket/credenciais `soundmeet-media`); `MusicianOwnershipGuard` aplicado
- [x] **4E.12** Endpoint de chave PIX do músico: `PATCH /musicians/:id/wallet/pix-key` no `payment-module` — `UpdateMusicianPixKeyUseCase` já existia no core mas não estava registrado em `payment.providers.ts`; cria a wallet lazy se ainda não existir; tipos cpf/cnpj/email/phone/random (`PixKey` VO já validava)
- [x] **4E.14** Multi-role / add-role (14/jul/2026, mobile Bloco 10.5): `POST /auth/add-role` — usuário autenticado que JÁ tem um papel (músico ou fã) adiciona o outro. `AddRoleUseCase` (`core/auth/application/use-cases/add-role/`, espelho do `SocialSignupUseCase`): 409 se já possui o papel ou se não tem cadastro inicial (aí o caminho é o social-signup), CPF/celular obrigatórios só pra role musician (anti multi-conta), `assignRealmRole` no Keycloak + aggregate criado com o MESMO sub, compensação remove só a role em falha, reparo idempotente de estado órfão (aggregate existente sem role → só reatribui). 7 testes unitários. O app faz token refresh silencioso após o 201 (roles novas entram no JWT; `buildAuthUser` deriva musicianId/audienceId do sub).
- [x] **4E.13** Push token do músico (jul/2026): `PATCH /musicians/:id/push-token` — `push_token`/`push_token_platform String?` em `Musician` (sem histórico multi-device, último registrado sobrescreve); `RegisterPushTokenUseCase` (mirror de `UpdateMusicianProfileUseCase`); `MusicianOwnershipGuard` aplicado; nunca exposto em `MusicianPresenter`. Consumido por `PushNotificationService` (ver Bloco 7.2)

**Risco residual (fora de escopo):** `POST /audiences` continua `@Public()` — permite criar `Audience` órfã sem Keycloak. Considerar restringir a admin/interno numa iteração futura.

**Dívidas técnicas registradas (jul/2026):**
- Resize de imagem server-side para o avatar (hoje só compressão client-side no picker do mobile) — considerar `sharp` se o tamanho médio dos uploads virar problema de storage/banda.
- Verificação de posse do celular por SMS/OTP (provedor a decidir — Twilio/AWS SNS/Zenvia). Hoje o celular é só coletado e checado como único, sem confirmar que o dono da conta realmente tem acesso a ele.

**Referência:** [auth/keycloak.md](auth/keycloak.md)

---

### Bloco 5 — Real-time e messaging

> **⚠️ Infra obrigatória ao criar o gateway Socket.io:** configurar `@socket.io/redis-adapter` usando as vars `REDIS_HOST`/`REDIS_PORT` já existentes. Sem ele, múltiplas instâncias NestJS não trocam eventos WebSocket — silent failure em produção com load balancer. Ver memória `project-websocket-redis-note`.

- [x] **5.1** WebSockets (Socket.io) — pedidos aceitos/recusados em tempo real + chat (ver Bloco 7.1) — `RedisIoAdapter` + `NotificationsGateway` (/notifications) + `ChatGateway` (/chat) + `RequestEventsHandler`; testes de integração do ChatController pendentes. **(jul/2026)** `RequestEventsHandler` ganhou um terceiro listener, `handleRequestCreated` (`@OnEvent(RequestCreatedEvent.name)`), emitindo `request.new` pro músico via `gateway.notifyNewRequest(musicianId, payload)` — mesma room `user:${sub}` já usada pro fã em `request.status_changed`, sem mudança no `handleConnection`. Fecha o gap: antes só o fã recebia tempo real (accept/reject), o músico não era avisado de pedido novo. Ver `soundmeet-mobile/Docs/roadmap-mobile.md` Bloco 4.4.
- [x] **5.2** RabbitMQ: pagamento confirmado → gamificação → ranking (event-driven) — `TipCompletedIntegrationEvent` publicado no exchange `soundmeet.events` via `PaymentEventsHandlers`; `GamificationTipCompletedConsumer` consome `soundmeet.gamification` e recalcula `TOP_FAS` + `TOP_APOIADORES`; canal `gamification_events` (prefetch 10); transport configurável via `GAMIFICATION_PROCESSING_TRANSPORT`
- [ ] **5.3** Outbox pattern para consistência entre domínios (opcional pós-MVP)

---

### Bloco 6 — IA musical (evolução)

- [x] **6.1** Sync individual de LRC (LRCLIB → fallback Genius) + ingest manual — `POST :id/synced-lyrics` (upsert, ingest passivo real) e `POST :id/synced-lyrics/sync` (busca ativa, protegida por `InternalToken`). **jul/2026, correção da descrição original:** o texto anterior ("Modo A ingest externo") estava impreciso — a maior parte do que foi implementado não é ingest passivo (backend só recebendo de um LRCGET externo), e sim o backend consultando LRCLIB/Genius ativamente (`ILrcLibClient`/`IGeniusClient`). O resultado é persistido em `music_library.lrc_raw`/`lrc_normalized` (Postgres) uma única vez; leituras seguintes (`GET .../synced-lyrics`, `.../chord-sheet`) não tocam mais a API externa. O cache Redis dentro de `SyncSyncedLyricsForMusicLibraryUseCase` é só um dedupe de busca por título/artista de curtíssimo prazo (1h hit / 5min negative-cache) — quem garante "não consultar de novo" é a persistência em Postgres, não o Redis.
- [x] **6.2** Bulk LRC assíncrono — `SyncedLyricsBulkJob` (aggregate com status/contadores) + `POST /synced-lyrics/bulk-sync` (`RequestSyncedLyricsBulkSyncUseCase`, 1 mensagem por `music_library_id`) + `GET /synced-lyrics/bulk-jobs/:id`. Transporte configurável via env `SYNCED_LYRICS_BULK_TRANSPORT` (`inline` por padrão, com backpressure/concorrência própria; `rabbitmq` via `SyncedLyricsRabbitmqDispatcher` + `SyncedLyricsBulkRequestedConsumer`), mesmo padrão de `*_PROCESSING_TRANSPORT` já usado em gamificação. **jul/2026:** faltavam testes de domínio pro aggregate e pros use-cases de bulk (só existia teste de controller com o use case inteiro mockado — não exercitava as transições de estado do job nem o dispatcher). Adicionados `synced-lyrics-bulk-job.aggregate.spec.ts`, `request-synced-lyrics-bulk-sync.use-case.spec.ts` e `process-synced-lyrics-bulk-item.use-case.spec.ts` (24 casos novos; suíte `synced-lyrics` completa: 12/12 suítes, 65/65 testes).
- [x] **6.3** Materialização chord-sheet — `POST chord-sheets/materialize` (JSON estruturado → `chord_sheet` em `music_library`) e `POST chord-sheets/materialize-renderable` (HTML/ChordPro → `renderable_chord_sheet`). **Débito técnico registrado (jul/2026):** `GET :id/chord-sheet` (endpoint principal de leitura) não lê a coluna `chord_sheet` já materializada — recomputa o artefato em memória a cada chamada a partir de `lrc_normalized`/`chords`/`structure_segments` (barato, sem chamada de rede ou de IA, mas inconsistente com `GET :id/chord-sheet/preview`, que lê `renderable_chord_sheet` direto via `findUnique`). Considerar alinhar os dois caminhos numa iteração futura — não é bloqueante.
- [ ] **6.4** Tuning Demucs — [audio-separation.md](AI-musician/audio-separation.md). **jul/2026, esclarecimento:** o Demucs já roda em produção em toda análise real de áudio (`/v2/analyze` → `ChordInferenceServiceV12`, `separation_method="demucs"` como default, extrai o stem harmônico `bass+other` antes do ChordFormer inferir os acordes — ganho já medido em ablação: "+0.8pp sevenths" vs. mix cru). O que falta não é integração, é o *tuning* de `segment`/`overlap` (trade-off tempo/custo de GPU vs. qualidade da separação) — item de otimização incremental, sem urgência de produto.
- [x] **6.5** **(jul/2026, durante o Bloco 7 mobile)** Ponte pipeline → catálogo, achado durante a investigação do fluxo "buscar cifra" do mobile: `CompleteAiCifraAnalysisJobUseCase` (chamado por `POST /ai-cifra/internal/analyses/:id/complete`, o worker Python) gravava `bpm/key/chords/segments` só no aggregate `AiCifraAnalysisJob.result` — **nada escrevia de volta em `MusicLibrary.chords/structure_segments/bpm/key`**, que é o que `GET /music-library/:id/chord-sheet` realmente lê. Só o script CLI offline `preload-chord-sheets-top-100.ts` fazia essa ponte, via Prisma cru, pulando a camada de domínio. Resultado prático: completar uma análise via `from-provider/analyses` nunca preenchia a cifra de verdade. Corrigido injetando `UpdateMusicLibraryUseCase` (já existia, reaproveitado) em `CompleteAiCifraAnalysisJobUseCase` — escreve best-effort (falha aqui não desfaz a conclusão do job) quando `upload.music_library_id` está setado. Testes novos em `complete-ai-cifra-analysis-job.use-case.spec.ts`.
- [x] **6.6** **(jul/2026, durante o Bloco 7 mobile)** Endpoint novo `GET /musicians/:musician_id/ai-cifra/search?query=&limit=` (`AiCifraSearchController`) — busca por texto livre (título/artista) via `MusifyPipedCatalogClient.searchVideos`, que já existia mas só era chamado por um script CLI offline, nunca por HTTP. Alimenta o fluxo mobile de "buscar cifra por nome ou cantor" (Bloco 7): resultado → `POST /music-library/items` (cria o item, cliente já sabe o id) → `POST .../from-provider/analyses` (com o id, ativa o `updateCatalogSource`) → poll `GET /ai-cifra/analyses/:id` → cifra populada via 6.5. Throttle `10s/15req` por músico. Testes em `search-ai-cifra-catalog.use-case.spec.ts`.
- [x] **6.7** **(jul/2026, auditoria de precisão do alinhamento acorde↔letra, disparada por pedido do usuário de revisar a abordagem antes de construir a tela de cifra no mobile)** Quatro achados corrigidos, ver [chord-sheet.md](AI-musician/chord-sheet.md) pros detalhes completos de cada um:
  - **Modo A implementado de verdade** — antes não existia ASR/forced-alignment nenhum no código (só `hasWordLevelTimings`/`coerceLineWords` já preparados pra consumir, sem produtor). Novo `POST /v1/align-lyrics` no worker (`app/lyrics_alignment_service.py`, pacote `ctc-forced-aligner` do HuggingFace — modelo `MahmoudAshraf/mms-300m-1130-forced-aligner` — sobre stem de voz do Demucs) + `AlignSyncedLyricsWordTimestampsUseCase` (`core/synced-lyrics`), disparado de `ProcessAiCifraAnalysisJobUseCase`/`CompleteAiCifraAnalysisJobUseCase` logo antes do `deleteObject` do áudio. **Não validado empiricamente** (escrito sem GPU/torch no ambiente) — precisa rodar contra áudio real antes de confiar em produção. **Limitação arquitetural real:** só funciona se a letra já estiver sincronizada no momento em que a análise de acordes termina (áudio é apagado logo depois, sem segunda chance) — não é uma limitação deste use-case, é da política de retenção de áudio já existente. **Correção (3ª rodada, pergunta direta do usuário — "mas do LRC ela já não vem separada?"):** a 2ª rodada concatenava todas as linhas antes de mandar pro aligner (1 chamada, áudio+texto inteiros) e reconstruía as linhas de volta contando palavras — jogava fora a fronteira de linha que o LRC já dá, e a reconstrução tinha um risco real não verificado (romanização podia não preservar 1:1 a contagem de palavras do texto concatenado, atribuindo palavra à linha errada silenciosamente). Corrigido pra alinhar linha por linha, cada uma contra seu próprio recorte de áudio (janela do LRC + 500ms de folga) — sem concatenação, sem reconstrução, ver [chord-sheet.md](AI-musician/chord-sheet.md) "Estado da implementação — Modo A".
  - **Genius parou de violar a própria regra de compliance do projeto** — `SyncSyncedLyricsForMusicLibraryUseCase` fazia scrape da letra completa da página do Genius e persistia como LRC sintética; agora só captura metadado (`song_id`/`url`) pra link-out, nunca o texto.
  - **`duration_mismatch`** — `pickBestLyrics` (auto-sync) não pontuava duração ao escolher entre candidatos LRCLIB, diferente do endpoint irmão de busca manual; podia casar letra de versão errada da música sem penalidade. Agora usa a mesma fórmula de bucket dos dois lados; divergência `>12s` vira `quality_flag`. **Débito fechado (jul/2026, 3ª rodada):** `MusicLibrary.duration_seconds` nunca era escrito por nenhum use-case do pipeline — adicionado `MusicLibrary.changeDurationSeconds()` (aggregate) + campo em `UpdateMusicLibraryInput` + repasse de `result.artifacts.duration_seconds` (já devolvido pelo worker em `/v1` e `/v2/analyze`) nos dois caminhos de conclusão de análise (`ProcessAiCifraAnalysisJobUseCase`/`CompleteAiCifraAnalysisJobUseCase`, mesmo padrão de `chords`/`bpm`/`key`). Testes de regressão em ambos + `music-library.aggregate.spec.ts`.
  - **Config de deploy do v22 corrigida** — `envs/.env.example` apontava `/v1/analyze` (legado) enquanto `docker-compose.yml` raiz já apontava `/v2/analyze`; `ai-cifra-mir-worker/docker-compose.yml` (compose standalone do worker) também corrigido + comentário apontando o compose raiz como fonte de verdade. `AI_CIFRA_ENABLE_V12` (nunca lido em `main.py`) removido dos dois profiles do compose raiz.
  - **🔴 Bug crítico achado e corrigido (revisão pós-implementação, a pedido do usuário):** `ProcessAiCifraAnalysisJobUseCase` — o caminho SÍNCRONO de conclusão de análise, usado por padrão via `AI_CIFRA_PROCESSING_TRANSPORT=http` (valor default em `envs/.env.example`) — **nunca chamava `UpdateMusicLibraryUseCase`**, ao contrário do que o item 6.5 (acima) parecia ter corrigido "de vez": 6.5 só emendou o caminho irmão (`CompleteAiCifraAnalysisJobUseCase`, usado no modo webhook/RabbitMQ). Resultado prático: no transporte padrão, terminar uma análise de cifra podia nunca escrever `bpm/key/chords/structure_segments` em `MusicLibrary` — e `GET .../chord-sheet` lê direto de lá, não do job. Corrigido espelhando a mesma ponte best-effort no caminho síncrono; teste de regressão em `process-ai-cifra-analysis-job.use-case.spec.ts` prova a gravação. **Precedente:** já é a terceira vez que um "fix" documentado como concluído (6.5) na verdade só cobria metade dos dois caminhos de conclusão gêmeos deste módulo — vale conferir os dois sempre que mexer em qualquer coisa pós-análise aqui.

- [ ] **6.8** **Fusão cifra↔áudio estilo DECIBEL (CifraClub) — trilha de PRODUTO, não de benchmark** (levantado 08/ago/2026 a pedido do usuário, durante o treino do ChordFormer v24). Referência: [DECIBEL, arXiv:2002.09748](https://arxiv.org/pdf/2002.09748) e a [versão TISMIR](https://transactions.ismir.net/articles/10.5334/tismir.81). Detalhamento completo e ressalvas em `ai-cifra-mir-worker/Docs/research/2026-07-estado-da-arte-e-roadmap.md` §R7.

  **O que é:** alinhar a cifra (sequência de acordes sem tempo) da *mesma* música ao áudio e **fundir** com a saída do ChordFormer. É **pós-processamento puro** — o paper afirma que os subsistemas de MIDI/tab não têm treino. **Não afeta nenhum treino em andamento**; entra no `eval_mir_eval.py` e no serviço de inferência (`/v2/analyze`).

  **Por que aqui e não no worker de pesquisa:** o ganho real é de produto. Em produção, músico brasileiro pedindo música brasileira → o CifraClub tem a cifra daquela música exata. É o repertório que nenhum dataset acadêmico cobre e onde o modelo é mais fraco.

  ⚠️ **Não esperar o "+13,6pp" do paper.** Esse número é sobre um método **fraco** (67,2%→80,8% WCSR); o método já forte (87,3%) ganhou **+0,5pp**, e o paper diz explicitamente que métodos fortes melhoram menos. Nosso modelo está na faixa forte (majmin 81,26). O DECIBEL também foi avaliado em **majmin**, e nosso gargalo é **sevenths** — não testado por eles. **Estimativa realista: +0,5 a +2pp.**

  **Ordem de implementação sugerida (barato → caro):**
  1. **Priors simbólicos brasileiros** (não exige áudio, alinhamento nem treino): alimentar `chordonomicon_transitions.json`/`chordonomicon_genre_priors.json` com as **800 progressões** já em disco (`artifacts/datasets/cifraclub/cifraclub_progressions.json`: `title`, `artist`, `key`, `chords_sequence`). Os priors são hoje o **maior ganho isolado em extensões** da tabela de ablação (**+1,8pp sevenths**), e o Chordonomicon é anglocêntrico. Consumido por `--crf-use-data-priors` (treino) e `--priors` (eval/inferência).
  2. **Fusão por música no `/v2/analyze`**: quando existir cifra do CifraClub para o `music_library` item, alinhar e fundir. O alinhamento é o núcleo difícil (o DECIBEL usa *jump alignment*, não DTW simples).

  **Pré-requisitos e bloqueios já verificados (08/ago/2026):**
  - `cifraclub_progressions.json` tem **800 músicas brasileiras** — formato certo, repertório certo para o produto.
  - **Não serve para o benchmark das 244**: o test set é 100% Chords1217 (pop anglófono do MSD), sobreposição ~zero. Medir no repertório brasileiro, nunca nas 244.
  - O Chords1217 **não tem título/artista** (só TrackID do MSD, ex. `TRWBQZI149E386757B`) — usar DECIBEL no benchmark exigiria antes resolver TrackID → título/artista via metadados do MSD.
  - Existe **1 único `.mid`** no projeto; o DECIBEL usou 3,85 MIDI + ~8 tabs por música. O caminho viável aqui é só o de tabs/cifras.
  - **Adicionar as 800 ao treino NÃO funciona**: `chords_sequence` não tem tempo nem áudio, e treino frame-level exige os dois.

---

### Bloco 7 — Produto avançado (backlog)

- [x] **7.1** Chat estabelecimento ↔ músico — domínio `src/core/chat/` completo (Conversation + Message aggregates, 3 repositórios, 5 use-cases); `ChatModule` + gateway `/chat` + controller REST + `ChatEventsHandler` (auto-abre conversa em `InquiryCreatedEvent`); testes de integração do controller ✅ (15 casos, `chat.int-spec.ts`)
  - **Estendido (jul/2026, pré-requisito do mobile Bloco 9):** 3 gaps reais achados ao ler o código (não pelos testes, que passavam mesmo assim) e corrigidos antes do mobile, mesmo precedente dos Blocos 4.4/5/6.
    1. **Bug real:** `ConversationPrismaRepository.findByParticipant` filtrava só `musician_id`/`band_id`, omitindo `establishment_id` — em produção um estabelecimento nunca via as próprias conversas via `GET /conversations`. O repositório in-memory (usado pelo `chat.int-spec.ts`, que por isso nunca pegou o bug) sempre teve os três campos. Corrigido + novo `conversation-prisma.repository.spec.ts` (mock de `PrismaClient`, assert das 3 cláusulas `OR`) — o tipo de teste que faltava no domínio `chat` e que teria capturado o bug antes.
    2. **`ListConversationsUseCase` enriquecido** com `last_message`/`unread_count` (novos métodos `findLastMessagesByConversationIds`/`countUnreadByConversationIds` em `IMessageRepository`, implementados via Prisma `distinct`+`orderBy`/`groupBy` e in-memory) e `ChatController.listConversations()` agora também resolve `establishment: {id, name, avatar}` (`IEstablishmentRepository.findByIds`, injetado via `EstablishmentsModule` importado em `ChatModule` — sem ciclo, confirmado por grep: `ChatModule → EstablishmentsModule → MusiciansModule` é leaf). Enriquecimento cross-context fica no controller, não dentro de `core/chat` — mesma fronteira DDD já seguida por `RequestOutput`/`TipOutput`.
    3. **Push notification de mensagem nova:** `MessageSentEvent` disparava mas nada escutava. Novo `NotificationsChatEventsHandler` (`notifications-module/chat-message-events.handler.ts`, `@OnEvent(MessageSentEvent.name)`, mesmo padrão de `payment-events.handler.ts`) — resolve o participante músico da conversa (só se não foi ele quem enviou; conversas só-banda não notificam, mobile ainda não tem login de banda), emite `chat.message.new` via `NotificationsGateway.notifyChatMessage` (mesma room `user:${musicianId}` de `request.new`/`tip.received` — reaproveitada pro mobile atualizar a lista de conversas sem manter uma segunda conexão persistente pro namespace `/chat`, que fica screen-scoped) e envia push **genérico** (sem preview do conteúdo, decisão de produto — evita vazar dados de negociação na tela de bloqueio) via `PushNotificationService`. Novo `chat-message-events.handler.spec.ts` (6 casos, mirror de `payment-events.handler.spec.ts`).
    - Ver `soundmeet-mobile/Docs/roadmap-mobile.md` Bloco 9 pro lado mobile.
  - **Revisão pós-implementação (jul/2026):** revisão de código em 8 ângulos (correção, comportamento removido, rastreamento cross-file, reuso, simplificação, eficiência, altitude, convenções CLAUDE.md) sobre o diff acima, achou 2 problemas reais adicionais, ambos corrigidos:
    1. **Bug real, mais sério que os 3 acima:** `ChatController.listConversations()` fazia `new EstablishmentId(id)` sem tratamento — o VO `Uuid` exige formato RFC4122 estrito (nibble de versão 1-5, variante 8/9/a/b), mais rígido que a validação do agregado `Conversation` (`class-validator @IsUUID("4")`, mais permissiva). Um `establishment_id` que passasse na validação do agregado mas não na do VO derrubava `GET /conversations` inteiro com `InvalidUuidError` — **já aconteceu de fato** com um fixture de teste durante esta revisão (`ESTABLISHMENT_USER` do `chat.int-spec.ts` teve que ser trocado por um UUID v4 estrito). Corrigido: enriquecimento de estabelecimento extraído pra `enrichWithEstablishment`/`loadEstablishments` (métodos privados testáveis), cada `establishment_id` malformado é pulado individualmente (log `warn`, degrada só aquela conversa pra `establishment: null`) e uma falha do repositório inteiro degrada todas as conversas do request pra `establishment: null` em vez de derrubar o endpoint — os dados de chat em si continuam íntegros mesmo se o enriquecimento falhar. Dois testes de regressão novos em `chat.int-spec.ts`.
    2. **Dead code:** `NotificationsChatEventsHandler` injetava `IMessageRepository` e chamava `msgRepo.findById(...)`, mas o resultado nunca era lido em lugar nenhum (sobrou de uma versão anterior que cogitava incluir preview de conteúdo, descartada pela decisão de push genérico). Removido — injeção, import e a exportação `CHAT_PROVIDERS.REPOSITORIES.MESSAGE.provide` em `chat.module.ts` (só existia pra isso).
- [x] **7.2** Push notifications via Expo Push API (jul/2026) — `PushNotificationService` (`notifications-module/push-notification.service.ts`, wrapper sobre `expo-server-sdk@5` — pinado abaixo do v6 porque v6 é ESM-only e quebra o build CommonJS deste projeto) chamado por `RequestEventsHandler.handleRequestCreated` quando o `Musician` tem `push_token` cadastrado (`PATCH /musicians/:id/push-token`, ver Bloco 4E.13). **Não usa Firebase/APNs diretamente** — Expo intermedia o credential exchange via EAS; `firebase-admin` no `package.json` segue órfão/não usado, fora de escopo remover. Código pronto; ativação real depende de configurar credenciais FCM/APNs no EAS (fora do escopo desta rodada). Ver `soundmeet-mobile/Docs/roadmap-mobile.md` Bloco 4.9.
- [~] **7.3** Validação compartilhamento social → pontos — **consolidado no 7.11** (jul/2026): o 7.11 já especifica o fluxo completo (aggregate `SocialShareMission`, submit/verify de prova, XP via `MissionCompleted`, badges). Não implementar separado — tratar 7.11 como a fonte única deste tema.
- [ ] **7.4** Analytics MongoDB (logs, auditoria) — **reavaliado jul/2026, mantém no backlog:** as projeções PG (`MusicianAnalytics`/`EstablishmentAnalytics`) cobrem o produto hoje; Mongo entra quando houver telemetria de volume (ex.: `FeedVideoViewed` do 7.10d, logs de scan). Não iniciar antes do 7.10.
- [~] **7.5** Planos premium / marketplace — **split (jul/2026):** planos premium estão FEITOS (gates 4C, features 4D, config central `plan-features.config.ts`, paywall mobile com valores espelhados — falta só o checkout recorrente, Bloco 4D.8/Asaas). O que sobra aqui é o **marketplace** (contratação intermediada com escrow) — manter como item futuro próprio; ver [monetization.md](monetization.md) e [payment-gateway-decisions.md](payment-gateway-decisions.md).
- [ ] **7.9** **Vídeo de apresentação no perfil do músico (portfólio estático)** — Fase 1 do feed geo:
  - [ ] **7.9a** Campo `presentation_video_url String?` e `presentation_video_uploaded_at DateTime?` em `MusicianProfile` (Prisma)
  - [ ] **7.9b** Aggregate: `changePresentationVideo(url, uploadedAt)` + `clearPresentationVideo()` em `MusicianProfile`
  - [ ] **7.9c** Endpoint `POST /musicians/:id/presentation-video` — multipart, limite 60s / 100MB → transcode HLS via FFmpeg → S3 → salva URL; padrão igual `ai-cifra-uploads.controller.ts`
  - [ ] **7.9d** Endpoint `DELETE /musicians/:id/presentation-video` — remove do S3 + limpa campos
  - [ ] **7.9e** Atualizar presenter com `presentation_video_url` e `presentation_video_duration_seconds`
  - [ ] **7.9f** Gate: `assertMusicianFeature(id, "presentation_video")` — FREE ❌ / ESSENTIAL ✅ (1 vídeo) / PRO ✅ (até 3 vídeos por instrumento)
  - Objetivo: portfólio do músico visível no perfil antes da contratação; sem criar feed dinâmico ainda
- [ ] **7.10** **Feed de descoberta geolocalizado (vídeos curtos)** — Fase 2 (aguarda volume crítico de músicos com vídeo):
  - **Pré-requisito:** 7.9 completo + base de músicos com vídeos suficiente para o feed ter conteúdo
  - **Diferencial vs TikTok/Reels:** exibe APENAS artistas e estabelecimentos dentro do raio geográfico do usuário — o que nenhuma rede social faz nativamente
  - [ ] **7.10a** Endpoint `GET /feed/musicians` com param `lat, lng, radius_km` — retorna músicos com `presentation_video_url` ordenados por proximidade + engajamento
  - [ ] **7.10b** Algoritmo: boosting por avaliação, frequência de eventos, gorjetas recentes
  - [ ] **7.10c** Paginação cursor-based (Redis cache por região)
  - [ ] **7.10d** Evento de domínio `FeedVideoViewed` → analytics MongoDB
  - Decisão: NÃO criar player de vídeo interno na Fase 2 — usar HLS stream direto do CloudFront
- [x] **7.6** **Afinador cromático** — completo (jul/2026): backend (7.6a) + mobile (Bloco 8 do roadmap-mobile: detecção MPM via react-native-pitchy, modos Guitarra/Cromático, gate do filtro de ruído):
  - [x] **7.6a** Adicionar `tuner_noise_filter: boolean` em `MusicianPlanFeatures` e `plan-features.config.ts`
  - Posicionamento: "já no app, sem trocar de contexto" — entry point do ritual pré-show  
  - Mobile: ✅ concluído — `TunerScreen` (modos Guitarra/Cromático, MPM via `react-native-pitchy`), ver [roadmap-mobile.md](../../soundmeet-mobile/Docs/roadmap-mobile.md) Bloco 8
- [x] **7.7** **Cardápio PDF do Estabelecimento** — confirmação de descoberta no perfil (todos os planos):
  - [x] **7.7a** Prisma: `menu_pdf_url String?` e `menu_pdf_updated_at DateTime?` em `EstablishmentProfile`
  - [x] **7.7b** Aggregate: `changeMenuPdf(url, updatedAt)` + `clearMenuPdf()` em `EstablishmentProfile`
  - [x] **7.7c** `POST /api/v1/establishments/:id/menu-pdf` — Multer diskStorage → fileFilter MIME (camada 1) + `file-type` v20 dynamic import nos bytes reais (camada 2) → Cloudflare R2 → salva URL; limite 5MB; ownership guard; armazenado em `establishments/{name-slug}/{id}/menu-pdf/menu-{ts}.pdf`
  - [x] **7.7d** `DELETE /api/v1/establishments/:id/menu-pdf` — remove do R2 + limpa campos no perfil
  - [x] **7.7e** Presenter atualizado (`menu_pdf_url`, `menu_pdf_updated_at`); `IEstablishmentStorage` port + `S3EstablishmentStorage` + providers
  - Upload/gestão do cardápio pelo dono: fatia **W1** de [roadmap-web.md](roadmap-web.md) (o estabelecimento é web-only). Leitura pelo fã: ✅ mobile abre via `Linking.openURL` (roadmap-mobile 11.5). Aviso de PDF desatualizado (>30 dias) segue pendente nos dois — o campo `menu_pdf_updated_at` já é persistido
- [x] **7.8** **Badge "Aberto agora"** — backend completo:
  - [x] **7.8a** Campo calculado `is_open_now: boolean` no `EstablishmentOutputMapper.toOutput()` via `OperatingHours.isOpenAt(now, dateTimeService)` — presente em todos os outputs de establishment
  - [x] **7.8b** `IDateTimeService` / `LuxonDateTimeService` injetado em `EstablishmentsModule`; passado para `ListEstablishmentsUseCase` e `GetEstablishmentUseCase`; cálculo com timezone correto (UTC)
  - Formulário de horários (dono) e badge "Aberto agora" no dashboard: fatia **W1** de [roadmap-web.md](roadmap-web.md). ⚠️ O `is_open_now` já sai em todos os outputs de establishment, mas **nenhuma plataforma tem UI para o dono preencher `operating_hours`** — na prática o campo é `null` para todo mundo, então o badge nunca acende. É o maior valor/esforço do web v1
- [ ] **7.11** **Missão de gamificação: compartilhamento social com Instagram** — público grava/envia clipe do evento no SoundMeet e compartilha no Instagram marcando músico e estabelecimento:
  - **Mecânica decidida (jun/2026):** sem integração direta com API do Meta (restrição de aprovação); fluxo é "grave/suba no SoundMeet → app gera card compartilhável com @handles do músico e do estabelecimento → usuário abre Instagram Stories/Feed manualmente e posta"
  - **Verificação:** usuário envia print/link do post como prova → moderação automática (hash de imagem) ou manual → XP creditado
  - [ ] **7.11a** Aggregate `SocialShareMission` — campos: `mission_id`, `audience_id`, `event_id`, `musician_id`, `establishment_id`, `proof_url`, `status (pending | verified | rejected)`, `xp_reward`, `created_at`
  - [ ] **7.11b** Use-case `SubmitSocialShareProof` — valida que evento está ativo ou ocorreu nas últimas 24h; cria missão com status `pending`
  - [ ] **7.11c** Use-case `VerifySocialShareMission` — admin/automação verifica prova → status `verified` → publica evento de domínio `MissionCompleted` → handler gamificação credita XP
  - [ ] **7.11d** Badge desbloqueável: 🎬 **"Divulgador"** (1ª missão concluída) / 📣 **"Amplificador"** (5+ missões) / 🌟 **"Embaixador"** (20+ missões com músicos distintos)
  - [ ] **7.11e** Endpoint `POST /missions/social-share` (submit prova) + `PATCH /missions/social-share/:id/verify` (admin)
  - [ ] **7.11f** Card compartilhável gerado server-side (PNG via `sharp`): foto do músico + logo SoundMeet + texto "@musico @ estabelecimento #SoundMeet" — mesmo pipeline do banner (4D.5)
  - **Debate pendente:** opt-in explícito do músico e do estabelecimento para serem marcados em conteúdo de terceiros (privacy by design)

- [x] **7.12** **Listagem de pedidos do próprio fã (16/jul/2026)** — `GET /requests/audiences/:audience_id` em `requests.controller.ts`, espelhando o padrão irmão já existente `GET /requests/musicians/:musician_id` (checagem de ownership inline, sem `AudienceOwnershipGuard`):
  - [x] **7.12a** Endpoint `GET /requests/audiences/:audience_id` — fã só vê os próprios pedidos (403 se tentar ver de outro fã); admin vê qualquer um
  - [x] **7.12b** Reaproveita `ListRequestsUseCase`/`SearchRequestsDto` sem nenhuma mudança de domínio/repositório — `audience_id` já era filtro de primeira classe em toda a cadeia (Prisma + in-memory) antes desta tarefa
  - Desbloqueia: `soundmeet-mobile/Docs/roadmap-mobile.md` Bloco 11.9 (`MyRequestsScreen`)

- [x] **7.13** **Busca por proximidade (geo)** — estabelecimentos, músicos e eventos feitos; modo turnê do músico feito (16/jul/2026):
  - [x] **7.13a** `EstablishmentFilter` com `lat, lng, radius_km` (jul/2026): bounding box indexável + Haversine exato (`shared/domain/geo.utils.ts`), ordenação por distância, paginação/total corretos (`searchByProximity` no repositório Prisma; espelho no in-memory). App: chips de raio no FanExplore (expo-location, leitura pontual foreground).
  - [x] **7.13b** **Eventos por proximidade + descoberta cross-establishment (16/jul/2026):** `EventFilter` ganhou `lat/lng/radius_km` (mesma coerção/clamp de 500km do 7.13a); `ListEventsUseCase` teve `establishment_id` tornado opcional — sem ele, força `is_public: true` no filtro (nunca expõe evento privado na busca global, mesmo se o cliente mandar `is_public=false`). `EventPrismaRepository.searchByProximity` faz join-through via `establishment.profile` (Event não tem lat/lng próprio — herda 100% de `establishment_id`); `EventInMemoryRepository` ganhou constructor opcional `establishmentRepo?: IEstablishmentRepository` pra replicar o join em memória (retrocompatível — instanciações existentes sem esse parâmetro continuam funcionando; filtro geo sem o repo injetado lança `InvalidArgumentError` explícito em vez de falhar silenciosamente). Novo `EventsDiscoveryController` (`GET /events`, `@Public()`) na mesma `events-module`, mesmo precedente do `AiCifraSearchController` (6.6) pra endpoint cross-cutting dentro de um módulo já nested. "Hoje à noite" não precisou de campo novo — o filtro `date_gte/date_lte` já existente cobre a janela de horário, calculada pelo cliente. **Observação registrada, não corrigida (fora de escopo):** `GET establishments/:id/events` (rota aninhada) é `@Public()` sem forçar `is_public: true` — hoje um evento privado de um estabelecimento específico é listável por quem souber o `establishment_id`, se não filtrar por `is_public`. Pré-existente a esta tarefa.
  - [x] **7.13c** **Músicos na busca por raio + geocoding (14/jul/2026):** `MusicianFilter` com `lat/lng/radius_km` (mesma coerção/sanitização do 7.13a), colunas denormalizadas `location_lat/location_lng` em `MusicianProfile` (migration com backfill do JSON `location`, índice composto; mapper escreve a cada save) e `searchByProximity` espelho no repositório Prisma + in-memory (spec próprio). **Decisão de arquitetura da localização:** público = GPS pontual em foreground (posição é "agora"); músico/estabelecimento = endereço cadastrado geocodificado (base fixa — sem tracking, sem permissão extra). Port `IGeocodingService` (`shared/domain/geocoding.service.ts`) + `HttpGeocodingService` (BrasilAPI CEP v2 → fallback Nominatim, best-effort: falha NUNCA bloqueia o save) + `FakeGeocodingService` pra testes; injetado (opcional) em `UpdateMusicianProfileUseCase` e `UpdateEstablishmentProfileUseCase` — endereço sem lat/lng explícito tenta CEP→coords. App: FanExplore ganhou toggle Locais | Músicos (aba de músicos busca por `stage_name` + raio, `MusicianResultCard` com distância/faixa de preço, navega pro perfil público).
  - [x] **7.13d** **Modo turnê temporário (16/jul/2026, implementado por decisão explícita — item estava marcado como futuro):** investigação disparada por dúvida do usuário sobre músico temporariamente em outra cidade confirmou que, antes desta tarefa, atualizar o endereço do perfil (`PATCH :id/profile`) já tornava o músico localizável na cidade nova imediatamente — mas **sobrescrevendo** a base permanente (sem expiração, sem reverter sozinho, e se a geocodificação falhasse ele sumia de **todas** as buscas). Implementado um segundo ponto de busca opcional, com expiração automática (máx. 30 dias, `MAX_TOURING_DAYS` em `musician-profile.aggregate.ts`), somado à base permanente (nunca a substitui): `MusicianProfile.touring_location`/`touring_expires_at` + `setTouringLocation()`/`clearTouringLocation()`/`isTouring` (expiração computada em leitura, mesmo padrão de `Subscription.isActive()` — sem cron). Colunas denormalizadas `touring_lat/touring_lng/touring_expires_at` em `MusicianProfile` (migration `20260716120000_add_musician_touring_location`, mesmo padrão do 7.13c). `searchByProximity` (Prisma + in-memory) passou a considerar os dois pontos (base OU turnê ativo), usando a menor distância. Endpoints `PATCH /musicians/:id/touring-location` (`SetMusicianTouringLocationUseCase` — geocodifica se faltar lat/lng, mas **aqui a falha de geocodificação BLOQUEIA** o save, ao contrário do update de perfil best-effort: sem coordenadas o modo turnê não tem função nenhuma) e `DELETE /musicians/:id/touring-location` (`ClearMusicianTouringLocationUseCase`); `MusicianOwnershipGuard` aplicado. `MusicianProfileOutput` ganhou `touring_location`/`touring_expires_at`/`is_touring`.
  - Desbloqueia: `soundmeet-mobile/Docs/roadmap-mobile.md` Bloco 11.3/11.4 (feed de descoberta e busca do fã) sem depender do fallback por `location_city`

- [x] **7.14** ✅ **Concluído em 07/ago/2026 (Bloco 9.6c)** — `GET /musicians/:musician_id/repertoire` (`@Public()`) com `PublicMusicLibraryItemPresenter`: só metadado (título, artista, gênero, dificuldade, duração), controller próprio em vez de afrouxar o genérico, allowlist explícita com teste de regressão. **Navegação de repertório para o público** — `MusicLibraryController` é `@Roles("musician","admin")` na classe inteira; um fã não pode ver o catálogo de um músico pra escolher a música ao pedir:
  - [x] **7.14a** Resolvido pelo **endpoint dedicado** (a segunda opção listada aqui), não pelo afrouxamento da rota genérica: relaxar `MusicLibraryController` exigiria lembrar em toda mudança futura de não deixar `chords`/`lyrics` escaparem no presenter. O controller novo nasce com um presenter que só sabe montar metadado.
  - **Escopo revisado (jul/2026, decisão do usuário durante auditoria):** `MusicLibrary.musicianId` é obrigatório no schema — cada item pertence a um músico específico, não é catálogo global. Com o modelo de IA de cifra ainda em treino, a maioria dos itens hoje tem só `title`/`artist` preenchidos, sem `chords`/`chord_sheet`/`lyrics`. Por isso o endpoint deve expor **só metadado de busca** (título, artista, gênero, difficulty) — **nunca** `chords`/`chord_sheet`/`lyrics`/`notes` — via um `PublicMusicLibraryPresenter` novo (mesmo padrão do `PublicMusicianPresenter`, Bloco 1.d). Mesma filosofia da busca que o músico já usa (`GET /musicians/:id/ai-cifra/search`, Bloco 6.6): identificar a música antes de qualquer conteúdo de cifra existir. Endpoint dedicado (`GET /musicians/:id/repertoire`, exigindo `musician_id` — nunca lista solta) é mais seguro que relaxar a rota genérica, evita vazar campo sensível por engano na resposta.
  - ~~Desbloqueia: `soundmeet-mobile/Docs/roadmap-mobile.md` Bloco 11.8 (`SongRequestScreen` com catálogo navegável em vez de só free-text/sugestões)~~ — **consumido em 09/set/2026**, nos DOIS clientes (`RepertoirePicker` no mobile, `SongCatalogPicker` no web). ⚠️ Ficou **um mês** entregue sem cliente nenhum: rota pronta não produz erro quando ninguém a chama, e a auditoria cruzada de 08/set não pegou porque perguntava se o cliente chama algo inexistente — nunca se existe algo que ninguém chama

- [ ] **7.15** **Validação de QR de estabelecimento** (baixa prioridade — não expandir escopo agora) — `ScanQRUseCase` (`src/core/audience/application/use-cases/scan-qr/scan-qr.use-case.ts`) só valida o esquema `soundmeet://musician/<uuid>`; se/quando check-in de estabelecimento via QR virar feature real, espelhar a mesma validação atômica + anti-abuso (5 scans/dia) para `soundmeet://establishment/<uuid>`. Registrar aqui apenas para não perder o rastro — não detalhar sub-tarefas até haver decisão de produto.

- [x] **7.16** **Leaderboard sem identidade exibível — resolvido pela 7.16b** (gap descoberto na implementação do `LeaderboardScreen` do fã, jul/2026; verificado contra o código em 09/set/2026). O ranking era tecnicamente funcional mas anônimo: `GET /gamification/leaderboard` só devolvia `user_id`, e um fã não podia resolver isso chamando `GET /audiences/:id` de outro usuário (`@Roles("audience","admin")` + ownership guard, dono/admin-only), então o mobile exibia "Fã #\<hash\>".
  - [x] **7.16b escolhida** — `findTopUsersWithProfile` na porta `IUserPointsRepository` devolve `UserPointsLeaderboardEntry` (`user_points` + `nickname` + `avatar`); `UserPointsOutputMapper.toLeaderboardOutput` e `UserPointsPresenter` carregam os dois campos até o HTTP. **Um único SQL:** o Prisma resolve por `include` (a relação `UserPoints.audience` já existe no schema, obrigatória e `onDelete: Cascade` — por isso `model.audience.nickname` não precisa de guarda). Sem round-trip extra e sem duplicar `nickname`/`avatar` dentro do agregado `UserPoints`, que é a fronteira entre bounded contexts.
  - [~] **7.16a superseded, não implementada** — o endpoint `GET /audiences/public-profiles?ids=...` resolveria o mesmo problema com **duas** chamadas e uma superfície pública nova a defender. Só volta a fazer sentido se outra tela precisar resolver identidade de fã em lote fora do leaderboard; hoje nada precisa.
  - 🔴 **`nickname`/`avatar` só são populados no caminho do leaderboard.** `GetUserPointsUseCase` (consulta do próprio usuário) não enriquece — os campos são opcionais no `UserPointsOutput` de propósito. Quem adicionar uma terceira rota sobre `UserPointsPresenter` precisa decidir explicitamente se enriquece, senão os campos chegam `undefined` sem erro nenhum.
  - ⚠️ **A rota é `@Public()`** (allowlist em `route-auth-coverage.spec.ts`: "leaderboard público"), então nickname e avatar de fã são dados públicos por decisão de produto — coerente com `business-rules.md`, que já registra "o leaderboard é público" ao justificar a queda do compartilhamento social para 10 pontos. Não há enumeração: a resposta é top-N com `limit` capado em 100, nunca a base inteira. **Nunca acrescentar e-mail, telefone ou preferências a este presenter.**
  - **In-memory degrada, não lança:** `UserPointsInMemoryRepository` recebe `IAudienceRepository` **opcional** e devolve `nickname`/`avatar` `null` quando não injetado (mesmo padrão de `EventInMemoryRepository` ↔ `EstablishmentInMemoryRepository`). Em produção o binding é `UserPointsPrismaRepository`, que sempre faz o JOIN.
  - Testes: 4 casos em `get-leaderboard.use-case.spec.ts` (nome resolvido, fã sem apelido → `null`, ordenação+limit, e o caso negativo sem `audienceRepo` injetado). Suíte gamification **18 suítes / 194 testes ✅**.
  - Desbloqueou: `soundmeet-mobile/Docs/roadmap-mobile.md` Bloco 11.12 — `LeaderboardRow` mostra o nome real, com fallback para "Fã #\<hash\>" só quando o fã nunca preencheu o apelido.

- [x] **7.18** **Google Calendar sync (17/jul/2026)** — bookings confirmados/cancelados sincronizados one-way com a agenda pessoal do músico (ou do líder da banda — decisão de produto: só a conta do líder, nunca de cada membro):
  - [x] **7.18a** Domínio novo `src/core/google-calendar/`: `GoogleCalendarIntegration` (1:1 com Musician, tokens OAuth cifrados) + `GoogleCalendarSyncedEvent` (mapeamento booking→evento, contabilidade de idempotência) — aggregates completos, validators, fake builders, repositórios in-memory + Prisma (tabelas `google_calendar_integrations`/`google_calendar_synced_events`, migration `20260717120000`)
  - [x] **7.18b** **Primeira criptografia at-rest do projeto**: porta `IEncryptionService` (`core/shared/domain/encryption.service.ts`) + `AesGcmEncryptionService` (AES-256-GCM, IV único/chamada, chave `TOKEN_ENCRYPTION_KEY` 32-bytes base64, obrigatória em produção via Joi; chave efêmera com warn em dev) + `FakeEncryptionService` — genérica, reutilizável por qualquer domínio futuro que precise de segredo decifrável
  - [x] **7.18c** Gateway `IGoogleCalendarGateway` (porta em `application/ports/`, erros co-localizados `GoogleCalendarAuthError`/`GoogleCalendarUnavailableError`) + `GoogleCalendarHttpClient` (axios cru, sem SDK; `withRetry` com backoff+jitter do padrão LrcLib; create idempotente via id determinístico = UUID do booking sem hífens, 409 = sucesso; delete idempotente, 404/410 = sucesso) + `FakeGoogleCalendarGateway`
  - [x] **7.18d** Fluxo OAuth: `GET /musicians/:id/google-calendar/connect` (ownership guard; URL de consentimento com escopo mínimo `calendar.events`+`openid email`, `access_type=offline`+`prompt=consent`, `state` HMAC-assinado c/ nonce+exp 10min) → callback **rota fixa** `GET /google-calendar/oauth/callback` (`@Public()` — o Google exige redirect URI exato, por isso não aninhada; `musician_id` viaja no state assinado, validado ANTES da troca do code) → `ConnectGoogleCalendarUseCase` (upsert por musician_id, reconexão preserva id/histórico). + `GET .../status` e `DELETE .../` (revogação best-effort + tokens zerados sempre)
  - [x] **7.18e** Sync assíncrono via RabbitMQ (trio dispatcher/consumers/rabbitmq no padrão synced-lyrics, channel `google_calendar_sync` prefetch 5, 2 filas — confirmed/cancelled): `GoogleCalendarSyncEventsHandler` escuta `BookingConfirmedEvent`/`BookingCancelledEvent` **cross-module via EventEmitter2** (precedente do notifications-module — scheduling-module ficou 100% intocado, zero acoplamento) e só enfileira; erros engolidos+logados (emitAsync propagaria pro fluxo de booking). `GoogleCalendarAuthError` adicionado a `NON_RETRIABLE_ERRORS` (token revogado → DLX direto, integração desativada). Transporte `GOOGLE_CALENDAR_SYNC_TRANSPORT` (`noop` default — inerte até ligar)
  - [x] **7.18f** Use cases do consumer: `SyncBookingConfirmedToGoogleCalendarUseCase` (resolve músico direto ou líder via `Band.members`, no-op se não conectado/sem líder/booking não mais confirmado; compensação da corrida confirm×cancel entre filas — re-check pós-create deleta evento órfão; título enriquecido best-effort com nome do estabelecimento) e `SyncBookingCancelledToGoogleCalendarUseCase` (fonte autoritativa = registro de sync, **não** re-resolve líder — troca de liderança não aponta pra agenda errada)
  - [x] **7.18g** Testes: 15 suítes novas, 93 casos (criptografia incl. adulteração/IV único; aggregates; token service c/ refresh+revogação; connect/status/disconnect; os 2 syncs incl. banda-líder, idempotência, compensação de corrida; HTTP client c/ axios mockado incl. retry/409/404; state service incl. state forjado/expirado; dispatcher/consumers/handler; controllers incl. XSS escape no callback). Suíte completa **na época**: 271/271, 2001/2001 ✅ (inclui fix de teste flaky pré-existente em `musician-profile-touring.aggregate.spec.ts` — dependia da data real). Baseline atual: **315 suítes / 2700 testes** (jul/2026, pós-8E)
  - **Pendente (pós-chaves reais):** teste manual E2E com client OAuth real do Google Cloud (connect → confirmar booking → evento na agenda → cancelar → evento some) e conferência de que nenhum token aparece nos logs do consumer
- [x] **7.17** **Corrigido (jul/2026, revisão do Bloco 11):** `GET /gamification/leaderboard?limit=N` retornava **422 em toda chamada** — `GetLeaderboardInput.limit`/`level` (`get-leaderboard.input.ts`) tinham `@IsNumber()` sem `@Type(() => Number)`; como o `ValidationPipe` global não usa `enableImplicitConversion`, o valor de query string (`"20"`) nunca virava `number` antes da validação, e `@IsNumber` rejeitava a string. Todos os DTOs irmãos (`SearchEstablishmentsDto`, `SearchEventsDto`, `GetRequestSuggestionsInput`) já tinham esse `@Type`; só este ficou de fora. Corrigido adicionando `@Type(() => Number)` em ambos os campos; verificado com `plainToClass`+`validateSync` isolado (antes: `isNumber`/`min`/`max` falhavam; depois: `limit: 20` como `number`, zero erros) e suíte `gamification` completa (190/190 passando). Achado durante revisão de qualidade do `LeaderboardScreen` do fã, não estava documentado como item aberto antes.

---

### Bloco 8 — Cifra Pessoal e Comunidade de Cifras 🎸

> O músico cria a versão **pessoal** de uma cifra gerada pela IA (fork), corrige os acordes que o modelo errou, escolhe tom/capotraste/complexidade e opcionalmente compartilha — com a banda ou com a comunidade. A cifra original da IA permanece imutável.

> ⚠️ **O desenho antigo deste bloco foi superado.** A versão anterior previa copiar
> `AiCifraAnalysisJob.chord_data` para dentro do fork, com `schema_version` e
> `is_shared` booleano, em rotas `/chord-sheet-forks`. O que foi implementado é
> diferente e melhor: **overlay de edições, não cópia**; `base_fingerprint` em
> vez de `schema_version`; `share_scope` de três valores em vez de booleano;
> `reconcile_status` para a re-análise da IA. O texto abaixo descreve o que
> existe no código.

#### Por que overlay e não cópia
Copiar a cifra congela o fork na análise em que ele nasceu. Quando o modelo é
retreinado e a música é re-analisada, o músico fica com uma cifra velha para
sempre, ou perde as correções. Guardando **o que ele mudou**, as correções são
reaplicadas sobre a análise nova e as que não ancoram viram conflito explícito.

#### Regras de negócio
- A cifra original (`music_library.chord_sheet`) é **imutável** — o fork nunca a toca
- Cada músico tem **no máximo 1 fork por `music_library_id`** (índice único no banco)
- Fork é **privado por padrão**; escopos: `private` | `band` | `community`
- Anotações pessoais (`notes`) **nunca** são visíveis para terceiros, nem na comunidade
- Ler NÃO escreve: a re-análise é sinalizada (`base_changed`), nunca aplicada sozinha
- Importar da comunidade **reancora** as correções contra a análise do importador
- Admin pode remover qualquer fork (moderação/takedown)

#### 8A — Fundação de teoria musical ✅
- [x] **8A.1** `ChordSymbol` VO (`shared/domain/value-objects/chord-symbol.vo.ts`) — acorde como estrutura, não string. Aceita as duas notações que circulam no sistema: colon do worker MIR (`C:maj`, `B:hdim7`) e padrão/brasileira (`C7M`, `C#m7(b5)/G#`). `transpose()`, `respell()`, `simplify()`, `equalsEnharmonically()`, `pitchClasses`. Símbolo não parseável devolve `null` e o chamador **preserva o texto verbatim**
- [x] **8A.2** `ChordEdit` e `ChordSheetViewSettings` VOs — o sinal de `transpose − capo` é a única conta de capotraste do repo
- [x] **8A.3** `chord-alignment.service.ts` extraído do use-case base e delegado
- [x] **8A.4** **Unificação do `ChordSymbol` (8E, jul/2026):** `get-chord-sheet-for-music-library.use-case.ts` mantinha uma segunda implementação de acordes — 7 métodos privados que conheciam 9 qualidades colon e só aplicavam grafia enarmônica no ramo colon. Substituídos por delegação ao VO, com testes de caracterização escritos **antes** do refactor. Três divergências corrigidas, todas visíveis para o músico:
  - `C:dim7`, `B:hdim7`, `A:minmaj7`, `D:min6`, `F:maj6`, `G:9` saíam **crus, com dois-pontos** — a tabela antiga devolvia `null` e o símbolo vazava para o app
  - notação de sufixo não era normalizada (`F7M` ficava `F7M` em vez de `Fmaj7`)
  - a grafia por tonalidade **não era aplicada em acorde de sufixo** — e como o ChordFormer emite sufixo, na prática nenhum acorde dele recebia a grafia certa (`A#m7` em tom de Fá, onde o correto é `Bbm7`)

#### 8B — Domínio, persistência e use-cases ✅
- [x] **8B.1** Aggregate `PersonalChordSheet`: `edits[]` (overlay), `view`, `notes`, `share_scope`, `base_fingerprint`, `base_pipeline_version`, `reconcile_status`
- [x] **8B.2** `IPersonalChordSheetRepository` (interface + in-memory + Prisma), **com o override de `SearchParams.filter`** — sem ele o repositório devolveria os dados de todos os usuários
- [x] **8B.3** `chord-sheet-fingerprint.ts` (exclui `confidence`, string canônica) — o sinal real de "a IA re-analisou"
- [x] **8B.4** `chord-sheet-overlay-applier.ts` — não muta o base, remapeia âncoras, 100% determinístico. Conflitos: `anchor_not_found`, `symbol_mismatch`, `ambiguous_match`, `unparseable_symbol`, `out_of_range`
- [x] **8B.5** 14 use-cases (fork, get, view, list, apply/remove edits, view settings, notes, share/unshare, delete, check access, import, list community)
- [x] **8B.6** `PersonalChordSheet.fake()` builder + testes de domínio
- [x] **8B.7** Prisma model + migration `20260728150000_add_personal_chord_sheets`

#### 8E — Exposição HTTP ✅ (jul/2026)
- [x] **8E.1** `is_owner` **fail-closed**: obrigatório em `PersonalChordSheetOutputMapper.toOutput`. Era `?? true` com default no mapper — qualquer esquecimento numa rota de comunidade vazaria `notes` no JSON. Sem default, o mesmo esquecimento é erro de compilação
- [x] **8E.1b** (29/jul/2026) **IDOR na rota do dono, encontrado em auditoria pós-entrega.** Obrigar o campo não bastou: `GET /musicians/:musician_id/personal-chord-sheets/:personal_chord_sheet_id` afirmava `is_owner: true` e o `GetPersonalChordSheetUseCase` só fazia `findById` — era o único use-case alcançado por rota do dono fora do `loadOwnedSheet`. O `MusicianOwnershipGuard` aprova a URL porque o `musician_id` É o do token; ele não sabe de quem é o fork do path. Um músico lia a cifra **privada** de outro, com `notes`, passando o próprio id na URL e o id alheio no sub-recurso. Corrigido trocando o input por `owner_musician_id` + `requesting_musician_id`: posse exigida via `loadOwnedSheet` e `is_owner` **derivado** do dono real. Os testes não pegaram porque o caso "terceiro lê fork privado → 403" só existia no controller de comunidade — agora existe nos dois, com o do use-case incluído
- [x] **8E.2** Conflito `out_of_range` no applier: `insert_chord` fora da duração da música vira conflito em vez de entrar no timeline e deformar a cifra inteira via `normalizeTimeline`
- [x] **8E.3** Read-model de listagem (`IPersonalChordSheetReadModel` + Prisma/in-memory): `edit_count` calculado com `jsonb_array_length` **no Postgres** — a coluna `edits` (até 500 edits ≈ 60 KB/linha) nunca sai do banco numa listagem
- [x] **8E.4** Gating de plano — `max_personal_chord_sheets` (FREE: 3, demais: ilimitado) e `chord_sheet_community_sharing` (FREE: false) em `plan-features.config.ts`; `assertMusicianCanCreatePersonalChordSheet` em `PlanCheckService`. Grant-at-action: cobrado no fork e no import, **nunca na leitura** — quem cai de plano continua tocando as cifras que já tem. Compartilhar com a **banda** é core em todos os tiers
  - ⚠️ **Quebra de assinatura:** o gate ficou DENTRO dos use-cases (padrão `CreateRepertoireUseCase`, "lógica de negócio no core"), então `ForkChordSheetUseCase`, `ImportCommunityChordSheetUseCase` e `SharePersonalChordSheetUseCase` passaram a receber `PlanCheckService` no construtor. Qualquer chamador novo precisa injetá-lo
- [x] **8E.5** Módulo NestJS `personal-chord-sheet-module/` com 3 controllers:
  - `musicians/:musician_id/personal-chord-sheets` (dono) — fork, list, get, chord-sheet, edits, view, notes, share/unshare, delete
  - `community/personal-chord-sheets` (comunidade) — list, get, chord-sheet, import
  - `admin/personal-chord-sheets` (moderação) — browse + takedown
  - ⚠️ **Desvio consciente do desenho antigo (8.7f):** a navegação da comunidade era para ser `@Public()`. Ficou **autenticada** (`@Roles("musician","admin")`). Cifra da comunidade carrega **letra**, e a decisão 7.14 fixou que endpoint público nunca expõe `lyrics`/`chords` — publicar sem login contradiria isso e ampliaria o risco de licenciamento que o kill-switch existe para conter. Se um dia virar vitrine pública de aquisição, é decisão de produto **com** revisão de licenciamento, não um `@Public()` a mais
- [x] **8E.6** Pares de banda resolvidos via `ListBandsUseCase` (`filter.musician_id`, achatando `members[]` com `status === "accepted"`) — sem isso `share_scope: "band"` seria aceito na escrita e ilegível na leitura
- [x] **8E.7** Kill-switch `PERSONAL_CHORD_SHEET_COMMUNITY_ENABLED` (default `true`) — desliga a comunidade sem deploy (rotas de comunidade → 404); rotas do dono seguem intactas. Entradas em `config.schema.ts` e `envs/.env.example`
- [x] **8E.8** Registrado em `app.module.ts` (24 módulos de feature)
- [x] **8E.9** Testes:
  - int-spec do módulo (fork/409/402, terceiro em fork privado → 403, fork community com `notes: null`, `owner_musician_id` na rota de comunidade, banda vs. estranho, takedown de admin, kill-switch ligado/desligado, `edit_count` sem `edits`)
  - regressão do `MusicianOwnershipGuard` em rota aninhada de 3 ids (`ownership.int-spec.ts`)
  - **spec ausente do `GetPersonalChordSheetUseCase`** — era o único dos 14 use-cases de 8B sem teste nenhum, justamente o que decide a redação de `notes`
  - testes de caracterização de formatação de acorde (rede de proteção do 8A.4), escritos ANTES do refactor
  - e2e `test/personal-chord-sheet/` contra Postgres real: fork → correção → overlay com transpose+capô → re-análise → `base_updated` sem write-on-read → share → leitura pela comunidade → import reancorado. É onde o `jsonb_array_length` do read-model roda de verdade
  - Suíte: **315 suítes / 2700 testes** ✅ (baseline anterior 313/2638)
- [x] **8E.10** `CHORD_EDIT_TYPES` exportado de `chord-edit.vo.ts` — a lista em runtime para o DTO validar sem repetir os literais (espelha `PERSONAL_CHORD_SHEET_SHARE_SCOPES`)
- [x] **8E.11** Documentação: este bloco reescrito (o texto anterior descrevia o desenho superado e estava ativamente errado), seção **Personal Chord Sheet** nova em `business-rules.md` (não havia uma linha sobre cifra pessoal) e nota do módulo + 3 armadilhas em `CLAUDE.md`, com `personal-chord-sheet` acrescentado aos domínios e aos escopos de commit

#### Armadilhas registradas (não repetir)
- **Nunca `:id` para o sub-recurso.** `MusicianOwnershipGuard` resolve por `FALLBACK_PARAMS = ["musician_id","musicianId","id"]`; um `:id` de filho colide e dá 403 no dono legítimo. Sempre `:personal_chord_sheet_id` + `@OwnershipParam({ param: "musician_id" })`
- **`owner_musician_id`, não `currentUser.userId`.** Nas rotas de comunidade, `GetPersonalChordSheetViewUseCase` precisa do id do DONO: a linha de `music_library` é dele e o use-case base lança `NotFoundError` se não bater
- **`base_version` é coluna morta** — nunca populada, sempre 0. É advisory por desenho: `MusicLibrary.updateChords()` não incrementa versão, então quem detecta re-análise é `base_fingerprint`. Não usar como fast-path
- **Os dois caminhos gêmeos de conclusão.** `CompleteAiCifraAnalysisJobUseCase` e `ProcessAiCifraAnalysisJobUseCase` são gêmeos; mudanças já cobriram só metade deles três vezes. Se 8C entrar com hook de invalidação de fork, tocar **os dois**

#### Pendente
- [ ] **8C** Reconciliação: `markBaseUpdated()` / `markReconciled()` / `clearEdits()` existem no agregado e **ainda não têm chamador de produção**. Precisa de use-case de reconciliação + hook de invalidação nos dois caminhos gêmeos de conclusão do ai-cifra
- [ ] **8C.1** `POST /:id/report` (denúncia) — fora do escopo de 8E: não existe use-case de denúncia em 8B e criar um agregado de moderação inflaria a entrega. Takedown de admin + kill-switch cobrem a emergência
- [~] **8D** UI no mobile — implementação completa em `soundmeet-mobile` (6 telas na `RepertoireStack`, editor de overlay, notas privadas/anotações públicas, compartilhamento, comunidade e import); typecheck/Expo config/100 testes limpos. Falta validação manual em device contra backend real antes de marcar `[x]`
- [ ] **8F** Diagramas de digitação por instrumento (`ChordSymbol.pitchClasses` já existe para isso)

**Referência:** [AI-musician/chord-sheet.md](AI-musician/chord-sheet.md) · `src/core/personal-chord-sheet/`

---

## ⚠️ Bloco 9.7 — Defeitos de fronteira HTTP (09/ago/2026) ✅

Encontrados ao implementar o **W2 do web** (eventos), batendo no container real com `curl`. Os três
já estão corrigidos. **O que importa aqui não são os três bugs — é o padrão:** todos sobreviveram a
uma suíte de 2876 testes verdes porque **todo teste do backend monta o input em memória**
(`new Date()`, `SearchParams.create({ filter })`) e pula a fronteira HTTP, que é exatamente onde os
três moram.

- [x] **9.7a — `@Type(() => Date)` faltando nos inputs de evento.** `CreateEventInput`,
      `UpdateEventInput` e `AddEventPerformerDto` tinham `@IsDate()` sem `@Type`. Como o
      `ValidationPipe` global não usa `enableImplicitConversion`, `POST /establishments/:id/events`
      respondia **422 "start_at must be a Date instance" para qualquer corpo** — criar evento pela
      API era impossível. Mesmo bug do 7.17 (`/gamification/leaderboard`), e o `scheduling` já
      tinha a correção com comentário (`search-bookings.dto.ts:72`).
      Regressão: `events-module/dto/__tests__/event-date-coercion.dto.spec.ts`.

- [x] **9.7b — `EventMusician.fee` (Decimal) não convertido no mapper.** A coluna é
      `Decimal? @db.Decimal(12,2)`, o `EventMusicianModel` declara `number | null` e o repositório
      passa `as any` — o compilador nunca viu. O `Decimal` chegava ao agregado, o `@IsNumber()`
      recusava e o `toEntity` lançava `LoadEntityError`: **um** performer com cachê gravado
      transformava `GET .../performers` num 422 permanente para o line-up inteiro. Corrigido com a
      mesma linha que `booking-model-mapper.ts:64` já fazia certo. (`Event.coverCharge` escapou por
      acidente — é `Float?`, não `Decimal`.)

- [x] **9.7c — 🔴 `app.set("query parser", "extended")` (Express 5).** O mais grave. O Express 5
      trocou o parser padrão para `"simple"`, que não monta objeto aninhado; `?filter[status]=x`
      virava a chave literal `"filter[status]"`, o `filter` do DTO ficava `undefined` e o
      `whitelist: true` descartava. **Toda busca com filtro da API devolvia a lista inteira, com
      HTTP 200 e sem nenhum erro** — musicians, events, bookings, inquiries, establishments.
      Medido: `filter[status]=cancelled` devolvia o evento `active`; `filter[name]=zzz` devolvia
      todos os músicos. O pior caso é a **busca por raio** (7.13b/c): `filter[lat]/[lng]/[radius_km]`
      descartado significa devolver o país em vez do bairro.

- [x] **9.7d — Swagger de `SearchEventsDto` anunciava campos de `sort` inexistentes.** O enum
      listava `start_at` e `updated_at`; os aceitos são os nomes de COLUNA do Prisma
      (`sortableFields`), e campo fora da lista lança `InvalidArgumentError` → 422, sem fallback.
      Quem seguisse o Swagger tomava 422. Enum corrigido e as três listas do módulo documentadas no
      próprio DTO.

### Pendências abertas descobertas junto (não corrigidas — precisam de decisão)

- [x] **`POST /auth/login` recusa conta de estabelecimento** — resolvido (F1.1, ago/2026).
      `LoginUseCase.resolveProfile` procurava só em `musicianRepo` e `audienceRepo`; sem aggregate
      local lançava `UnauthorizedError`, e a resposta era **401 "Credenciais inválidas"** com
      credenciais válidas. Agora consulta `establishmentRepo.findByEmail` **por último** (musician
      e audience são o caminho quente) e devolve `role: "establishment"`.
      - **`profile_id` é o UUID do agregado, não o `sub`** — a igualdade `id == sub` não vale nesta
        persona. Novo tipo `LoginRole = RegisterRole | "establishment"` em `login.output.ts`;
        `RegisterRole` ficou intocado de propósito, porque estabelecimento não entra por
        `POST /auth/register`.
      - **Por que não devolvemos a lista de unidades:** `establishments.email` é `@unique` e **não
        existe vínculo usuário↔estabelecimento no banco** — a relação vive só no claim
        `establishment_ids`. O login resolve exatamente a unidade cujo email foi usado; a lista
        completa o cliente lê do próprio `access_token`.
      - **Impacto no mobile:** `applyTokenSession` só distingue musician de audience e gravaria o id
        do estabelecimento como `audienceId`, corrompendo a sessão em silêncio. `useLogin` passou a
        barrar `role === "establishment"` com mensagem apontando o painel web.
      - `AddRoleUseCase` **continua binário** musician/audience (item 9.1c) — assume a invariante
        `aggregate.id == sub`, que não vale para estabelecimento.

- [x] **Rate limit global por IP atrás de um BFF** — resolvido. `UserThrottlerGuard`
      (`shared-module/guards/user-throttler.guard.ts`) substitui o `ThrottlerGuard` padrão como
      `APP_GUARD` (`app.module.ts:120`): o tracker passa a ser `user:<sub>` do JWT, com fallback
      para IP em rota anônima. Antes, como todo o `soundmeet-web` sai do IP do BFF, os
      `RATE_LIMIT_MAX ?? 100`/60s valiam para **o painel inteiro somado** — ~15 page views/minuto
      esgotavam a cota e todo mundo passava a 429 ao mesmo tempo.
  - **Escolhido `sub` e não `X-Forwarded-For`:** `trust proxy` exige saber **quantos** proxies
    existem na frente, e o número muda entre compose, load balancer e CDN. Com `n` alto demais o
    cliente escolhe o próprio IP aparente escrevendo o header — um mecanismo de defesa cuja
    configuração correta depende da topologia vai estar errado em algum ambiente.
  - **A assinatura é verificada de verdade**, e isso não estava no plano: o desenho original aceitava
    decodificar o token sem verificar, com o custo explícito de "quem forjar `sub` ganha baldes
    novos". Não foi preciso pagar — o `AuthModule` é `@Global()` e exporta o `AuthJwtVerifier`, que
    já mantém o JWKS em cache, então verificar aqui é criptografia local sem round-trip. Para ganhar
    balde novo agora é preciso um token **válido**.
  - ⚠️ **Nunca lança daqui.** Token ausente, expirado ou de outro emissor cai em IP em silêncio —
    um 401 vindo do rate limiter mataria toda rota `@Public()` que recebe um Bearer velho por tabela.
    Testes em `shared-module/__tests__/user-throttler.guard.spec.ts`.

---

## Bloco 10 — Contrato Digital de Show 📄

> Todo show confirmado gera automaticamente um contrato adaptado àquele artista, àquele local e
> àquele valor; as duas partes assinam eletronicamente pelo canal que já usam (web para o bar, app
> para o músico); o documento fica congelado, com hash de integridade e página pública de
> verificação.

Chamado **F1.3(b)** no plano de fases do produto. A ordem foi **invertida de propósito**: o plano
original mandava fazer o escrow primeiro e o contrato como camada de cima. O contrato não toca em
dinheiro, então entrega valor sozinho (prova documental contra chargeback — camada 1 de
[payment-gateway-decisions.md](payment-gateway-decisions.md), anti-calote, profissionalização da
negociação) com risco regulatório zero, enquanto **escrow sem contrato assinado é a pior combinação
possível**: custódia de recursos de terceiros sem documento probatório.

> ⚠️ **Correção de premissa registrada:** o **F1.0** (subconta/wallet Asaas por músico) **não está
> implementado** — grep em `src/` e `prisma/` devolve zero ocorrências de `asaas_wallet_id` ou
> `subaccount`; o único wallet id existente é o `ASAAS_WALLET_ID` da plataforma
> (`config.schema.ts:168`). Ele era declarado pré-requisito do F1.3 e não é.

#### Decisões tomadas
| Decisão | Escolha |
|---|---|
| Ordem | Contrato primeiro; escrow (F1.3a) vira bloco próprio |
| Custódia do escrow | **Mecanismo real decidido no deploy** 🔴 — a porta `IBookingEscrowGateway` foi planejada e **não** chegou a ser escrita; o contrato foi entregue sem ela (verificado em 15/ago/2026) |
| Assinatura | Própria (aceite + trilha + hash), atrás de `IContractSignatureProvider` |
| Gatilho | Emitido no `BookingConfirmedEvent`; **não bloqueia** o show |
| Catálogo de cláusulas | **Código, não banco** — ver abaixo |

#### Por que o catálogo é código e não banco
O desenho original previa `ContractClause`/`ClauseVariant`/`ContractTemplate` como agregados com
repositório. Foi recusado: quem edita texto de cláusula é a SoundMeet com advogado, e texto jurídico
precisa ser enviado **atomicamente com o código que resolve suas variáveis**. Em banco, nasceria um
CRUD administrativo que ninguém usa, toda correção de redação viraria migration, e seria possível
alterar texto legal em produção sem revisão. Em código, **revisão jurídica = code review**, o teste
de snapshot trava a redação, e `body` é função pura de variáveis tipadas — variável renomeada é erro
de compilação. O único agregado persistido é `Contract`, que guarda o snapshot já renderizado.

#### 10A — Domínio e catálogo ✅ *(B1)*
- [x] **10A.1** Agregado `Contract` **imutável por construção** — não existe mutador de conteúdo, só de status e assinatura. 4 VOs (`ContractParty`, `ContractSignature`, `ContractVariables`, `RenderedClause`)
- [x] **10A.2** `IContractRepository` (interface + in-memory + Prisma) **com o override de `SearchParams.filter`** — sem ele o repositório devolveria contrato de todos os estabelecimentos
- [x] **10A.3** Catálogo de **23 cláusulas / 38 variantes** em 8 arquivos por categoria, cada cláusula com `legal_note`
- [x] **10A.4** Tetos legais como invariante validada, não só redigida: multa ≤ 100% do cachê (CC art. 412), exclusividade dentro do cap de km/dias (CF art. 5º, XIII)
- [x] **10A.5** Testes do catálogo: 1728 contextos, Proxy comparando `consumes` nos dois sentidos, snapshot por variante, nenhuma variante inalcançável (com a exceção documentada de `tributos.contratante_pf`)

#### 10B — Persistência, renderização e HTTP ✅ *(B2)*
- [x] **10B.1** Migration `20260815120000_add_contracts` + `enum ContractStatus`; FK `Restrict` em booking/establishment e `SetNull` em musician/band
- [x] **10B.2** Mapper que **recalcula o `content_hash` na carga** e recusa contrato adulterado no banco
- [x] **10B.3** Três portas: `IContractRenderer`, `IContractStorage`, `IContractSignatureProvider`
- [x] **10B.4** `ReactPdfContractRenderer` — o teste gera PDF de verdade, com acentuação. O risco declarado (`@react-pdf/renderer` × CommonJS) **não se materializou no runtime** (Node 22 faz `require(esm)` nativo) mas materializou no Jest; resolvido com `transformIgnorePatterns` cirúrgico
- [x] **10B.5** Storage privado — **`IContractStorage` não tem `getPublicUrl`**, e isso é a feature: sem função que produza URL pública, vazar contrato fica impossível por construção
- [x] **10B.6** 7 use-cases (issue, sign, get, get-document, list, verify, annul) + `ContractIssuanceHandler` no `BookingConfirmedEvent`
- [x] **10B.7** `contract-module` com 2 controllers (autenticado + verificação pública isolada), presenter, DTOs, providers, envs, registro no `app.module.ts`, `int-spec` das rotas
  - ⚠️ **Correção (19/ago/2026):** este item dizia "int-spec das 7 rotas" e **não era verdade** — o
    arquivo cobria 5 grupos; `POST /contracts/issue` e `POST /contracts/:id/annul` não tinham um
    único teste. E a rota sem teste era exatamente a que estava sem autorização (ver 10E). Cobertas
    agora, mais um spec de DTO na fronteira do `ValidationPipe`

##### Três correções de desenho feitas durante a implementação
- 🔴 **Fabricação de CPF.** `buildContractor` derivava o documento do representante legal dos 11 primeiros dígitos do CNPJ, porque `ContractParty` exigia representante para PJ. É falsificar documento num instrumento que existe para provar fatos, e o erro passaria despercebido até alguém conferir. Corrigido na raiz: representante opcional, `signer_document` nullable, e a âncora de identidade passou a ser `signer_user_id`
- **Integrantes da banda iam por UUID** — `contratado_integrantes` recebia `member.musician_id.id`, então a formação sairia como lista de UUIDs. Passou a resolver nomes por `findByIds`
- **`RenderedClause` preservava as quebras do arquivo-fonte**, produzindo parágrafos esfarrapados no PDF. Passou a refluir: linha em branco separa parágrafo, quebra interna vira espaço

#### 10C — Qualificação real das partes ✅ *(15/ago/2026)*
> Nasceu de duas perguntas do usuário sobre a B2: *"isso está dentro da lei? além disso não deveria
> ser flexível?"* e *"o correto seria pedir o CPF do representante legal"*. As duas pegaram
> limitações reais.

- [x] **10C.1** `Musician.cnpj` (MEI) — migration aditiva `20260815160000_add_musician_cnpj`, agregado, mapper, fake builder, `findByCnpj` nas três camadas de repositório, `update-musician` com checagem de duplicidade (`@unique` estouraria P2002 → 500), DTO e presenter
  - **Fora de `MusicianCreateCommand` de propósito** — o cadastro continua sendo de pessoa física; o CNPJ entra em configurações do perfil. A regra está no sistema de tipos, não só em comentário: um patch que tentou passar `cnpj` na criação foi recusado pelo `tsc`
  - **PII:** sai por `MusicianPresenter` (dono/admin), **nunca** por `PublicMusicianPresenter` — mesmo tratamento de email/telefone, com teste que trava
- [x] **10C.2** Eixo `contracted_is_company` no `ClauseContext` + terceira variante `tributos.contratado_pj`. **Não é simetria decorativa:** a retenção previdenciária alcança o contribuinte individual (art. 4º da Lei 10.666/2003), e MEI é pessoa jurídica — sem a variante, o contrato mandaria o bar fazer retenção indevida. As duas variantes antigas passaram a declarar `contracted_is_company: false` para não colidir (aplicabilidade não-exclusiva escolhe a primeira, em silêncio)
- [x] **10C.3** `collectMissingQualification` aceita **CPF OU CNPJ** do músico — o MEI que só cadastrou o CNPJ está qualificado
- [x] **10C.4** `Establishment.legal_representative_name` + `_document` — migration aditiva `20260815170000_add_establishment_legal_representative`, agregado com `changeLegalRepresentative` (CPF sem nome é recusado; nome sem CPF é aceito), mapper, fake builder, use-case, DTO, presenter
  - **PII:** `GET /establishments/:id` é `@Public()`. O CNPJ é registro público e sai inteiro; o CPF do representante sai **mascarado** (`529.***.**7-25`) — o bastante para o dono conferir na tela, nada para colher CPF alheio. O valor íntegro só circula dentro do servidor, na emissão
- [x] **10C.5** `buildContractor` passa a preencher o representante real; nova pendência `contratante.representante_legal` (exige nome **e** CPF — meia qualificação é o papel fraco que a fatia conserta)
- [x] **10C.6** UIs de configuração: campo de CNPJ MEI no perfil do músico (mobile, seção Identidade, com máscara e validação) e nome + CPF do representante no perfil do estabelecimento (web). **Nenhum dos dois entra em cadastro/signup**
- [x] **10C.7** Gates: backend **351 suítes / 3250 testes** · mobile 9/132 · web 88 arquivos/816 testes · `tsc` e lint limpos nos três

#### 10D — Documentação ✅ *(B5)*
- [x] **10D.1** [contract/contract-digital.md](contract/contract-digital.md) — arquitetura do subsistema
- [x] **10D.2** [contract/legal-checklist.md](contract/legal-checklist.md) — **o documento que vai ao advogado**, com as perguntas abertas em formato de checklist
- [x] **10D.3** Seção "Domínio Contract" em [business-rules.md](business-rules.md)
- [x] **10D.4** Aviso 🔴 da decisão pendente de custódia em [payment-gateway-decisions.md](payment-gateway-decisions.md)
- [x] **10D.5** Este bloco + `CLAUDE.md` dos três projetos + índice em [README.md](README.md)

#### 10E — Correções de segurança da emissão ✅ *(19/ago/2026)*

> Achadas numa auditoria do bloco inteiro pedida pelo usuário, lendo o código contra os docs. A
> suíte estava verde (355 suítes / 3321 testes) e o `tsc` limpo — **nada disto aparecia em teste**,
> pelo mesmo motivo do 9.7: a rota com o defeito não tinha teste nenhum, e o item 10B.7 afirmava
> que tinha.

- [x] **10E.1 🔴 `POST /contracts/issue` não tinha autorização nenhuma.** O controller repassava o
      DTO cru (`issueUseCase.execute(dto)`) e `IssueContractInput` não carregava identidade do
      requisitante. O `GetContractUseCase` chamado logo depois protegia só a **leitura** — quando os
      efeitos já tinham acontecido. Três consequências, todas antes do 403:
  - qualquer usuário autenticado com um `booking_id` fazia nascer contrato **alheio**: PDF no
    storage, `ContractIssuedEvent` publicado e `ContractDeliveryHandler` mandando o documento — com
    CPF, CNPJ, endereço e cachê — por e-mail às duas partes;
  - o ramo `{ issued: false, missing: [...] }` retornava **antes** de qualquer checagem, virando um
    oráculo do estado cadastral alheio (`contratado.cpf`, `contratante.representante_legal`);
  - o ramo de idempotência devolvia o `ContractOutput` de terceiros direto do use-case.
- [x] **10E.2 A identidade virou campo obrigatório e nulável**, não opcional:
      `requesting_participant_ids: string[] | null` **sem default**. `null` é o caminho do sistema
      (`ContractIssuanceHandler`), declarado em código. Opcional é o que deixou a rota nascer sem
      autorização; obrigatório força cada novo chamador a decidir, e o `tsc` cobra — foi assim que a
      correção encontrou sozinha os 26 call-sites do spec. Mesma lição de `is_owner` no
      `personal-chord-sheet`.
- [x] **10E.3 Fail-closed sobre lista vazia.** `assertNegotiationViewer` **pula** a checagem quando
      o ator não tem identidade nenhuma — convenção dos jobs internos de scheduling. Aqui isso seria
      fail-open para todo token sem claim utilizável, então a lista vazia é barrada antes de chamar o
      helper.
- [x] **10E.4 `tone`/`outdoor`/`exclusivity_requested` saíram da rota HTTP.** A decisão de produto
      da B3 já dizia "retentativa só com `booking_id`", e o `soundmeet-web` obedecia — **só o backend
      discordava**. `IssueContractDto` virou `OmitType`, e um spec roda o `ValidationPipe` real
      (mesmas opções de `applyGlobalConfig`) provando o descarte: o controller faz `...dto`, então
      whitelist é o que separa o corpo da regra.
- [x] **10E.5 `requesting_user_id` obrigatório na assinatura.** `sign-contract` e
      `request-signature-challenge` faziam `input.requesting_user_id ?? ""`: a **âncora de identidade
      da assinatura** degradava para string vazia em silêncio, no exato documento que existe para
      provar quem assinou — e a chave do desafio (que inclui o signatário) virava um balde
      compartilhado entre pessoas diferentes do mesmo papel.
- [x] **10E.6 Código de assinatura passou a HMAC.** Era `createHash("sha256")` puro sobre 6 dígitos:
      1 milhão de possibilidades, quebrável por tabela pré-computada — quem vazasse o Redis leria os
      códigos vivos. Agora `createHmac` com `CONTRACT_CHALLENGE_SECRET` (Joi exige ≥32 chars em
      produção). Teste prova que um provider com outro segredo recusa o mesmo código.
- [x] **10E.7 `@Throttle` 5/60s no `POST /:id/sign/challenge`.** Cada pedido invalida o anterior e
      escreve na caixa de entrada de alguém; repetido, impede a própria parte de assinar.

**Referência de teste:** `issue-contract.use-case.spec.ts` (8 casos de autorização, incluindo "recusa
sem criar contrato, subir PDF ou renderizar"), `contracts.controller.int-spec.ts` (issue + annul) e
`contract-module/dto/__tests__/issue-contract.dto.spec.ts` (fronteira do pipe).

#### Armadilhas registradas (não repetir)
- **Autorizar na saída não é autorizar.** `POST /contracts/issue` filtrava o resultado e parecia
  seguro; o contrato alheio já tinha nascido, o PDF já estava no storage e o e-mail já tinha saído.
  Em rota que escreve, a checagem vem **antes do primeiro efeito**, não antes do `return`
- **Campo de autorização opcional é campo esquecido.** Se `requesting_participant_ids` fosse `?:`,
  o chamador novo simplesmente não o passaria e nada acusaria. Obrigatório-e-nulável transforma a
  omissão em erro de compilação
- **Nunca fabricar documento.** Nem CPF derivado de CNPJ, nem razão social inventada, nem endereço chutado. Quando o dado não existe, o documento diz que não existe, ou a emissão vira pendência. É a única falha deste subsistema que ninguém percebe até alguém conferir
- **Aplicabilidade não-exclusiva escolhe a primeira variante, sem erro.** Toda variante nova precisa fechar os eixos que as irmãs abrem
- **Ordem de rota quebra em silêncio:** `@Get(":contract_id")` depois de `@Get()` e antes dos `@Post`. E a rota `@Public()` mora em controller separado — um `@Public()` solto num controller com `@UseGuards` expõe rota autenticada sem querer
- **`IContractStorage` sem `getPublicUrl` é decisão, não esquecimento.** Não adicionar

#### Pendente
- [ ] 🔴 **Revisão por advogado** — gate para o primeiro contrato em produção. `legal-checklist.md` §10 é a lista de perguntas
- [x] **B3 — Web ✅ (16/ago/2026):** feature `contract` completa em `soundmeet-web` — 5 Route Handlers
      de BFF, lista `/dashboard/contratos` com filtro de status, detalhe com `ContractDocument` em
      HTML nativo (índice de cláusulas com scroll-spy, snapshot como fonte e PDF como derivado),
      assinatura, downloads, reenvio de e-mail, pendência acionável de qualificação e página pública
      `/contrato/[codigo]`. Gates: `tsc` e lint limpos, **93 arquivos / 867 testes** (eram 88/817).
  - ⚠️ **A assinatura é de DOIS passos, e o briefing da B3 dizia um.** `challenge_code` é
    `@IsNotEmpty()` em `SignContractInput` — sem ele o backend recusa. A UI pede o código, mostra o
    destino mascarado e o vencimento, e **não trava o botão em ter um desafio vivo na sessão**: o
    código vale 10 min no servidor e sobrevive a um reload, enquanto pedir outro invalida o que a
    pessoa acabou de receber.
  - **Decisões de produto tomadas com o usuário:** item próprio no menu (contrato tem ciclo de vida
    independente do booking) · retentativa de emissão só com `booking_id`, sem expor `tone`/`outdoor`/
    `exclusivity_requested` (exclusividade é opt-in com tetos legais e não cabe num botão de "tentar
    de novo") · nota discreta de que a assinatura vale como prova escrita e **não** é título
    executivo, ao lado do aceite.
  - **Achado durante a implementação:** as chaves de `missing` se dividem entre o que o
    estabelecimento resolve (`contratante.*`) e o que só o artista resolve (`contratado.*`). A UI
    separa as duas listas — mandar o dono do bar "corrigir" o CPF do músico é enviá-lo a uma tela que
    não existe. Chave desconhecida aparece com o nome cru e **não** habilita a retentativa.
  - 🔴 **Ver a pendência do Anexo I registrada abaixo** — nasceu desta fatia.
- [x] **B4 — Mobile ✅ (19/ago/2026):** feature `contract` em `soundmeet-mobile` — FSD completa
      (domain/application/infrastructure/ui), `ContractListScreen` + `ContractDetailScreen`,
      `ContractSignSheet` de dois passos e Anexo I reusando `StageTechSpecSection`. Gates: `tsc`
      limpo, `expo config` resolve, **11 suítes / 158 testes** (eram 10/137). Entradas: tile
      "Contratos" no `QuickAccessGrid` e linha no `ProfileMenuGroups`, ambas em `colors.accent.violet`
      (contrato é continuação da negociação, mesma cor de Propostas e Agenda).
  - **O contrato É a tela do show**, como desenhado: `GET /scheduling/bookings` continua sem chamador
    em `src/`, e `ContractShowSummary` mostra data, dia da semana, horário, duração, endereço e
    cachê — todos com o texto **pronto do backend**, nunca reformatado, porque refazer a formatação
    no cliente criaria uma segunda verdade sobre documento congelado.
  - **Sem badge de "aguardando você" nas entradas**, e isso é a regra e não esquecimento: a contagem
    viria de `features/contract` e a regra de ouro do FSD proíbe `features/musician` importar de
    outra feature. Mesmo precedente já registrado no tile de Propostas. O hook
    `usePendingContractCount` existe e é usado **dentro** da própria feature (o filtro "Aguardando
    você (n)" da lista).
  - **"Baixar" é receber por e-mail** (`POST /contracts/:id/document/send`). `expo-file-system` não
    está instalado, o documento carrega CPF/CNPJ/endereço/cachê, e a caixa de entrada persiste fora
    do telefone — que é exatamente o valor probatório que a camada 4 de anti-chargeback busca. Os
    três desfechos são distinguidos (`describeContractDelivery`): PDF inexistente **não** sugere
    "tente de novo", que mandaria a pessoa insistir para sempre.
  - 🔴 **Defeito pego na auto-revisão:** a trava "role até o fim para assinar" usava só `onScroll` —
    e conteúdo que **cabe** na tela nunca dispara `onScroll`, então um contrato curto tornava a
    assinatura impossível de liberar. Corrigido medindo viewport (`onLayout`) e conteúdo
    (`onContentSizeChange`) e reavaliando em **ambos**: os dois callbacks não têm ordem garantida, e
    medir só num deixaria o caso em que ele chega primeiro sem reconferência.
  - **Contrato anulado mostra o motivo.** `annul_reason` é obrigatório na rota justamente para isto:
    ver só "Anulado" não diz se o show caiu, se o cachê estava errado ou se vem outro no lugar.
- [x] 🔴 **Anexo I fora do `content_hash` — corrigido em 16/ago/2026** *(achado durante a B3)*.
      O Anexo I **existia** no PDF (`StageTechSpecAnnex`, nome em inglês — por isso um grep por
      "Anexo" não o encontrava), mas chegava por um campo próprio da porta do renderer
      (`ContractRenderInput.stage_tech_spec`), lido do **perfil vivo** do estabelecimento. Ou seja:
      ficava **fora do snapshot e fora do hash**. Duas emissões do mesmo contrato com a ficha
      editada entre elas produziam documentos diferentes com o **mesmo** `content_hash` — enquanto
      `estrutura_tecnica.com_anexo` transforma *"item declarado no Anexo I"* em inadimplemento. A
      única parte do documento fora da verificação de integridade era justamente a que cria
      obrigação. E a B3 não conseguia renderizá-lo, porque o dado não estava no snapshot que
      `GET /contracts/:id` devolve.
  - **Correção:** `ficha_tecnica_anexo?: StageTechSpecJSON` em `ContractVariables`, congelado na
    emissão sob a **mesma condição** que escolhe a variante da cláusula (`has_stage_tech_spec`). O
    campo `stage_tech_spec` **saiu da porta do renderer** — duas fontes para o mesmo conteúdo é o
    que permitiu a divergência; agora o PDF lê de `variables`, como o web.
  - **Não precisou de `show-v2`.** Nenhum corpo de cláusula mudou (os 38 snapshots seguem intactos),
    e contrato antigo renderiza igual.
  - 🔴 **A invariante que torna isso seguro:** a chave é **ausente**, nunca `null`.
    `JSON.stringify` omite `undefined` e inclui `null`, e `ContractModelMapper.toEntity` **recalcula
    o hash na carga** e recusa contrato divergente — um `null` faria todo contrato já assinado parar
    de carregar com `LoadEntityError`. O construtor do VO apaga a chave para qualquer valor que não
    seja objeto, e `contract-variables.vo.spec.ts` trava isso com um teste dedicado (incluindo o caso
    `null` e o caso array).
  - Paridade de rótulos entre PDF e painel travada por teste nos **dois** projetos.
- [ ] ~~**E-mails** de contrato emitido/assinado com PDF anexo~~ — ✅ **já existe** (verificado em
      16/ago/2026): `ContractDeliveryHandler` + `POST /contracts/:id/document/send`, com PDF anexo e
      hash no corpo. Este item estava desatualizado; `payment-gateway-decisions.md` já registrava a
      camada 4 como concluída em 15/ago
- [~] **F1.3(a) — Escrow.** 🟡 **Domínio, portas, adapters e job entregues em 19/ago/2026;
      falta a fatia HTTP e a criação da subconta (F1.0) em produção.**

  **O que existe agora:**
  - `BookingEscrow` — agregado como máquina de estados (`pending → held → released | refunded |
    disputed`), com repositório nas três camadas e o **override de `SearchParams.filter`** (sem ele
    o repositório devolveria a custódia de todos os músicos: valor de cachê, comissão e a
    referência da cobrança no provedor)
  - `MusicianWallet.held_balance` + `holdFunds`/`releaseHeldFunds`/`refundHeldFunds`, e a subconta
    (`asaas_wallet_id` + `apiKey` **cifrada** na infra de SM-016)
  - `Booking.checkIn()` e `Booking.dispute()` — o registro da apresentação vale por si como camada 3
    de prova contra chargeback, com ou sem escrow
  - Portas `IBookingEscrowGateway` / `ISubaccountGateway` + `AsaasEscrowAdapter` /
    `AsaasSubaccountAdapter`
  - `ReleaseBookingEscrowUseCase`, `ProcessDueEscrowReleasesUseCase` e `EscrowReleaseJob` (horário)
  - `escrow_release_days` no catálogo de planos: **D+2 pago / D+5 FREE**. É prazo, não gate —
    ninguém é bloqueado, o FREE só recebe depois
  - `uses_escrow` no contrato passou a vir da config (`ESCROW_ENABLED` +
    `ESCROW_CUSTODIAN_LEGAL_NAME`). **Nenhum corpo de cláusula mudou** — os 38 snapshots seguem
    intactos, como previsto

  **Cinco decisões que valem registro:**
  - 🔴 **O dinheiro não é da plataforma, e o código reflete isso.** `held_balance` é ESPELHO do que
    está bloqueado na subconta do músico, não um saldo lógico numa conta nossa. O caminho (i) de
    `payment-gateway-decisions.md` foi recusado porque a cláusula `papel_da_plataforma.com_custodia`
    **afirma** que o valor não integra o patrimônio da SoundMeet — ligá-lo por ali transformaria
    cláusula assinada em declaração falsa.
  - **A comissão só vira receita na liberação.** `platform_fee` é congelada na criação mas não é
    receita até `released`. Show não realizado, nenhuma comissão — é o argumento mais forte contra
    responsabilidade solidária, e está escrito na cláusula.
  - **A ordem provedor → custódia → carteira não é arbitrária.** Marcar como liberado antes de o
    provedor confirmar deixaria o app anunciando um saldo que o gateway recusa a sacar. Teste
    dedicado prova que a falha do provedor não move nada.
  - **Divisão em CENTAVOS INTEIROS** (`BookingEscrow.splitAmount`): `amount.subtract(fee)` em ponto
    flutuante produz `1111.1000000000001` e o `Money` recusa — o agregado nascia inválido para uma
    combinação comum de cachê e percentual. Também é o que garante
    `platform_fee + net_amount === amount` exatamente; centavo perdido em arredondamento é centavo
    que ninguém recebe.
  - **Liberar exige check-in E ausência de contestação.** Só por prazo entregaria o cachê de um show
    que ninguém confirmou ter acontecido; com contestação aberta seria decidir a disputa por
    omissão. O prazo conta do **fim do show**, não da retenção — o pagamento é antecipado.

  **Armadilha nova registrada:** `ClassValidatorFields` repassa `fields` como `groups` do
  class-validator. Passar nomes de PROPRIEDADE ali derruba toda a metadata e o validador responde
  *"an unknown value was passed to the validate function"* — parece erro de tipo, é de configuração,
  e faz **todo** agregado nascer inválido. Sempre `[]` quando não há campos, como `TipValidator`.

  **Fatia HTTP — parte 1 entregue (19/ago/2026):**
  - `POST /scheduling/bookings/:id/check-in` — as **duas partes** podem registrar. Em muita casa
    quem tem o app aberto no fim da noite é o dono, e um check-in feito pela contraparte é prova
    ainda mais forte a favor do artista. Corpo vazio: a hora é do **servidor**, porque aceitar
    `checked_in_at` do cliente permitiria registrar um show de ontem como se fosse de hoje
  - `POST /scheduling/bookings/:id/dispute` — 🔴 **só o CONTRATANTE.** Contestar é dizer "o serviço
    não foi entregue"; deixar o artista fazer isso seria deixá-lo travar o próprio pagamento. A
    checagem **não** usa `assertNegotiationParticipant` (que aceita qualquer lado) e é fail-closed
    sobre lista de identidades vazia
  - `int-spec` na fronteira HTTP (`booking-check-in.int-spec.ts`): prova que o papel vem do TOKEN,
    que o `checked_in_by` sai `band` no show de banda **exigindo o líder**, e que o músico toma 403
    ao tentar contestar — sem gravar nada
  - `SchedulingModule` não conhece `payment`: marcar o booking já bloqueia a liberação automática,
    porque `ProcessDueEscrowReleasesUseCase` confere `booking.isDisputed`. Congelar o agregado
    `BookingEscrow` é ato da mediação, que é humana por desenho

  **Falta:** criação da subconta por HTTP (F1.0), webhooks de `PAYMENT_RECEIVED`/escrow no
  `AsaasWebhookController`, e a UI. E o ⚠️ **período de avaliação do Asaas** (60 dias, máx. 10
  subcontas e R$2.000 por subconta) define o tamanho do piloto — ver
  [payment-gateway-research-2026-08.md](payment-gateway-research-2026-08.md)
- [ ] Auditoria de vocabulário de emprego nas telas; prazo de retenção; banda com CNPJ próprio; endereço estruturado do músico

**Referência:** [contract/contract-digital.md](contract/contract-digital.md) · `src/core/contract/`

---

## Bloco 10B — Fechamento do escrow, avaliação no mobile e ponte Spotify ✅ *(21/ago/2026)*

> **Registrado retroativamente em 22/ago/2026.** As três features foram entregues em 21/ago sem
> passar pelos docs canônicos — só a taxa entrou em `plans/musician-plans.md`. Enquanto isso durou,
> a regra "verifique `business-rules.md` antes de assumir que algo existe" dava **falso negativo**
> nestes três pontos. Detalhe das regras em [business-rules.md](business-rules.md).

### 10B.1 — Escrow: fatia HTTP e webhooks ✅

- [x] `CreateBookingEscrowUseCase` no `BookingConfirmedEvent`; ordem persistir → cobrar → referenciar
- [x] `findChargeByReference` antes de criar — sem isso a retomada emitia um **segundo PIX**
- [x] Branch `escrow:` no `AsaasWebhookController`, avaliado antes do caminho de gorjeta
- [x] `markHeld`/`release` dentro de `UnitOfWork` — a falha entre os dois updates deixava
      `held_balance` errado **permanentemente**, porque a reexecução retornava cedo
- [x] `GET /musicians/:id/wallet/escrow` (extrato somente-leitura). **Sem rota de reter/liberar**
- [x] `booking_fee_percentage` centralizado em `plan-features.config.ts`

### 10B.2 — Músico avalia o estabelecimento (mobile) ✅

- [x] `ContractReviewAction` na tela de contrato — o músico não tem lista de bookings no app
- [x] Só com booking `completed`; **show de banda não oferece a ação** (nenhum integrante passa na
      checagem de autoria do backend, nem o líder — o CTA aparecia e falhava sempre)

### 10B.3 — Ponte Spotify do fã ✅

- [x] `AudienceSpotifyLink` (agregado satélite), tokens cifrados, `state` HMAC com `purpose`,
      callback em controller separado, job de renovação a cada 30 min, escopo `user-library-modify`
- [x] **Buscar e salvar são dois atos** — o fã confirma capa e álbum antes de salvar
- [x] Migration `20260821190000_add_audience_spotify_link`

**Pendente:** `SPOTIFY_REDIRECT_URI` no `.env` real e teste do OAuth em device.

---

## Bloco 11 — Apresentação ao vivo 🎤 *(22/ago/2026)*

Nasceu de uma validação, não do catálogo: perguntado se o fã via "Salvar no Spotify" da música
que o artista estava tocando, o rastreamento mostrou que **o sistema não sabia o que era tocado**.
O `SaveToSpotifyAction` só existia na tela de sucesso do pedido, com texto digitado pelo próprio
fã; `PlayModeScreen` avançava de música sem tocar a rede; `PATCH /requests/:id/played` existia sem
nenhum chamador. A mesma lacuna bloqueava dois itens do catálogo — A5 (setlist inteligente) e
B1 (relatório pós-show) — e derrubava a afirmação de `roadmap-web.md:722` de que "100% dos dados"
do relatório já existiam: `repertoire` é o que se sabe tocar, não o que se tocou.

### 11.1 — Primitiva: o set ao vivo (F0) ✅

- [x] Domínio `src/core/performance/` — agregado `Performance` + entidade embutida `PerformedSong`,
      6 invariantes (uma música por vez, set fechado não recebe música, `position` do agregado,
      um set `live` por evento+músico via índice parcial, pedido não repetido, duração nunca
      negativa)
- [x] `PerformanceEligibilityService` — abrir set exige escalação em `EventMusician`
- [x] Repositórios in-memory + Prisma, migration `20260821200000_add_performance`
- [x] `performance-module` com 3 controllers e handler de `SongStartedEvent` que fecha o ciclo do
      `markAsPlayed`
- [x] Mobile: `LiveSetControl` na tela Ao Vivo, Play Mode transmitindo **só com set aberto**, store
      persistido em `expo-secure-store`

### 11.2 — Tocando agora para o fã ✅

- [x] `GET /performances/live` + `NowPlayingCard` no perfil público, com "Salvar no meu Spotify"
      recebendo o par vindo do palco. Polling de 20s (decisão registrada; socket exigiria room de
      evento no gateway)

### 11.3 — Currículo verificado (F4) ✅

- [x] `GET /musicians/:id/resume` — derivado, nunca declarado; sem cachê no output
- [x] Mobile: `MyResumeScreen` (músico) + `VerifiedResumeSection` (perfil público do fã)

### 11.4 — Setlist inteligente por local (F5) ✅

- [x] `GET /musicians/:id/setlist-suggestions?establishment_id=` com `evidence` por sugestão
- [x] Mobile: `SetlistSuggestionsScreen`, alcançável do card do show aberto

### 11.5 — Relatório pós-show (F6) ✅

- [x] `GET /performances/:performance_id/report` + `PerformanceReportScreen` e
      `PerformanceHistoryScreen`

### 11.6 — Card compartilhável do pós-show (B1) ✅ *(22/ago/2026)*

- [x] `establishment_name` no output de `GET /performances/:id/report` — único campo novo no
      backend; precedente de `get-musician-resume`
- [x] Mobile: `ShowRecapCard` (imagem capturável) + `ShowRecapSection` (preview + opt-in de
      gorjeta + ações), dentro de `PerformanceReportScreen`
- [x] `qrShare.ts` → `imageShare.ts` e novo `useCardShare` genérico em `shared/hooks/` — a mecânica
      de captura/trava/pulso era idêntica; `useQRCardShare` virou wrapper de 8 linhas e
      `QRCodeContent.tsx` não foi tocado
- [x] 🔴 Gorjeta **opt-in, padrão desligado**; `tips_during_song` fora do card em qualquer caso;
      set sem música não oferece compartilhamento. Ver `business-rules.md` §"Card compartilhável"
- [x] Preferência do toggle lembrada por músico (`recap-preferences.storage.ts`) — o card também
      serve de arquivo pessoal, não só de post. Restauração só LIGA; default e falha caem em `false`

### Pendente

- [ ] Push para o fã em vez de polling
- [ ] Wrapped anual do fã (B2) — agregação do mesmo dado
- [ ] Encerramento automático de set esquecido aberto
- [ ] Confirmação em device físico (mesma ressalva de todos os blocos do mobile)

**Referência:** [performance/live-performance.md](performance/live-performance.md) ·
`src/core/performance/`

---

## Bloco 12 — Modo Ensaio (S3) 🎧 *(22/ago/2026)*

O `ai-audio-module` estava completo e com **zero UI** desde sempre. Esta fatia deu produto a ele.

- [x] **Migration `20260822180000_add_practice_mode_stems`** — `AiAudioUpload.musicLibraryId`
      (espelha `AiCifraUpload`) + `AiAudioSeparationJob.stems_expire_at` + índices. Ambas nullable,
      sem backfill.
- [x] 🔴 **Política de retenção dos stems** — `PurgeExpiredAiAudioStemsUseCase` + job horário +
      `AI_AUDIO_STEMS_RETENTION_HOURS` (default 72h) + `deleteObject` na porta de storage. Stem é a
      gravação, separada: reter indefinidamente era postura de direito autoral divergente da do
      ai-cifra, que apaga o áudio ao concluir. Status `expired` distinto de `failed`.
- [x] `POST /musicians/:id/ai-audio/practice/separations` — separa a partir da **biblioteca**,
      re-resolvendo a fonte pelo resolver do `ai-cifra` (o áudio original não existe mais)
- [x] Mobile: `PracticeModeScreen` + `usePracticeStems` (4 players com líder fixo e correção de
      deriva) + `usePracticeScrollSync` (cifra rolando pela posição real do áudio) + mesa com
      mute/solo + transporte com meia-velocidade e pitch preservado
- [x] `usePlayModeAutoScroll` **não foi tocado** — o caminho de palco fica isolado
- [ ] 🔴 **Gate jurídico** — a retenção curta reduz a exposição, não a elimina. Entrar na mesma
      lista de perguntas ao advogado de `contract/legal-checklist.md`
- [ ] Loop A/B de trecho — o controle que mais falta num modo de ensaio de verdade
- [ ] Confirmação em device físico — **com peso maior aqui**: a qualidade da sincronia entre os
      quatro players É a feature, e só o aparelho responde
- [ ] Camada canônica de `music_library` antes de escalar — hoje cada músico paga GPU pela mesma
      música

**Referência:** [AI-musician/practice-mode.md](AI-musician/practice-mode.md)

---

## Observações técnicas (não esquecer)

| Observação                                      | Onde impacta                                         | Bloco   |
| ----------------------------------------------- | ---------------------------------------------------- | ------- |
| **Teste não atravessa HTTP** — os 3 bugs do 9.7 passaram por 2876 testes verdes | Todo DTO com `@IsDate`/filtro aninhado          | 9.7     |
| ~~Filtro aninhado descartado (Express 5)~~      | ✅ resolvido — `query parser: extended` em `main.ts` | 9.7c    |
| ~~`POST /auth/login` 401 para estabelecimento~~ | ✅ resolvido — `resolveProfile` consulta establishment | 9.7/F1.1 |
| ~~Rate limit global por IP atrás do BFF~~       | ✅ resolvido — `UserThrottlerGuard` rastreia por `sub` do JWT | 9.7     |
| ~~`payment-module` bloqueia fluxo produção~~    | ✅ HTTP completo; gorjeta PIX no Mercado Pago        | 1       |
| ~~QR vulnerável — qualquer string passa~~       | ✅ resolvido — parser `soundmeet://`, UUID, match    | 2       |
| ~~Scan sem transação → inconsistência~~         | ✅ resolvido — UoW atômico (`update` + `insert`)     | 2.5     |
| ~~`ai-audio-module` órfão~~                     | ✅ resolvido — registrado em `app.module.ts`          | 3.1     |
| ~~Bulk/ai-cifra sem auth consistente~~          | ✅ resolvido — `InternalTokenGuard` + `@SkipThrottle` | 4       |
| ~~Multi-roles sem ownership completo~~          | ✅ resolvido — guards aplicados, testes cobertos     | 4B      |
| Saque PIX (Asaas real)                          | ~ `AsaasGatewayAdapter` ativo; webhook TRANSFER_DONE ok | 1.6/1.7 |
| Gorjeta PIX                                     | ✅ `MercadoPagoPixGateway` (Orders API); mock só sem env | 1.6     |

---

## Bloco 15 — Pedido com gorjeta, celebração e QR universal ✅ *(27/ago/2026)*

> Três das quatro "ideias de ganho claro" auditadas em 27/ago. A quarta
> (onboarding do fã sem cadastro) ficou fora por decisão do usuário.
> Detalhe das regras em [business-rules.md](business-rules.md) (Request →
> "Destaque pago") e [qr-code.md](qr-code.md).

### 15.1 — Destaque pago no pedido musical (backend)

- [x] `RequestBoost` VO + colunas em `music_requests` + enum `RequestBoostStatus`
- [x] `BoostMinimumAmountPolicy` e `MusicianAcceptsTipsPolicy` na cadeia de `CanMakeRequestPolicy`
- [x] Portas `IBoostChargePort` / `ITipEligibilityPort` (inversão: `core/request` não conhece `core/payment`)
- [x] Cobrança criada no aceite, via `SendTipUseCase` — nenhuma mecânica de gorjeta duplicada
- [x] `GET /requests/:id/boost/payment`, `GET /tips/:id`, `accepts_tips` nas sugestões
- [x] Job de expiração a cada 5 min + eventos de domínio + notificações por socket
- [x] Ordenação da fila verificada contra Postgres real (`test/request/boosted-request-ordering.e2e-spec.ts`)
- [x] 🔴 `is_priority` removido — era campo fantasma (ver business-rules)

### 15.2 — UI do fã e do músico (mobile)

- [x] `RequestBoostSection` em `SongRequestScreen` (valor + dedicatória + preview do card)
- [x] `useFanNotificationsSocket` — **o fã nunca havia conectado no socket**; `connectSocket()` só era chamado no navigator do músico
- [x] `PendingBoostHost` (banner flutuante + folha do QR) e `RequestBoostPaymentSheet`
- [x] `RequestCard` do músico com faixa de destaque e dedicatória
- [x] `NowPlayingCard` exibe a dedicatória quando a música tocando veio de destaque pago

### 15.3 — Celebração pós-pagamento

- [x] `TipCelebrationOverlay` (bloom radial, `CelebrationBurst` com gravidade, contagem do valor, montagem do recibo, dedicatória)
- [x] `TipReceiptCard` (ViewShot) + share/galeria reusando `imageShare.ts`
- [x] 🔴 **Primeiro tratamento de reduce-motion do app** (`useReducedMotion`) — com a preferência ligada o overlay vai direto ao estado final, sem versão "mais lenta"
- [x] Valor no card é **opt-in, desligado por padrão** — mesma postura do `ShowRecapCard`

### 15.4 — QR universal (backend + mobile + web)

- [x] QR grava `https://soundmeet.com.br/musico/<uuid>`; parser aceita os dois formatos com allowlist de origem
- [x] `app.json` com `associatedDomains` + `intentFilters` (`autoVerify`)
- [x] Rotas `/.well-known/*` no `soundmeet-web`, com 404 quando não configurado
- [x] `InstallAppSheet` (só renderiza com URL de loja real)
- [x] `npm run backfill:qr-links`

### Pendente deste bloco

- [x] ~~**DECIDIR O HOST CANÔNICO**~~ — **resolvido em 07/set/2026:
      `soundmeet.com.br`**, o domínio efetivamente registrado.
      🔴 O host anterior, `soundmeet.app`, **é de terceiro** — nunca foi
      comprado, entrou por suposição. Ele responde 308 para `www` (redirect já
      quebraria a busca do `assetlinks.json`/AASA) e o `www` serve **outro
      produto** (SPA Vite, em inglês, `theme-color #DC2E73`). Um QR impresso
      apontando para lá levaria o fã ao site de um estranho — a mesma falha do
      adesivo colado por cima, cometida por nós.
      Ajustados: `QR_DEFAULT_BASE_URL`, a allowlist do `ScanQRUseCase`,
      `ALLOWED_HOSTS` do mobile e o `app.json`. Detalhe em
      [qr-code.md](qr-code.md) e [ops/domain-soundmeet-com-br.md](ops/domain-soundmeet-com-br.md).
- [ ] **DNS do `soundmeet.com.br` apontando para o `soundmeet-web`** — hoje o
      apex está no parking da Hostinger. É o que falta para o `/.well-known/*`
      responder e o rebuild ser seguro.
- [x] ~~**Aplicar a migration** `20260827120000_add_request_boost`~~ — aplicada em 07/set/2026
- [x] ~~`ANDROID_SHA256_CERT_FINGERPRINTS`~~ — obtido em 27/ago do APK do build de 16/ago (sem gastar build), já em `soundmeet-web/.env.local`. ⚠️ Trocar pelo fingerprint do Google quando publicar com Play App Signing
- [ ] **`IOS_APP_TEAM_ID`** — não existe conta Apple nem build iOS. Android funciona independente
- [ ] **URLs de loja** — só depois de publicar; até lá a `InstallAppSheet` não renderiza
- [ ] **Rebuild nativo do mobile** — `app.json` mudou configuração nativa, não sai por OTA.
      🔴 **Só DEPOIS do host resolvido e do `assetlinks.json` respondendo 200 com
      `application/json`:** o `autoVerify` roda no momento da INSTALAÇÃO, e um
      domínio que falha ali fica marcado como não verificado **em cache** — o APK
      novo abriria no navegador até ser reinstalado
- [ ] **Push para o público**: `Audience` não tem `push_token`. Quem está com o app fechado quando o músico aceita não é avisado; hoje só o banner de pendência recupera
- [ ] Verificar o caminho do dinheiro ponta a ponta depende de MP.1b–MP.8 (sandbox do Mercado Pago)

---

## Viabilidade (referência rápida)

| Feature                    | Status                                               |
| -------------------------- | ---------------------------------------------------- |
| Perfil + QR (geração)      | ✅                                                   |
| Validação QR (parse/UUID)  | ✅ Bloco 2 + **QR universal https** (Bloco 15.4) — allowlist de origem, `soundmeet://` legado aceito |
| Pedidos musicais           | ✅ + **destaque pago** (Bloco 15.1) — gorjeta acoplada, cobrança só no aceite |
| Saque PIX músico           | ~ `AsaasGatewayAdapter` ativo; gorjeta no Mercado Pago |
| Gamificação (domínio)      | ✅                                                   |
| Folha de cifra / IA        | ✅ sync/bulk/materialização (6.1–6.3); ~ tuning Demucs (6.4) |
| Auth Keycloak              | ✅ JWT validado, guards aplicados, ownership completo (4B.1–4B.6), rate limit global |
| Feature Gating (planos)    | ✅ **resolvido em 16/ago/2026** — `advanced_analytics` e `realtime_analytics` viraram gate real (402 no endpoint, com paywall no web e no mobile); `max_qr_codes` saiu do catálogo (o domínio nunca suportou); `api_access`/`white_label` viraram `coming_soon` no `GET /plans`, com `Exclude<>` impedindo gatear capacidade inexistente; limite de eventos no FREE **não** aplicado por decisão de produto (protege o inventário da `/agenda` pública). Ver §9.7 de [roadmap-web.md](roadmap-web.md) |
| Badge "Aberto agora"       | ✅ backend (7.8a/7.8b) — sem UI de preenchimento em nenhuma plataforma; fatia W1 de [roadmap-web.md](roadmap-web.md) |
| Dashboard estabelecimento  | ~ parcial                                            |
| Chat integrado             | ✅ Bloco 7.1 completo (Conversation/Message, gateway `/chat`, push, 15 testes) **(corrigido jul/2026 — tabela estava desatualizada frente ao Bloco 7.1 acima)** |

---

## Bloco 16 — Tier 3: lote, turnê, confirmação de e-mail, indicação (28/set/2026)

Quatro itens de uma anotação que os tratava como backend-a-fazer. A verificação
mostrou outra coisa: **os quatro já tinham rota HTTP**. Dois estavam completos;
dois tinham rota que *parecia* funcionar e não fazia o que prometia.

- [x] **16.1 Responder pedidos em lote — MOBILE.** Backend já estava pronto
      desde o 9.4c (07/ago/2026): `POST /requests/batch-respond`, throttle
      6/min, teto 50, dedupe, sequencial. Faltava só o app.
      Seleção múltipla por long-press na `LiveDashboardScreen`,
      `SelectionActionBar` flutuante, `BatchRejectSheet` (primeira coleta de
      `rejection_reason` do app — a recusa individual nunca pediu motivo).
      🔴 **O relatório parcial é o ponto da fatia:** a rota devolve **200 mesmo
      com parte do lote falhando**. Os que falham **permanecem na fila,
      marcados e com o motivo no próprio card**, e a seleção é reduzida a eles
      para retentar. Sumir com o item que falhou faria o músico achar que
      respondeu 30 tendo respondido 27. Regras puras em
      `domain/request-batch.rules.ts` (10 testes, exercitados contra o caso
      negativo).

- [x] **16.2 Modo turnê — MOBILE.** Backend pronto desde o 7.13d
      (16/jul/2026). Seção nova no accordion de perfil, **reusando
      `EditLocationSection` sem alteração** (é totalmente controlado por props).
      O autofill de CEP virou `shared/services/cep/useCepAutofill.ts`, usado
      pelas duas seções — duas cópias divergiriam na primeira correção.
      Atalhos de duração (3/7/15/30) em vez de date picker, e a UI mostra **a
      data em que expira**, não os dias restantes.
      ⚠️ Aqui a falha de geocodificação **bloqueia o save** (decisão do 7.13d),
      ao contrário do update de perfil, que é best-effort — a UI reflete isso.
      🔴 O payload é **snake_case** (`LocationInput`), ao contrário do
      `PATCH :id/profile`, que é camelCase: com `forbidNonWhitelisted`, um
      `zipCode` aqui é 422 no lote inteiro. `buildTouringPayload` centraliza e
      tem teste que falha se alguém trocar a convenção.

- [x] **16.3 Confirmação de e-mail.** Ver [email.md](email.md) §2 e §4 —
      a seção do Keycloak estava **factualmente errada** e foi reescrita.
      Resumo: o Keycloak **nunca** enviou verificação (`createUser` cria com
      `emailVerified: true` + `requiredActions: []`), e `email_verified_at` era
      escrito num lugar e **lido em nenhum**.
      🔴 `GET /auth/verify-email` **mutava estado com token de uso único** —
      prefetch de scanner de e-mail o queimava antes do usuário clicar. Hoje:
      `GET .../status` consulta, `POST` confirma, o GET antigo redireciona.
      `POST /auth/resend-verification` (resposta genérica, para não virar
      oráculo de enumeração). Página `(public)/verificar-email` no web
      (`noindex`, fora do sitemap). `verifyEmail: false` no realm —
      **e a linha precisou entrar no `pickDefined` do `keycloak-sync.mjs`**,
      mesma armadilha do `loginTheme`.
      **O gate: saque PIX.** `EmailNotVerifiedError` → 403 +
      `code: EMAIL_NOT_VERIFIED`, com CTA de reenvio na `WithdrawSheet`.
      A checagem fica na validação de entrada, **antes de `reserve()`** — as
      três barreiras de concorrência ficaram intocadas, e há teste que falha se
      alguém mover o gate para depois.

- [x] **16.4 Indicação de talentos + compartilhamento social.** Ver
      [business-rules.md](business-rules.md) → "Indicação de talentos e
      compartilhamento social". Resumo: a indicação era **descartada** (sem
      tabela, evento sem handler, use-cases sem mediator), o compartilhamento
      valia **50 pontos auto-declarados e sem dedupe**, e os dois sistemas de
      pontos divergiam. Agora: domínio `src/core/indication/` + migration,
      caixa de entrada no dashboard do web, sheet de indicação no perfil
      público do app, valores unificados (10/15) e dedupe por conteúdo no
      ledger.

**Não implementado, com motivo:** deep link de verificação no app. O AASA
(`/musico/*`, `/local/*`) e o `intentFilters` **não capturam**
`/verificar-email`, então o link já abre no navegador nas duas plataformas —
que é o comportamento correto, já que a página web faz tudo. Capturá-lo no app
exigiria mudar AASA + intentFilters + **rebuild nativo** para replicar uma
página que já funciona.

**Suíte:** 405 suítes / 3944 testes ✅ · mobile 29/321 ✅ · web 102/1010 ✅

---

## Recomendações de infra

- **Event-driven** via RabbitMQ (pagamento → gamificação)
- **Redis** — cache perfis, catálogos, LRC match
- **MongoDB** — analytics futuro (Bloco 7)
