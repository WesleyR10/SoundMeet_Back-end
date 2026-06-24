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

---

## Observações técnicas (não esquecer)

| Observação                               | Onde impacta                                         | Bloco |
| ---------------------------------------- | ---------------------------------------------------- | ----- |
| `payment-module` bloqueia fluxo produção | Gorjetas, wallet, withdraw                           | 1     |
| QR vulnerável — qualquer string passa    | `ScanQRUseCase`                                      | 2     |
| Scan sem transação → inconsistência      | audience + userInteraction                           | 2.5   |
| ~~`ai-audio-module` órfão~~              | ✅ resolvido — registrado em `app.module.ts`          | 3.1   |
| Bulk/ai-cifra sem auth consistente       | synced-lyrics, ai-cifra controllers                  | 4     |
| Multi-roles sem ownership completo       | guards/use cases por tenant, estabelecimento e banda | 4B    |
| Saque PIX (Asaas real)                   | `AsaasGatewayAdapter` + webhook TRANSFER_DONE        | 1.6/1.7 |
| Gorjeta PIX ainda mock                   | `PixGatewayMock` — aguardando chaves Iugu            | 1.6   |

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
| Dashboard estabelecimento  | ~ parcial                                            |
| Chat integrado             | backlog Bloco 7                                      |

---

## Recomendações de infra

- **Event-driven** via RabbitMQ (pagamento → gamificação)
- **Redis** — cache perfis, catálogos, LRC match
- **MongoDB** — analytics futuro (Bloco 7)
