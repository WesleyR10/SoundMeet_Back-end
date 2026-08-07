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
  - Desbloqueia: `soundmeet-mobile/Docs/roadmap-mobile.md` Bloco 11.8 (`SongRequestScreen` com catálogo navegável em vez de só free-text/sugestões)

- [ ] **7.15** **Validação de QR de estabelecimento** (baixa prioridade — não expandir escopo agora) — `ScanQRUseCase` (`src/core/audience/application/use-cases/scan-qr/scan-qr.use-case.ts`) só valida o esquema `soundmeet://musician/<uuid>`; se/quando check-in de estabelecimento via QR virar feature real, espelhar a mesma validação atômica + anti-abuso (5 scans/dia) para `soundmeet://establishment/<uuid>`. Registrar aqui apenas para não perder o rastro — não detalhar sub-tarefas até haver decisão de produto.

- [ ] **7.16** **Leaderboard sem identidade exibível** (descoberto na implementação do `LeaderboardScreen` do fã, jul/2026) — `GET /gamification/leaderboard` retorna `UserPointsPresenter[]`, que só tem `user_id` (sem nome/avatar); e um fã não pode resolver isso chamando `GET /audiences/:id` de outro usuário (`@Roles("audience","admin")` + ownership guard, dono/admin-only). Resultado: hoje o ranking é tecnicamente funcional mas anônimo (mobile mostra "Fã #<hash>" em vez de um nome):
  - [ ] **7.16a** Endpoint público (ou escopado a `audience`) que resolva `user_id → nickname/display_name/avatar` para uma lista de IDs — ex. `GET /audiences/public-profiles?ids=...` retornando só os campos exibíveis (nunca e-mail/telefone/preferências privadas)
  - [ ] **7.16b** Alternativa mais simples: `UserPointsPresenter`/`GetLeaderboardUseCase` já populam `nickname`/`avatar` diretamente na resposta do leaderboard, evitando um segundo round-trip
  - Desbloqueia: `soundmeet-mobile/Docs/roadmap-mobile.md` Bloco 11.12 (`LeaderboardScreen` com nome real em vez de posição anônima)

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
| Folha de cifra / IA        | ✅ sync/bulk/materialização (6.1–6.3); ~ tuning Demucs (6.4) |
| Auth Keycloak              | ✅ JWT validado, guards aplicados, ownership completo (4B.1–4B.6), rate limit global |
| Feature Gating (planos)    | ~ **parcial (revisto 06/ago/2026)** — músico: 13 de 18 flags aplicadas de fato; estabelecimento: **só 2 de 6** (`promotional_campaigns`, `multi_establishment`). `advanced_analytics`, `api_access`, `max_qr_codes`, `white_label` existem no config e **nunca são lidas**; o limite "1 evento ativo no Free" não existe nem como flag. Ver Bloco 9.7 e [plans/establishment-plans.md](plans/establishment-plans.md) |
| Badge "Aberto agora"       | ✅ backend (7.8a/7.8b) — sem UI de preenchimento em nenhuma plataforma; fatia W1 de [roadmap-web.md](roadmap-web.md) |
| Dashboard estabelecimento  | ~ parcial                                            |
| Chat integrado             | ✅ Bloco 7.1 completo (Conversation/Message, gateway `/chat`, push, 15 testes) **(corrigido jul/2026 — tabela estava desatualizada frente ao Bloco 7.1 acima)** |

---

## Recomendações de infra

- **Event-driven** via RabbitMQ (pagamento → gamificação)
- **Redis** — cache perfis, catálogos, LRC match
- **MongoDB** — analytics futuro (Bloco 7)
