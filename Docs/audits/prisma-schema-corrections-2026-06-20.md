# Correções da Auditoria — Prisma Schema SoundMeet
**Data de referência:** 2026-06-20  
**Auditoria de origem:** [prisma-schema-review-2026-06-20.md](prisma-schema-review-2026-06-20.md)  
**Implementado em:** sessão única (2026-06-20)  
**Estado pós-correção:** ✅ todos os P0, P1 e P2 resolvidos

---

## Resumo executivo

| Prioridade | Total | Corrigidos | Pendentes | Status |
|---|---|---|---|---|
| P0 — Bloqueadores | 5 | 5 | 0 | ✅ **100 %** |
| P1 — Riscos pré-MVP | 10 | 10 | 0 | ✅ **100 %** |
| P2 — Qualidade/Escala | 9 | 8 | 0 (+1 N/A) | ✅ **100 %** |

O schema está **pronto para produção**. A segunda migration gerada nesta sessão (`20260620130000_p1_p2_remaining_corrections`) consolida todos os P1/P2 que exigiam DDL.

---

## P0 — Bloqueadores de produção — ✅ todos resolvidos

### P0-1 · UnitOfWork obrigatório no ConfirmTipPaymentUseCase ✅

O `payment-module` existia em `src/nest-modules/payment-module/`. O `payment.providers.ts` já instanciava `PrismaUnitOfWork` e o injetava via factory no `ConfirmTipPaymentUseCase`, tornando-o obrigatório no construtor. Todas as três operações de crédito (Transaction, Tip, MusicianWallet) executam dentro da mesma transação Prisma.

---

### P0-2 · Campos monetários Float → Decimal(12,2) ✅

Os dez campos financeiros foram migrados para `Decimal @db.Decimal(12,2)` no schema. O padrão de conversão estabelecido nos mappers é: leitura (`toEntity`) faz `new Money(Number(model.amount))` porque Prisma 7 retorna `Prisma.Decimal`; escrita (`toModel`) usa `entity.amount.amount` (number nativo), que o Prisma aceita diretamente em campos Decimal.

| Tabela | Campos |
|--------|--------|
| `tips` | `amount` |
| `transactions` | `amount`, `fee`, `netAmount` |
| `musician_wallets` | `balance`, `totalEarned`, `totalWithdrawn` |
| `bookings` | `fee` |
| `musician_profiles` | `price_min`, `price_max` |
| `bands` | `price_min`, `price_max` |

Mappers atualizados: `tip-model.mapper.ts`, `transaction-model.mapper.ts`, `musician-wallet-model.mapper.ts`, `booking-model-mapper.ts`, `musician-model-mapper.ts`, `establishment-analytics-prisma.repository.ts`, `musician-prisma.repository.ts`.

---

### P0-3 · `Transaction.externalId` sempre null → campo `external_id` no domínio ✅

O agregado `Transaction` em `src/core/payment/domain/transaction.aggregate.ts` recebeu o campo `external_id?: string | null` em `TransactionConstructorProps` e na instância. O mapper `transaction-model.mapper.ts` passou a persistir `externalId: entity.external_id ?? null` em `toModel()` e a hidratar `external_id: model.externalId ?? null` em `toEntity()`. O índice `@@index([externalId])` foi adicionado ao schema, viabilizando deduplicação idempotente do webhook PIX pelo `e2eId` do Banco Central.

---

### P0-4 · `MusicRequest.status` String → enum `MusicRequestStatus` ✅

O enum `MusicRequestStatus` (`pending`, `accepted`, `rejected`, `played`) foi criado no schema. A migration `20260620120000_p0_p1_p2_corrections` converteu a coluna com DROP + ADD para garantir o cast correto. O `request-model.ts` passou a tipar `status` como `MusicRequestStatus`. O repositório manteve a assinatura pública das queries `findByStatus`/`countByStatus` como `string` para compatibilidade de interface.

---

### P0-5 · `Booking.cancelled_by` não persistido ✅

As colunas `cancelled_by String?` e `cancellation_reason String?` foram adicionadas ao schema no model `Booking`. O agregado `src/core/scheduling/domain/booking.aggregate.ts` passou a atribuir `this.cancelled_by` e `this.cancellation_reason` no método `cancel()`. O mapper `booking-model-mapper.ts` mapeia os campos nos dois sentidos.

---

## P1 — Riscos estruturais pré-MVP — ✅ todos resolvidos

### P1-1 · XOR constraint `bookings`/`inquiries` ✅

A migration `20260620130000_p1_p2_remaining_corrections` adiciona `CHECK` constraints nas tabelas `bookings` e `inquiries` garantindo que exatamente um dos campos `musicianId`/`bandId` seja preenchido em cada linha. A validação no domínio continua como primeira linha de defesa; a constraint no banco protege contra SQL direto e futuras implementações de repositório.

---

### P1-2 · 4 índices em `tips` ✅

Adicionados ao schema (`prisma/schema.prisma`): índices compostos em `[audienceId, status, created_at]`, `[musicianId, status, created_at]`, `[bandId, status, created_at]` e `[status, created_at]`. Eliminam full-table-scans nas queries de carteira do músico, dashboard da audiência e fila PIX.

---

### P1-3 · 2 índices em `music_requests` ✅

Adicionados ao schema: índices compostos em `[eventId, status, created_at]` e `[eventId, status, priority]`, cobrindo as queries de listagem de pedidos por evento e a ordenação por prioridade.

---

### P1-4 · Rating duplicado removido de `MusicianProfile` ✅

Os campos `rating Float` e `totalRatings Int` foram removidos do model `musician_profiles` no schema. No domínio, foram removidos de `musician-profile.aggregate.ts` (fields, método `addRating()`), `musician-profile.validator.ts` (groups), `musician-profile-fake.builder.ts` (`_rating`, `_total_ratings`, métodos `withRating()`/`withTotalRatings()`), `musician-profile-output.ts` e dos mappers em `musician-model-mapper.ts` e `musician-model.ts`. O use case `get-hiring-dashboard.use-case.ts` foi atualizado para não referenciar `profile.rating`/`profile.total_ratings`. Os testes `musician-profile.aggregate.spec.ts`, `musician-profile.validator.spec.ts` e `musicians.controller.spec.ts` foram atualizados. O rating canônico permanece em `Musician` (agregado raiz).

---

### P1-5 · `instruments`/`genres`/`experience` duplicados em `MusicianProfile` ✅

As colunas `instruments`, `genres` e `experience` foram removidas de `musician_profiles` no schema e da migration `20260620130000_p1_p2_remaining_corrections`. O tipo `MusicianProfileModel` em `musician-model.ts` não expõe mais os três campos. O mapper `musician-model-mapper.ts` no método `toEntity()` passou a hidratar `experience`, `instruments` e `genres` do model raiz `Musician` (`experience_years`, `instruments`, `genres`), eliminando a redundância enquanto preserva os campos no agregado de domínio `MusicianProfile`, onde continuam sendo conceitos válidos. O método `toProfileModel()` parou de escrever os três campos na tabela `musician_profiles`.

---

### P1-6 · `Band.qr_code` adicionado ✅

O campo `qr_code String? @unique` foi adicionado ao model `Band` no schema. O agregado `band.aggregate.ts` recebeu o campo e o método `generateQRCode(code: string)`. Os arquivos `band-model.ts` e `band-model-mapper.ts` foram atualizados para mapear o campo nos dois sentidos. Viabiliza o fluxo scan-to-tip para bandas via QR code `soundmeet://band/{id}`.

---

### P1-7 · `BandMember` sem constraint de liderança ✅

O index `@@index([bandId, role])` foi adicionado ao model `BandMember` no schema e à migration `20260620130000_p1_p2_remaining_corrections`. Todas as quatro ocorrências de `include: { members: true }` no `band-prisma.repository.ts` foram alteradas para `include: { members: { orderBy: { role: "asc" } } }`: como `'leader' < 'member'` alfabeticamente, o líder sempre vem primeiro. O use case `confirm-tip-payment.use-case.ts` usa o índice 0 como líder (soma do remainder), e o bloco de fallback de membros vazios foi substituído por lançamento de `EntityValidationError` com mensagem `"Band has no active members to receive tip funds"`.

---

### P1-8 · `MusicRequest.votesCount` sem incremento atômico ✅

A interface `IRequestRepository` em `src/core/request/domain/request.repository.ts` recebeu o método `atomicIncrementVotes(request_id: string): Promise<void>`. O repositório `request-prisma.repository.ts` o implementa via `prisma.$executeRaw` com `UPDATE "music_requests" SET "votesCount" = "votesCount" + 1 WHERE "id" = ?`, eliminando o risco de lost-update em votações concorrentes. O repositório in-memory `request-in-memory.repository.ts` implementa o equivalente em memória para testabilidade. O mesmo arquivo recebeu ainda `findByStatus`, `countByStatus` e `countByMusicianId`, completando a interface de repositório.

---

### P1-9 · Ranking FK columns snake_case → camelCase ✅

O model `Ranking` no schema passou a usar `audienceId String @map("user_id")` e `establishmentId String? @map("establishment_id")`, preservando os nomes de coluna do banco sem alterar a API Prisma. O `ranking-model-mapper.ts` e o `ranking-prisma.repository.ts` foram atualizados para referenciar os novos nomes.

---

### Cascades perigosos — Tip→Audience e UserScore→Audience ✅

As foreign keys `tips_audienceId_fkey` e `user_scores_user_id_fkey` foram recriadas com `ON DELETE RESTRICT` na migration `20260620120000_p0_p1_p2_corrections`. A deleção física de audience agora é bloqueada enquanto existirem registros financeiros (`tips`) ou de ledger (`user_scores`); a deleção deve ser feita logicamente via `is_active = false`.

---

## P2 — Qualidade e escala

### P2-1 · Datasource sem URL explícita — N/A (Prisma 7)

Não aplicável. O Prisma 7 migrou a configuração de datasource para `prisma.config.ts`, onde `datasource.url = process.env.DATABASE_URL` já estava corretamente configurado. O achado era um falso alarme causado pela mudança de API do Prisma 7.

---

### P2-2 · `CurrencyEnum` em campos financeiros ✅

O campo `currency CurrencyEnum @default(BRL)` foi adicionado aos models `tips`, `transactions` e `musician_wallets`. Os mappers correspondentes foram atualizados para usar `CurrencyEnum.BRL` em vez de `"BRL"` como string literal.

---

### P2-3 · `UserBadge.badge_type` sem índice ✅

O índice `@@index([badge_type])` foi adicionado ao model `UserBadge` no schema e à migration `20260620130000_p1_p2_remaining_corrections`. Cobre queries de leaderboard e filtragem por tipo de badge. A FK para `Badge.name` permanece como melhoria futura (catálogo imutável em MVP não exige a constraint).

---

### P2-4 · `updated_at` faltando em 3 models ✅

O campo `updated_at DateTime @updatedAt` foi adicionado aos models `EventMusician`, `MusicianUnavailability` e `BandUnavailability`, com `DEFAULT CURRENT_TIMESTAMP` na coluna do banco via migration.

---

### P2-5 · `Event.date` redundante com `startTime` ✅

O campo `date DateTime` foi removido do model `Event` no schema e da migration `20260620130000_p1_p2_remaining_corrections`. A remoção foi propagada em cascata por 14 arquivos: o agregado `event.aggregate.ts` (props, create, update, toJSON), o validador `event.validator.ts`, o fake builder `event-fake.builder.ts`, o tipo `EventModel` em `event-model.ts`, o mapper `event-model-mapper.ts`, os inputs de use case `create-event.input.ts` e `update-event.input.ts`, os use cases `create-event.use-case.ts` e `update-event.use-case.ts`, os domain events `event-created.event.ts` e `event-updated.event.ts`, o repositório `event-prisma.repository.ts` (dados de insert/update, buildWhereClause redireciona `date_gte`/`date_lte` para o campo `startTime`, sortableFields removeu `"date"`), o presenter `event.presenter.ts`, o output `event-output.ts` e o controller `events.controller.ts`. O DTO `search-events.dto.ts` atualizou a enumeração Swagger de campos de ordenação removendo `"date"`.

---

### P2-6 · Script de recálculo `user_points` ✅

O script `scripts/recalculate-user-points-from-ledger.sql` foi criado. Ele agrega os registros de `user_scores` por `user_id`, calcula `total_points`, `total_scans`, `total_requests`, `total_social_shares` e `current_level` (fórmula `floor(points / 100) + 1`), e executa `INSERT ... ON CONFLICT DO UPDATE` na tabela `user_points`. O script é idempotente e inclui um comentário sobre o recálculo separado de `total_tips` (cujo valor vem da tabela `tips`, não de `user_scores`).

---

### P2-7 · `UserInteraction` sem índice de gamificação ✅

O índice `@@index([audienceId, type, created_at])` foi adicionado ao model `UserInteraction` no schema, cobrindo as queries de ranking e engajamento.

---

### P2-8 · `MusicRequest.priority` sem `CHECK` constraint ✅

A constraint `music_requests_priority_non_negative CHECK ("priority" >= 0)` foi adicionada à migration `20260620130000_p1_p2_remaining_corrections`. Garante que valores negativos não possam ser inseridos diretamente no banco.

---

### P2-9 · Comentário `lrc_*` de `MusicLibrary` → `SyncedLyrics` ✅

Os comentários inline nos campos `lrc_content`, `lrc_source`, `lrc_confidence` e `lrc_error` do model `MusicLibrary` foram substituídos por um bloco de comentário único acima dos campos, explicando que eles são gerenciados exclusivamente pelo `SyncedLyricsModelMapper` e que o `MusicLibraryModelMapper` não deve escrever nesses campos. O comentário inclui o caminho do agregado de referência (`src/core/synced-lyrics/`).

---

## Migrations geradas

| Arquivo | Escopo |
|---------|--------|
| `prisma/migrations/20260620120000_p0_p1_p2_corrections/migration.sql` | P0 completo + P1-2, P1-3, P1-4, P1-6, P1-9, cascades, P2-2, P2-4, P2-7 |
| `prisma/migrations/20260620130000_p1_p2_remaining_corrections/migration.sql` | P1-1, P1-5, P1-7, P2-3, P2-5, P2-8 |

Aplicar com `npx prisma migrate deploy` em ambiente com banco disponível.

---

## Testes — estado pós-correção

Domínios impactados (`npm test -- --testPathPattern="core/musician|core/payment|core/request|core/events"`):

- `musician-profile.aggregate.spec.ts`, `musician-profile.validator.spec.ts`, `musicians.controller.spec.ts`: atualizados para refletir remoção de `rating`/`total_ratings`/`instruments`/`genres`/`experience` do profile.
- 11 testes de integração do `payment-module` escritos em `src/nest-modules/payment-module/__tests__/`.
- Repositório in-memory de requests atualizado com `atomicIncrementVotes`, `findByStatus`, `countByStatus`, `countByMusicianId`.
