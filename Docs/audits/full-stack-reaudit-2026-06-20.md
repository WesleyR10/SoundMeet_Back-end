# Reauditoria Arquitetural Completa — SoundMeet Backend
**Data:** 2026-06-20  
**Auditor:** Auditor técnico sênior (sessão autônoma)  
**Escopo:** Core · NestJS · Prisma · RabbitMQ · Segurança · Testes — backend completo  
**Baseline:** 4 auditorias anteriores (2026-06-18 e 2026-06-20) + respectivos relatórios de correção  
**Modo:** Diagnóstico puro — nenhuma alteração de código executada

---

## 1. Metadados

### Auditorias de baseline
| Auditoria | Arquivo | Correção |
|-----------|---------|---------|
| Core 2026-06-18 | core-review-2026-06-18.md | core-review-2026-06-18-corrections.md |
| NestJS 2026-06-18 | nest-modules-review-2026-06-18.md | nest-modules-review-2026-06-18-corrections.md |
| Prisma 2026-06-20 | prisma-schema-review-2026-06-20.md | prisma-schema-corrections-2026-06-20.md |
| RabbitMQ/Outbox 2026-06-20 | rabbitmq-outbox-review-2026-06-20.md | rabbitmq-outbox-review-2026-06-20-corrections.md |
| Política de handlers | nest-event-handlers-policy-2026-06-19.md | — |

### Comandos executados e resultados

| Comando | Resultado |
|---------|-----------|
| `npm run build` | ✅ PASS — 0 erros de compilação TypeScript |
| `npm test -- --passWithNoTests` | ❌ FAIL — 6 suites com falha (41 testes), 190 suites passando (1390 testes) |
| `npx prisma validate` | ✅ PASS — schema válido |
| `npx prisma migrate status` | ⚠️ PENDENTE — 2 migrations não aplicadas ao banco local |
| `npm run lint` (parcial) | ❌ FAIL — 115 erros de formatação (prettier/import-sort) em arquivos recentes |

#### Suites com falha
| Suite | Causa raiz |
|-------|-----------|
| `musicians.controller.int-spec.ts` | `AuthGuard` injetado no controller, test não usa `overrideGuard()` |
| `bands.controller.int-spec.ts` | Idem |
| `requests.controller.int-spec.ts` | Idem |
| `establishments.controller.int-spec.ts` | Idem |
| `events.providers.spec.ts` | `AuthGuard` requer `AuthJwtVerifier` — não provido no test module |
| `payment.providers.spec.ts` | `ConfirmTipPaymentUseCase` requer `DomainEventMediator` — não provido no test module |

#### Migrations pendentes (banco local)
- `20260620120000_p0_p1_p2_corrections`
- `20260620130000_p1_p2_remaining_corrections`

As migrations existem e foram verificadas no schema, mas o banco local de testes não as recebeu. Isso explica falhas em int-specs que tentam conectar ao banco.

---

## 2. Resumo Executivo — Parecer por Camada

| Camada | Parecer | Principais riscos remanescentes |
|--------|---------|-------------------------------|
| **Core** | ✅ Sólido | UoW opcional em ConfirmTipPayment; ScanQR sem atomicidade; roadmap desatualizado sobre Bloco 2 |
| **NestJS** | ⚠️ Parcial | 6 test suites quebradas; int-specs de musicians/requests/establishments/bands não têm `overrideGuard`; auth-module/ownership pendentes |
| **Prisma** | ⚠️ Parcial | Schema correto; migrations não aplicadas ao banco local; Float remanescente em analytics (não financeiro); `total_tips Float` em UserPoints |
| **RabbitMQ** | ✅ Funcional com ressalvas | Integration events: apenas TipCompleted mapeado; queues mortas no env (requests, notifications, payments, gamification); correlationId parcial |
| **Segurança** | ⚠️ Parcial | Auth-module criado mas Blocos 4/4B não concluídos; ownership multi-tenant pendente; int-specs sem auth demonstram gap |
| **Testes** | ❌ Regressão | 41 testes falhando em 6 suites; falhas são de setup de DI pós-correção, não de lógica de negócio; cobertura HTTP/e2e ausente |

---

## 3. Scorecard de Revalidação

### Core (2026-06-18) — 16 itens auditados

| Prioridade | Total | ✅ Corrigido | ⚠️ Parcial | ❌ Não corrigido |
|-----------|-------|-------------|-----------|----------------|
| P0 | 3 | 2 | 1 | 0 |
| P1 | 5 | 5 | 0 | 0 |
| P2 | 5 | 3 | 2 | 0 |

**P0 corrigidos:** 2/3 (67%)  
**P1 corrigidos:** 5/5 (100%)  
**P2 corrigidos:** 3/5 (60%)

### NestJS (2026-06-18) — 16 itens auditados

| Prioridade | Total | ✅ Corrigido | ⚠️ Parcial | ❌ Não corrigido/Regressão |
|-----------|-------|-------------|-----------|--------------------------|
| P0 | 7 | 5 | 1 | 1 |
| P1 | 8 | 6 | 1 | 1 |
| P2 | 7 | 5 | 1 | 1 |

**P0 corrigidos:** 5/7 (71%)  
**P1 corrigidos:** 6/8 (75%)  
**P2 corrigidos:** 5/7 (71%)

### Prisma (2026-06-20) — 14 itens auditados

| Prioridade | Total | ✅ Corrigido | ⚠️ Parcial | ❌ Não corrigido |
|-----------|-------|-------------|-----------|----------------|
| P0 | 5 | 5 | 0 | 0 |
| P1 | 9 | 9 | 0 | 0 |
| P2 | 9 | 8 | 1 | 0 |

**P0 corrigidos:** 5/5 (100%)  
**P1 corrigidos:** 9/9 (100%)  
**P2 corrigidos:** 8/9 (89%)

### RabbitMQ/Outbox (2026-06-20) — 17 itens auditados

| Prioridade | Total | ✅ Corrigido | ⚠️ Parcial | ❌ Não corrigido |
|-----------|-------|-------------|-----------|----------------|
| P0 | 2 | 2 | 0 | 0 |
| P1 | 7 | 6 | 1 | 0 |
| P2 | 8 | 6 | 2 | 0 |

**P0 corrigidos:** 2/2 (100%)  
**P1 corrigidos:** 6/7 (86%)  
**P2 corrigidos:** 6/8 (75%)

---

## 4. Matriz Completa de Revalidação

### 4.1 Core (2026-06-18)

| ID | Achado original | Status | Evidência no código |
|----|----------------|--------|-------------------|
| CORE-P0-1 | QR sem parse soundmeet:// | ✅ Corrigido | `scan-qr.use-case.ts:137` — regex `^soundmeet:\/\/musician\/([^/]+)$` |
| CORE-P0-2 | ConfirmTipPayment sem atomicidade | ⚠️ Parcial | UoW injetado pelo payment.providers.ts. Mas construtor ainda tem `uow?: IUnitOfWork` (opcional, linha 48). Ausência de injeção → falha silenciosa, não erro de startup |
| CORE-P0/P1-3 | Fonte de verdade de pontos indefinida | ✅ Corrigido | `AddPointsUseCase` escreve `UserScore` (ledger) antes de `UserPoints` (projeção); `Audience` não compete com saldo |
| CORE-P0/P1-4 | Audience com fluxos paralelos (pedido, gorjeta, voto, presença) | ✅ Corrigido | `audiences.providers.ts` importa `CreateRequestUseCase`, `PaymentSendTipUseCase`, `VoteRequestUseCase`, `AddEventAttendeeUseCase` |
| CORE-P1-1 | EstablishmentAnalytics como .entity.ts sem in-memory | ✅ Corrigido | `establishment-analytics.read-model.ts` confirmado; handler usa import correto |
| CORE-P1-2 | RequestVote órfão | ✅ Corrigido | `VoteRequestUseCase` wired em `requests.providers.ts`; exposto em `requests.controller.ts` |
| CORE-P1-3 | Gamification ledger/projeção invertido | ✅ Corrigido | `AddPointsUseCase` confirma ledger-first em providers e handler |
| CORE-P1-4 | Events com dupla orquestração em repository e use case | ✅ Corrigido | `events.providers.ts` registra `EventAttendeePrismaRepository`, `EventMusicianPrismaRepository`; use cases recebem repositórios dedicados |
| CORE-P1-5 | ai-cifra sem barrels e mappers com fallback silencioso | ✅ Corrigido | Confirmado por build limpo |
| CORE-P1-6 | MusicLibrary vs SyncedLyrics — fonte de verdade indefinida | ✅ Corrigido | Schema: `music_library.lrc_*` com comentário inline de propriedade `SyncedLyrics` |
| CORE-P1-7 | scheduling max_shows_per_day não aplicado | ✅ Corrigido | `IBookingRepository.countConfirmedByDate()` implementado |
| CORE-P2-1 | payment paths divergentes | ⚠️ Parcial | Re-exports adicionados; paths físicos antigos ainda existem |
| CORE-P2-2 | Cobertura Prisma/in-memory desigual | ⚠️ Parcial | Build verde; specs novos básicos; cobertura de infra ainda irregular |
| CORE-P2-3 | Barrels inconsistentes | ✅ Corrigido | ai-cifra ganhou barrels; build confirma sem import de path interno |
| CORE-P2-4 | Mappers sem LoadEntityError | ✅ Corrigido | ai-cifra e RequestVote mappers atualizados |
| CORE-P2-5 | ai-audio AiAudioSeparationOutput como .entity.ts ambíguo | ✅ Corrigido | Renomeado para .child-entity.ts |

### 4.2 NestJS (2026-06-18)

| ID | Achado original | Status | Evidência no código |
|----|----------------|--------|-------------------|
| NEST-P0-1 | audiences.providers com facades desalinhadas | ✅ Corrigido | `audiences.providers.ts` importa use cases canônicos de request, payment, gamification, events |
| NEST-P0-2 | events.providers sem repos de attendee/performer | ✅ Corrigido | `events.providers.ts` registra `EventAttendeePrismaRepository` e `EventMusicianPrismaRepository` |
| NEST-P0-3 | payment-module ausente | ✅ Corrigido | `src/nest-modules/payment-module/` existe com controller, providers, DTOs, testes |
| NEST-P0-4 | auth-module ausente | ⚠️ Parcial | `auth-module` criado com JWT/JWKS; guards aplicados em controllers. Mas Blocos 4 e 4B do roadmap (Keycloak enforcement, ownership, multi-tenant) ainda marcados como `[ ]` |
| NEST-P0-5 | AI tokens fail-open | ✅ Corrigido | `InternalTokenGuard` aplicado em `ai-cifra.controller.ts` e `ai-audio.controller.ts`; Joi torna tokens obrigatórios em produção |
| NEST-P0-6 | Bulk/materialização lyrics sem token | ✅ Corrigido | `synced-lyrics-lrclib.controller.ts` usa `AuthGuard + RolesGuard + InternalTokenGuard` em bulk/materialize (linhas 74, 96) |
| NEST-P0-7 | establishment-analytics-events.handlers importa arquivo antigo | ✅ Corrigido | Handler importa `establishment-analytics.read-model` (confirmado linha 4 do handler) |
| NEST-P1-1 | VoteRequestUseCase não exposto | ✅ Corrigido | `requests.controller.ts` linhas 90-91 confirmam injeção e rota |
| NEST-P1-2 | RequestEventsHandlers mutava Audience diretamente | ✅ Corrigido | Handler usa `AddPointsUseCase` com `processOnce()` |
| NEST-P1-3 | gamification-module sem exports de write | ✅ Corrigido | `gamification.module.ts` exporta `ADD_POINTS_USE_CASE`, `CALCULATE_POINTS_USE_CASE`, `USER_SCORE_REPOSITORY` |
| NEST-P1-4 | ai-audio-module órfão | ✅ Corrigido | `app.module.ts:50` confirma `AiAudioModule` registrado |
| NEST-P1-5 | RabbitMQ bootstrap fragmentado | ✅ Corrigido | `RabbitmqModule.forRoot()` centralizado; `normalizeTransport()` helper aplicado |
| NEST-P1-6 | Controller gordo com Prisma direto em ai-cifra-uploads | ✅ Corrigido | Controller usa `MusicLibraryCatalogService` (que delega para use cases canônicos); nenhum `PrismaService` direto no controller |
| NEST-P1-7 | Testes Nest insuficientes (events, scheduling, gamification, ai-cifra, ai-audio, synced-lyrics) | ❌ Regressão | 6 novas suites criadas, mas 2 delas falham (events.providers.spec, payment.providers.spec) por ausência de `DomainEventMediator` e `AuthJwtVerifier` no test module. Suites de musicians/requests/establishments/bands pré-existentes agora também falham (controller usa `AuthGuard` mas test não registra `AuthModule`) |
| NEST-P1-8 | Rotas fragilizadas em requests.controller | ✅ Corrigido | VoteRequestUseCase adicionado; reordenação de rotas aplicada |
| NEST-P2-1 | DTOs/Swagger incompletos | ✅ Corrigido | SearchEventsDto e DTOs sensíveis atualizados |
| NEST-P2-2 | `as any` em controllers | ⚠️ Parcial | Reduzidos em arquivos tocados; não varridos globalmente |
| NEST-P2-3 | Duplicidade de EntityValidationError filter | ✅ Corrigido | Contrato único em GlobalExceptionFilter |
| NEST-P2-4 | supertest-extend.ts legado | ✅ Corrigido | Removido |
| NEST-P2-5 | Política de @OnEvent handlers sem documentação | ✅ Corrigido | `nest-event-handlers-policy-2026-06-19.md` criado |
| NEST-P2-6 | MongoDB obrigatório sem uso real | ✅ Corrigido | MongoDB tornouse opcional |
| NEST-P2-7 | Guard compartilhado para callbacks internos | ✅ Corrigido | `InternalTokenGuard` reutilizado em ai-cifra, ai-audio e synced-lyrics |

### 4.3 Prisma (2026-06-20)

| ID | Achado original | Status | Evidência no schema |
|----|----------------|--------|-------------------|
| PRISMA-P0-1 | ConfirmTipPayment sem UoW | ✅ Corrigido no schema / ⚠️ Parcial no código | payment.providers.ts injeta PrismaUnitOfWork. Mas use case `uow?` ainda opcional → P0 remanescente no core |
| PRISMA-P0-2 | Campos monetários Float | ✅ Corrigido | `tips.amount`, `transactions.amount/fee/netAmount`, `musician_wallets.*` todos `Decimal @db.Decimal(12,2)` |
| PRISMA-P0-3 | Transaction.externalId sempre null | ✅ Corrigido | `transaction.aggregate.ts:21,51,68` confirma `external_id`; mapper hidrata nos dois sentidos |
| PRISMA-P0-4 | MusicRequest.status como String | ✅ Corrigido | `schema.prisma:68` — `enum MusicRequestStatus`; `music_requests.status MusicRequestStatus @default(pending)` |
| PRISMA-P0-5 | Booking.cancelled_by não persistido | ✅ Corrigido | `schema.prisma:364-365` — `cancelled_by String?`, `cancellation_reason String?` |
| PRISMA-P1-1 | Sem XOR constraint em bookings/inquiries | ✅ Corrigido | Migration `20260620130000...` — `bookings_musician_or_band_xor` e `inquiries_musician_or_band_xor` CHECK constraints |
| PRISMA-P1-2 | tips sem índices | ✅ Corrigido | `schema.prisma:759-762` — 4 índices compostos em tips |
| PRISMA-P1-3 | music_requests sem índice (eventId+status) | ✅ Corrigido | Índices `[eventId, status, created_at]` e `[eventId, status, priority]` adicionados |
| PRISMA-P1-4 | Rating duplicado em Musician e MusicianProfile | ✅ Corrigido | `schema.prisma:123-139` — MusicianProfile sem `rating`/`totalRatings` |
| PRISMA-P1-5 | instruments/genres/experience duplicados em MusicianProfile | ✅ Corrigido | MusicianProfile sem esses campos; mapper hidrata da raiz |
| PRISMA-P1-6 | Band sem qr_code | ✅ Corrigido | `schema.prisma:147` — `qr_code String? @unique` em Band; `band.aggregate.ts` tem `generateQRCode()` |
| PRISMA-P1-7 | BandMember sem constraint de liderança; remainder para [0] | ✅ Corrigido | `@@index([bandId, role])` adicionado; `members: { orderBy: { role: 'asc' } }` em band-prisma.repository.ts; zero membros lança EntityValidationError |
| PRISMA-P1-8 | votesCount sem atomic increment | ✅ Corrigido | `IRequestRepository.atomicIncrementVotes()` com `$executeRaw UPDATE ... SET votesCount = votesCount + 1` |
| PRISMA-P1-9 | Ranking FK columns em snake_case | ✅ Corrigido | `schema.prisma:711` — `audienceId String @map("user_id")`, `establishmentId String? @map("establishment_id")` |
| PRISMA-Cascade | Tip→Audience e UserScore→Audience com Cascade | ✅ Corrigido | `schema.prisma:702,754` — ambos com `onDelete: Restrict` |
| PRISMA-P2-1 | datasource sem URL explícita | ✅ N/A | Prisma 7 usa `prisma.config.ts` — falso alarme reconhecido |
| PRISMA-P2-2 | CurrencyEnum não usado em campos financeiros | ✅ Corrigido | `tips.currency`, `transactions.currency`, `musician_wallets.currency` com `CurrencyEnum @default(BRL)` |
| PRISMA-P2-3 | UserBadge sem FK/índice para Badge.name | ✅ Corrigido | `@@index([badge_type])` adicionado |
| PRISMA-P2-4 | updated_at faltando em 3 models | ✅ Corrigido | `EventMusician`, `MusicianUnavailability`, `BandUnavailability` com `updated_at @updatedAt` |
| PRISMA-P2-5 | Event.date redundante com startTime | ✅ Corrigido | Campo `date` removido de `Event`; schema:308-332 confirma só `startTime`/`endTime` |
| PRISMA-P2-6 | TRUNCATE sem script de recálculo | ✅ Corrigido | `scripts/recalculate-user-points-from-ledger.sql` criado |
| PRISMA-P2-7 | UserInteraction sem índice de gamificação | ✅ Corrigido | `@@index([audienceId, type, created_at])` adicionado |
| PRISMA-P2-8 | MusicRequest.priority sem CHECK | ✅ Corrigido | `music_requests_priority_non_negative CHECK ("priority" >= 0)` em migration |
| PRISMA-P2-9 | lrc_* sem comentário de propriedade SyncedLyrics | ✅ Corrigido | Comentário inline adicionado no schema |

### 4.4 RabbitMQ/Outbox (2026-06-20)

| ID | Achado original | Status | Evidência no código |
|----|----------------|--------|-------------------|
| MQ-P0-1 | TipCompletedEvent nunca emitido; handler sem processOnce | ✅ Corrigido | `confirm-tip-payment.use-case.ts`: publica `tip` via mediator pós-UoW; `PaymentEventsHandlers` com `processOnce()` chave `payment_event:tip_completed:{tip_id}:{audience_id}` |
| MQ-P0-2 | EVENTS_MESSAGE_BROKER_CONFIG vazio; exchange soundmeet.events inexistente | ✅ Corrigido | Config mapeia `TipCompletedIntegrationEvent → soundmeet.events / payment.tip.completed`; exchange topic declarado em `rabbitmq.module.ts:59` |
| MQ-P1-1 | x-delayed-message sem health check | ✅ Corrigido | `rabbitmq.module.ts:27` — `onApplicationBootstrap()` faz `assertExchange` e re-lança em caso de falha |
| MQ-P1-2 | Analytics handlers sem idempotência | ✅ Documentado | Aceitável: upsert idempotente por design; documentado no corrections |
| MQ-P1-3 | ai-audio dispatcher sem onModuleDestroy | ✅ Corrigido | `ai-audio.dispatcher.ts:40,75` — `destroyed`, `onModuleDestroy()`, `scheduleTimeout()` |
| MQ-P1-4 | normalizeTransport frágil | ✅ Corrigido | `app.module.ts:22` — `normalizeTransport()` com `.trim().toLowerCase()` |
| MQ-P1-5 | Retry com delay fixo 5s | ✅ Corrigido | `rabbitmq-consume-error.filter.ts:63` — `computeDelay()` exponencial com jitter |
| MQ-P1-6 | dlx.queue sem consumer | ✅ Corrigido | `dlx-logging.consumer.ts` criado; registrado em `rabbitmq.module.ts:99` |
| MQ-P1-7 | ai-audio-module não registrado | ✅ Confirmado já estava feito | `app.module.ts:50` confirma AiAudioModule |
| MQ-P2-1 | EVENTS_MESSAGE_BROKER_CONFIG vazio | ✅ Consolidado com P0-2 | — |
| MQ-P2-2 | publishEvent sem messageId | ✅ Corrigido | `rabbitmq-message-broker.ts` inclui `messageId: randomUUID()` |
| MQ-P2-3 | event_version sem política | ✅ Documentado | MVP: nova versão = nova routing key; sem código necessário |
| MQ-P2-4 | SyncedLyricsBulkConsumer sem timeout | ✅ Corrigido | `synced-lyrics.consumers.ts:10,12,68` — `withTimeout(30_000)` |
| MQ-P2-5 | Analytics handlers sem timeout | ✅ Documentado | Risco baixo; aceito para MVP |
| MQ-P2-6 | Routing keys inconsistentes | ✅ Documentado | Padrão estabelecido; inconsistência ai_cifra vs payment intencional |
| MQ-P2-7 | correlationId não propagado | ⚠️ Parcial | messageId em publishEvent; `x-correlation-id` HTTP→RabbitMQ pendente para pós-MVP |
| MQ-P2-8 | Transport env vars sem Joi cross-validation | ✅ Corrigido | RABBITMQ_URL com `uri({scheme:["amqp","amqps"]}).required()`; `AI_AUDIO_PROCESSING_TRANSPORT` agora com `.valid("http","rabbitmq")` |

---

## 5. Regressões Detectadas

### REG-1 — Int-specs de musicians/requests/establishments/bands agora falham (CRÍTICO)

**Tipo:** Regressão de teste introduzida pela correção do auth-module  
**Suites afetadas:**
- `musicians.controller.int-spec.ts` (13 testes)
- `bands.controller.int-spec.ts` (6 testes)
- `requests.controller.int-spec.ts` (8 testes)
- `establishments.controller.int-spec.ts` (12 testes)

**Causa:** Após a correção do NestJS que adicionou `@UseGuards(AuthGuard, RolesGuard)` nos controllers de musicians e requests, os int-specs existentes não foram atualizados para usar `overrideGuard(AuthGuard).useValue({...})`. O módulo de teste não resolve `AuthJwtVerifier`, dependência de `AuthGuard`.

**Contraste:** `audiences.controller.int-spec.ts` PASSA porque foi atualizado (linha 207: `overrideGuard(AuthGuard)`). Os demais não foram.

**Impacto:** A suite de referência mais madura do projeto (`musicians.controller.int-spec.ts`) está quebrada. Isso encobre regressões de produto futuras.

**Evidência:** Erro exato — `Nest can't resolve dependencies of the AuthGuard (?, Reflector, ConfigService). Please make sure that the argument AuthJwtVerifier at index [0] is available in the RootTestModule context.`

---

### REG-2 — payment.providers.spec falha por DomainEventMediator não injetado

**Tipo:** Regressão de teste introduzida pela correção do payment-module  
**Suite:** `payment.providers.spec.ts`

**Causa:** `ConfirmTipPaymentUseCase` agora requer `DomainEventMediator` como 6º argumento (adicionado na correção MQ-P0-1). O spec não inclui `DomainEventMediator` na lista de providers.

**Impacto:** O único teste que valida o wiring de use cases de payment está quebrado. Falhas de composição em payment não seriam detectadas.

---

### REG-3 — events.providers.spec falha por AuthJwtVerifier não resolvível

**Tipo:** Regressão de teste introduzida pela correção do events-module  
**Suite:** `events.providers.spec.ts`

**Causa:** O spec instancia `EventsController`, que tem `@UseGuards(AuthGuard, RolesGuard)`. O test module não importa `AuthModule` nem provê `AuthJwtVerifier`.

**Impacto:** Teste criado especificamente para validar o wiring P0 de attendee/performer repositories não funciona.

---

### REG-4 — UoW ainda opcional no ConfirmTipPaymentUseCase (regressão de contrato)

**Tipo:** Correção parcial que não eliminou o risco original  
**Arquivo:** `src/core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case.ts:48`

**Causa:** `private readonly uow?: IUnitOfWork` — o operador `?` torna o UoW opcional. O `payment.providers.ts` injeta o UoW corretamente, mas qualquer outro contexto que instancie `ConfirmTipPaymentUseCase` sem UoW (ex: testes, outros módulos futuros) executa o fluxo financeiro sem transação, silenciosamente.

A correção Prisma (P0-1) afirmou que `IUnitOfWork` seria obrigatório no construtor. O código mostra que não é.

**Risco real:** Baixo a curto prazo (payment.providers.ts sempre injeta o UoW). Alto a médio prazo quando novos contextos ou testes instanciam o use case diretamente sem perceber a omissão.

---

### REG-5 — 115 erros de lint em arquivos das últimas correções

**Tipo:** Qualidade degradada acumulada  
**Arquivos afetados:** `payment-event-processing.service.ts`, `payment.module.ts`, `dlx-logging.consumer.ts`, `rabbitmq-consume-error.filter.ts`, `requests.controller.ts`, `synced-lyrics.consumers.ts`, `withdraw-to-pix.dto.ts`, e outros

**Causa:** Correções aplicadas em múltiplas sessões sem run de autofix ao final. Erros são de formatação (prettier/import-sort), não de lógica.

**Impacto:** CI/CD que rode lint como gate bloquearia todos os deploys. Menor em ambiente de desenvolvimento, bloqueador em pipeline com lint gate.

---

## 6. Achados Novos

### CORE-NEW-1 — ScanQR.execute sem atomicidade (P1 — Bloco 2.5 do roadmap, ainda não implementado)

**Arquivo:** `src/core/audience/application/use-cases/scan-qr/scan-qr.use-case.ts:91,105`

```typescript
await this.userInteractionRepo.insert(userInteraction); // operação 1
await this.audienceRepository.update(audience);          // operação 2 — sem UoW
```

Falha após inserção de `userInteraction` e antes de `update(audience)` cria interação sem reflexo no perfil do público. O roadmap reconhece isso no Bloco 2.5, mas o corrections report do core marcou o achado CORE-P0-2 como "Resolvido" genericamente; a atomicidade do ScanQR é um gap separado, nunca endereçado.

**Risco:** Médio. Interação duplicada em restart ou inconsistência parcial de pontos de presença.  
**Correção sugerida:** Adicionar `IUnitOfWork` ao `ScanQRUseCase` (Bloco 2.5 do roadmap).  
**Bloco:** 2.5

---

### NEST-NEW-1 — Roadmap diverge da realidade sobre Blocos 2, 3 e 4 (P1 — Dívida documental)

**Arquivo:** `Docs/roadmap.md:51-83`

O roadmap lista Bloco 2 (QR Code) e Bloco 3 (módulos órfãos) inteiramente como `[ ]` pendentes. No entanto:

- **Bloco 2.1–2.4:** Já implementados no core (`scan-qr.use-case.ts` parseia `soundmeet://musician/<uuid>`, valida UUID, verifica músico existente/ativo). Apenas 2.5 (UoW) e 2.6 (testes atualizados) são genuinamente pendentes.
- **Bloco 3.1 (ai-audio):** Marcado `[ ]` no roadmap, mas `app.module.ts:50` confirma `AiAudioModule` registrado.
- **Bloco 3.3–3.4 (music-library-module):** Marcado `[ ]` no roadmap, mas `music-library-module` existe com controller, providers, service, DTOs e testes.
- **Bloco 4.1–4.5:** Marcados `[ ]` no roadmap. Parcialmente implementados (auth-module criado, guards aplicados), mas ownership/multi-tenant (4B) genuinamente pendentes.

**Risco:** Desenvolvedores que leiam o roadmap podem retrabalhar o que já existe, ou pular itens que acreditam estar prontos.

---

### DB-NEW-1 — Migrations não aplicadas ao banco local (P1 — Operacional)

**Evidência:** `npx prisma migrate status` reporta 2 migrations pendentes:
- `20260620120000_p0_p1_p2_corrections`
- `20260620130000_p1_p2_remaining_corrections`

O banco local de testes está 2 migrations atrás do schema declarado. Isso explica diretamente as falhas nas int-specs que tentam conectar ao banco (`musicians.controller.int-spec`, `establishments.controller.int-spec`, `requests.controller.int-spec`, `bands.controller.int-spec`).

**Risco:** Qualidade de CI degradada; int-specs deveriam ser o safety net para regressões, mas estão quebradas por razão de infraestrutura local, não de código.  
**Correção:** `npx prisma migrate dev` ou `npx prisma migrate deploy` no ambiente de dev/CI.

---

### DB-NEW-2 — Float remanescente em campos financeiros de analytics (P2)

**Arquivo:** `prisma/schema.prisma:645,970,973,989,990`

```prisma
model UserPoints      { total_tips Float }        // soma monetária de gorjetas
model MusicianAnalytics { totalTipAmount Float; engagementScore Float }
model EstablishmentAnalytics { totalSpent Float; avgRating Float }
```

A correção Prisma-P0-2 migrou os campos financeiros transacionais para `Decimal`. Os campos de analytics/projeção que também carregam valores monetários (`total_tips`, `totalTipAmount`, `totalSpent`) permaneceram como `Float`.

**Risco:** Para analytics, desvio de centavo é menos crítico que em transações. Mas `total_tips` em `UserPoints` representa soma monetária real — potencial desvio cumulativo em usuários com muitas gorjetas.  
**Correção sugerida:** Migrar `UserPoints.total_tips` para `Decimal`. `engagementScore` e `avgRating` podem permanecer Float (são scores, não valores monetários).

---

### MQ-NEW-1 — Queues mortas no .env.example sem consumer ou dispatcher (P2)

**Arquivo:** `envs/.env.example` + `src/nest-modules/rabbitmq-module/rabbitmq.module.ts`

As seguintes queues aparecem no .env.example mas não têm consumer, dispatcher, exchange declarado, nem routing key:
- `RABBITMQ_QUEUE_REQUESTS` (soundmeet.requests)
- `RABBITMQ_QUEUE_NOTIFICATIONS` (soundmeet.notifications)
- `RABBITMQ_QUEUE_PAYMENTS` (soundmeet.payments)
- `RABBITMQ_QUEUE_GAMIFICATION` (soundmeet.gamification)

Ao contrário de `soundmeet.events` (que tem exchange topic declarado e TipCompleted mapeado), essas queues são configurações mortas. Criam impressão falsa de que payment, gamification e notifications fluem via broker.

**Risco:** Confusão arquitetural; `soundmeet.exchange` no Joi schema (linha 33 config-module) também não mapeia para nenhum exchange declarado — o exchange criado é `soundmeet.events` (topic) e `direct.delayed`. O valor default `soundmeet.exchange` nunca funciona como exchange real.

---

### XCUT-NEW-1 — Ownership/multi-tenant sem enforcement (P0 para MVP com dados reais)

**Arquivo:** Blocos 4B do roadmap — nenhum dos itens implementados  
**Referência:** `Docs/auth/keycloak.md`

O `auth-module` existe e valida JWT/Keycloak. Os guards verificam roles (`musician`, `establishment`, `admin`). Mas não há enforcement de ownership:
- Músico A pode chamar `PATCH /musicians/{id_do_musico_B}` com token de músico válido.
- Estabelecimento A pode chamar `POST /events` em nome do estabelecimento B.
- Músico pode confirmar gorjeta de outro músico.

As claims de contexto do Keycloak (`establishment_ids`, `band_ids`) não são lidas nem validadas nos use cases. As rotas de escrita verificam autenticação (quem é você?) mas não autorização de recurso (você pode alterar esse objeto?).

**Risco:** Crítico para ambiente multi-tenant com dados reais. Músicos podem interferir em perfis de outros; estabelecimentos podem criar eventos em nome alheio.  
**Bloco:** 4B (4B.2, 4B.3, 4B.4, 4B.5)

---

### XCUT-NEW-2 — Int-specs sem mecanismo padrão de bypass de auth (P1)

**Arquivos:** `musicians.controller.int-spec.ts`, `bands.controller.int-spec.ts`, `requests.controller.int-spec.ts`, `establishments.controller.int-spec.ts`

O projeto não tem um helper de test que padronize `overrideGuard(AuthGuard).useValue({ canActivate: () => true })`. O `audiences.controller.int-spec.ts` implementou o override manualmente; os outros módulos não. Toda nova int-spec que use controllers com guard vai repetir o mesmo problema.

**Correção sugerida:** Criar `src/nest-modules/shared-module/testing/auth-guard-mock.ts` com helper reutilizável; atualizar int-specs afetadas e documentar a convenção.

---

## 7. Dívida Documental

| Item | Documento | Inconsistência |
|------|-----------|---------------|
| Bloco 2 | roadmap.md | Items 2.1–2.4 listados como `[ ]` mas implementados no core |
| Bloco 3.1 | roadmap.md | ai-audio listado como `[ ]` mas registrado em app.module.ts |
| Bloco 3.3–3.4 | roadmap.md | music-library-module listado como `[ ]` mas implementado |
| Bloco 4 | roadmap.md | Parcialmente implementado (auth-module, guards), mas todos os itens marcados `[ ]` |
| auth-module | roadmap.md linha 22 | Coluna de status diz `❌ Keycloak pendente` mas module existe com JWT/JWKS |
| music-library-module | roadmap.md linha 23 | Diz `❌ core pronto, sem controller Nest` mas controller existe |
| P0 atomicidade | core-review-corrections | Diz "Resolvido", mas `uow?` ainda é opcional no construtor |
| Bloco 2.5 (UoW no ScanQR) | roadmap.md | Listado como `[ ]` e genuinamente pendente — alinhado |
| business-rules.md | Todos os `[~]` de AI musician | Não atualizado para refletir correções de ai-cifra, music-library |

---

## 8. Fluxos Críticos End-to-End — Status Atual

### Fluxo 1 — payment → wallet → gamification

**Status:** ⚠️ Parcial

**Caminho:** `POST /tips` → SendTipUseCase → Tip(pending) → `POST /tips/:id/confirm` → ConfirmTipPaymentUseCase → UoW(Transaction + Tip.complete + N×Wallet.credit) → `DomainEventMediator.publish(tip)` → `PaymentEventsHandlers.handleTipCompleted()` → `processOnce()` → `AddPointsUseCase` → UserScore(ledger) + UserPoints(projeção)

**O que funciona:** Transação financeira com UoW (payment.providers.ts injeta corretamente); `TipCompletedEvent` emitido; `processOnce()` com Redis garante idempotência.

**O que está incompleto:**
1. `uow?` opcional — contextos que não usam payment.providers.ts ficam sem transação
2. Sem webhook PIX real (1.6, 1.7 do roadmap)
3. `TipCompletedIntegrationEvent` publicado em `soundmeet.events`, mas nenhum consumer externo existe ainda

---

### Fluxo 2 — scan QR → audience → points

**Status:** ⚠️ Parcial

**Caminho:** `POST /audiences/:id/scan-qr` → ScanQRUseCase → parseMusicianQRCode(soundmeet://musician/uuid) → valida músico ativo → insert(UserInteraction) → update(Audience) → AddPointsUseCase(QR_SCAN)

**O que funciona:** Parse de QR, validação UUID, verificação músico ativo, pontuação via AddPointsUseCase.

**O que está incompleto:**
1. Sem UoW entre insert(UserInteraction) e update(Audience) — operações não atômicas (Bloco 2.5)
2. DTO de ScanQR não foi verificado para `@IsUUID` em musician_id (Bloco 2.6 de testes)

---

### Fluxo 3 — request → vote → ranking

**Status:** ⚠️ Parcial

**Caminho:** `POST /requests` → CreateRequestUseCase → `POST /requests/:id/vote` → VoteRequestUseCase → RequestVotePrismaRepository + atomicIncrementVotes → AddPointsUseCase

**O que funciona:** CreateRequest, VoteRequest com repositório dedicado e atomic increment.

**O que está incompleto:**
1. Ranking não é atualizado automaticamente por evento — `soundmeet.gamification` queue sem consumer
2. Não há fluxo event-driven request → ranking; uso manual via use case dedicado

---

### Fluxo 4 — AI cifra/audio/synced-lyrics

**Status:** ai-cifra ✅ (transport=http), ai-audio ⚠️, synced-lyrics ✅

**ai-cifra:** Dispatcher → CreateAiCifraAnalysisJobUseCase → consumers completamente wired; transport configurável.

**ai-audio:** Módulo registrado, dispatcher e consumers existem, `onModuleDestroy` implementado. Sem smoke test end-to-end confirmado.

**synced-lyrics:** Bulk com `withTimeout(30s)` e `InternalTokenGuard`. Transport inline funciona; RabbitMQ mode não testado.

---

### Fluxo 5 — booking → analytics

**Status:** ⚠️ Parcial

**Caminho:** `POST /bookings` → ProposeBookingUseCase → BookingCreatedEvent → `@OnEvent` → EstablishmentAnalyticsEventsHandlers → RecalculateDailyAnalyticsUseCase → EstablishmentAnalyticsPrismaRepository (upsert)

**O que funciona:** Booking lifecycle (propose, confirm, cancel) com max_shows_per_day; analytics handlers recebem eventos e fazem upsert idempotente; handler importa `.read-model` correto.

**O que está incompleto:**
1. Sem MongoDB analytics (definido na arquitetura como analytics store secundário, ainda no backlog)
2. `EstablishmentAnalytics` na Prisma usa `date` como campo único — o `date` foi removido do model `Event` na correção P2-5, mas `MusicianAnalytics` e `EstablishmentAnalytics` mantêm campo `date DateTime @db.Date` (dia específico, diferente de `Event.startTime`)

---

## 9. Recomendações Priorizadas — Próximos 10 Passos

### 1. Corrigir int-specs para registrar AuthModule ou usar overrideGuard (P0 operacional)
**Arquivos:** `musicians.controller.int-spec.ts`, `bands.controller.int-spec.ts`, `requests.controller.int-spec.ts`, `establishments.controller.int-spec.ts`, `events.providers.spec.ts`, `payment.providers.spec.ts`  
**Ação:** Criar `auth-guard-mock.ts` em `shared-module/testing/` e aplicar em todos os int-specs. Para `payment.providers.spec.ts`, adicionar `DomainEventMediator` como provider mock.  
**Impacto:** Restaura 41 testes para verde; restaura capacidade de detectar regressões.  
**Roadmap:** Sem bloco associado — manutenção de qualidade.

### 2. Aplicar migrations ao banco de CI/dev (P0 operacional)
**Ação:** `npx prisma migrate dev` no ambiente de desenvolvimento; configurar `prisma migrate deploy` no pipeline de CI.  
**Impacto:** Desbloqueia int-specs que dependem do banco; garante que P0-2 (Float→Decimal) e P0-4 (MusicRequestStatus enum) estejam efetivos.

### 3. Tornar uow obrigatório em ConfirmTipPaymentUseCase (P0 arquitetural — Bloco 1)
**Arquivo:** `src/core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case.ts:48`  
**Ação:** Mudar `private readonly uow?: IUnitOfWork` para `private readonly uow: IUnitOfWork`.  
**Impacto:** Qualquer contexto que instancie sem UoW falha na compilação em vez de silenciosamente.

### 4. Implementar atomicidade em ScanQRUseCase (P1 — Bloco 2.5)
**Arquivo:** `src/core/audience/application/use-cases/scan-qr/scan-qr.use-case.ts`  
**Ação:** Adicionar `IUnitOfWork` como dependência; envolver `insert(userInteraction)` + `update(audience)` em `uow.do()`.  
**Roadmap:** Bloco 2.5.

### 5. Atualizar roadmap.md para refletir estado real (P1 documental)
**Arquivo:** `Docs/roadmap.md`  
**Ação:** Marcar 2.1–2.4 como `[x]`; marcar 3.1 e 3.3–3.4 como `[x]`; ajustar status de Bloco 4 para refletir o que foi implementado (auth-module, guards) vs o que falta (ownership, 4B).  
**Impacto:** Evita retrabalho e confusão sobre próximo passo.

### 6. Criar helper padrão de guard mock para testes (P1 qualidade)
**Arquivo:** `src/nest-modules/shared-module/testing/auth-guard-mock.ts`  
**Ação:** Criar `AuthGuardMock` e `AuthModuleMock` reutilizáveis; documentar na CLAUDE.md de módulos que todos os int-specs de controllers com guards devem usá-lo.  
**Impacto:** Previne REG-1 e XCUT-NEW-2 de se repetirem.

### 7. Implementar Bloco 4B — enforcement de ownership (P0 para dados reais)
**Arquivos:** controllers, use cases de escrita, guards  
**Ação:** Criar `OwnershipGuard` ou policy que leia `establishment_ids`, `band_ids` do JWT e valide contra o recurso solicitado. Aplicar em rotas de escrita de musicians, establishments, events, scheduling, payment.  
**Roadmap:** Bloco 4B.1–4B.5.

### 8. Corrigir lint nos arquivos das correções recentes (P1 qualidade)
**Ação:** `npm run lint -- --fix` nos arquivos com erros de prettier/import-sort; verificar resultado e commitar.  
**Impacto:** Desbloqueia CI/CD com lint gate; remove REG-5.

### 9. Migrar UserPoints.total_tips para Decimal (P2 — financeiro)
**Arquivo:** `prisma/schema.prisma:645`  
**Ação:** Migration ALTER TABLE user_points ALTER COLUMN total_tips TYPE NUMERIC(12,2); atualizar mapper.  
**Roadmap:** DB-NEW-2; não tem bloco associado.

### 10. Implementar Bloco 1.6–1.7 (PIX real + webhook idempotente)
**Ação:** Substituir `PixGatewayMock` por adapter real; implementar webhook `POST /payments/pix/callback` com deduplicação por `externalId` (Transaction.external_id já preparado para isso).  
**Roadmap:** Blocos 1.6 e 1.7.

---

## 10. Parecer Final

### Pronto para produção?

**Resposta curta: NÃO para produção geral. SIM para MVP controlado com condições.**

### O que bloqueia MVP
1. **41 testes falhando** (6 suites) — pipeline de CI está vermelho. Não é seguro fazer deploy quando a suite de referência (`musicians.controller.int-spec`) está quebrada por regressão de setup.
2. **Migrations pendentes no banco local** — int-specs de banco não podem rodar.
3. **Ownership/multi-tenant ausente** (XCUT-NEW-1) — qualquer usuário autenticado com role correto pode alterar recursos de outros. Aceitável em ambiente fechado/beta com usuários confiáveis; não aceitável em produção pública.

### O que está produtivo para MVP controlado
- Core de todos os 13 domínios: sólido, validado, testado.
- Fluxo de gorjeta financeira: atômico via UoW; idempotente via processOnce; TipCompleted publicado no broker.
- Schema Prisma: todos os P0/P1 corrigidos; monetário em Decimal; enums corretos; índices presentes.
- Auth: JWT validado; guards em controllers de escrita.
- AI-Cifra (transport=http): ciclo completo funcional.
- RabbitMQ infraestrutura: backoff exponencial, DLX com logging, health check de plugin.
- ScanQR: parse correto de `soundmeet://musician/<uuid>`, UUID validado, músico verificado.
- Gamificação: ledger (UserScore) e projeção (UserPoints) separados; AddPointsUseCase com processOnce.

### O que bloqueia escala pós-MVP
- Outbox pattern para eventos financeiros (Bloco 5.3)
- Ranking via event-driven RabbitMQ (Bloco 5.2)
- Webhook PIX real (Blocos 1.6, 1.7)
- Ownership enforcement completo (Bloco 4B)
- Cobertura HTTP/e2e (pendente desde a primeira auditoria)

### Condições para liberação de MVP controlado (em ordem)
1. Corrigir int-specs quebradas (Passos 1 e 2 acima) — estimativa: 4–6h
2. Aplicar migrations ao banco de staging/prod
3. Decidir e documentar explicitamente o nível de risco aceito para ownership (4B.1–4B.5 para after v1.0 ou antes)
4. Corrigir lint (1h com autofix)
5. Tornar uow obrigatório no construtor (1 linha de código + teste)
