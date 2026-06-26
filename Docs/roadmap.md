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
- [x] **4C.4** QR Code personalizado — `CustomizeQRCodeUseCase` com `assertMusicianFeature(musician_id, "custom_qr_code")`; `QRCustomization` VO (cores, logo, label); endpoint `POST /musicians/:id/qr-code/customize` (PRO only)
- [x] **4C.5** ~~Acesso à biblioteca musical — `music_library_access: true` em todos os planos por decisão de produto (cifra é core feature)~~
- [x] **4C.6** Gestão de split de banda — `assertMusicianFeature(leader_id, "auto_split_management")` em `AddBandMemberUseCase` ao detectar `role === "leader"` (PRO → até 8 membros)
- [x] **4C.7** Multi-estabelecimento — `assertEstablishmentFeature(establishment_id, "multi_establishment")` em `CreateEstablishmentUseCase` quando `existing_establishment_ids` presentes; hard-limit 3 unidades; PRO only
- [x] **4C.8** Testes de domínio por gate: `CustomizeQRCode`, `GetMusicianAnalytics`, `AddBandMember`, `WithdrawToPix`, `CreateEstablishment`, `CreateCampaign` — (a) FREE bloqueado com `PlanLimitExceededError`, (b) plano pago permitido, (c) subscription cancelada = volta ao FREE
- [x] **4C.9** Debate e fechamento de valores/tiers — concluído jun/2026 (ver decisões no cabeçalho deste bloco)
- [x] **4C.10** Campanhas promocionais — domínio `src/core/campaign/` completo (aggregate, repository, in-memory, Prisma, `CreateCampaignUseCase`); `assertEstablishmentFeature(establishment_id, "promotional_campaigns")` (FREE bloqueado · GROWTH/PRO permitido); `CampaignModule` + controller + Prisma schema (`campaigns` table)


---

### Bloco 4D — Novas funcionalidades premium (implementação)

> Features que diferenciam os planos no produto, decididas no debate de planos (jun/2026).

- [ ] **4D.1** **Repertório/Setlist** — domínio `src/core/repertoire/`:
  - [ ] **4D.1a** Aggregate `Repertoire` + `RepertoireSong` (id, musician_id, name, songs ordenadas, position, custom_notes)
  - [ ] **4D.1b** Use-cases: criar, editar ordem, estimar tempo de show (média 3,5 min/música)
  - [ ] **4D.1c** Use-case: compartilhar — link read-only temporário (ESSENTIAL) e convite nominal (PRO)
  - [ ] **4D.1d** Gate: `max_repertoires` e `max_songs_per_repertoire` via `getMusicianFeatures()` (FREE 1×20 / ESSENTIAL 3×80 / PRO ∞)
  - [ ] **4D.1e** NestJS module + controller + presenter + DTOs
- [ ] **4D.2** **Play Mode no Repertório** — tela ao vivo durante show (frontend):
  - [ ] **4D.2a** Tela fullscreen: cifra + letra da música atual; botões próxima/anterior com 1 clique
  - [ ] **4D.2b** Badge "customizada" em músicas editadas pelo músico
  - [ ] **4D.2c** Auto-scroll configurável
- [ ] **4D.3** **Tempo estimado de show** — campo calculado no Repertoire:
  - [ ] **4D.3a** Campo `duration_override_seconds?: number` por `RepertoireSong` (padrão 3,5 min se ausente)
  - [ ] **4D.3b** Output calculado no presenter: `estimated_show_duration_minutes`
- [ ] **4D.4** **Compartilhamento de Repertório** — já especificado em 4D.1c; itens de infra:
  - [ ] **4D.4a** ESSENTIAL: gerar token temporário read-only; expirar após 7 dias
  - [ ] **4D.4b** PRO: endpoint de convite nominal a músico cadastrado (permissão de edição)
- [ ] **4D.5** **Banner Generation (templates)** — `src/nest-modules/banner-module/`:
  - [ ] **4D.5a** 5–10 templates SVG/HTML (logo, foto músico/estabelecimento, nome, data, QR do evento)
  - [ ] **4D.5b** Gate: `assertMusicianCanGenerateBanner` / `assertEstablishmentCanGenerateBanner` (FREE ❌ / ESSENTIAL 3/mês / PRO 15/mês)
  - [ ] **4D.5c** Geração server-side PNG via `sharp` ou `canvas`; retorno como link para download
- [ ] **4D.6** **Banner Generation (AI) — roadmap futuro** (pré-requisito: 4D.5):
  - [ ] **4D.6a** Geração via API (DALL-E ou Stability AI) para plano PRO
- [ ] **4D.7** **Progress bar de saque no dashboard** — UX obrigatório para todos os planos (frontend):
  - [ ] **4D.7a** Barra de progresso "Você está a R$X de poder sacar" na home do músico
  - [ ] **4D.7b** Prazo estimado baseado no ritmo atual de gorjetas
- [x] **4D.8** **Plano Anual** — billing cycle anual no `Subscription`:
  - [x] **4D.8a** `BillingCycle` enum (`"monthly" | "annual"`) + campo no aggregate; `create()` auto-computa `expires_at`; `isActive()` respeita `expires_at`; `toJSON()` inclui campo; validator rejeita valores inválidos
  - [x] **4D.8b** `prisma/schema.prisma` + `billing_cycle String @default("monthly")`; `PlanPricing` interface + `MUSICIAN_PLAN_PRICING` + `ESTABLISHMENT_PLAN_PRICING` em `plan-features.config.ts`; mapper atualizado; 4 novos métodos em `PlanCheckService` (`getBillingCycle`, `getPlanPricing`); 33 novos testes

---

### Bloco 5 — Real-time e messaging

- [ ] **5.1** WebSockets (Socket.io) — pedidos aceitos/recusados em tempo real
- [ ] **5.2** RabbitMQ: pagamento confirmado → gamificação → ranking (event-driven)
- [ ] **5.3** Outbox pattern para consistência entre domínios (opcional pós-MVP)

---

### Bloco 6 — IA musical (evolução)

- [ ] **6.1** Bulk LRC Modo A (ingest externo) — endpoints de ingest + cache Redis
- [ ] **6.2** Bulk LRC Modo B (fila RabbitMQ interna) — job entity + consumers
- [ ] **6.3** Materialização chord-sheet em escala (`GET .../chord-sheet`)
- [ ] **6.4** Tuning Demucs — [audio-separation.md](AI-musician/audio-separation.md)

---

### Bloco 7 — Produto avançado (backlog)

- [ ] **7.1** Chat estabelecimento ↔ músico
- [ ] **7.2** WebSockets push / Firebase APNs
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
  - [ ] **7.6a** Adicionar `tuner_noise_filter: boolean` em `MusicianPlanFeatures` e `plan-features.config.ts`
  - [ ] **7.6b** Frontend: afinador básico via WebAudio API + algoritmo YIN/autocorrelação (todos os planos)
  - [ ] **7.6c** Frontend: modo filtro de ruído + gate `assertMusicianFeature(id, "tuner_noise_filter")` (ESSENCIAL + PRO)
  - [ ] **7.6d** Mobile: plugin de áudio nativo para latência mínima
  - Posicionamento: "já no app, sem trocar de contexto" — não compete com GuitarTuna; entry point do ritual pré-show
- [x] **7.7** **Cardápio PDF do Estabelecimento** — confirmação de descoberta no perfil (todos os planos):
  - [x] **7.7a** Prisma: `menu_pdf_url String?` e `menu_pdf_updated_at DateTime?` em `EstablishmentProfile`
  - [x] **7.7b** Aggregate: `changeMenuPdf(url, updatedAt)` + `clearMenuPdf()` em `EstablishmentProfile`
  - [x] **7.7c** `POST /api/v1/establishments/:id/menu-pdf` — Multer diskStorage → fileFilter MIME (camada 1) + `file-type` v20 dynamic import nos bytes reais (camada 2) → Cloudflare R2 → salva URL; limite 5MB; ownership guard; armazenado em `establishments/{name-slug}/{id}/menu-pdf/menu-{ts}.pdf`
  - [x] **7.7d** `DELETE /api/v1/establishments/:id/menu-pdf` — remove do R2 + limpa campos no perfil
  - [x] **7.7e** Presenter atualizado (`menu_pdf_url`, `menu_pdf_updated_at`); `IEstablishmentStorage` port + `S3EstablishmentStorage` + providers
  - Viewer inline no perfil público (PDF.js web / WebView mobile) — frontend pendente
  - Aviso "Atualizado há X dias" quando `menu_pdf_updated_at` > 30 dias — frontend pendente
- [~] **7.8** **Badge "Aberto agora"** — backend completo; falta apenas frontend:
  - [x] **7.8a** Campo calculado `is_open_now: boolean` no `EstablishmentOutputMapper.toOutput()` via `OperatingHours.isOpenAt(now, dateTimeService)` — presente em todos os outputs de establishment
  - [x] **7.8b** `IDateTimeService` / `LuxonDateTimeService` injetado em `EstablishmentsModule`; passado para `ListEstablishmentsUseCase` e `GetEstablishmentUseCase`; cálculo com timezone correto (UTC)
  - [ ] **7.8c** Frontend: badge "Aberto agora" na listagem e no perfil do estabelecimento
  - [ ] **7.8d** Frontend: formulário de edição de horários no dashboard do estabelecimento (preencher campo que já existe)
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
| Badge "Aberto agora"       | ✅ backend (7.8a/7.8b) — aguarda frontend (7.8c/7.8d) |
| Dashboard estabelecimento  | ~ parcial                                            |
| Chat integrado             | backlog Bloco 7                                      |

---

## Recomendações de infra

- **Event-driven** via RabbitMQ (pagamento → gamificação)
- **Redis** — cache perfis, catálogos, LRC match
- **MongoDB** — analytics futuro (Bloco 7)
