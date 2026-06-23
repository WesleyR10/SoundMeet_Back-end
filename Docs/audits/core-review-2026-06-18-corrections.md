# Correções da Auditoria Arquitetural do Core — 2026-06-18

## Escopo Executado

Correções aplicadas dentro de `soundmeet-backend/src/core/`, com ajustes de testes unitários relacionados e este relatório versionado em `Docs/audits/`.

Não foram executados os 5 próximos passos fora do core do relatório original:

1. Auditoria de `src/nest-modules/`.
2. Auditoria de `prisma/schema.prisma`.
3. Auditoria de RabbitMQ/outbox.
4. Auditoria de segurança de endpoints internos de IA.
5. Auditoria de testes HTTP/e2e.

Observação: a árvore de trabalho já continha mudanças fora do escopo. Esta fase não reverteu nem normalizou mudanças pré-existentes.

## Decisões Arquiteturais

- `ScanQRUseCase`: o QR canônico de pontuação é `soundmeet://musician/<uuid>`. O `musician_id` informado no body é aceito apenas como redundância e deve bater com o UUID extraído do QR.
- Pontuação: `UserScore` é o ledger/fonte de verdade; `UserPoints` é projeção; `Audience` é leitura/experiência e não deve disputar saldo canônico.
- Fluxos de `Audience`: `make-music-request`, `send-tip`, `attend-event` e `vote-song` foram transformados em facades para portas/use cases canônicos (`request`, `payment`, `events`, `request vote`) e deixaram de mutar pontos/badges diretamente em `Audience`.
- `ConfirmTipPaymentUseCase`: o fluxo financeiro multi-agregado passa a aceitar `IUnitOfWork`; repositories Prisma de payment usam o transaction client ativo quando compartilharem o mesmo UoW.
- `EstablishmentAnalytics`: definido como read model/projection explícito, não aggregate root. O arquivo passou de `.entity.ts` para `.read-model.ts` e ganhou repository in-memory.
- `RequestVote`: escolhido como aggregate persistido. `RequestVote` é a fonte individual de votos e `Request.votes_count` fica como projeção de upvotes atualizada pelo use case.
- `events`: attendees e performers passam a ter caminho canônico por aggregates dedicados (`EventAttendee`, `EventMusician`); `IEventRepository` ficou focado em persistência e consultas necessárias.
- `MusicLibrary` x `SyncedLyrics`: `SyncedLyrics` é fonte de verdade para LRC; `MusicLibrary` mantém projeção/cache de dados derivados. Para chord sheet, `ai-cifra` é a fonte de verdade e `MusicLibrary` materializa/cacheia.
- `ai-audio`: `AiAudioSeparationOutput` foi modelado como child entity explícita (`.child-entity.ts`), não aggregate root.

## Correções por Módulo

### `audience`

- Resolvido: `ScanQRUseCase` agora parseia `soundmeet://musician/<uuid>`, valida UUID, exige consistência com `musician_id` quando informado e checa existência/atividade do músico antes de pontuar.
- Resolvido: fluxos paralelos de pedido, gorjeta, presença e voto passaram a delegar para bounded contexts canônicos.
- Resolvido: specs ajustadas para a nova fronteira sem mutação local de pontos.

### `gamification`

- Resolvido: `AddPointsUseCase` e `CalculatePointsUseCase` registram `UserScore` antes de atualizar `UserPoints`.
- Resolvido: helper comum centraliza `PointsSource -> ScoreType`, pontos do ledger, referência e descrição.
- Resolvido: `ScoreTypeEnum.BONUS` incluído para suportar pontos variáveis sem fallback incorreto.

### `payment`

- Resolvido: `ConfirmTipPaymentUseCase` usa `IUnitOfWork` quando fornecido.
- Resolvido: `TipPrismaRepository`, `TransactionPrismaRepository` e `MusicianWalletPrismaRepository` usam o transaction client ativo do UoW.
- Parcial: paths planos de repositories/validators foram adicionados via re-export para compatibilidade com o padrão documentado sem mover fisicamente as pastas antigas.

### `establishment`

- Resolvido: `EstablishmentAnalytics` agora é `establishment-analytics.read-model.ts`.
- Resolvido: repository in-memory de analytics criado e exportado.
- Resolvido: imports, mapper, use cases e README interno atualizados.

### `request`

- Resolvido: `RequestVote` completado com repository, in-memory, Prisma mapper/repository e `VoteRequestUseCase`.
- Resolvido: mapper Prisma de `RequestVote` usa `LoadEntityError`.
- Resolvido: `Request.votes_count` formalizado como projeção de upvotes.

### `events`

- Resolvido: `AddEventAttendeeUseCase` e `RemoveEventAttendeeUseCase` usam sempre `IEventAttendeeRepository`.
- Resolvido: `AddEventPerformerUseCase` e `RemoveEventPerformerUseCase` usam `IEventMusicianRepository`.
- Resolvido: métodos comportamentais foram removidos do contrato `IEventRepository`; permanecem apenas consultas necessárias como `isAudienceAttendee` e `isMusicianPerformer`.

### `ai-cifra`

- Resolvido: barrels `index.ts` adicionados em domínio, aplicação, portas, use cases, infra/db e raiz.
- Resolvido: mappers Prisma deixam de fazer fallback silencioso de status/método inválido e passam a lançar `LoadEntityError`.
- Parcial: não foram criadas novas specs dedicadas para todos os mappers; a suíte completa do core passou após as mudanças.

### `music-library` e `synced-lyrics`

- Resolvido: constantes de política de fronteira adicionadas para formalizar fonte de verdade/projeção.
- Resolvido: `SyncedLyrics` declarado como fonte de verdade de LRC; `MusicLibrary` como projeção/cache.

### `scheduling`

- Resolvido: `max_shows_per_day` aplicado em `ProposeBookingUseCase` e `ConfirmBookingUseCase`.
- Resolvido: `IBookingRepository` ganhou contagem diária confirmada por músico/banda, com implementações in-memory e Prisma.
- Resolvido: mapper dedicado `availability-model-mapper.ts` criado e usado pelo repository Prisma.

### `ai-audio`

- Resolvido: `AiAudioSeparationOutput` renomeado/modelado como child entity explícita.
- Resolvido: imports, mapper, fake builder, specs e barrel atualizados.

## Status dos Itens do Relatório Original

| Item | Status |
|---|---|
| P0 — QR seguro | Resolvido |
| P0 — Atomicidade em confirmação de gorjeta | Resolvido no core, dependente de wiring com UoW na camada Nest |
| P0/P1 — Fonte de verdade de pontos | Resolvido no core |
| P0/P1 — Fluxos paralelos em Audience | Resolvido no core |
| P1 — EstablishmentAnalytics | Resolvido |
| P1 — RequestVote órfão | Resolvido |
| P1 — Gamification ledger/projeção | Resolvido |
| P1 — Events attendees/performers | Resolvido no core |
| P1 — ai-cifra barrels/mappers | Resolvido; testes dedicados adicionais ficam recomendados |
| P1 — MusicLibrary x SyncedLyrics | Resolvido por contrato de domínio |
| P1 — scheduling max_shows_per_day | Resolvido |
| P2 — payment paths | Parcial via re-export plano |
| P2 — cobertura Prisma/in-memory desigual | Parcial; suíte completa do core passou, mas não foram criadas specs novas para todos os repositories |
| P2 — barrels | Resolvido para `ai-cifra`; demais módulos principais já possuíam barrels |
| P2 — mappers/status | Resolvido nos mappers críticos de `ai-cifra` e `RequestVote` |
| P2 — ai-audio output ambíguo | Resolvido |
| P2 — scheduling Availability mapper/Inquiry | Mapper resolvido; cobertura adicional de Inquiry permanece recomendada |

## Validação

Comando executado:

```bash
npm test -- --runInBand "src/core"
```

Resultado: 159 test suites passed, 1231 tests passed.

## Riscos Remanescentes Dentro do Core

- O UoW de pagamento está pronto no core, mas a atomicidade real depende de a camada de composição instanciar repositories Prisma com o mesmo `PrismaUnitOfWork`.
- As facades de `Audience` agora exigem portas canônicas; a camada Nest deve ser ajustada posteriormente para fornecer esses use cases.
- A padronização de paths de `payment` foi feita por re-export para reduzir diff; uma migração física completa pode ser feita em rodada separada.
- Ainda há oportunidade de criar specs dedicadas para os novos mappers/repositories de `RequestVote`, `EstablishmentAnalyticsInMemoryRepository` e mappers de `ai-cifra`, embora a suíte completa do core esteja verde.
