# Auditoria Arquitetural — Prisma Schema SoundMeet
**Data:** 2026-06-20  
**Escopo:** `prisma/schema.prisma` · migrations · mapeamento domínio↔banco  
**Baseline:** core-review-2026-06-18 · nest-modules-review-2026-06-18  
**Parecer final:** ❌ **Não está pronto para produção** — 5 bloqueadores P0 impedem operação financeira segura.

---

## Contexto

O schema cobre 13 domínios, 38 models Prisma, 6 enums de máquina de estado e 10 migrations aplicadas. A última migration (`20260213120000_ddd_refinements`) converteu os status de domínio para enums PostgreSQL e reestruturou o ledger de gamificação. O estado atual das migrations está sincronizado (`Database schema is up to date!`).

---

## P0 — Bloqueadores de produção

### P0-1 · Fluxo de pagamento não é atômico

**Arquivo:** `src/core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case.ts:47-52`

```typescript
constructor(
  private readonly uow?: IUnitOfWork,  // opcional!
) {}

async execute(input) {
  if (this.uow) return this.uow.do(() => this.confirm(input));
  return this.confirm(input);  // ← sem transação!
}
```

Sem UoW injetado (o `payment-module` ainda não existe), as operações executam em sequência sem transação:

1. `txRepo.insert(transaction)` → persiste
2. `tipRepo.update(tip)` → se falhar: transaction existe, tip continua `pending`
3. N × `walletRepo.update(wallet)` → se falhar no membro 3 de 5: 2 membros recebem crédito, 3 não

**Risco:** divergência irrecuperável entre `transactions`, `tips` e `musician_wallets`. Gorjeta "paga" pelo público sem crédito no músico.

**Correção:** `IUnitOfWork` deve ser obrigatório no construtor; o payment-module (Bloco 1) deve injetá-lo via providers.

---

### P0-2 · Todos os campos monetários usam `Float` (IEEE 754)

**Campos afetados:**

| Tabela | Campo |
|--------|-------|
| `tips` | `amount` |
| `transactions` | `amount`, `fee`, `netAmount` |
| `musician_wallets` | `balance`, `totalEarned`, `totalWithdrawn` |
| `bookings` | `fee` |
| `musician_profiles` | `price_min`, `price_max` |
| `bands` | `price_min`, `price_max` |

`Float` PostgreSQL (`double precision`, 64-bit IEEE 754) não representa centavos exatamente. `0.1 + 0.2 = 0.30000000000000004`. Em splits de gorjeta com 3 membros e valores não-redondos, o saldo acumulado na `MusicianWallet` diverge dos valores reais de centavo em centavo. A escala importa: 10.000 gorjetas × desvio médio de R$ 0,01 = R$ 100 de erro silencioso.

**Correção:** Migrar todos os campos monetários para `Decimal` Prisma (`@db.Decimal(12,2)`). O VO `Money` no domínio usa `number` internamente — o mapper faz o cast. A migration deve usar `NUMERIC(12,2)`.

---

### P0-3 · `Transaction.externalId` sempre `null` no mapper

**Arquivo:** `src/core/payment/infra/db/prisma/transaction-model.mapper.ts:47`

```typescript
externalId: null, // Not currently in domain entity, but present in Prisma schema
```

O agregado `Transaction` não tem campo `external_id`. O schema tem a coluna `externalId String?`. O mapper hardcodeia `null`. Quando o Bloco 1.7 (webhook PIX) for implementado, o `e2eId` (end-to-end ID do Banco Central) não pode ser armazenado no domínio.

**Consequência:** deduplicação idempotente de callbacks PIX por `externalId` é impossível. Um callback duplicado cria dois `Transaction` com o mesmo `externalId = null`, creditando o músico duas vezes.

**Correção:** Adicionar `external_id?: string | null` ao `Transaction` aggregate e ao `TransactionCreateCommand`. Persistir no mapper. Adicionar `@@index([externalId])` na tabela `transactions`.

---

### P0-4 · `MusicRequest.status` é String, não enum

**Schema:**
```prisma
model MusicRequest {
  status String @default("pending")  // "pending", "accepted", "rejected", "played"
```

Todas as outras máquinas de estado foram migradas para enums PostgreSQL na `20260213120000_ddd_refinements` (`BookingStatus`, `TipStatus`, `TransactionStatus`, etc.), mas `music_requests.status` foi omitido. O banco aceita qualquer string: `"PENDING"`, `"pendingg"`, `""`.

O domínio tem `RequestStatusEnum { PENDING, ACCEPTED, REJECTED, PLAYED }` com validação VO.  
O enum Prisma correspondente não existe.

**Correção:**

```prisma
enum MusicRequestStatus {
  pending
  accepted
  rejected
  played
}
```

Migration: `ALTER TABLE "music_requests" ALTER COLUMN "status" TYPE "MusicRequestStatus" USING ("status"::"MusicRequestStatus");`

---

### P0-5 · `Booking.cancelled_by` não é persistido

**Domínio:**
```typescript
cancel(now: Date, cancelled_by: "establishment" | "musician" | "band", reason?: string | null): void
```

O parâmetro `cancelled_by` é usado para calcular a janela de penalidade (`free_cancellation_hours`) e para emitir `BookingCancelledEvent`. Não existe coluna no schema. Após a escrita no banco, quem cancelou é perdido permanentemente.

**Impacto:** (a) cálculo de multa retroativo impossível; (b) logs de disputa inexistentes; (c) analytics "establishment X cancels" ou "musicians ghost bookings" inviáveis.

**Correção:** Adicionar `cancelled_by String?` e `cancellation_reason String?` ao model `Booking` e ao aggregate.

---

## P1 — Riscos estruturais pré-MVP

### P1-1 · Sem constraint XOR no banco para `Booking` e `Inquiry`

O domínio valida:
```typescript
if (hasMusician === hasBand) {
  this.notification.addError("Either musician_id or band_id must be provided (exclusively)", "target");
}
```

O schema tem ambos como `String?` sem `CHECK` constraint. Qualquer SQL raw, migration com bug, ou futuro repositório que não chame o agregado pode criar linhas com `musician_id = NULL AND band_id = NULL` ou ambos preenchidos. O domínio não pode proteger dados já no banco.

**Correção:** Migration com `CHECK`:
```sql
ALTER TABLE "bookings" ADD CONSTRAINT bookings_musician_or_band_xor
  CHECK (
    (musician_id IS NOT NULL AND band_id IS NULL) OR
    (musician_id IS NULL AND band_id IS NOT NULL)
  );
-- Idem para inquiries
```

---

### P1-2 · Tabela `tips` sem nenhum índice

`tips` não tem nenhum índice além da PK implícita. Queries reais:
- `GET /musicians/:id/wallet` → tips recebidas por músico
- Dashboard público audience → gorjetas enviadas por usuário
- Fila de processamento PIX → tips com `status = pending`

Todas fazem full table scan. Com 100k gorjetas (realista após 6 meses), cada query leva segundos.

**Correção:**
```prisma
@@index([audienceId, status, created_at])
@@index([musicianId, status, created_at])
@@index([bandId, status, created_at])
@@index([status, created_at])
```

---

### P1-3 · Índice crítico faltando em `MusicRequest`

O caso de uso mais frequente em produção: "listar pedidos pendentes do evento X por prioridade". Os índices existentes cobrem `[eventId, musicianId]` e `[eventId, created_at]` mas nenhum cobre `eventId + status` juntos.

**Correção:**
```prisma
@@index([eventId, status, created_at])   // listagem ao vivo
@@index([eventId, status, priority])     // ordenação por prioridade
```

---

### P1-4 · Rating duplicado: `Musician` e `MusicianProfile`

```prisma
model Musician        { rating Float; total_ratings Int }
model MusicianProfile { rating Float; totalRatings  Int }
```

Dois campos com o mesmo semântico, sem mecanismo de sincronização. `Musician.addRating()` (via VO `Rating`) atualiza o agregado raiz que é mapeado para `musicians.rating`. `MusicianProfile.rating` permanece como foi inserido. Endpoints que incluem o perfil via join retornam rating diferente do endpoint que retorna só o músico.

**Correção:** Remover `rating` e `totalRatings` de `musician_profiles`. São dados do agregado raiz, não do sub-agregado de perfil.

---

### P1-5 · `instruments`/`genres` duplicados: `Musician` e `MusicianProfile`

```prisma
model Musician        { genres String[]; instruments String[] }
model MusicianProfile { genres String[]; instruments String[] }
```

`Musician.changeGenres()` atualiza a raiz. O perfil tem sua própria cópia. Busca de músicos por gênero pode usar a raiz; exibição de perfil pode usar o perfil — resultando em dados diferentes para a mesma entidade. `MusicianProfile.experience` (int) vs `Musician.experience_years` (int) também duplica.

**Correção:** Remover `genres`, `instruments`, `experience` de `musician_profiles`. O mapper deve carregar esses valores da raiz `Musician` ao hidratar o perfil.

---

### P1-6 · `Band` sem `qr_code`

`Tip.band_id` existe — bandas recebem gorjetas. Mas `Band` não tem `qr_code`. O fluxo scan-to-tip para bandas é arquiteturalmente quebrado: não há o que o público escaneia para encontrar a banda.

O campo `qr_code` em `Musician` é `@unique`. O padrão estabelecido (musician `soundmeet://musician/{id}`) deve ter equivalente para banda (`soundmeet://band/{id}`).

**Correção:** Adicionar `qr_code String? @unique` ao model `Band`. O agregado `Band` deve implementar `generateQRCode()` seguindo o mesmo padrão do `Musician`.

---

### P1-7 · `BandMember` sem constraint de liderança + split financeiro por ordem de inserção

O use case `confirm-tip-payment` distribui o resto da divisão (`remainder`) para `activeMembers[0]` — o primeiro da lista retornada pelo ORM. Isso não é necessariamente o líder da banda. Não há índice, ordering, ou constraint que garanta a posição do líder.

```typescript
if (i === 0) { share += remainder; }  // "primeiro membro" ≠ "líder"
```

Adicionalmente, não há constraint que impeça uma banda sem membros. O bloco `else` do caso sem membros é um comment `// log warning` sem lógica — fundos desaparecem.

**Correção:** 
1. Adicionar `@@index([bandId, role])` e lógica de busca `ORDER BY role = 'leader' DESC`.
2. `Band.members.length === 0` deve lançar exceção no use case, não ser silencioso.

---

### P1-8 · `MusicRequest.votesCount` denormalizado sem sync atômico

`MusicRequest.votesCount Int @default(0)` é mantido manualmente enquanto `request_votes` é a fonte real. Sem transação atômica entre `INSERT INTO request_votes` e `UPDATE music_requests SET votesCount = votesCount + 1`, duas votações concorrentes lêem o mesmo `votesCount`, ambas incrementam para o mesmo valor, e um voto é perdido (lost update).

**Correção:** Remover `votesCount` do schema e calcular on-the-fly via `SELECT COUNT(*) FROM request_votes WHERE requestId = X`, ou usar `UPDATE music_requests SET votesCount = votesCount + 1 WHERE id = X` (atomic increment) no mesmo statement da inserção de voto.

---

### P1-9 · `Ranking`: FK columns são snake_case quebrando a convenção camelCase

```prisma
model Ranking {
  user_id          String   -- deveria ser: audienceId
  establishment_id String?  -- deveria ser: establishmentId
  ...
  audience      Audience       @relation(fields: [user_id], ...)
  establishment Establishment? @relation(fields: [establishment_id], ...)
}
```

Todo o resto do schema usa `musicianId`, `audienceId`, `establishmentId` (camelCase). `Ranking` quebra essa convenção. O cliente Prisma gerado para `Ranking` terá `user_id` e `establishment_id` onde todos os outros models têm camelCase — quebrando a previsibilidade do tipo gerado.

**Correção:** Renomear para `audienceId` e `establishmentId` em migration, atualizando o mapper de ranking.

---

## P2 — Qualidade e preparação para escala

### P2-1 · `datasource db` sem `url` explícita no `schema.prisma`

O `prisma.config.ts` injeta `DATABASE_URL` via `defineConfig.datasource.url`. O `schema.prisma` tem apenas `provider = "postgresql"` sem `url`. Ferramentas que operam diretamente no schema (extensões IDE Prisma, `prisma validate` sem config, pipelines CI que geram o cliente sem `prisma.config.ts`) não encontram a URL.

**Correção:** Adicionar `url = env("DATABASE_URL")` ao bloco `datasource db`.

---

### P2-2 · `CurrencyEnum` existe mas campos financeiros não têm moeda

`Tip.amount`, `Transaction.amount`, `MusicianWallet.balance` não têm campo de moeda. O `CurrencyEnum` só é usado em `price_currency` dos modelos de preço. Se o produto aceitar pagamentos em USD (marketplace internacional), há alteração breaking de schema sem migration path óbvio.

**Correção:** Adicionar `currency CurrencyEnum @default(BRL)` a `tips`, `transactions`, `musician_wallets`.

---

### P2-3 · `Badge` catálogo desacoplado de `UserBadge.badge_type` (sem FK)

```prisma
model Badge     { name String @unique }
model UserBadge { badge_type String }  -- sem FK para Badge.name
```

Um `UserBadge` pode ter `badge_type = "badge_que_nao_existe"`. Integridade referencial só existe no domínio. O catálogo `Badge` pode ser editado (renomear badge) sem invalidar `UserBadge` existentes.

**Correção:** Adicionar `@@index([badge_type])` e considerar FK para `Badge.name`, ou mover para constraint de validação explícita no application layer.

---

### P2-4 · `EventMusician`, `MusicianUnavailability`, `BandUnavailability` sem `updated_at`

Mudanças de status (`confirmed → cancelled`) em `event_musicians` e criações/edições de indisponibilidade não têm timestamp de modificação. Impede CDC, auditoria e replication.

---

### P2-5 · `Event.date` redundante com `Event.startTime`

```prisma
model Event {
  date      DateTime   -- componente de data
  startTime DateTime   -- contém data + hora
  endTime   DateTime
}
```

`date` e `startTime` carregam a mesma informação de data. Podem divergir (`date = 2026-06-20`, `startTime = 2026-06-21 22:00`). Remover `date` e derivar a data de `startTime` quando necessário.

---

### P2-6 · Migração destrutiva `TRUNCATE TABLE "user_points"` sem rollback

`20260213120000_ddd_refinements` executa `TRUNCATE TABLE "user_points"` sem SQL de rollback. O comentário na migration documenta a intenção mas não há `down` migration. Se aplicado em ambiente com dados reais (staging ou prod), todos os resumos de pontuação são destruídos irreversivelmente.

**Ação:** Documentar explicitamente que environments com dados reais precisam de backup antes da migration. Criar script de recálculo (`recalculate-user-points-from-ledger.sql`) para reconstruir `user_points` a partir de `user_scores`.

---

### P2-7 · `UserInteraction` sem índice composto para queries de gamificação

Queries típicas: "interações de tipo QR_SCAN do usuário X neste mês". O model não tem índice em `[audienceId, type, created_at]`. Com volume de interações, cada query de gamificação faz scan completo.

---

### P2-8 · `MusicRequest.priority` sem restrição de valor

```prisma
priority Int @default(0)
```

Sem `CHECK (priority >= 0)` e sem valor máximo. Queries de ordenação por prioridade não têm ceiling. Logicamente, prioridade máxima deveria ser cap em algum valor (ex: nível de nível VIP = prioridade 5).

---

### P2-9 · `SyncedLyrics` projection em `music_library` sem marcador no schema

A arquitetura define que `SyncedLyrics` aggregate é persistido via projeção nos campos `lrc_*` de `music_library`. Isso está correto e funciona, mas não há nenhuma indicação no schema. Um novo desenvolvedor que leia `music_library` não sabe que os campos `lrc_*` são gerenciados pelo `SyncedLyricsModelMapper`, não pelo `MusicLibraryModelMapper`. Risco: dois mappers escrevendo nos mesmos campos.

**Ação (não schema):** Adicionar comentário inline no schema nas colunas `lrc_*` de `music_library` indicando que são propriedade do `SyncedLyrics` aggregate.

---

## Mapeamento domínio vs. schema — síntese

| Agregado | Tabela Prisma | Status mapeamento |
|----------|--------------|-------------------|
| `Musician` | `musicians` | ✅ OK — rating duplicado em profile (P1-4) |
| `MusicianProfile` | `musician_profiles` | ⚠️ duplica instruments/genres/experience (P1-5) |
| `Band` | `bands` | ⚠️ sem qr_code (P1-6), sem BandWallet |
| `BandMember` | `band_members` | ⚠️ sem constraint de líder (P1-7) |
| `MusicLibrary` | `music_library` | ✅ OK — LRC projeta SyncedLyrics (P2-9) |
| `Establishment` | `establishments` | ✅ OK |
| `EstablishmentProfile` | `establishment_profiles` | ✅ OK |
| `Event` | `events` | ⚠️ campo `date` redundante (P2-5) |
| `EventMusician` | `event_musicians` | ⚠️ sem `updated_at` (P2-4) |
| `Booking` | `bookings` | ❌ sem `cancelled_by` (P0-5), sem XOR constraint (P1-1) |
| `Inquiry` | `inquiries` | ⚠️ sem XOR constraint (P1-1) |
| `Audience` | `audiences` | ✅ OK |
| `MusicRequest` | `music_requests` | ❌ status String não-enum (P0-4), votesCount sem sync (P1-8) |
| `RequestVote` | `request_votes` | ✅ OK |
| `RequestFeedback` | `request_feedback` | ✅ OK |
| `Tip` | `tips` | ❌ Float monetário (P0-2), sem índices (P1-2) |
| `Transaction` | `transactions` | ❌ externalId sempre null (P0-3), Float (P0-2) |
| `MusicianWallet` | `musician_wallets` | ❌ Float (P0-2) |
| `UserPoints` | `user_points` | ✅ OK (projeção) |
| `UserScore` | `user_scores` | ⚠️ user_id inconsistente com audienceId (P1-9-related) |
| `UserBadge` | `user_badges` | ⚠️ sem FK para Badge.name (P2-3) |
| `Badge` | `badges` | ✅ OK |
| `UserInteraction` | `user_interactions` | ⚠️ sem índice gamificação (P2-7) |
| `Ranking` | `rankings` | ⚠️ snake_case FK columns (P1-9) |
| `SyncedLyrics` | projetado em `music_library` | ✅ OK (by design) |
| `SyncedLyricsBulkJob` | `synced_lyrics_bulk_jobs` | ✅ OK |
| `AiAudioUpload` | `ai_audio_uploads` | ✅ OK |
| `AiAudioSeparationJob` | `ai_audio_separation_jobs` | ✅ OK |
| `AiCifraUpload` | `ai_cifra_uploads` | ✅ OK |
| `AiCifraAnalysisJob` | `ai_cifra_analysis_jobs` | ✅ OK |
| `Availability` | `musician_calendar_settings`/`_availability_rules`/`_unavailability` + band equivalents | ⚠️ sem `updated_at` (P2-4) |

---

## Atomicidade / Unit of Work — fluxos críticos

| Fluxo | Operações | UoW presente? | Risco |
|-------|-----------|---------------|-------|
| `ConfirmTipPayment` | insert(Tx) + update(Tip) + N×update(Wallet) | ❌ Opcional, não injetado | **CRÍTICO** (P0-1) |
| `ProposeBooking` | insert(Booking) + validação disponibilidade | ✅ padrão NestJS | Baixo |
| `ConfirmBooking` | update(Booking) + N×insert(Unavailability) | ✅ via repository | Baixo |
| `ScanQR` | update(Audience) + insert(UserInteraction) | ❌ Bloco 2.5 pendente | Médio |
| `MakeMusicRequest` | insert(Request) + update(UserPoints) | ⚠️ sem UoW explícito | Médio |

---

## Cascades / Deletes perigosos

| Relação | `onDelete` | Avaliação |
|---------|-----------|-----------|
| `MusicianProfile → Musician` | `Cascade` | ✅ OK — perfil é subagregado |
| `MusicRequest → Musician` | `Cascade` | ⚠️ Deletar músico apaga histórico de pedidos do público |
| `MusicRequest → Audience` | `Cascade` | ⚠️ Deletar audience apaga histórico de pedidos |
| `Booking → Establishment` | `Cascade` | ⚠️ Deletar estabelecimento apaga contratos/reservas |
| `Tip → Audience` | `Cascade` | ❌ Deletar audience apaga registros financeiros — deveria ser `Restrict` |
| `Transaction → Audience` | `SetNull` | ✅ OK — mantém registro financeiro mesmo sem user |
| `Transaction → Musician` | `SetNull` | ✅ OK |
| `EventMusician → Musician` | `SetNull` | ✅ OK |
| `UserScore → Audience` | `Cascade` | ❌ Deletar audience apaga o ledger financeiro imutável — `Restrict` obrigatório |

**Achado crítico:** `Tip` e `UserScore` com `Cascade` em audience são perigosos. A deleção de uma conta de público deveria ser lógica (`is_active = false`), nunca física enquanto houver histórico financeiro (`Tip`) ou ledger de pontos (`UserScore`).

---

## Recomendações priorizadas

### Imediato (antes de ligar o Bloco 1 — payment-module)

1. **P0-1** — Tornar `IUnitOfWork` obrigatório no `ConfirmTipPaymentUseCase`; garantir injeção no `payment-module`.
2. **P0-2** — Criar migration para converter todos os campos monetários de `Float` para `Decimal(12,2)`.
3. **P0-3** — Adicionar `external_id` ao agregado `Transaction` e ao mapper; adicionar `@@index([externalId])`.
4. **P0-4** — Criar enum `MusicRequestStatus` e migrar `music_requests.status`.
5. **P0-5** — Adicionar `cancelled_by String?` e `cancellation_reason String?` ao agregado e schema de `Booking`.

### Antes do MVP público

6. **P1-1** — Adicionar CHECK constraints XOR em `bookings` e `inquiries`.
7. **P1-2** — Adicionar 4 índices na tabela `tips`.
8. **P1-3** — Adicionar `@@index([eventId, status, created_at])` em `music_requests`.
9. **P1-4 + P1-5** — Remover campos duplicados de rating, genres, instruments, experience de `musician_profiles`.
10. **P1-6** — Adicionar `qr_code String? @unique` ao model `Band` e implementar `generateQRCode()` no agregado.
11. **P1-7** — Corrigir lógica de split por líder; validar banda com 0 membros.
12. **P1-8** — Substituir `votesCount` denormalizado por atomic increment ou computed column.
13. **Cascade Tip → Audience** — Alterar para `Restrict` ou `SetNull`. Idem `UserScore → Audience`.

### Backlog técnico qualificado

14. **P2-1** — Adicionar `url = env("DATABASE_URL")` ao `schema.prisma`.
15. **P2-2** — Adicionar `currency CurrencyEnum` aos campos financeiros.
16. **P2-3** — Definir política de integridade referencial para `UserBadge.badge_type`.
17. **P2-4** — Adicionar `updated_at` a `event_musicians`, `musician_unavailability`, `band_unavailability`.
18. **P2-5** — Remover `Event.date` (redundante com `startTime`).
19. **P2-6** — Criar script `recalculate-user-points-from-ledger.sql`.
20. **P1-9** — Renomear `user_id`/`establishment_id` em `rankings` para camelCase.

---

## Parecer final

O schema é **estruturalmente sólido** no que cobre: 13 domínios mapeados com fidelidade, enums de estado corretos (exceto Request), relações financeiras religadas na última migration, e a divisão ledger/projeção de gamificação bem executada.

**Mas não está pronto para produção** por 5 razões objetivas:

| # | Bloqueador | Impacto |
|---|------------|---------|
| P0-1 | ConfirmTipPayment não-atômico | Perda financeira irrecuperável |
| P0-2 | Float para dinheiro | Drift de centavos em escala |
| P0-3 | externalId sempre null | Webhook PIX não-idempotente |
| P0-4 | Request.status como String | Invariante de estado quebrado no banco |
| P0-5 | cancelled_by não persistido | Disputas e penalidades inauditáveis |

Resolvendo os 5 P0s e os 8 P1s listados, o schema suporta produção MVP. Os P2s podem ser endereçados no primeiro sprint de hardening pós-launch.
