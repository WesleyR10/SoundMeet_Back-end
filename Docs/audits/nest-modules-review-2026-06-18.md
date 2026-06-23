# Auditoria Arquitetural da Camada NestJS - 2026-06-18

## Escopo

Esta auditoria cobre `soundmeet-backend/src/nest-modules/` em modo diagnostico. Nenhum codigo de producao foi refatorado nesta fase.

Fontes usadas:

- `soundmeet-backend/Docs/architecture.md`
- `soundmeet-backend/Docs/business-rules.md`
- `soundmeet-backend/Docs/features.md`
- `soundmeet-backend/Docs/roadmap.md`
- `soundmeet-backend/Docs/qr-code.md`
- `soundmeet-backend/Docs/AI-musician/chord-sheet.md`
- `soundmeet-backend/Docs/AI-musician/README.md`
- `soundmeet-backend/Docs/audits/core-review-2026-06-18.md`
- `soundmeet-backend/Docs/audits/core-review-2026-06-18-corrections.md`
- `.cursor/rules/nestjs-api-layer.mdc`
- Referencia externa: `FC3-admin-catalogo-de-videos-typescript/src/nest-modules/`

Foco principal: verificar se a camada Nest expoe corretamente os use cases e decisoes do core corrigido, sem reintroduzir fluxos paralelos ou regra de negocio fora dos bounded contexts canonicos.

## Resumo Executivo

A camada NestJS do SoundMeet preserva bem o esqueleto FC3 nos modulos CRUD maduros: controllers finos, providers declarativos, presenters, `ValidationPipe` global com 422, wrapper `{ data }` e filtros de excecao. `musicians-module`, partes de `establishments-module`, `requests-module` e `scheduling-module` mostram que o padrao interno existe e e reaplicavel.

O problema central nao e estrutura de pastas. A camada Nest **nao acompanhou completamente as correcoes arquiteturais do core feitas em 2026-06-18**. Isso aparece como wiring quebrado ou incompleto em `audiences-module` e `events-module`, ausencia de `payment-module` mesmo com facades de audience dependendo dele, falta de `VoteRequestUseCase` na API e handlers que ainda atualizam `Audience` diretamente, contornando a decisao de `UserScore` como ledger.

Ha tambem uma lacuna de seguranca transversal: `auth-module` nao existe, Keycloak/JWT estao apenas em config/Swagger, e endpoints de escrita ficam sem guards. Nos modulos de IA, os endpoints internos usam tokens opcionais e falham abertos quando a env nao esta definida; `synced-lyrics` tem rate limit parcial, mas o token de bulk existe no schema e nao e aplicado.

Parecer curto: a camada Nest esta boa como base de CRUD e composicao simples, mas **nao esta pronta para evoluir produto sensivel** (pagamento, gamificacao real, IA em escala, callbacks internos) antes dos P0/P1 abaixo.

## Fase 1 - Mapeamento Inicial

### Modulos Encontrados em `src/nest-modules/`

| Modulo | Artefatos principais | Testes Nest | Integracoes | AppModule | Status inicial |
|---|---|---:|---|---|---|
| `config-module` | `config-module.module.ts`, `config.schema.ts` | 1 spec | Joi/env, Keycloak/JWT config, RabbitMQ config, PIX config | sim | Parcial: config de auth/payment existe sem modulo correspondente |
| `database-module` | `database.module.ts`, `prisma/prisma.service.ts` | 1 spec | Prisma, MongoDB/Mongoose, Redis cache | sim | Parcial: Mongo obrigatorio apesar de analytics ainda backlog |
| `shared-module` | presenters, filters, interceptor, testing helpers | 7 specs | Validation/serialization HTTP | indireto via `global-config.ts` | Conforme como biblioteca transversal |
| `rabbitmq-module` | `rabbitmq.module.ts`, consume error filter | 1 spec | RabbitMQ, DLX, delayed exchange | nao direto | Parcial: `forRoot` usado por features, `forFeature` nao usado |
| `musicians-module` | module, 2 controllers, providers, presenters, DTOs, testing | 2 spec + 1 int-spec | Prisma | sim | Parcial baixo risco |
| `establishments-module` | module, controller, providers, analytics handlers/job, presenters, DTOs | 1 int-spec | Prisma, EventEmitter, scheduling analytics | sim | Parcial; import de analytics desatualizado |
| `audiences-module` | module, controller, providers, presenter, DTOs, testing | 1 spec + 1 int-spec | Prisma, musician repo, gamification interaction | sim | Nao conforme: facades com DI antiga |
| `requests-module` | module, controller, providers, presenter, DTOs, event handlers, testing | 1 spec + 1 int-spec | Prisma, EventEmitter | sim | Parcial: `VoteRequest` ausente e handler duplica gamificacao |
| `events-module` | module, controller, providers, presenter, DTOs | 0 | Prisma, EventEmitter mediator | sim | Nao conforme: attendee/performer repos nao wired |
| `scheduling-module` | module, bookings/inquiries/calendar controllers, providers, presenters, handlers/job, DTOs | 0 | Prisma, EventEmitter, cron | sim | Parcial; sem testes HTTP |
| `gamification-module` | module, controller, providers, presenter, DTOs | 0 | Prisma | sim | Parcial: so leitura/projecao |
| `ai-cifra-module` | module, controllers, providers, presenter, DTOs, dispatcher, consumers, job, rabbitmq config | 0 | Prisma, S3/R2/MinIO, RabbitMQ, worker HTTP, SimpMusic/Musify/Piped | sim | Parcial alto risco: seguranca e controller gordo |
| `ai-audio-module` | module, controllers, providers, presenter, DTOs, dispatcher, consumers, rabbitmq config | 0 | Prisma, S3/R2/MinIO, worker HTTP/RabbitMQ | nao | Orfao/incompleto |
| `synced-lyrics-module` | module, 2 controllers, providers, presenter, DTOs, dispatcher, consumer, guard, rabbitmq config | 0 | Prisma, Redis cache, LRCLIB, RabbitMQ | sim | Parcial: bulk sem token forte |

### Modulos Esperados Ausentes

| Modulo esperado | Motivo | Impacto |
|---|---|---|
| `payment-module` | Core `payment` pronto; roadmap Bloco 1 | Gorjetas, confirmacao PIX, wallet e saque nao fecham pela API; `Audience.SendTipUseCase` depende de use case canonico de payment. |
| `auth-module` | Arquitetura define Keycloak/RBAC; roadmap Bloco 4 | Rotas de escrita e callbacks internos ficam sem autenticacao/autorizacao consistente. |
| `music-library-module` | Core `music-library` pronto; roadmap Bloco 3.3 | Rotas de `music-library` aparecem parcialmente em `synced-lyrics`; `ai-cifra-uploads.controller.ts` acessa `PrismaService` diretamente para catalogo. |

### Infra Compartilhada

| Infra | Estado | Observacao critica |
|---|---|---|
| `global-config.ts` | Conforme parcial | Aplica `ValidationPipe` 422, `WrapperDataInterceptor`, `ClassSerializerInterceptor` e filters. Ha duplicidade de tratamento de `EntityValidationError` entre filter especifico e global. |
| `database-module` | Parcial | Prisma e Redis sao necessarios; MongoDB e obrigatorio no boot, mas analytics Mongo ainda esta no backlog. |
| `rabbitmq-module` | Parcial | DLX/retry existe, mas `RabbitmqModule.forRoot()` fica dentro de modulos de feature quando transport e RabbitMQ. Isso cria risco de dupla inicializacao se `ai-cifra` e `synced-lyrics` usarem RabbitMQ juntos. |
| `config-module` | Parcial | Keycloak/JWT/PIX/RabbitMQ estao no schema; `AI_AUDIO_*` existe no type, mas nao entra no Joi runtime; `SYNCED_LYRICS_BULK_TOKEN` e declarado e nao aplicado em controller/guard. |
| `shared-module` | Conforme parcial | Como biblioteca transversal funciona. `supertest-extend.ts` ainda parece legado FC3 (`admin-catalog`) e nao representa auth real do SoundMeet. |

### Cobertura de Testes por Modulo

| Modulo | `*.spec.ts` | `*.int-spec.ts` | Leitura |
|---|---:|---:|---|
| `shared-module` | sim | nao | Boa cobertura de presenters/filters/interceptor. |
| `config-module` | sim | nao | Basico. |
| `database-module` | sim | nao | Basico. |
| `musicians-module` | sim | sim | Melhor referencia Nest atual. |
| `establishments-module` | nao | sim | Falta unit spec. |
| `audiences-module` | sim | sim | Desatualizados: instanciam facades com assinatura antiga. |
| `requests-module` | sim | sim | Bom inicio, mas nao cobre `VoteRequest` inexistente na API. |
| `events-module` | nao | nao | Lacuna relevante. |
| `scheduling-module` | nao | nao | Lacuna relevante. |
| `gamification-module` | nao | nao | Lacuna relevante. |
| `ai-cifra-module` | nao | nao | Lacuna critica para modulo operacional caro. |
| `ai-audio-module` | nao | nao | Lacuna critica e modulo nem registrado. |
| `synced-lyrics-module` | nao | nao | Lacuna critica em bulk/LRCLIB/cache. |

### Lacunas Ja Apontadas no Roadmap/Core

- `payment-module` ausente bloqueia fluxo publico -> musico de gorjetas.
- `auth-module` ausente deixa endpoints internos de IA/bulk e rotas de escrita sem protecao adequada.
- `ai-audio-module` existe, mas nao esta registrado em `app.module.ts`.
- `music-library-module` dedicado nao existe.
- RabbitMQ payment -> gamification -> ranking ainda nao tem wiring.
- Core corrigido define `UserScore` como ledger e `UserPoints` como projecao; Nest ainda tem handler que muta `Audience`.
- Core corrigido transformou facades de `Audience` para delegar a bounded contexts canonicos; Nest ainda injeta dependencias antigas.

## Fase 2 - Auditoria por Modulo

### `config-module` - Parcial

Checklist:

- Estrutura: conforme para modulo global.
- Joi/env: parcial.
- Alinhamento docs: parcial.
- Testes: parcial.

Diagnostico: o modulo valida a maior parte da configuracao, inclusive Keycloak, JWT, RabbitMQ, Redis, S3 e PIX. O problema e que a composicao real nao acompanha a config: ha variaveis obrigatorias de auth sem `auth-module`, variaveis de payment sem `payment-module`, e `AI_AUDIO_*` tipadas em `config.schema.ts` sem validacao Joi em `config-module.module.ts`.

Classificacao: P1 para `AI_AUDIO_*` e P2 para configs obrigatorias de subsistemas ainda desligados.

### `database-module` - Parcial

Checklist:

- Prisma: conforme.
- Redis cache: conforme parcial.
- MongoDB: parcial.
- Testes: basico.

Diagnostico: `DatabaseModule` centraliza Prisma, Redis e MongoDB. Prisma e Redis sao coerentes com os modulos atuais. MongoDB aparece como obrigatorio mesmo sem uso claro nos `nest-modules`; isso aumenta atrito operacional e pode derrubar boot de ambientes que nao precisam de analytics ainda.

Classificacao: P2.

### `shared-module` / `global-config.ts` - Conforme Parcial

Checklist:

- ValidationPipe global 422: conforme.
- Filters/interceptors: conforme parcial.
- Presenters compartilhados: conforme.
- Testing helpers: parcial.

Diagnostico: a base HTTP esta alinhada ao FC3 e ao SoundMeet: validacao 422, serializacao, wrapper e filters. O desvio menor e a duplicidade de tratamento de `EntityValidationError` no filter especifico e no `GlobalExceptionFilter`. O helper `supertest-extend.ts` ainda carrega semantica de admin FC3 e nao prova auth real.

Classificacao: P2.

### `rabbitmq-module` - Parcial

Checklist:

- DLX/retry: parcial.
- `forRoot`/`forFeature`: parcial.
- Consumers delegando para use cases: conforme nos modulos que usam.
- Testes de integracao: ausentes.

Diagnostico: o modulo fornece retry por `direct.delayed`, DLX generica e `RabbitmqConsumeErrorFilter`. Isso e util, mas o bootstrap esta fragmentado: `ai-cifra-module` e `synced-lyrics-module` chamam `RabbitmqModule.forRoot()` condicionalmente; o padrao FC3 e registrar infra uma vez no bootstrap e features usarem `forFeature()`. O `forFeature()` existe e expoe `IMessageBroker`, mas nao foi encontrado uso na camada Nest.

Trade-off: manter `forRoot` em features simplifica ligar/desligar subsistemas por env, mas paga com risco de dupla conexao, handlers duplicados e configuracao global menos previsivel.

Classificacao: P1.

### `musicians-module` - Parcial Baixo Risco

Checklist:

- Controllers finos: conforme.
- Providers/tokens: conforme.
- Presenters: conforme.
- DTOs: parcial.
- Auth/guards: ausente.
- Testes: bom baseline.

Diagnostico: e a melhor referencia interna de modulo Nest CRUD. Controllers delegam a use cases, presenters encapsulam resposta, providers seguem `REPOSITORIES`/`USE_CASES`. Os desvios sao sistemicos: DTOs herdam inputs do core e nao declaram `@ApiProperty` em todos os campos, search DTOs usam `implements` em alguns casos, e nao ha guards.

Classificacao: P2 local; P1 transversal para auth.

### `establishments-module` - Parcial

Checklist:

- Controller principal: conforme.
- Providers: parcial.
- Analytics handlers/job: parcial.
- Presenters: conforme.
- DTOs: parcial.
- Testes: parcial.

Diagnostico: o CRUD principal esta alinhado ao padrao. O problema concreto e `establishment-analytics-events.handlers.ts` importar `establishment-analytics.entity`, enquanto a correcao do core renomeou/definiu analytics como read model (`establishment-analytics.read-model.ts`). Esse e um ponto de drift direto entre Nest e core corrigido.

Classificacao: P0 se a compilacao estiver quebrada no estado atual; P1 se existir compatibilidade residual nao observada.

### `audiences-module` - Nao Conforme

Checklist:

- Controller fino: conforme.
- Presenter: conforme.
- DTOs: parcial.
- Providers: nao conforme.
- Alinhamento core corrigido: nao conforme.
- Auth/guards: ausente.
- Testes: desatualizados.

Diagnostico: o core corrigiu facades de `Audience` para delegar a bounded contexts canonicos. A camada Nest ainda instancia esses use cases como antes, apenas com `IAudienceRepository`.

Desalinhamento confirmado:

| Use case | Core exige hoje | Nest injeta hoje |
|---|---|---|
| `MakeMusicRequestUseCase` | `IAudienceRepository`, `CreateRequestUseCase`, `AddPointsUseCase` | apenas `IAudienceRepository` |
| `SendTipUseCase` | `IAudienceRepository`, payment `SendTipUseCase` | apenas `IAudienceRepository` |
| `VoteSongUseCase` | `IAudienceRepository`, `VoteRequestUseCase` | apenas `IAudienceRepository` |
| `AttendEventUseCase` | `IAudienceRepository`, `AddEventAttendeeUseCase` | apenas `IAudienceRepository` |
| `ScanQRUseCase` | `IAudienceRepository`, `IUserInteractionRepository`, `IMusicianRepository` | correto |

Impacto: rotas que chamam essas facades tendem a falhar em runtime ou operar com dependencias `undefined`, e os testes atuais nao protegem isso porque tambem foram escritos com a assinatura antiga.

Outros pontos:

- `make-music-request` permite `event_id` opcional no DTO/input, mas o use case agora exige `event_id` para criar pedido canonico.
- `scan-qr.dto` ainda deveria reforcar `@IsUUID` em `musician_id`, alem da validacao de core.
- `share-social-media` e `indicate-musician` ainda parecem manter mutacoes locais de pontos/badges em `Audience`; isso deve ser tratado como decisao pendente de fronteira com `gamification`.

Classificacao: P0.

### `requests-module` - Parcial

Checklist:

- Controller fino: conforme.
- Providers: parcial.
- Presenter: conforme.
- DTOs: parcial.
- Handlers: parcial.
- Testes: bom baseline.

Diagnostico: o modulo cobre CRUD/resposta/played/listagens e usa `DomainEventMediator`. Porem o core corrigido completou `RequestVote` como aggregate persistido, e a camada Nest nao registra `VoteRequestUseCase` nem `RequestVotePrismaRepository`. Tambem nao ha endpoint de voto canonico.

Risco adicional: `RequestEventsHandlers` ainda escuta `RequestCreatedEvent` e `RequestPlayedEvent` para mutar `Audience` diretamente (`makeMusicRequest`, `addPointsForAction`, badges). Isso reintroduz fluxo paralelo de gamificacao depois da decisao de `UserScore` como ledger e `UserPoints` como projecao.

Ha tambem risco de roteamento: `@Get(":id")` aparece antes de `@Get("musicians/:musician_id/suggestions")` e `@Get("musicians/:musician_id")`. Em Nest/Express, rotas parametrizadas podem capturar segmentos estaticos se registradas antes; vale teste real, mas o layout atual e fragil.

Classificacao: P1.

### `events-module` - Nao Conforme

Checklist:

- Controller fino: conforme.
- DTOs: parcial.
- Providers: nao conforme.
- Repositories dedicados de attendee/performer: nao wired.
- Testes: ausentes.

Diagnostico: a correcao do core removeu caminho comportamental pelo `IEventRepository` e consolidou attendees/performers em repositories dedicados. A camada Nest continua instanciando `AddEventAttendeeUseCase`, `RemoveEventAttendeeUseCase`, `AddEventPerformerUseCase` e `RemoveEventPerformerUseCase` com apenas `IEventRepository`.

Core exige:

- `AddEventAttendeeUseCase(IEventRepository, IEventAttendeeRepository)`
- `AddEventPerformerUseCase(IEventRepository, IEventMusicianRepository)`

Nest atual:

- registra apenas `EventPrismaRepository`
- nao registra `EventAttendeePrismaRepository`
- nao registra `EventMusicianPrismaRepository`

Impacto: endpoints de attendee/performer e facade `AttendEventUseCase` ficam desconectados do core corrigido.

Classificacao: P0.

### `scheduling-module` - Parcial

Checklist:

- Controllers finos: conforme.
- Providers: conforme.
- Presenters: parcial.
- Handlers/job: conforme parcial.
- Testes: ausentes.

Diagnostico: o modulo esta razoavelmente alinhado com o core corrigido: `ProposeBookingUseCase` e `ConfirmBookingUseCase` recebem os repositorios necessarios para disponibilidade e contagem diaria. O gap principal e cobertura HTTP inexistente. `calendar.controller.ts` retorna output cru em alguns fluxos em vez de presenter consistente, e alguns controllers usam `as any`.

Classificacao: P2 local; P1 por falta de testes em modulo de agenda.

### `gamification-module` - Parcial

Checklist:

- Controller fino: conforme.
- Providers: parcial.
- Ledger/projecao: parcial na camada Nest.
- Handlers: ausentes.
- Testes: ausentes.

Diagnostico: a API exposta e quase toda de leitura (`GetUserPoints`, leaderboard, badges, rankings). Nao ha `AddPointsUseCase`, `CalculatePointsUseCase`, `UserScorePrismaRepository` ou handler de eventos de pagamento expostos pela camada Nest. Isso impede `audiences-module` de compor corretamente `MakeMusicRequestUseCase` com ledger canonico e deixa o futuro fluxo payment -> gamification sem superficie de composicao.

Classificacao: P1.

### `ai-cifra-module` - Parcial Alto Risco

Checklist:

- Job/fila/worker: parcial.
- Controllers: parcial.
- DTOs/Swagger: parcial.
- Providers: bom, com excecoes.
- Consumers/dispatchers: parcial.
- Seguranca: nao conforme.
- Testes: ausentes.

Diagnostico: o modulo e funcionalmente rico e segue a ideia do `chord-sheet.md`: upload, analise, dispatcher, consumers, storage e worker. O risco esta na borda:

- endpoints internos `progress/complete/fail` usam `AI_CIFRA_PROGRESS_TOKEN` de forma fail-open: se a env nao esta definida, nao bloqueiam;
- rotas caras de upload/preload/provider nao tem auth nem rate limit;
- `ai-cifra-uploads.controller.ts` injeta `PrismaService` e manipula `musicLibrary` diretamente, contornando `music-library` core/Nest;
- nao ha testes Nest para contratos HTTP, 422, token 403, enqueue ou preload;
- `RabbitmqModule.forRoot()` fica dentro do modulo quando transport e RabbitMQ.

Trade-off: a logica de preload no controller acelera entrega de IA musical, mas e o tipo de atalho que vira acoplamento caro: catalogo musical, provider externo, storage e job orchestration ficam misturados na borda HTTP.

Classificacao: P0 para protecao de endpoints internos e abuso de endpoints caros; P1 para Prisma direto/controller gordo.

### `ai-audio-module` - Orfao / Nao Pronto

Checklist:

- Module existe: sim.
- Registrado no `app.module.ts`: nao.
- RabbitMQ: incompleto.
- Controllers/providers: presentes.
- Testes: ausentes.

Diagnostico: o modulo existe, mas nao e importado por `AppModule`. Se `AI_AUDIO_PROCESSING_TRANSPORT=rabbitmq`, o modulo registra apenas `AiAudioSeparationRequestedConsumer`, nao importa `RabbitmqModule.forRoot()` e nao registra consumers de completed/failed apesar de eles existirem no arquivo de consumers. Isso torna o modo RabbitMQ half-wired.

Classificacao: P0/P1 conforme decisao de produto: se ai-audio deveria estar ativo agora, P0; se e feature desligada intencionalmente, falta documentar explicitamente e ajustar config/testes.

### `synced-lyrics-module` - Parcial

Checklist:

- Leitura/ingest/chord-sheet: bom.
- LRCLIB/cache: bom parcial.
- Bulk: parcial.
- Rate limit: parcial.
- Token interno: nao conforme.
- Testes: ausentes.

Diagnostico: o modulo implementa boa parte do plano de `chord-sheet.md`: busca LRCLIB, LRC por `music-library`, download, materializacao de chord sheet e bulk. O rate limit por Redis e positivo, mas falha aberto se o cache falhar e usa chave por IP/rota, nao por `musician_id` ou caller. `SYNCED_LYRICS_BULK_TOKEN` esta no schema, mas nao e aplicado em `bulk-sync`, `bulk-jobs` ou materializacao.

Classificacao: P1/P0 para bulk e materializacao sem protecao quando exposto.

## Achados Criticos (P0)

### P0-1 - `audiences.providers.ts` Esta Desalinhado com as Facades Corrigidas do Core

`MakeMusicRequestUseCase`, `SendTipUseCase`, `VoteSongUseCase` e `AttendEventUseCase` agora dependem de use cases canonicos de `request`, `payment`, `gamification` e `events`. A camada Nest ainda injeta apenas `AudienceRepository`.

Impacto: rotas de pedido, gorjeta, voto e presenca via Audience podem falhar em runtime e nao representam as fronteiras corrigidas do core.

Recomendacao: corrigir composicao por modulos canonicos e exportar os use cases necessarios; nao remendar com logica local em controller.

### P0-2 - `events.providers.ts` Nao Registra Repositories Dedicados de Attendee/Performer

Use cases de attendee/performer exigem `IEventAttendeeRepository` e `IEventMusicianRepository`; Nest registra apenas `IEventRepository`.

Impacto: endpoints de participantes/performers e `AttendEventUseCase` ficam quebrados ou incompletos.

Recomendacao: registrar `EventAttendeePrismaRepository` e `EventMusicianPrismaRepository`, ajustar factories e adicionar testes.

### P0-3 - `payment-module` Ausente Bloqueia Fluxo Financeiro Canonico

O core de payment esta pronto e o roadmap define endpoints de tip, confirmacao, wallet e withdraw. A camada Nest nao tem `payment-module`, mas `audiences-module` expoe gorjeta via facade que agora depende do use case canonico de payment.

Impacto: produto nao fecha gorjeta publica -> musico, e o Swagger ainda anuncia `Payments`.

Recomendacao: criar `payment-module` antes de prometer fluxo de gorjeta em rotas de Audience; compor `PrismaUnitOfWork` no fluxo de confirmacao de pagamento.

### P0-4 - Auth/Keycloak Inexistente na Camada Nest

Arquitetura define Keycloak/RBAC, config exige Keycloak/JWT, Swagger anuncia bearer auth, mas nao existe `auth-module` e nao ha guards nos controllers de escrita. Os unicos `@UseGuards` encontrados sao rate limit de `synced-lyrics`.

Impacto: escrita em entidades, upload/preload de IA, bulk e operacoes sensiveis ficam publicas se expostas.

Recomendacao: implementar `auth-module` com guards por role (`audience`, `musician`, `establishment`, `admin`) e aplicar pelo menos em rotas de escrita/operacionais.

### P0-5 - Endpoints Internos de IA Falham Abertos

`ai-cifra` e `ai-audio` so bloqueiam callbacks internos quando o token esperado esta definido. Em ambiente sem env, qualquer cliente pode chamar progress/complete/fail.

Impacto: jobs podem ser marcados como completos/falhos por caller externo; resultados de IA podem ser corrompidos.

Recomendacao: fail-closed em producao, token obrigatorio via Joi e guard compartilhado para callbacks de worker.

### P0-6 - Bulk/Materializacao de Lyrics/Chord Sheet Sem Token Aplicado

`SYNCED_LYRICS_BULK_TOKEN` existe no schema, mas nao foi encontrado uso em controllers/guards. `bulk-sync`, consulta de jobs e materializacao ficam protegidos apenas por rate limit.

Impacto: abuso de LRCLIB/cache/DB e carga operacional indevida.

Recomendacao: aplicar token interno/role admin/musician, com rate limit como camada complementar.

### P0-7 - `establishment-analytics-events.handlers.ts` Importa Arquivo Antigo

O handler importa `establishment-analytics.entity`, mas a correcao do core definiu analytics como read model. Isso indica drift entre Nest e core corrigido.

Impacto: potencial erro de compilacao ou uso de contrato antigo.

Recomendacao: ajustar import e testes do handler/job apos aprovacao de correcoes.

## Achados Medios/Baixos (P1/P2)

### P1 - `VoteRequestUseCase` Nao Esta Exposto

`VoteRequestUseCase` e `RequestVoteRepository` existem no core corrigido, mas nao aparecem em `requests-module` nem em `audiences-module`.

Impacto: voto canonico fica inacessivel pela API, e `Audience.vote-song` nao consegue delegar corretamente.

### P1 - `RequestEventsHandlers` Reintroduz Pontuacao Fora do Ledger

O handler escuta eventos de request e atualiza `Audience` diretamente com pontos/badges. Isso contraria a decisao corrigida: `UserScore` e ledger, `UserPoints` e projecao, `Audience` e leitura/experiencia.

Impacto: pontuacao, badges e ranking podem divergir entre `Audience` e `Gamification`.

### P1 - `gamification-module` So Expoe Leitura

Sem `AddPointsUseCase`, `CalculatePointsUseCase`, `UserScorePrismaRepository` e handlers de eventos, o modulo nao consegue ser a composicao canonica para pontos.

Impacto: outros modulos continuam tentados a mutar pontuacao localmente.

### P1 - `ai-audio-module` Orfao

O modulo nao esta em `app.module.ts`. Se for feature ativa, isso e bloqueador; se for intencionalmente desligado, falta documentacao no codigo e alinhamento de config.

### P1 - RabbitMQ Bootstrap Fragmentado

`RabbitmqModule.forRoot()` dentro de `ai-cifra-module` e `synced-lyrics-module` diverge do FC3 e pode duplicar conexoes/handlers.

### P1 - Controller Gordo com Prisma em `ai-cifra-uploads.controller.ts`

O controller manipula `musicLibrary` via `PrismaService`, incluindo `findFirst`, `create` e `updateMany`. Isso vaza infra e regra de catalogo para HTTP.

### P1 - Handler `@OnEvent` Sem Politica de Falha Uniforme

Handlers in-process logam e engolem erros; RabbitMQ consumers usam retry/DLX. Side effects de analytics/gamificacao podem falhar silenciosamente.

### P1 - Testes Nest Insuficientes nos Modulos de Maior Risco

Sem specs/int-spec em `events`, `scheduling`, `gamification`, `ai-cifra`, `ai-audio` e `synced-lyrics`.

### P1 - Rotas Fragilizadas em `requests.controller.ts`

`@Get(":id")` aparece antes de rotas `musicians/...`. Deve ser testado e provavelmente reordenado para evitar captura indevida.

### P2 - DTOs e Swagger Nao Cumprem Totalmente a Regra Interna

Muitos DTOs herdam inputs do core com `class-validator`, mas nao declaram `@ApiProperty` em todos os campos. Search DTOs usam `implements` em alguns modulos, o que nao adiciona decorators em runtime.

### P2 - Uso de `as any` em Controllers

Uso em controllers de `audiences`, `bands`, `events`, `inquiries` e outros esconde incompatibilidades de contrato.

### P2 - Rate Limit de Synced Lyrics Falha Aberto

Se Redis/cache falha, o guard permite a chamada. Isso pode ser aceitavel para leitura publica, mas nao para bulk/materializacao.

### P2 - Storage S3/R2/MinIO Duplicado Entre IA Cifra e IA Audio

Factories de storage sao parecidas nos dois modulos. O isolamento por bounded context e defensavel, mas o custo de manutencao cresce.

### P2 - Duplicidade de Filter para `EntityValidationError`

O filter especifico e o global tratam o mesmo erro. A ordem do Nest tende a favorecer o especifico, mas o contrato pode divergir.

## Desvios vs FC3

### Desvios Que Nao Sao Problema

- Prisma no lugar de Sequelize: alinhado a `architecture.md`.
- Swagger e prefixo global `api/v1`: padrao SoundMeet.
- Multiplos controllers por modulo (`bands`, `bookings/inquiries/calendar`): coerente com dominios do produto.
- Consumers/dispatchers/rabbitmq config nos modulos de IA: extensao legitima ao padrao FC3.
- `GlobalExceptionFilter`: extensao util para erros de dominio/HTTP alem dos filters FC3.

### Desvios Que Viram Achado

- Ausencia de `auth-module` e guards, enquanto FC3 tem `auth-module`, `AuthGuard` e `CheckIsAdminGuard`.
- `RabbitmqModule.forRoot()` em feature modules, enquanto o padrao FC3 favorece bootstrap unico e `forFeature()` para uso por features.
- Cobertura de controller spec/int-spec muito inferior a categories/genres/cast-members do FC3.
- Handlers `@OnEvent` sem retry/DLX/outbox equivalente aos consumers RabbitMQ.
- DTOs nao cumprem a regra interna de `@ApiProperty`, mesmo que estejam proximos ao estilo FC3 de herdar input do core.

## Desvios vs Docs/Roadmap

- `payment-module` ausente apesar do Bloco 1 do roadmap.
- QR seguro foi corrigido no core, mas DTOs/rotas ainda nao reforcam totalmente UUID/ownership/auth.
- `auth-module` ausente apesar do Bloco 4 e da arquitetura Keycloak/RBAC.
- `ai-audio-module` existe e nao esta registrado, conforme gap do Bloco 3.1.
- `music-library-module` ausente; funcionalidades aparecem parcialmente em `synced-lyrics` e via Prisma direto em `ai-cifra`.
- Bulk LRC e endpoints internos de IA nao tem protecao consistente conforme `chord-sheet.md`.
- RabbitMQ payment -> gamification -> ranking nao existe na composicao Nest.

## Desvios vs Core Corrigido

- Facades de `Audience` exigem use cases canonicos, mas providers Nest ainda usam assinatura antiga.
- `EventAttendee` e `EventMusician` viraram caminho canonico, mas `events-module` nao registra seus repositories.
- `RequestVote` foi escolhido como aggregate persistido, mas API nao o expoe.
- `UserScore` como ledger nao esta refletido no `gamification-module` nem nos handlers de request.
- `payment` com UoW esta pronto no core, mas nao ha `payment-module` nem `PrismaUnitOfWork` na composicao Nest.
- `EstablishmentAnalytics` como read model nao esta refletido no handler Nest.
- `SyncedLyrics` como fonte de verdade de LRC esta parcialmente exposto, mas `MusicLibrary` segue sem modulo dedicado e com acesso direto por controller de IA.

## Inconsistencias Entre `nest-modules`

- Alguns modulos tem spec/int-spec (`musicians`, `requests`, `audiences`), enquanto os mais operacionais (`events`, `scheduling`, `gamification`, IA) nao tem.
- Alguns controllers retornam presenters consistentemente; `calendar` e partes de IA retornam outputs/void de forma menos padronizada.
- Auth inexistente e compensada pontualmente por token opcional/rate-limit, sem politica unica.
- RabbitMQ e usado por IA e synced lyrics; payment/gamification/requests tem filas em config, mas nao consumidores.
- DTOs variam entre `extends`, `implements`, `OmitType`, `PartialType` e campos manuais com cobertura Swagger desigual.
- Handlers de eventos in-process e consumers RabbitMQ tem estrategias diferentes de erro, retry e observabilidade.

## Analise Critica de Libs, Integracoes e Patterns

### NestJS DI por Providers

O padrao de providers declarativos e bom e copia o FC3. O problema nao e a tecnica, e sim a falta de composicao cross-module apos o core evoluir. Quando use cases passam a depender de portas canonicas, os modulos Nest precisam importar/exportar use cases ou usar um modulo de composicao explicito. Instanciar com menos dependencias e pior que falhar cedo: cria erro tardio e testes enganosos.

Recomendacao: corrigir DI por fronteira de bounded context, nao por atalhos locais.

### Presenters

Presenters estao bem aplicados nos CRUDs. Em IA/synced lyrics, algumas responsabilidades de renderizacao e HTML ficam no controller. Isso e aceitavel para spike, mas nao para superficie publica com risco de XSS/review e teste.

Recomendacao: mover renderizacao/serializacao complexa para presenter ou service de apresentacao.

### DTO + ValidationPipe

Herdar inputs do core segue FC3 e evita duplicacao de validação. Porem a regra interna do SoundMeet exige `@ApiProperty` e Swagger consistente. Ha duas opcoes:

- Opcao A: manter DTOs finos herdando inputs e ajustar a regra para aceitar Swagger via presenters/responses.
- Opcao B: criar DTOs Nest completos com `@ApiProperty` + `class-validator`, duplicando parte dos inputs.

Recomendacao: para MVP, seguir Opcao A nos CRUDs e aplicar `@ApiProperty` em rotas novas/sensiveis; mas search DTOs devem evitar `implements` sem decorators.

### PrismaService e UoW

Prisma nos repositories esta correto. Prisma direto em controller (`ai-cifra-uploads`) e desvio real. Para pagamento, a ausencia de `PrismaUnitOfWork` na camada Nest impede garantir atomicidade real apesar da correcao do core.

Recomendacao: usar UoW explicitamente em `payment-module`; mover acesso `musicLibrary` para use cases/repositories.

### RabbitMQ / DLX / Retry

`@golevelup/nestjs-rabbitmq` e uma escolha razoavel para Nest e o projeto ja tem filtro de erro. O risco esta em operacao: dependencia de `x-delayed-message`, DLX generica, retry fixo e bootstrap fragmentado.

Recomendacao: centralizar root, testar filter em int-spec, declarar plugin requerido e padronizar backoff/observabilidade.

### Redis / Rate Limit

Redis via `CacheModule` e coerente. O guard custom de synced lyrics e pragmático, mas falha aberto e limita por IP/rota. Para bulk, IA e uploads caros, isso e fraco.

Recomendacao: combinar auth/role/token + quota por usuario/musician_id + IP; fail-open so para leitura publica de baixo custo.

### Keycloak/Auth

Keycloak faz sentido para multi-tenant/RBAC do produto, mas hoje e so configuracao. Manter Swagger bearer sem guards cria falsa seguranca.

Recomendacao: implementar modulo minimo antes de escalar qualquer rota de escrita, upload, bulk ou callback interno.

### LRCLIB e Compliance

LRCLIB como fonte best-effort esta alinhado ao `chord-sheet.md`. O modulo ja tem cache e score. Falta amarrar protecao de bulk e politica de direito/cache por tipo de fonte.

Recomendacao: tratar leitura publica e bulk/admin como superficies diferentes.

### EventEmitter vs Outbox/RabbitMQ

`@OnEvent` e simples e bom para efeitos leves. Para pontos, ranking, analytics financeiro ou pagamento -> gamificacao, falha silenciosa nao e aceitavel.

Recomendacao: eventos criticos devem ir para outbox/RabbitMQ ou ter retry/idempotencia explicitos. `@OnEvent` pode ficar para logs/projecoes nao criticas.

## Recomendacoes Priorizadas

### P0

1. Corrigir `events.providers.ts`: registrar `EventAttendeePrismaRepository` e `EventMusicianPrismaRepository`, ajustar factories de add/remove attendee/performer e adicionar teste.
2. Corrigir `audiences.providers.ts`: compor facades com `CreateRequestUseCase`, `AddPointsUseCase`, `SendTipUseCase` de payment, `VoteRequestUseCase` e `AddEventAttendeeUseCase`.
3. Criar `payment-module` com endpoints minimos do roadmap e composicao com `PrismaUnitOfWork` para confirmacao de tip.
4. Criar `auth-module` minimo Keycloak/JWT + guards por role; aplicar em escritas e operacoes internas.
5. Tornar tokens internos de IA fail-closed em producao e aplicar token/guard em synced lyrics bulk/materialize.
6. Corrigir import de `EstablishmentAnalytics` read model no handler de analytics.

### P1

1. Expor `VoteRequestUseCase` em `requests-module` e revisar rota canonica de voto.
2. Remover ou refatorar `RequestEventsHandlers` para nao mutar pontos/badges em `Audience`; usar ledger `UserScore`.
3. Estender `gamification-module` com `UserScoreRepository`, `AddPointsUseCase` e exports necessarios.
4. Decidir `AiAudioModule`: registrar no `AppModule` ou documentar/desligar explicitamente; corrigir RabbitMQ completed/failed.
5. Centralizar `RabbitmqModule.forRoot()` e usar `forFeature()` onde fizer sentido.
6. Criar `music-library-module` dedicado e remover Prisma direto de `ai-cifra-uploads.controller.ts`.
7. Adicionar specs/int-spec para `events`, `scheduling`, `gamification`, `ai-cifra`, `ai-audio`, `synced-lyrics`.
8. Reordenar rotas de `requests.controller.ts` para segmentos estaticos antes de `:id`.

### P2

1. Padronizar DTOs/search DTOs e decidir regra oficial para `@ApiProperty` vs inputs herdados do core.
2. Reduzir uso de `as any` nos controllers.
3. Resolver duplicidade de `EntityValidationError` entre filters.
4. Adaptar/remover helper legado `supertest-extend.ts`.
5. Documentar politica de falha para `@OnEvent` handlers.
6. Avaliar tornar MongoDB opcional ate analytics Mongo ser implementado.
7. Extrair guard compartilhado para callbacks internos de worker.

## Proximos Passos Sugeridos

Fora desta fase, a ordem tecnica mais segura e:

1. Corrigir P0 de wiring (`events` e `audiences`) antes de abrir novas features.
2. Implementar `payment-module` com UoW real.
3. Implementar `auth-module` e proteger rotas sensiveis.
4. Resolver `ai-audio` e RabbitMQ root.
5. Criar `music-library-module` e retirar catalogo do controller de IA.
6. Rodar auditoria especifica de `prisma/schema.prisma`, RabbitMQ/outbox e testes HTTP/e2e.

## Parecer Final: A Camada Nest Esta Pronta Para Evoluir?

Parcialmente, mas nao para os blocos sensiveis do roadmap.

Ela esta pronta para continuar evoluindo CRUDs simples seguindo `musicians-module` como referencia. Nao esta pronta para crescer em pagamento, gamificacao real, IA operacional ou endpoints internos sem antes corrigir composicao, auth e testes.

Minha recomendacao e direta: **nao iniciar novas features de produto em cima da camada Nest atual antes de resolver os P0**. O core foi corrigido; agora a camada Nest precisa ser trazida para a mesma verdade arquitetural. Caso contrario, o sistema vai parecer organizado no dominio e falhar justamente na borda que recebe trafego real.
