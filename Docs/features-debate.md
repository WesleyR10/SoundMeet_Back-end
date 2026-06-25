# Features Debate — SoundMeet

> Documento de análise e debate para features candidatas. Cada feature lista o que já existe no projeto, o que falta, esforço estimado, valor de negócio e pontos de decisão abertos.

---

## Estado atual: Ratings, Badges, Levels, Points

Antes de debater novas features, confirmação do que **já existe** no projeto:

### Ratings (já existe, sem rota HTTP)

- **Musician:** `musician.addRating(rating: number)` — atualiza `musician.rating` (VO `Rating`) e `musician.total_ratings` via média incremental.
- **Establishment:** `establishment.addRating(ratingValue, ratedBy: Uuid, comment?)` — mesmo mecanismo; guarda histórico com autor e comentário.
- **O que falta:** rota HTTP `POST /musicians/:id/ratings` e `POST /establishments/:id/ratings`. O domínio está pronto.

### Points / Score (já existe com NestJS)

- `UserScore` (ledger/fonte de verdade) e `UserPoints` (projeção/resumo) existem no domínio e têm repositórios Prisma.
- `AddPointsUseCase`, `CalculatePointsUseCase` e `CalculateRankingUseCase` existem.
- `GET /gamification/users/:user_id/points` já está no controller.

### Badges (já existe com NestJS)

- `Badge`, `UserBadge` existem no domínio; `AwardBadgeUseCase` existe.
- `GET /gamification/badges`, `GET /gamification/users/:user_id/badges` já estão no controller.

### Leaderboard (já existe, mas é genérico)

- `GetLeaderboardUseCase` já existe — `GET /gamification/leaderboard?limit=10`.
- Retorna `UserPoints[]` (qualquer user_type), ordenado por pontos via `userPointsRepo.findTopUsers(limit)`.
- **O que falta para um leaderboard de audience:** filtrar por `user_type === "audience"`.

### Levels

- Levels são calculados indiretamente via `UserPoints.level` (projeção) — existe no agregado.
- Não há endpoint dedicado de level, mas o `GET .../points` já expõe o level atual.

---

## Feature 1 — `POST /requests/batch-respond`

### Descrição
Músico rejeita (ou aceita) múltiplos pedidos pendentes de uma vez.

### Existe hoje?
Não. `RespondToRequestUseCase` processa um request por chamada.

### Valor
Alto. Músico que retorna de uma pausa pode ter dezenas de pedidos pendentes. Responder um por um é UX ruim. Batch-reject é a operação mais comum.

### Esforço
Médio. Precisa de:
- `BatchRespondRequestsInput` com `{ request_ids: string[], action: "accept"|"reject", rejection_reason?: string }`
- `BatchRespondRequestsUseCase` que itera e chama o use case individual (ou opera em loop no repositório)
- `POST /requests/batch-respond` com `@Roles("musician", "admin")`
- Validação: músico só responde seus próprios requests (checar `entity.musician_id.id === input.musician_id` em cada item)

### Pontos de decisão
- Semântica: resposta atômica (tudo ou nada) ou best-effort (retorna lista de erros por request_id)?
- Recomendação: **best-effort** — erros por request_id no response, não abortar o batch.
- Limite máximo de IDs por batch? (sugestão: 50)

---

## Feature 2 — `GET /establishments/:id/events/active`

### Descrição
Atalho para retornar o(s) evento(s) atualmente ativos de um estabelecimento — usado no fluxo do QR code para redirecionar o público ao evento correto.

### Existe hoje?
Não como rota dedicada. `GET /establishments/:id/events` lista todos os eventos e `EventStatus` existe como enum — mas não há atalho por status.

### Valor
Alto. É o endpoint crítico do QR code flow: usuário escaneia QR → app bate nessa rota → obtém o evento ativo → redireciona para a fila de pedidos. Sem isso, o app precisa listar todos os eventos e filtrar no cliente.

### Esforço
Baixo. O `ListEventsUseCase` já suporta filtro por `establishment_id`. Basta:
- Nova rota `GET /establishments/:establishment_id/events/active` no `EventsController`
- Chama `ListEventsUseCase` com `{ establishment_id, status: "active" }`
- `@Public()` — público (qualquer um com QR pode acessar)

### Pontos de decisão
- Retornar lista (pode haver mais de um ativo? edge case) ou single object?
- Recomendação: **lista** — raro ter mais de um ativo, mas o modelo permite. Cliente usa o primeiro.

---

## Feature 3 — `POST /musicians/:id/ratings` e `POST /establishments/:id/ratings`

### Descrição
Endpoint para audiência avaliar músico ou estabelecimento após um evento.

### Existe hoje?
O domínio está pronto (`addRating` existe em ambos os aggregates). **Falta apenas a rota HTTP.**

### Valor
Alto. Ratings são fator de contratação para estabelecimentos e descoberta para audiência. Sem rota, o dado nunca entra no sistema.

### Esforço
Médio. Precisa de:
- `AddMusicianRatingUseCase` (input: `musician_id`, `rating: 1-5`, `rated_by: audience_id`)
- `AddEstablishmentRatingUseCase` (input: `establishment_id`, `rating: 1-5`, `rated_by`, `comment?`)
- DTOs + controllers
- **Regra de negócio a decidir:** quem pode ratar? Apenas audiences que assistiram ao evento (`EventAttendee`)? Ou qualquer audience autenticado?

### Pontos de decisão
1. **Quem pode ratar?** Recomendação: verificar se `audience_id` é `EventAttendee` do evento onde o músico/establishment atuou — previne rating farming. Mas isso adiciona complexidade (join com events).
2. **Uma avaliação por audience por músico/estabelecimento** ou por evento? Recomendação: por evento (mais rico historicamente).
3. **Rating de establishment:** o aggregate já guarda `rated_by` e `comment` — usar esse mecanismo rico.

---

## Feature 4 — `GET /audiences/leaderboard`

### Descrição
Top N audiences por pontos/level — engajamento e gamificação social.

### Existe hoje?
`GET /gamification/leaderboard` já existe, mas retorna qualquer `user_type`. Para filtrar só audiências, falta o filtro.

### Valor
Médio. Incentiva engajamento — audiências competem por pontos ao fazer pedidos, votar, dar gorjetas. Exibir o ranking na tela do evento é um motivador.

### Esforço
Baixo. Opções:
1. **Adicionar `user_type` filter** ao `GET /gamification/leaderboard?user_type=audience` — mais genérico.
2. **Nova rota dedicada** `GET /audiences/leaderboard` — mais claro para o cliente.

Recomendação: **opção 1** (adicionar query param `user_type` no leaderboard existente). Menos endpoints, mais flexível.

### Pontos de decisão
- `IUserPointsRepository.findTopUsers(limit, userType?)` precisa suportar o filtro.
- Verificar se o Prisma schema de `UserPoints` tem `user_type` ou `userId` que pode fazer join com `Audience`.

---

## Feature 5 — Banda: Split de Gorjeta por Percentual

### Descrição
Hoje gorjetas de banda são divididas igualmente entre todos os membros. A feature permite definir percentual por membro (ex: líder 40%, demais 20% cada).

### Existe hoje?
Divisão igualitária está hardcoded em `TipUseCase` / domínio de pagamentos. O aggregate `Band` tem `members[]` com `role`, `instrument`, `joined_at` — mas não tem campo `tip_share_percentage`.

### Valor
Baixo-médio (nicho). Relevante para bandas profissionais onde o líder assume mais custos. Menos urgente que as outras features.

### Esforço
Alto. Requer:
- Adicionar `tip_share_percentage?: number` ao `BandMemberProps` (0-100, soma = 100)
- Validação no aggregate: soma de percentuais = 100% se todos especificados, senão divisão igualitária para membros sem percentual
- Alterar `PayTipToBandUseCase` para ler os percentuais
- Migration Prisma no `BandMember` model
- UI para o estabelecimento configurar (fora do escopo backend)

### Pontos de decisão
- Percentual é configurado por quem? Apenas o líder via `PATCH /bands/:id/members/:musicianId`?
- Se a soma não for 100%, dividir igualmente? Ou rejeitar?
- Recomendação: **adiar** até validar demanda real. Implementar divisão igualitária como padrão é suficiente para MVP.

---

## Feature 6 — Event Auto-Finish Job

### Descrição
Job agendado que finaliza automaticamente eventos com status `active` cujo `end_date` já passou — similar ao `ExpirePendingBookingsJob` do scheduling module.

### Existe hoje?
Não. Um evento pode ficar indefinidamente em `active` se o organizador esquecer de chamar `POST /establishments/:id/events/:event_id/finish`.

### Valor
Alto para consistência de dados. Um evento de ontem ainda `active` polui queries, o leaderboard e o QR flow (retornaria um evento "ativo" que não está acontecendo).

### Esforço
Baixo. Padrão já existe em `ExpirePendingBookingsJob`:
- `AutoFinishEventsJob` com `@Cron(CronExpression.EVERY_HOUR)` (ou a cada 30min)
- `IEventRepository.findActiveEventsEndedBefore(date: Date): Promise<Event[]>`
- Iterar e chamar `event.finish()` + `eventRepo.update(event)`
- Registrar no `EventsModule` como provider

### Pontos de decisão
- Frequência do job? Recomendação: **a cada 15 minutos** (eventos musicais são curtos).
- Disparar domain events ao auto-finalizar? Sim — `EventFinishedDomainEvent` já deve existir se `finish()` o dispara.
- Notificar músicos/estabelecimento? Fora do escopo do job — o event handler cuida disso.

---

## Resumo de Prioridades Sugeridas

| # | Feature | Valor | Esforço | Prioridade |
|---|---------|-------|---------|-----------|
| 6 | Event auto-finish job | Alto | Baixo | **P0** |
| 2 | `GET /establishments/:id/events/active` | Alto | Baixo | **P0** |
| 3 | Rating endpoints (músico + establishment) | Alto | Médio | **P1** |
| 1 | `POST /requests/batch-respond` | Alto | Médio | **P1** |
| 4 | `GET /audiences/leaderboard` (filtro user_type) | Médio | Baixo | **P2** |
| 5 | Band tip split por percentual | Baixo | Alto | **Backlog** |
