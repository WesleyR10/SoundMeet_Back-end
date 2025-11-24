# Domínio Gamification

## Visão Geral

O domínio **Gamification** implementa o sistema de pontuação, badges, interações, scores e rankings da plataforma SoundMeet, seguindo rigorosamente DDD + Clean Architecture + Hexagonal, alinhado aos módulos já concluídos.

## Arquitetura

```
gamification/
├── application/
│   ├── use-cases/         
│   └── validations/
├── domain/
│   ├── entities/          
│   ├── repositories/
│   ├── value-objects/
│   └── validators/
└── infra/
    └── db/
        ├── in-memory/
        └── prisma/
```

## Entidades e VO

- `UserPoints`: total de pontos e contadores; usa `UserLevel` e `PointsSource`.
- `UserScore`: pontuações atômicas por `ScoreType`; valida e calcula pontos.
- `UserInteraction`: interações de usuário; valida via `UserInteractionValidator` e metadata tipada.
- `UserBadge`: progresso e desbloqueio por `BadgeType`; valida e controla estado.
- `Ranking`: classificações por `RankingType` e `RankingPeriod`.
- IDs: `UserPointsId`, `UserScoreId`, `UserBadgeId`, `RankingId`, `UserInteractionId`.

## Casos de Uso

- `AddPointsUseCase`: adiciona pontos conforme `PointsSource`.
- `CreateUserPointsUseCase`, `CreateUserScoreUseCase`, `CreateUserInteractionUseCase`.
- `AwardBadgeUseCase`: concede badge ao usuário.
- `CalculateRankingUseCase`, `GetLeaderboardUseCase` e CRUD/lista para cada agregado.

## Repositórios

- Interfaces estendem `ISearchableRepository` com filtros/params/result.
- Implementações `in-memory` e `prisma` com mapeadores consistentes e ordenação.

## Validações

- Notification pattern com `EntityValidationError` em todas as entidades.
- DTOs com `class-validator` nos inputs de use-cases.
- VO validam valores permitidos e expõem métodos utilitários (`getPoints`, `getDescription`).

## Padrões e Consistência

- `create()`, `validate()`, `toJSON()`, `fake()`, getters `entity_id`.
- Métodos de negócio: `scanQr`, `makeMusicRequest`, `sendTip`, `unlock`, `updateProgress`, `changePoints` etc.

## Testes

- Cobertura de unitários em VO e agregados; integração em repositórios Prisma e casos de uso.

