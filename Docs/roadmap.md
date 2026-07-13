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
- [~] **1.6** Substituir `PixGatewayMock` por gateway PIX real (adapter + env vars) — `AsaasGatewayAdapter` implementado (saques PIX out via `POST /v3/transfers`); gorjetas ainda usam `PixGatewayMock` (aguardando chaves Iugu)
- [~] **1.7** Webhook/callback de confirmação PIX + idempotência — `AsaasWebhookController` (`POST /webhooks/asaas`) com `TRANSFER_DONE`/`TRANSFER_FAILED` + `processOnce`; handler de gorjeta `PAYMENT_RECEIVED` pendente (Iugu)
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

- [x] **4C.1** Analytics em tempo real — `GetMusicianAnalyticsUseCase` com `assertMusicianFeature(musician_id, "realtime_analytics")` + endpoint `GET /musicians/:id/analytics`; FREE → `realtime_available: false`; ESSENTIAL/PRO → dados em tempo real
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

- [ ] **6.1** Bulk LRC Modo A (ingest externo) — endpoints de ingest + cache Redis
- [ ] **6.2** Bulk LRC Modo B (fila RabbitMQ interna) — job entity + consumers
- [ ] **6.3** Materialização chord-sheet em escala (`GET .../chord-sheet`)
- [ ] **6.4** Tuning Demucs — [audio-separation.md](AI-musician/audio-separation.md)
- [x] **6.5** **(jul/2026, durante o Bloco 7 mobile)** Ponte pipeline → catálogo, achado durante a investigação do fluxo "buscar cifra" do mobile: `CompleteAiCifraAnalysisJobUseCase` (chamado por `POST /ai-cifra/internal/analyses/:id/complete`, o worker Python) gravava `bpm/key/chords/segments` só no aggregate `AiCifraAnalysisJob.result` — **nada escrevia de volta em `MusicLibrary.chords/structure_segments/bpm/key`**, que é o que `GET /music-library/:id/chord-sheet` realmente lê. Só o script CLI offline `preload-chord-sheets-top-100.ts` fazia essa ponte, via Prisma cru, pulando a camada de domínio. Resultado prático: completar uma análise via `from-provider/analyses` nunca preenchia a cifra de verdade. Corrigido injetando `UpdateMusicLibraryUseCase` (já existia, reaproveitado) em `CompleteAiCifraAnalysisJobUseCase` — escreve best-effort (falha aqui não desfaz a conclusão do job) quando `upload.music_library_id` está setado. Testes novos em `complete-ai-cifra-analysis-job.use-case.spec.ts`.
- [x] **6.6** **(jul/2026, durante o Bloco 7 mobile)** Endpoint novo `GET /musicians/:musician_id/ai-cifra/search?query=&limit=` (`AiCifraSearchController`) — busca por texto livre (título/artista) via `MusifyPipedCatalogClient.searchVideos`, que já existia mas só era chamado por um script CLI offline, nunca por HTTP. Alimenta o fluxo mobile de "buscar cifra por nome ou cantor" (Bloco 7): resultado → `POST /music-library/items` (cria o item, cliente já sabe o id) → `POST .../from-provider/analyses` (com o id, ativa o `updateCatalogSource`) → poll `GET /ai-cifra/analyses/:id` → cifra populada via 6.5. Throttle `10s/15req` por músico. Testes em `search-ai-cifra-catalog.use-case.spec.ts`.

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
- [ ] **7.3** Validação compartilhamento social → pontos
- [ ] **7.4** Analytics MongoDB (logs, auditoria)
- [ ] **7.5** Planos premium / marketplace — ver [monetization.md](monetization.md)
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
- [ ] **7.6** **Afinador cromático** — utilitário de ritual pré-show (todos os planos; filtro de ruído: ESSENCIAL + PRO):
  - [x] **7.6a** Adicionar `tuner_noise_filter: boolean` em `MusicianPlanFeatures` e `plan-features.config.ts`
  - Posicionamento: "já no app, sem trocar de contexto" — entry point do ritual pré-show  
  - Frontend + mobile: ver [roadmap-frontend.md](roadmap-frontend.md) (7.6b/7.6c/7.6d)
- [x] **7.7** **Cardápio PDF do Estabelecimento** — confirmação de descoberta no perfil (todos os planos):
  - [x] **7.7a** Prisma: `menu_pdf_url String?` e `menu_pdf_updated_at DateTime?` em `EstablishmentProfile`
  - [x] **7.7b** Aggregate: `changeMenuPdf(url, updatedAt)` + `clearMenuPdf()` em `EstablishmentProfile`
  - [x] **7.7c** `POST /api/v1/establishments/:id/menu-pdf` — Multer diskStorage → fileFilter MIME (camada 1) + `file-type` v20 dynamic import nos bytes reais (camada 2) → Cloudflare R2 → salva URL; limite 5MB; ownership guard; armazenado em `establishments/{name-slug}/{id}/menu-pdf/menu-{ts}.pdf`
  - [x] **7.7d** `DELETE /api/v1/establishments/:id/menu-pdf` — remove do R2 + limpa campos no perfil
  - [x] **7.7e** Presenter atualizado (`menu_pdf_url`, `menu_pdf_updated_at`); `IEstablishmentStorage` port + `S3EstablishmentStorage` + providers
  - Viewer inline e aviso de PDF desatualizado: ver [roadmap-frontend.md](roadmap-frontend.md) (7.7)
- [x] **7.8** **Badge "Aberto agora"** — backend completo:
  - [x] **7.8a** Campo calculado `is_open_now: boolean` no `EstablishmentOutputMapper.toOutput()` via `OperatingHours.isOpenAt(now, dateTimeService)` — presente em todos os outputs de establishment
  - [x] **7.8b** `IDateTimeService` / `LuxonDateTimeService` injetado em `EstablishmentsModule`; passado para `ListEstablishmentsUseCase` e `GetEstablishmentUseCase`; cálculo com timezone correto (UTC)
  - Badge e formulário de horários no dashboard: ver [roadmap-frontend.md](roadmap-frontend.md) (7.8c/7.8d)
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

- [ ] **7.12** **Listagem de pedidos do próprio fã** — hoje `GET /requests` é `@Roles("musician","establishment","admin")` (`requests.controller.ts`); um fã não consegue listar o próprio histórico/fila de pedidos:
  - [ ] **7.12a** Endpoint `GET /audiences/:id/requests` (ou `GET /requests?audience_id=`) — mesmo padrão de ownership dos demais endpoints de `audiences-module` (fã só vê os próprios; admin vê qualquer um)
  - [ ] **7.12b** Reusar `ListRequestsUseCase`/filtro existente, adicionar `audience_id` ao filtro se ainda não suportado
  - Desbloqueia: `soundmeet-mobile/Docs/roadmap-mobile.md` Bloco 11.9 (`MyRequestsScreen`), hoje marcado bloqueado

- [ ] **7.13** **Busca por proximidade (geo)** — `EstablishmentFilter` (`establishment.repository.ts`) e `EventFilter` não suportam raio geográfico, apesar de lat/lng já existirem no schema; `features.md` descreve "busca por proximidade" como intencional:
  - [ ] **7.13a** Estender `EstablishmentFilter`/`ListEstablishmentsUseCase` com `lat, lng, radius_km` (Haversine na query ou extensão PostGIS, avaliar custo)
  - [ ] **7.13b** Endpoint (ou parâmetro) equivalente para eventos "perto de mim/hoje à noite" — hoje eventos só existem aninhados em `establishments/:id/events`, sem busca cross-establishment
  - Desbloqueia: `soundmeet-mobile/Docs/roadmap-mobile.md` Bloco 11.3/11.4 (feed de descoberta e busca do fã) sem depender do fallback por `location_city`

- [ ] **7.14** **Navegação de repertório para o público** — `MusicLibraryController` é `@Roles("musician","admin")` na classe inteira; um fã não pode ver o catálogo de um músico pra escolher a música ao pedir:
  - [ ] **7.14a** Relaxar `GET /music-library/items` e `GET /music-library/items/:id` para role `audience`, escopado a `musician_id` de um perfil público e apenas itens não-privados (definir flag de visibilidade se não existir), ou criar endpoint dedicado `GET /musicians/:id/repertoire` (`@Public` ou `audience`-only)
  - Desbloqueia: `soundmeet-mobile/Docs/roadmap-mobile.md` Bloco 11.8 (`SongRequestScreen` com catálogo navegável em vez de só free-text/sugestões)

- [ ] **7.15** **Validação de QR de estabelecimento** (baixa prioridade — não expandir escopo agora) — `ScanQRUseCase` (`src/core/audience/application/use-cases/scan-qr/scan-qr.use-case.ts`) só valida o esquema `soundmeet://musician/<uuid>`; se/quando check-in de estabelecimento via QR virar feature real, espelhar a mesma validação atômica + anti-abuso (5 scans/dia) para `soundmeet://establishment/<uuid>`. Registrar aqui apenas para não perder o rastro — não detalhar sub-tarefas até haver decisão de produto.

- [ ] **7.16** **Leaderboard sem identidade exibível** (descoberto na implementação do `LeaderboardScreen` do fã, jul/2026) — `GET /gamification/leaderboard` retorna `UserPointsPresenter[]`, que só tem `user_id` (sem nome/avatar); e um fã não pode resolver isso chamando `GET /audiences/:id` de outro usuário (`@Roles("audience","admin")` + ownership guard, dono/admin-only). Resultado: hoje o ranking é tecnicamente funcional mas anônimo (mobile mostra "Fã #<hash>" em vez de um nome):
  - [ ] **7.16a** Endpoint público (ou escopado a `audience`) que resolva `user_id → nickname/display_name/avatar` para uma lista de IDs — ex. `GET /audiences/public-profiles?ids=...` retornando só os campos exibíveis (nunca e-mail/telefone/preferências privadas)
  - [ ] **7.16b** Alternativa mais simples: `UserPointsPresenter`/`GetLeaderboardUseCase` já populam `nickname`/`avatar` diretamente na resposta do leaderboard, evitando um segundo round-trip
  - Desbloqueia: `soundmeet-mobile/Docs/roadmap-mobile.md` Bloco 11.12 (`LeaderboardScreen` com nome real em vez de posição anônima)

- [x] **7.17** **Corrigido (jul/2026, revisão do Bloco 11):** `GET /gamification/leaderboard?limit=N` retornava **422 em toda chamada** — `GetLeaderboardInput.limit`/`level` (`get-leaderboard.input.ts`) tinham `@IsNumber()` sem `@Type(() => Number)`; como o `ValidationPipe` global não usa `enableImplicitConversion`, o valor de query string (`"20"`) nunca virava `number` antes da validação, e `@IsNumber` rejeitava a string. Todos os DTOs irmãos (`SearchEstablishmentsDto`, `SearchEventsDto`, `GetRequestSuggestionsInput`) já tinham esse `@Type`; só este ficou de fora. Corrigido adicionando `@Type(() => Number)` em ambos os campos; verificado com `plainToClass`+`validateSync` isolado (antes: `isNumber`/`min`/`max` falhavam; depois: `limit: 20` como `number`, zero erros) e suíte `gamification` completa (190/190 passando). Achado durante revisão de qualidade do `LeaderboardScreen` do fã, não estava documentado como item aberto antes.

---

### Bloco 8 — Cifra Pessoal e Comunidade de Cifras 🎸

> Músico pode criar uma versão pessoal da cifra gerada pela IA (fork), editar livremente (transpor, adicionar notas, corrigir acordes) e opcionalmente compartilhar com a comunidade — que só pode visualizar. A original da IA permanece imutável.

#### Regras de negócio
- A cifra original (`AiCifraAnalysisJob.chord_data`) é **imutável** — nunca modificada pelo usuário
- Cada músico pode ter **no máximo 1 fork por `music_library_id`**
- Fork é **privado por padrão** (`is_shared = false`)
- Fork compartilhado é **read-only** para todos os outros músicos
- O músico pode **descompartilhar** a qualquer momento (volta a privado)
- `schema_version` detecta incompatibilidade quando o modelo de IA é atualizado
- Admin pode deletar qualquer fork (moderação)

#### Domínio — `src/core/personal-chord-sheet/`
- [ ] **8.1** Aggregate `PersonalChordSheet` com campos: `personal_chord_sheet_id`, `music_library_id`, `musician_id`, `chord_data` (JSON — mesmo schema do `AiCifraAnalysisJob`), `schema_version`, `notes`, `is_shared`, `shared_at`, `created_at`, `updated_at`
- [ ] **8.2** `IPersonalChordSheetRepository` (interface + in-memory + Prisma)
- [ ] **8.3** Use-cases:
  - [ ] **8.3a** `CreatePersonalChordSheet` — valida unicidade `(musician_id, music_library_id)`; copia `chord_data` + `schema_version` do job AI mais recente
  - [ ] **8.3b** `UpdatePersonalChordSheet` — ownership check; valida schema compatível
  - [ ] **8.3c** `DeletePersonalChordSheet` — ownership check (admin bypass)
  - [ ] **8.3d** `GetPersonalChordSheet` — retorna próprio fork ou fork público de outro músico
  - [ ] **8.3e** `ListPersonalChordSheets` — lista do músico; filtra por `is_shared=true` para comunidade
  - [ ] **8.3f** `SharePersonalChordSheet` — seta `is_shared = true`, `shared_at = now()`
  - [ ] **8.3g** `UnsharePersonalChordSheet` — reverte para privado
- [ ] **8.4** `PersonalChordSheet.fake()` builder + testes de domínio

#### Prisma schema
- [ ] **8.5** Adicionar tabela `PersonalChordSheet` com índice único `(musician_id, music_library_id)` e índice em `is_shared` para listagem de comunidade

#### NestJS — `src/nest-modules/personal-chord-sheet-module/`
- [ ] **8.6** Module, providers, controller, presenter, DTOs
- [ ] **8.7** Endpoints protegidos:
  - [ ] **8.7a** `POST /music-library/:id/chord-sheet-forks` — cria fork (`@Roles("musician")`)
  - [ ] **8.7b** `GET /music-library/:id/chord-sheet-forks/mine` — meu fork (`@Roles("musician")`)
  - [ ] **8.7c** `PATCH /chord-sheet-forks/:id` — edita meu fork (`@Roles("musician")` + ownership)
  - [ ] **8.7d** `DELETE /chord-sheet-forks/:id` — deleta (`@Roles("musician", "admin")` + ownership)
  - [ ] **8.7e** `POST /chord-sheet-forks/:id/share` + `DELETE /chord-sheet-forks/:id/share` — compartilhar / descompartilhar (`@Roles("musician")` + ownership)
  - [ ] **8.7f** `GET /community/chord-sheet-forks` + `GET /community/chord-sheet-forks/:id` — browse público (`@Public()`)
- [ ] **8.8** Testes de integração: create, update, share/unshare, acesso cruzado bloqueado, admin delete

**Referência:** [AI-musician/chord-sheet.md](AI-musician/chord-sheet.md) · core `ai-cifra` (schema de `chord_data`)

---

## Observações técnicas (não esquecer)

| Observação                                      | Onde impacta                                         | Bloco   |
| ----------------------------------------------- | ---------------------------------------------------- | ------- |
| ~~`payment-module` bloqueia fluxo produção~~    | ✅ HTTP completo; gorjeta PIX ainda mock (Iugu)      | 1       |
| ~~QR vulnerável — qualquer string passa~~       | ✅ resolvido — parser `soundmeet://`, UUID, match    | 2       |
| ~~Scan sem transação → inconsistência~~         | ✅ resolvido — UoW atômico (`update` + `insert`)     | 2.5     |
| ~~`ai-audio-module` órfão~~                     | ✅ resolvido — registrado em `app.module.ts`          | 3.1     |
| ~~Bulk/ai-cifra sem auth consistente~~          | ✅ resolvido — `InternalTokenGuard` + `@SkipThrottle` | 4       |
| ~~Multi-roles sem ownership completo~~          | ✅ resolvido — guards aplicados, testes cobertos     | 4B      |
| Saque PIX (Asaas real)                          | ~ `AsaasGatewayAdapter` ativo; webhook TRANSFER_DONE ok | 1.6/1.7 |
| Gorjeta PIX ainda mock                          | `PixGatewayMock` — aguardando chaves Iugu            | 1.6     |

---

## Viabilidade (referência rápida)

| Feature                    | Status                                               |
| -------------------------- | ---------------------------------------------------- |
| Perfil + QR (geração)      | ✅                                                   |
| Validação QR (parse/UUID)  | ✅ Bloco 2 completo (UoW atômico + testes com UUID real) |
| Pedidos musicais           | ✅                                                   |
| Saque PIX músico           | ~ `AsaasGatewayAdapter` ativo; gorjetas aguardam Iugu |
| Gamificação (domínio)      | ✅                                                   |
| Folha de cifra / IA        | ~ Bloco 6                                            |
| Auth Keycloak              | ✅ JWT validado, guards aplicados, ownership completo (4B.1–4B.6), rate limit global |
| Feature Gating (planos)    | ✅ Bloco 4C completo (4C.1–4C.10): analytics, saque, QR, split, multi-estabelecimento, campanhas |
| Badge "Aberto agora"       | ✅ backend (7.8a/7.8b) — frontend em roadmap-frontend.md |
| Dashboard estabelecimento  | ~ parcial                                            |
| Chat integrado             | backlog Bloco 7                                      |

---

## Recomendações de infra

- **Event-driven** via RabbitMQ (pagamento → gamificação)
- **Redis** — cache perfis, catálogos, LRC match
- **MongoDB** — analytics futuro (Bloco 7)
