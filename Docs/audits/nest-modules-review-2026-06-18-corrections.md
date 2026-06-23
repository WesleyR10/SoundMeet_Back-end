# Correcoes da auditoria NestJS - 2026-06-18

## Escopo executado

Esta fase executou as correcoes P0, P1 e P2 da auditoria `nest-modules-review-2026-06-18.md`, com foco na camada `src/nest-modules/`.

Ficaram explicitamente fora de escopo, conforme pedido:

- auditoria dedicada de `prisma/schema.prisma`;
- auditoria dedicada de RabbitMQ/outbox;
- auditoria dedicada de testes HTTP/e2e.

## Decisoes arquiteturais

### Auth e RBAC

Escolha: criar `auth-module` com JWT local para dev/test, validacao Keycloak via JWKS/RS256/issuer para ambientes reais, decorators `@Public()`/`@Roles()`, `AuthGuard`, `RolesGuard` e `InternalTokenGuard`.

Por que encaixa no SoundMeet: permite proteger rotas sensiveis agora sem acoplar toda a API a uma biblioteca Keycloak antes da integracao operacional estar madura. O payload ja normaliza roles em formato compativel com Keycloak (`realm_access` e `resource_access`).

Trade-off aceito: a configuracao Keycloak foi versionada como realm export + script idempotente local. Validacoes de ownership continuam no backend/use cases; claims de contexto (`tenant_id`, `organization_id`, `establishment_ids`, `band_ids`) nao substituem regra de dominio.

### RabbitMQ

Escolha: bootstrap unico em `AppModule` com `RabbitmqModule.forRoot()` e `forFeature()` nos modulos consumidores/produtores.

Por que encaixa no SoundMeet: segue o padrao FC3 e evita multiplas conexoes/handlers duplicados por modulo.

Trade-off aceito: padronizacao profunda de outbox, observabilidade e plugin `x-delayed-message` ficou documentada, mas auditoria dedicada de mensageria permanece fora desta fase.

### Payment e UoW

Escolha: criar `payment-module` com controller/providers e compor confirmacao de tip com `PrismaUnitOfWork`.

Por que encaixa no SoundMeet: pagamento e carteira precisam de atomicidade real na borda Nest; a correcao evita fluxo financeiro paralelo no `audiences-module`.

Trade-off aceito: integracao real com PSP/webhook permanece substituivel por gateway configuravel. A superficie HTTP minima foi exposta sem prometer recursos nao implementados.

### DTOs e Swagger

Escolha: manter a Opcao A do relatorio: DTOs de CRUD podem herdar inputs do core, mas rotas novas/sensiveis recebem Swagger/decorators reais. Search DTOs nao devem ficar apenas como `implements` vazio.

Trade-off aceito: evita duplicar validacao core no Nest, mas exige revisao pontual quando a rota vira superficie publica/sensivel.

### EventEmitter vs outbox

Escolha: `@OnEvent` permanece aceitavel para efeitos leves/projecoes reprocessaveis. Fluxos criticos devem usar use cases canonicos e evoluir para RabbitMQ/outbox ou retry/idempotencia explicitos.

Referencia: `Docs/audits/nest-event-handlers-policy-2026-06-19.md`.

### Rate limit e tokens internos

Escolha: endpoints bulk/materialize/callbacks internos usam token compartilhado por guard reutilizavel e, quando aplicavel, roles + rate limit. Rate limit falha aberto apenas para leitura publica de baixo custo; escrita/bulk falha fechado.

## Correcoes por etapa

### Etapa 1 - Wiring critico

- `events-module`: registrados repositories Prisma de attendee/performer e factories de add/remove attendee/performer.
- `audiences-module`: facades recompostas para use cases canonicos de request, payment, vote, events e gamification.
- `establishments-module`: handler de analytics alinhado ao read model `EstablishmentAnalytics`.

### Etapa 2 - Payment module

- Criado `src/nest-modules/payment-module/`.
- Expostos endpoints minimos de tip, confirmacao, wallet e withdraw.
- Confirmacao de tip composta com `PrismaUnitOfWork`.
- `audiences-module` passou a delegar fluxo financeiro ao payment canonico.

### Etapa 3 - Auth transversal

- Criado `auth-module`.
- Aplicados guards/roles em rotas de escrita, upload, preload, bulk e operacoes sensiveis.
- Rotas publicas ficaram declaradas via `@Public()`.
- Swagger bearer passou a refletir protecao real.

### Etapa 4 - IA e bulk

- Callbacks internos de `ai-cifra` e `ai-audio` usam `InternalTokenGuard`.
- Tokens internos sao obrigatorios em producao via Joi/config.
- Bulk/materializacao de `synced-lyrics` exige token interno e roles.
- `SyncedLyricsRateLimitGuard` falha fechado em operacoes nao-GET.

### Etapa 5 - Gamificacao, voto e handlers

- `VoteRequestUseCase` exposto no `requests-module`.
- `requests.controller.ts` recebeu rota canonica de voto e ordem de rotas ajustada.
- `RequestEventsHandlers` deixou de mutar pontos/badges em `Audience` e passou a usar `AddPointsUseCase`.
- `gamification-module` exporta repositorios/use cases necessarios para ledger.

### Etapa 6 - RabbitMQ e ai-audio

- `AiAudioModule` registrado no `AppModule`.
- Consumers de IA ajustados com `forFeature()` e channel padronizado.
- `RabbitmqModule.forRoot()` centralizado no root.
- Teste de wiring cobre root unico e feature modules.

### Etapa 7 - Music Library

- Criado `music-library-module` com DTOs, presenter, providers, controller e `MusicLibraryCatalogService`.
- `ai-cifra-uploads.controller.ts` deixou de acessar `PrismaService` diretamente.
- `ai-cifra.providers.ts` passou a consultar MusicLibrary via use case.
- Path do catalogo ficou em `music-library/items` para evitar colisao com `synced-lyrics`.

### Etapa 8 - Padronizacao transversal P2

- `EntityValidationError` ficou com contrato unico no `GlobalExceptionFilter`.
- Removido helper legado `supertest-extend.ts` e import no setup de Jest.
- MongoDB tornou-se opcional ate analytics Mongo estar ativo.
- Reduzidos casts `as any` em controllers tocados/criticos.
- `SearchEventsDto` recebeu decorators reais de validacao/Swagger.
- Tags Swagger atualizadas para modulos novos/ativos.

### Etapa 9 - Testes Nest P1

Foram adicionados specs unitarios para lacunas apontadas no P1:

- `events-module/__tests__/events.controller.spec.ts`;
- `gamification-module/__tests__/gamification.controller.spec.ts`;
- `scheduling-module/__tests__/scheduling.controllers.spec.ts`;
- `ai-audio-module/__tests__/ai-audio.controller.spec.ts`;
- `ai-cifra-module/__tests__/ai-cifra.controller.spec.ts`;
- `synced-lyrics-module/__tests__/synced-lyrics.controllers.spec.ts`.

Os testes cobrem delegacao de controller para use cases canonicos, serializacao por presenters, transformacao de query/body e endpoints sensiveis internos/bulk em nivel unitario. Nao substituem uma auditoria HTTP/e2e dedicada.

### Correcoes complementares - Keycloak, confiabilidade e padronizacao

- `payment.providers.ts` passou a instanciar `ConfirmTipPaymentUseCase` real com `PrismaUnitOfWork`, sem wrapper/cast.
- `auth-module` ganhou `AuthJwtVerifier` com validacao Keycloak por JWKS/RS256/issuer e verificacao opcional de audience/`azp`.
- Criado realm export versionado em `infra/keycloak/realm-soundmeet.json`.
- Criado script idempotente `scripts/keycloak-sync.mjs` para aplicar realm, roles, clients, mappers e groups via Admin REST.
- Documentada arquitetura Keycloak em `Docs/auth/keycloak.md`.
- `RequestEventsHandlers` recebeu idempotencia por cache e retry curto via `RequestEventProcessingService`.
- DTOs/search DTOs antigos receberam decorators reais de validacao/Swagger.
- Renderizacao HTML de chord sheet saiu do controller para `SyncedLyricsPreviewPresenter`.
- Tratamento local de `EntityValidationError` em `ai-cifra-uploads.controller.ts` foi removido; HTTP fica centralizado no `GlobalExceptionFilter`.

## Checklist P0/P1/P2

### P0

- [x] Corrigir `events.providers.ts` com repositories attendee/performer e factories.
- [x] Corrigir `audiences.providers.ts` com facades canonicas.
- [x] Criar `payment-module` com UoW em confirmacao de tip.
- [x] Criar `auth-module` com validacao local/JWKS Keycloak e proteger rotas sensiveis.
- [x] Tornar tokens internos de IA/bulk fail-closed em producao.
- [x] Corrigir handler de analytics para read model correto.

### P1

- [x] Expor `VoteRequestUseCase` e rota canonica de voto.
- [x] Refatorar `RequestEventsHandlers` para ledger canonico.
- [x] Estender `gamification-module` com `AddPointsUseCase`/exports.
- [x] Registrar `AiAudioModule` e corrigir consumers RabbitMQ.
- [x] Centralizar RabbitMQ root e usar `forFeature()`.
- [x] Criar `music-library-module` e remover Prisma direto do controller de IA.
- [x] Adicionar specs para `events`, `scheduling`, `gamification`, `ai-cifra`, `ai-audio`, `synced-lyrics`.
- [x] Reordenar rotas de `requests.controller.ts`.

### P2

- [x] Padronizar DTO/search DTOs conforme Opcao A.
- [x] Reduzir `as any` em controllers tocados/criticos.
- [x] Resolver duplicidade de `EntityValidationError`.
- [x] Remover helper legado `supertest-extend.ts`.
- [x] Documentar politica de falha para `@OnEvent`.
- [x] Tornar MongoDB opcional ate analytics Mongo ser implementado.
- [x] Extrair guard compartilhado para callbacks internos de worker.
- [x] Versionar configuracao Keycloak com realm export + scripts idempotentes.

## Testes e verificacoes executadas

- Etapa 8: testes focados de config/database/shared/music-library passaram.
- Etapa 8: `npm run build` passou.
- Etapa 8: lint focado dos arquivos tocados passou.
- Etapa 9: novos specs passaram (`6` suites, `22` testes).
- Etapa 9: suite agregada da Fase 2 passou (`13` suites, `49` testes).
- Etapa 9: lint focado dos novos specs passou.
- Etapa 9: `npm run build` passou.
- Correcoes complementares: testes focados passaram (`9` suites, `38` testes).
- Correcoes complementares: lint focado dos arquivos alterados passou.
- Correcoes complementares: `npm run build` passou.

Observacao: `npm run lint` global ainda falha por arquivos formataveis acumulados no branch amplo. Nao foi aplicado autofix global para evitar churn fora do escopo imediato da etapa.

## Riscos remanescentes

- Fluxos criticos baseados em eventos ainda precisam de auditoria dedicada de RabbitMQ/outbox para garantia operacional completa; nesta fase foi adicionada idempotencia/retry no handler Nest de requests.
- Cobertura HTTP/e2e continua pendente por decisao de escopo.
- Schema Prisma e migracoes nao foram auditados nesta fase.
- Warnings de `aws-sdk` v2 aparecem nos testes agregados; nao quebram a suite, mas indicam divida futura de dependencia.

## Parecer final

A camada Nest ficou significativamente mais alinhada ao core corrigido: wiring cross-module, auth, payment, gamification, RabbitMQ, MusicLibrary e seguranca de IA/bulk agora possuem composicao explicita e testes unitarios basicos.

Ainda nao e uma camada pronta para escala operacional critica sem as auditorias dedicadas de schema, outbox/RabbitMQ e HTTP/e2e, mas esta pronta para evolucao controlada do MVP com riscos principais documentados.
