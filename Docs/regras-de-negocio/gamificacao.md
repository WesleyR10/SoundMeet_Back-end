# Gamificação

> Parte das [regras de negócio](../README.md) — o que a API já faz, por domínio.
> Marcações: `[x]` implementado · `[~]` parcial · `[ ]` pendente.

*Seção original: “Domínio Gamification (Pontos, Badges, Rankings)”.*


**Pontos globais de usuário (UserPoints)**

- [x] Acúmulo de pontos por tipo de ação  
       Código: user-points.aggregate.ts ([18]) e points-source.vo.ts ([23]).  
       Regras:
  - `scanQr` → +10 pts
  - `makeMusicRequest` → +25 pts
  - `acceptedMusicRequest` → +50 pts
  - `sendTip` → 1 pt por real doado
  - `shareOnSocial` → +10 pts (uma vez por conteúdo; era 50 até 28/set/2026)
  - indicação de músico → +15 pts
  - Os valores vêm de `GAMIFICATION_POINTS` (`gamification-points.ts`) via `PointsSource`
  - Métodos genéricos `addPoints`/`subtractPoints` com validação.

- [x] Cálculo de nível, progressão e detecção de level up  
       Código: user-points.aggregate.ts ([18]) e user-level.vo.ts ([14]).  
       Regras:
  - `UserLevel.getLevelByPoints` define o nível.
  - `needsLevelUp` detecta se o total de pontos já ultrapassou o nível atual.
  - `getProgressToNextLevel` retorna % de progresso até o próximo nível.
  - Flags: `isTopFan` (>= 1000 pts), `isActiveSupporter` (tip + compartilhamento).

- [x] Use-case central para cálculo de pontos  
       Código: calculate-points.use-case.ts ([24]).  
       Regra: recebe `user_id` + `source` e aplica o método correspondente em `UserPoints`, criando o registro se não existir.

**Badges de usuário (UserBadge)**

- [x] Sistema genérico de badges com progresso e desbloqueio  
       Código: user-badge.aggregate.ts ([25]) e badge-type.vo.ts ([26]).  
       Regras:
  - Cada badge possui `BadgeType` com pontos requeridos, descrição e regras de desbloqueio.
  - `addProgress`/`unlock` atualizam estado e timestamps.
  - `canUnlock` e `getProgressPercentage` facilitam a aplicação de negócios.

- [x] Use-cases para concessão e manipulação de badges  
       Código: award-badge.use-case.ts ([27]) e demais use-cases em `application/use-cases`.  
       Regras: cada use-case recebe DTO validado com `class-validator` e orquestra criação/atualização em repositórios.

- [x] **Progresso automático das conquistas** (29/set/2026)
       Código: `domain/badge-tracks.ts`, `sync-user-badges.use-case.ts`, chamado por `AddPointsUseCase`.
       Regras:
  - 🔴 **Até aqui NADA avançava uma conquista.** `AwardBadgeUseCase` só era chamado pela rota de admin; o fã pontuava, subia de nível, e `user_badges` só tinha o que o seed escrevia à mão.
  - O progresso é **derivado do ledger** (`UserScore`), nunca acumulado: a cada crédito, `SyncUserBadgesUseCase` soma os lançamentos dos tipos que cada conquista escuta (`BADGE_TRACKS`) e grava só o que mudou. Idempotente; um sync perdido é corrigido pelo próximo crédito; quem já tinha pontos recebe as conquistas no primeiro crédito seguinte, **sem migration de backfill**.
  - Trilhas: Iniciante Musical e Super Fã = qualquer ponto; Sugestor Criativo = pedidos enviados; Acertador = pedidos ACEITOS; Apoiador e Mecenas = gorjeta (1 pt/real); Socializador = compartilhamento (já deduplicado por conteúdo); Descobridor = QR + indicação. Os limiares continuam em `BadgeType.getRequiredPoints`.
  - Só cria linha com progresso > 0 (conquista não começada é ausência; o app desenha a argola vazia pelo catálogo). Nunca revoga o que já desbloqueou.
  - **Falha nas conquistas não derruba o crédito**: os pontos já estão gravados quando o sync roda; propagar faria o handler ver erro num crédito que aconteceu (e um retry creditaria de novo). Loga `gamification.badges.sync_failed`.
  - 🔴 **Bug corrigido junto:** o validador de `UserBadge` tinha `@Max(100)` em `progress`, mas `progress` é medido em **pontos** (limiares de 100 a 10.000). Toda conquista acima de 100 pontos nasceria inválida — só não aparecia porque nada avançava conquista nenhuma. O mesmo `@Max(100)` saiu de `UpdateUserBadgeInput` (rota de admin). Regressão em `sync-user-badges.use-case.spec.ts`, verificada contra o caso negativo.
  - O seed deixou de escrever conquista à mão ("Super Fã" desbloqueado com 100 de progresso num limiar de 10.000) e passou a derivá-las pelo mesmo use-case.
  - ⚠️ O app espelha o catálogo (`soundmeet-mobile/src/features/audience/domain/fan-charms.ts`): conquista nova aqui tem de entrar lá.

**Interações e ranking**

- [x] Registro tipado de interações de usuário (UserInteraction)  
       Código: user-interaction.aggregate.ts ([28]) e interaction-metadata.vo.ts ([29]).  
       Regra: grava o tipo de interação (scan, pedido, tip, share, etc.), target, metadata e pontos associados.

- [x] Rankings por tipo e período  
       Código: ranking.aggregate.ts ([30]) e ranking-type.vo.ts ([31]).  
       Regras:
  - `RankingTypeEnum` suporta diferentes rankings (ex.: Top Fãs, Top Apoiadores, etc.).
  - `RankingPeriodEnum` define periodicidade (diário, semanal, mensal, anual, all-time).
  - Validações garantem que `period_end > period_start` e `position >= 1`.
  - Flags: `isCurrentPeriod`, `isTopPosition`, `getPositionMedal`.

- [~] Algoritmo completo de ranking mensal (Top Fãs, Top Sugestões, Top Discoverers, etc.)  
  Estrutura de `Ranking` e `UserPoints` já está pronta, com use-cases para cálculo e leaderboard; contudo, a lógica fina de cada tipo de ranking (combinações específicas de métricas) ainda pode ser expandida para refletir todos os cenários descritos em _Features_.

- [x] Leaderboard com identidade exibível (7.16b)
       Código: `get-leaderboard.use-case.ts`, `findTopUsersWithProfile` em `user-points-prisma.repository.ts`, `UserPointsPresenter`.
       Regras:
  - `GET /gamification/leaderboard` devolve `nickname` e `avatar` do fã além dos pontos. Antes só saía `user_id`, e o app exibia "Fã #\<hash\>": um fã não pode consultar `GET /audiences/:id` de outro fã (dono/admin-only), então não havia como resolver o nome pelo cliente.
  - Resolvido em **um único SQL** (`include` da relação `UserPoints.audience`, obrigatória no schema), não por segundo round-trip. `nickname`/`avatar` **não** são copiados para dentro do agregado `UserPoints` — a identidade continua sendo do `Audience`.
  - `nickname`/`avatar` são `null` para quem nunca preencheu o apelido; o cliente cai no `Fã #\<hash\>`. Nunca fabricar nome.
  - 🔴 **A rota é `@Public()`**: apelido e avatar de fã são dados públicos por decisão de produto — é a mesma premissa que justifica o compartilhamento social valer só 10 pontos. **Nunca acrescentar e-mail, telefone ou preferências ao `UserPointsPresenter`**, que é servido sem autenticação. Não há enumeração da base: a resposta é top-N, com `limit` capado em 100.
  - Os campos são opcionais no `UserPointsOutput` e só o caminho do leaderboard os popula — `GET /gamification/users/:id/points` (consulta do próprio usuário) devolve `undefined` neles, de propósito.

[14]: ../../src/core/gamification/domain/value-objects/user-level.vo.ts
[18]: ../../src/core/gamification/domain/user-points.aggregate.ts
[23]: ../../src/core/gamification/domain/value-objects/points-source.vo.ts
[24]: ../../src/core/gamification/application/use-cases/calculate-points/calculate-points.use-case.ts
[25]: ../../src/core/gamification/domain/user-badge.aggregate.ts
[26]: ../../src/core/gamification/domain/value-objects/badge-type.vo.ts
[27]: ../../src/core/gamification/application/use-cases/award-badge/award-badge.use-case.ts
[28]: ../../src/core/gamification/domain/user-interaction.aggregate.ts
[29]: ../../src/core/gamification/domain/value-objects/interaction-metadata.vo.ts
[30]: ../../src/core/gamification/domain/ranking.aggregate.ts
[31]: ../../src/core/gamification/domain/value-objects/ranking-type.vo.ts