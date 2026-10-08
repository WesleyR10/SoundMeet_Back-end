# 🏗️ Arquitetura e Padrão de Desenvolvimento — SoundMeet

> **Regra de ouro:** consistência > inovação. Todo código novo segue exatamente os padrões dos módulos de referência. Antes de alterar qualquer arquivo, compare com um módulo já pronto.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | NestJS 11 + TypeScript (Express 5) |
| Arquitetura | DDD + Clean Architecture + Hexagonal |
| Projeto de referência | Curso Full Cycle 3 (`FC3-admin-catalogo-de-videos-typescript`) — externo; dentro do repo, a referência são os módulos `musician` e `establishment` |
| ORM / Banco | Prisma 7 + PostgreSQL (único banco; analytics são projeções em tabelas próprias); Redis (cache, rate limit, adapter do Socket.io) |
| Mensageria | RabbitMQ (eventos entre domínios e jobs dos workers de IA) |
| Tempo real | Socket.io (`@nestjs/websockets`) com adapter Redis |
| Auth | Keycloak (multi-tenant, RBAC, social login, JWT) |
| Mídia | AWS SDK v3 sobre MinIO (dev), AWS S3 ou Cloudflare R2 — provider por domínio (`*_STORAGE_PROVIDER`). Não há FFmpeg no processo Node nem HLS |
| Qualidade | ESLint + Prettier, Jest, Swagger, class-validator, class-transformer; Sentry para erros |

**Módulos de referência (copie o padrão deles):** `src/core/musician/` e `src/core/establishment/`.

## Estrutura de um domínio (`src/core/[domain]/`)

```
domain/
  [entity].aggregate.ts        # raiz de agregado: export class [Entity] extends AggregateRoot
  [entity].repository.ts       # interface I[Entity]Repository + SearchParams/SearchResult/Filter
  [entity].validator.ts        # [Entity]ValidatorFactory
  [entity]-fake.builder.ts     # [Entity]FakeBuilder (para testes)
  value-objects/               # VOs do domínio
  events/                      # eventos de domínio
  __tests__/
application/
  use-cases/
    common/                    # outputs e mappers compartilhados
    create-[entity]/ get-[entity]/ list-[entities]/ update-[entity]/ delete-[entity]/
    index.ts
infra/
  db/
    in-memory/                 # repositório em memória (testabilidade — OBRIGATÓRIO)
    prisma/                    # [entity]-model-mapper.ts + [entity]-prisma.repository.ts
index.ts
```

A camada NestJS (controllers/DTOs/DI) vive em `src/nest-modules/[domain]-module/`, separada do core.

## Convenções de nomenclatura

- Raiz de agregado: **sempre** `[entity].aggregate.ts` → `class [Entity] extends AggregateRoot`. (Não usar `.entity.ts` para raízes.)
- ID: `class [Entity]Id extends Uuid`; propriedade `[entity]_id: [Entity]Id`.
- Propriedades de domínio em **snake_case**; colunas Prisma podem ser camelCase — o **mapper reconcilia** os nomes.
- Métodos: `change[Prop]()` / `update[Prop]()`; estado: `activate()`/`deactivate()`/`verify()`; getters computados: `get is[State]()`.
- Repositório: `I[Entity]Repository extends ISearchableRepository<...>`.
- Use case: `[Action][Entity]UseCase implements IUseCase<Input, Output>`.

## Padrões obrigatórios

**Agregado:** construtor com defaults, getter `entity_id`, `static create(command)` que chama `validate()`, `validate(fields?)` via `[Entity]ValidatorFactory`, `static fake()`, `toJSON()`.

**Validação (Notification Pattern):**
1. valida no agregado com `validate(fields?)`;
2. no use case, checa `entity.notification.hasErrors()`;
3. lança `EntityValidationError(entity.notification.toJSON())`.

**Mapper Prisma:** `toModel(entity)` e `toEntity(model)`; em erro de carga, lança `LoadEntityError`. Status de domínio (string/VO) é casteado para o enum Prisma correspondente.

**VOs compartilhados disponíveis** (`src/core/shared/domain/value-objects/`): `Uuid`, `Email`, `Phone`, `QRCode`, `Rating`, `Address`, `Location`, `CNPJ`, `CPF`, `Money`, `PriceRange`, `OperatingHours`, `SocialLinks`, `ExternalUrl`, `StageTechSpec`, `ChordSymbol`, entre outros. Confira a pasta antes de criar um VO novo.

**Envelope HTTP:** o `WrapperDataInterceptor` global (`src/nest-modules/shared-module/interceptors/wrapper-data/`) embrulha toda resposta em `{ data: ... }`; o wrap é pulado quando o body é falsy ou já contém a chave `meta` (listas paginadas do CollectionPresenter já saem como `{ data, meta }`). **Todo cliente HTTP (mobile/web) deve ler `data.data`** — nunca o body cru.

## Banco de dados (Prisma)

- Status de **máquina de estado de domínio** usam enums Prisma (lista completa em `prisma/schema.prisma`), por exemplo `EventStatus`, `BookingStatus`, `InquiryStatus`, `ContractStatus`, `TipStatus`, `TransactionStatus`, `BookingEscrowStatus`, `MusicRequestStatus`, `RequestBoostStatus`, `SubscriptionStatus`, `PerformanceStatus`.
- Status **operacionais de worker** (ai-audio, ai-cifra, synced-lyrics) permanecem `String` (telemetria evolutiva).
- Gamificação: `UserScore` (tabela `user_scores`) é o **ledger** (fonte de verdade de eventos de pontos); `UserPoints` (tabela `user_points`, `audienceId @unique`) é a **projeção/resumo**.
- Relations financeiras religadas via `@relation`: `Transaction` → Audience/Musician/Band; `MusicianWallet` → Musician.

## Checklist antes de implementar

- [ ] Comparei com `musician`/`establishment`.
- [ ] Estrutura de pastas e nomenclatura idênticas ao padrão.
- [ ] Agregado com regras de negócio, validação por notification e `toJSON()`.
- [ ] Repositório com filtros/busca; **in-memory + prisma**.
- [ ] Campos do agregado batem com as colunas do Prisma (via mapper).
- [ ] Testes de domínio + fake builder.

## ❌ Nunca

- Criar estrutura divergente dos módulos de referência.
- Usar `.entity.ts` para raiz de agregado.
- Duplicar lógica/fonte de verdade entre agregados.
- Quebrar Clean Architecture/DDD (domínio não depende de infra).
