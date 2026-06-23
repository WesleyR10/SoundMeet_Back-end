# Auditoria Arquitetural — RabbitMQ, Eventos e Outbox SoundMeet
**Data:** 2026-06-20  
**Escopo:** Integração RabbitMQ · Consumers · Dispatchers · Retry/DLX · Idempotência · EventEmitter2 · Outbox  
**Baseline:** prisma-schema-review-2026-06-20 · nest-event-handlers-policy-2026-06-19  
**Parecer final:** ⚠️ **MVP restrito possível com dívida técnica aceita** — 1 P0 de consistência financeira, 1 P0 de ficção arquitetural, infraestrutura de RabbitMQ para AI jobs sólida.

---

## Contexto

O SoundMeet implementa uma arquitetura híbrida de eventos: `EventEmitter2` em memória para efeitos locais leves, e RabbitMQ com delayed exchange para jobs de IA (ai-cifra, ai-audio, synced-lyrics). Os domain events seguem o padrão `AggregateRoot.applyEvent()` → `DomainEventMediator.publish()` → `@OnEvent`. Integration events têm a infraestrutura declarada (`IIntegrationEvent`, `RabbitMQMessageBroker`) mas não são publicados no broker em nenhum fluxo atual.

O documento de política `nest-event-handlers-policy-2026-06-19.md` reconhece a trade-off e aceita `@OnEvent` com idempotência para request/gamification em MVP, deferindo outbox para fase futura. Esta auditoria valida se essa trade-off está sendo honrada na implementação e identifica onde ela não está.

---

## Topologia atual da mensageria

### Exchanges e queues declarados

| Exchange | Tipo | Propósito |
|---------|------|-----------|
| `direct.delayed` | `x-delayed-message` (plugin) | Único exchange de publicação — AI jobs + retries |
| `dlx.exchange` | `topic` | Dead Letter Exchange — recebe mensagens após 3 falhas |

| Queue | Routing Key | Channel | prefetch | Consumidor |
|-------|------------|---------|---------|-----------|
| `soundmeet.ai_cifra_analysis` | `ai-musician.cifra-analysis.requested` | `ai_cifra_analysis` | 1 | `AiCifraAnalysisRequestedConsumer` |
| `soundmeet.ai_cifra_analysis.completed` | `ai-musician.cifra-analysis.completed` | `ai_cifra_analysis` | 1 | `AiCifraAnalysisCompletedConsumer` |
| `soundmeet.ai_cifra_analysis.failed` | `ai-musician.cifra-analysis.failed` | `ai_cifra_analysis` | 1 | `AiCifraAnalysisFailedConsumer` |
| `soundmeet.ai_cifra_analysis.progress` | `ai-musician.cifra-analysis.progress` | `ai_cifra_analysis` | 1 | `AiCifraAnalysisProgressConsumer` |
| `soundmeet.ai_audio_separation` | `ai-musician.audio-upload.validated` | `ai_audio_separation` | 1 | `AiAudioSeparationRequestedConsumer` |
| `soundmeet.ai_audio_separation.completed` | `ai-musician.audio-upload.separated` | `ai_audio_separation` | 1 | `AiAudioSeparationCompletedConsumer` |
| `soundmeet.ai_audio_separation.failed` | `ai-musician.audio-upload.separation-failed` | `ai_audio_separation` | 1 | `AiAudioSeparationFailedConsumer` |
| `soundmeet.synced_lyrics_bulk` | `ai-musician.synced-lyrics-bulk.requested` | `synced_lyrics_bulk` | 5 | `SyncedLyricsBulkRequestedConsumer` |
| `dlx.queue` | `#` (catch-all) | `default` | 1 | **Nenhum** |

### Queues declaradas no `.env.example` sem implementação

As seguintes queues aparecem no `envs/.env.example` mas não existem consumers, dispatchers nem configuração de exchange/routing key no código:

- `soundmeet.requests` (RABBITMQ_QUEUE_REQUESTS)
- `soundmeet.notifications` (RABBITMQ_QUEUE_NOTIFICATIONS)
- `soundmeet.payments` (RABBITMQ_QUEUE_PAYMENTS)
- `soundmeet.gamification` (RABBITMQ_QUEUE_GAMIFICATION)

Estas são configurações mortas que criam a impressão de que payment e gamification fluem via broker.

---

## P0 — Bloqueadores de produção

### P0-1 · Ausência de outbox no fluxo financeiro payment → gamification

**Arquivo:** `src/core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case.ts`

O use case executa três operações dentro de uma `PrismaUnitOfWork` (Transaction, Tip, MusicianWallet), e depois emite `TipCompletedEvent` via `DomainEventMediator.publish()`. O `RequestEventsHandlers` (ou equivalente de payment) que ouve esse evento chama `AddPointsUseCase`, creditando pontos de gamificação ao público que enviou a gorjeta.

O problema: a emissão do evento ocorre **fora da transação de banco**. Se o processo cair após o commit financeiro (`$transaction`) e antes da chamada `domainEventMediator.publish()`, a gorjeta é debitada do público e creditada na carteira do músico, mas os pontos de gamificação nunca são registrados. Não há retry, recovery nem compensação possível — o `UserScore` e `UserPoints` ficam permanentemente desatualizados.

**Risco:** financeiro direto. O ledger de gamificação (`user_scores`) diverge do ledger financeiro (`tips`/`transactions`) silenciosamente. Sem outbox ou event store, não há como detectar nem corrigir a divergência após o fato.

**O que está protegido:** a trade-off de gorjetas foi aceita na política de handlers, mas a política pressupõe idempotência no handler de payment — e o handler de payment **não tem `processOnce()`**. O único handler com `processOnce()` é o de `RequestCreatedEvent`/`RequestPlayedEvent`, não os de `TipCompletedEvent`.

---

### P0-2 · Integration events declarados mas nunca publicados no broker

**Arquivos relevantes:** `src/core/shared/infra/message-broker/rabbitmq/rabbitmq-message-broker.ts`, `src/core/shared/infra/message-broker/events-message-broker-config.ts`, `src/core/shared/domain/events/domain-event-mediator.ts`

Existe uma cadeia completa de infraestrutura: `DomainEventMediator.publishIntegrationEvents()` itera os `getIntegrationEvent()` de cada domain event e emite via EventEmitter2 ou `IMessageBroker`. O `RabbitMQMessageBroker` implementa `publishEvent()` com `conn.publish(exchange, routing_key, event)`. Todos os 20+ domain events têm `getIntegrationEvent()` implementado com payload tipado e `event_name` definido.

O problema: nenhum use case chama `publishIntegrationEvents()`. O mapa `EVENTS_MESSAGE_BROKER_CONFIG` em `events-message-broker-config.ts` está **vazio** (sem entradas). O `RabbitMQMessageBroker` não está wired em nenhum provider de módulo de domínio. Ou seja: toda a infraestrutura de integration events é código morto.

**Consequência imediata:** não há separação real entre in-process e out-of-process. Quando um subsistema externo (ex: notificações push, analytics externo, webhook de estabelecimento) precisar consumir `event.created` ou `booking.confirmed`, não existe mecanismo publicado no broker para isso — apesar do contrato estar no código.

**Consequência futura:** quando o primeiro consumer externo for implementado (Bloco de notificações, integração webhook), a decisão de routing key e exchange terá que ser feita sob pressão, sem a estrutura `EVENTS_MESSAGE_BROKER_CONFIG` já validada.

---

## P1 — Riscos estruturais pré-MVP

### P1-1 · Dependência implícita do plugin `x-delayed-message` sem health check

**Arquivo:** `src/nest-modules/rabbitmq-module/rabbitmq.module.ts`

O exchange `direct.delayed` é declarado com `type: "x-delayed-message"` e `arguments: { "x-delayed-type": "direct" }`. Este tipo requer o plugin `rabbitmq_delayed_message_exchange`, que não é instalado por padrão no RabbitMQ nem disponível em todos os planos de provedores gerenciados (CloudAMQP Lemur, Azure Service Bus, Amazon MQ para RabbitMQ antes da versão 3.12).

Se o broker subir sem o plugin, a declaração do exchange falha silenciosamente ou cria um exchange de tipo desconhecido, dependendo da versão do cliente. O retry system inteiro deixa de funcionar: ao retentar, o consumer republica para `direct.delayed`, mas a mensagem é descartada porque o exchange não tem o comportamento de delay. O sistema passa nos health checks básicos (conexão estabelecida, queues declaradas) mas retries nunca ocorrem.

Não há nenhum log, health check ou startup assertion que valide a presença do plugin.

---

### P1-2 · Idempotência parcial — handlers financeiros sem `processOnce()`

**Arquivos:** `src/nest-modules/requests-module/request-events.handlers.ts`, `src/nest-modules/payment-module/` (handlers de gorjeta, se existirem)

O `RequestEventsHandlers` usa `eventProcessing.processOnce(chave, fn)` para garantir que pontos de request criado, aceito e executado não sejam duplicados em reprocessamentos. Esta é a única classe com essa proteção.

Os handlers de `EstablishmentAnalyticsEventsHandlers` em `src/nest-modules/establishments-module/establishment-analytics-events.handlers.ts` respondem a `BookingConfirmedEvent`, `BookingCancelledEvent` e `BookingCompletedEvent` sem qualquer proteção de idempotência. Um restart do processo durante emissão de eventos recria todos os eventos não-dispatched, e o analytics pode ser recalculado múltiplas vezes para o mesmo booking — embora seja um recálculo por upsert e não por incremento, o risco é baixo mas real.

O risco mais crítico é que **qualquer handler de payment** que venha a ser adicionado (tip → gamification) também não terá `processOnce()`, repetindo créditos de pontos em restart/replay.

---

### P1-3 · AI-Audio dispatcher sem `onModuleDestroy()`

**Arquivo:** `src/nest-modules/ai-audio-module/ai-audio.dispatcher.ts` (dispatcher de análise in-memory)

O `AiCifraAnalysisDispatcher` implementa `onModuleDestroy()` com lógica de graceful shutdown: drena a fila interna, cancela timers de backpressure e aguarda jobs em progresso. O dispatcher equivalente do `ai-audio-module` não implementa o hook.

Em shutdown graceful (`SIGTERM`), o AI-Audio dispatcher continua processando ou aborta jobs sem cleanup. Timers de verificação de GPU/load average (`gpuCheckIntervalMs: 2000`) ficam ativos após o módulo ser destruído, gerando exceções não capturadas e potencialmente impedindo o shutdown do processo.

---

### P1-4 · `enableConsumers` calculado com lógica frágil em `app.module.ts`

**Arquivo:** `src/app.module.ts`

O booleano `shouldRegisterRabbitmqHandlers` é calculado com OR entre três comparações de string de env vars. Se uma env var tiver espaço extra (`"rabbitmq "`) ou capitalização diferente (`"RabbitMQ"`), o resultado é falso e os consumers não são registrados. O `RabbitmqModule.forRoot({ enableConsumers: false })` inicializa a conexão mas pula o registro de handlers — mensagens publicadas pelos dispatchers acumulam nas queues indefinidamente sem consumidor ativo.

A inconsistência entre `RABBITMQ_REGISTER_HANDLERS` (env var separada mencionada na docs) e o cálculo automático em `app.module.ts` cria dois mecanismos de controle que podem conflitar.

---

### P1-5 · Retry delay fixo, não exponencial

**Arquivo:** `src/nest-modules/rabbitmq-module/rabbitmq-consume-error.filter.ts`

O `RabbitmqConsumeErrorFilter` usa `x-delay: 5000` fixo em todas as tentativas. Com 3 retries e 5 segundos de delay, mensagens falhas voltam ao consumer 5s, 10s e 15s após o erro original. Em um cenário de falha em cascata (banco sobrecarregado, serviço externo indisponível), todas as mensagens em retry chegam em bursts sincronizados após 5s, potencialmente agravando o problema que causou a falha original.

O padrão correto é backoff exponencial com jitter: `delay = min(base * 2^tentativa + rand(), cap)`. A infraestrutura de delayed exchange suporta qualquer valor de `x-delay` — é apenas a lógica do filtro que precisa ser alterada.

---

### P1-6 · `dlx.queue` sem consumer, alertas ou TTL

**Arquivo:** `src/nest-modules/rabbitmq-module/rabbitmq.module.ts`

Mensagens que excedem 3 tentativas ou são não-retriáveis (`NotFoundError`, `EntityValidationError`) são nacked e roteadas para `dlx.exchange` → `dlx.queue`. A fila é durável e retém as mensagens indefinidamente sem consumer.

Em produção, falhas de jobs de IA (arquivo corrompido, modelo indisponível), falhas de synced-lyrics e qualquer evento não-retriável acumulam em `dlx.queue` sem nenhum alerta, métrica ou painel. A única forma de descobrir é via RabbitMQ Management UI manualmente. Não há TTL de expiração, não há consumer de logging estruturado, não há integração com observabilidade.

---

### P1-7 · ai-audio-module não registrado em `app.module.ts`

**Arquivo:** `src/app.module.ts`

Confirmado na auditoria de schema (2026-06-20): o `AiAudioModule` existe em `src/nest-modules/ai-audio-module/` com consumers, dispatchers e configuração de RabbitMQ completos, mas não está na lista de imports do `AppModule`. Em produção, nenhum consumer de ai-audio é registrado e o dispatcher nunca é injetado. Jobs de separação de fontes não têm caminho de execução.

---

## P2 — Qualidade e escala

### P2-1 · `EVENTS_MESSAGE_BROKER_CONFIG` vazio — routing keys indefinidas

**Arquivo:** `src/core/shared/infra/message-broker/events-message-broker-config.ts`

O mapa de configuração que associa cada integration event a um exchange e routing key específicos está declarado mas sem entradas. O fallback atual usa `event.event_name` como routing key e `process.env.RABBITMQ_EXCHANGE` como exchange. O `soundmeet.exchange` mencionado no env não é declarado como exchange no `rabbitmq.module.ts` — os únicos exchanges criados são `direct.delayed` e `dlx.exchange`. A primeira publicação de integration event real falhará silenciosamente (golevelup/nestjs-rabbitmq pode criar o exchange automaticamente com tipo `direct` padrão, que não é o esperado) ou lançará erro de exchange não encontrado.

---

### P2-2 · Ausência de `messageId` em integration events gerais

**Arquivo:** `src/nest-modules/rabbitmq-module/rabbitmq-message-broker.ts`

Os dispatchers de AI modules definem `messageId: job_id` nas opções de publicação, permitindo deduplicação pelo broker ou pelo consumer. O `RabbitMQMessageBroker.publishEvent()` não inclui `messageId` nas opções de publicação. Qualquer consumer de integration event futuro não terá identificador único para idempotência baseada em ID de mensagem.

---

### P2-3 · Contratos de mensagem sem versionamento operacional

**Arquivos:** todos os arquivos `*.event.ts` em `src/core/*/domain/events/`

Todos os integration events têm `event_version = 1` hardcoded. Não há mecanismo de routing por versão (ex: `event.created.v1` vs `event.created.v2`), nem lógica de upgrade/downgrade no consumer. Uma mudança de payload (adição de campo obrigatório, renomeação) é um breaking change silencioso: o producer publica a nova versão, o consumer deserializa o payload sem erro (campos extras ignorados, campos removidos ficam `undefined`) e o comportamento diverge sem exceção.

---

### P2-4 · prefetchCount=5 para synced_lyrics_bulk sem timeout de job

**Arquivo:** `src/nest-modules/synced-lyrics-module/rabbitmq/synced-lyrics.rabbitmq.ts`

O channel `synced_lyrics_bulk` tem `prefetchCount: 5`, permitindo até 5 jobs simultâneos em um único consumidor. Jobs de sincronização bulk podem ser longos (fetching de letras, múltiplas APIs externas, processamento de texto). Se um job travar esperando resposta de API externa sem timeout configurado, ele segura um slot de prefetch indefinidamente. Com 5 slots travados, a queue para de avançar sem erro visível — parece que está processando mas nenhum job conclui.

---

### P2-5 · `@OnEvent` handlers sem timeout — risco de bloqueio do event loop

**Arquivo:** `src/nest-modules/establishments-module/establishment-analytics-events.handlers.ts`

Os handlers de analytics chamam `calculateDailyAnalyticsUseCase.execute()` síncronamente no callback do `@OnEvent`. O EventEmitter2 com `await emitAsync()` (usado no `DomainEventMediator`) aguarda o handler resolver antes de prosseguir. Um deadlock ou lentidão no banco durante um evento de booking pode bloquear o event emitter por tempo indefinido, atrasando todos os outros eventos na fila in-process.

---

### P2-6 · Nomenclatura inconsistente de routing keys

**Arquivos:** `src/nest-modules/ai-cifra-module/rabbitmq/ai-cifra.rabbitmq.ts`, `src/nest-modules/ai-audio-module/rabbitmq/ai-audio.rabbitmq.ts`

AI-Cifra usa o padrão `ai-musician.cifra-analysis.<estado>` com estados `requested`, `completed`, `failed`, `progress`. AI-Audio usa `ai-musician.audio-upload.<estado>` com estados `validated`, `separated`, `separation-failed`. O formato é inconsistente: `cifra-analysis` vs `audio-upload` (domínio vs artefato), `requested`/`completed` vs `validated`/`separated` (verbo vs participio). Sem AsyncAPI spec, é impossível auditar quem produz e quem consome cada routing key sem ler todos os arquivos.

---

### P2-7 · Ausência de correlationId/traceId nas mensagens

Nenhuma mensagem publicada no broker carrega um `correlationId` ou `traceId` de origem. Um job de AI-Cifra que falha após 3 retries chega na `dlx.queue` com `job_id` e `music_library_id`, mas sem o ID do request HTTP que o originou nem o ID do usuário que disparou. Correlação com logs de aplicação e APM é impossível sem instrumentação adicional.

---

### P2-8 · Transport configurável por env var sem validação de consistência

**Arquivo:** `src/app.module.ts`

Cada módulo lê sua própria env var de transport (`AI_CIFRA_PROCESSING_TRANSPORT`, `AI_AUDIO_PROCESSING_TRANSPORT`, `SYNCED_LYRICS_BULK_TRANSPORT`) e condiciona o registro de consumers e o dispatcher injetado. Não há validação cruzada: é possível ter `AI_CIFRA_PROCESSING_TRANSPORT=rabbitmq` com `RABBITMQ_URL` inválida — o módulo sobe, o dispatcher tenta publicar, a conexão falha em runtime sem erro de inicialização. A estratégia de seleção de transport deveria ser validada no startup com `ConfigService` e fail-fast.

---

## Análise dos fluxos críticos

### Fluxo 1 · payment → gamification → ranking

Estado atual: **in-process only, sem garantia de entrega**.

O `ConfirmTipPaymentUseCase` executa a transação financeira e emite `TipCompletedEvent` via `DomainEventMediator.publish()`. O handler correspondente (a ser implementado ou o `RequestEventsHandlers` se reutilizado) chama `AddPointsUseCase`. Os pontos são creditados no `UserScore` (ledger) e projetados para `UserPoints`.

Garantia: nenhuma. Se o processo cair entre commit financeiro e emissão, o ponto não é creditado. Se o handler for executado duas vezes (restart durante emissão), o ponto é duplicado — porque não há `processOnce()` no handler de gorjeta.

O fluxo de ranking não existe como RabbitMQ flow — `Ranking` é atualizado manualmente ou via use case dedicado. A queue `soundmeet.gamification` declarada no env não tem consumer.

**Status:** bloqueado por P0-1.

---

### Fluxo 2 · request events

Estado atual: **funcional com idempotência parcial**.

`RequestCreatedEvent` → `@OnEvent` → `AddPointsUseCase` com `processOnce()` usando chave `created:{request_id}:{audience_id}`. Cobertura: criação, aceitação e play. Rejeição: log apenas.

Risco: a chave de idempotência usa `aggregate_id` (request_id) e `audience_id`, mas não inclui `event_version` ou timestamp. Em um cenário de replay de eventos históricos (ex: migração, recálculo manual de pontos), as chaves antigas colidem com as novas e os pontos não são recreditados. Para uso MVP normal sem replay, é aceitável.

**Status:** funcional para MVP com trade-off aceita na política.

---

### Fluxo 3 · AI jobs (cifra e audio)

Estado atual: **funcional para ai-cifra, não funcional para ai-audio**.

AI-Cifra tem o ciclo completo: dispatcher → `direct.delayed` → consumers (requested/progress/completed/failed) → use cases → `@UseFilters(RabbitmqConsumeErrorFilter)` → retry até 3x → DLX. O transport padrão é `http` (in-process dispatcher), mudando para RabbitMQ via env var.

AI-Audio: mesma estrutura mas o módulo não está importado no `AppModule` (P1-7). Consumers declarados mas nunca registrados.

Risco adicional em produção: `x-delayed-message` plugin obrigatório (P1-1), sem health check.

**Status:** ai-cifra funcional para MVP com transport=http (default). ai-audio bloqueado por P1-7.

---

### Fluxo 4 · synced lyrics bulk

Estado atual: **funcional com transport=inline (default)**.

O dispatcher inline processa jobs em memória sequencialmente. Com transport=rabbitmq, publica na `soundmeet.synced_lyrics_bulk` e o consumer `SyncedLyricsBulkRequestedConsumer` processa com prefetch=5. O fluxo está implementado e funcional.

Risco: prefetch=5 sem timeout de job (P2-4). Com transport=inline (default), o risco é menor porque o dispatcher in-memory tem controle de backpressure.

**Status:** funcional para MVP com transport=inline.

---

## Separação @OnEvent vs RabbitMQ/Outbox — validação contra política

A política em `nest-event-handlers-policy-2026-06-19.md` define:

| Efeito | Canal prescrito | Estado atual | Conformidade |
|--------|----------------|--------------|-------------|
| Logs estruturados | `@OnEvent` | `BookingEventsHandlers` — logging puro | ✅ Conforme |
| Analytics/projeções recalculáveis | `@OnEvent` | `EstablishmentAnalyticsEventsHandlers` | ✅ Conforme |
| Pontos de gamificação por request | `@OnEvent` + `processOnce()` | `RequestEventsHandlers` | ✅ Conforme |
| Pontos de gamificação por gorjeta | `@OnEvent` + `processOnce()` (prescrito) | Handler ausente ou sem `processOnce()` | ❌ Não conforme |
| AI jobs | RabbitMQ | AI-Cifra com transport=http/rabbitmq | ✅ Conforme |
| Notificações push | RabbitMQ (prescrito) | Queue declarada, sem consumer | ❌ Não implementado |
| Integration events (webhooks, externo) | RabbitMQ + outbox (prescrito) | Infraestrutura declarada, não wired | ❌ Não conforme |

---

## Observabilidade e logs

### O que existe

O `RabbitmqConsumeErrorFilter` loga o erro com contexto (`queue`, `routingKey`, `retryCount`, `messageId`) usando o logger do NestJS antes de republish ou nack. Os consumers de AI modules têm logs de início e fim de processamento.

O `BookingEventsHandlers` produz logs estruturados JSON para todos os eventos de booking — é o único handler com observabilidade de events bem implementada.

### O que falta

Não há log estruturado para: mensagens que entram na `dlx.queue`, tempo de processamento por consumer, taxa de retries por queue, contagem de eventos emitidos vs handlers executados. Não há integração com métricas (Prometheus, Datadog) para as queues RabbitMQ. O Management plugin do RabbitMQ oferece métricas nativas, mas não há dashboard ou alerta configurado.

---

## Recomendações priorizadas

### Alta prioridade — antes de produção com dados financeiros reais

1. **Adicionar `processOnce()` no handler de `TipCompletedEvent`** — chave `tip:{tip_id}:{audience_id}`. Não resolve o outbox mas elimina a duplicação em restart. Custo: 1h.

2. **Registrar `AiAudioModule` no `AppModule`** — um import. Custo: 15min (P1-7).

3. **Implementar `onModuleDestroy()` no AI-Audio dispatcher** — copiar o padrão do AI-Cifra. Custo: 2h (P1-3).

4. **Validar presença do plugin `x-delayed-message` no startup** — um health check com `amqplib.connect()` + `assertExchange()` no `onApplicationBootstrap()` do `RabbitmqModule`. Fail-fast se o plugin não estiver disponível. Custo: 3h (P1-1).

5. **Adicionar consumer/logger para `dlx.queue`** — consumer que loga mensagem morta como `ERROR` com payload completo e `queue` de origem. Custo: 2h (P1-6).

### Média prioridade — antes de escala pública

6. **Implementar backoff exponencial com jitter no `RabbitmqConsumeErrorFilter`** — `delay = min(5000 * 2^retryCount + rand(0,1000), 60000)`. Custo: 1h (P1-5).

7. **Preencher `EVENTS_MESSAGE_BROKER_CONFIG`** com routing keys e exchanges corretos para cada integration event. Declarar `soundmeet.exchange` no `rabbitmq.module.ts` ou redirecionar para `direct.delayed`. Custo: 4h (P2-1).

8. **Adicionar `messageId` no `RabbitMQMessageBroker.publishEvent()`** — usar `randomUUID()` ou `event.occurred_on.toISOString()` + hash do payload. Custo: 1h (P2-2).

9. **Adicionar timeout de job no `SyncedLyricsBulkRequestedConsumer`** — `Promise.race([processJob(), sleep(timeoutMs).then(() => throw TimeoutError)])`. Custo: 2h (P2-4).

10. **Validar env vars de transport no startup** — `ConfigService` com Joi schema que valida que `RABBITMQ_URL` é válida quando qualquer transport for `rabbitmq`. Custo: 2h (P2-8).

### Baixa prioridade — hardening pós-launch

11. **Padronizar nomenclatura de routing keys** — adotar `{domínio}.{entidade}.{evento}` consistentemente: `ai.cifra.analysis.requested`, `ai.audio.separation.requested`. Custo: 1 sprint (impacto em worker Python e consumers).

12. **Implementar outbox pattern para fluxos financeiros** — tabela `domain_events` com `(aggregate_id, event_type, payload, dispatched_at)`, processo periódico que lê events não-dispatched e publica no broker. Custo: 1 sprint (P0-1 definitivo).

13. **Wire integration events ao broker** — implementar pelo menos `TipCompletedIntegrationEvent` e `BookingConfirmedIntegrationEvent` com routing keys definidas. Custo: 1 sprint (P0-2 parcial).

14. **Adicionar correlationId/traceId** — header `x-correlation-id` propagado desde o request HTTP original até a mensagem RabbitMQ e logs do consumer. Custo: 2 sprints (P2-7).

15. **AsyncAPI spec** — documentar todas as queues, exchanges, routing keys, schemas de payload e versões. Custo: 1 sprint.

---

## Parecer final

| Subsistema | Status MVP | Condição |
|-----------|-----------|---------|
| AI-Cifra (transport=http) | ✅ Pronto | Default atual; sem RabbitMQ |
| AI-Cifra (transport=rabbitmq) | ⚠️ Condicionado | Exige plugin validado (P1-1) |
| AI-Audio | ❌ Bloqueado | Módulo não importado (P1-7) |
| Synced-Lyrics (transport=inline) | ✅ Pronto | Default atual |
| Request → Gamification | ✅ Pronto | `processOnce()` implementado |
| Payment → Gamification | ⚠️ Risco aceito | Sem outbox; adicionar `processOnce()` em gorjeta |
| Integration Events / Webhooks | ❌ Não implementado | Infraestrutura morta (P0-2) |
| Analytics de estabelecimento | ✅ Pronto | Recalculável, risco baixo |

**Veredicto:** A mensageria **não está pronta para produção geral**. Está pronta para **MVP restrito** nos subsistemas de AI-Cifra (http), requests e analytics, com as ressalvas de P1-7 (ai-audio) e P0-1 (gorjeta sem `processOnce()`). Os dois P0 não bloqueiam MVP operacional — bloqueiam expansão para dados financeiros em escala sem risco de divergência de ledger.
