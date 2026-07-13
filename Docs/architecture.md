# 🏗️ Arquitetura e Padrão de Desenvolvimento — SoundMeet

> **Regra de ouro:** consistência > inovação. Todo código novo segue exatamente os padrões dos módulos de referência. Antes de alterar qualquer arquivo, compare com um módulo já pronto.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | NestJS + TypeScript |
| Arquitetura | DDD + Clean Architecture + Hexagonal |
| Projeto de referência | `FC3-admin-catalogo-de-videos-typescript` (na raiz do monorepo) |
| ORM / Banco | Prisma + PostgreSQL (principal); MongoDB (analytics/logs); Redis (cache/sessão) |
| Mensageria | RabbitMQ (pedidos em tempo real, notificações, pagamentos, gamificação) |
| Auth | Keycloak (multi-tenant, RBAC, social login, JWT) |
| Mídia | AWS S3 + CloudFront; FFmpeg; HLS |
| Qualidade | ESLint + Prettier, Jest, Swagger, class-validator, class-transformer |

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

**VOs compartilhados disponíveis:** `Uuid`, `Email`, `Phone`, `QRCode`, `Rating`, `Address`, `CNPJ`, `CPF`, `Money`, `PriceRange`, `OperatingHours`, `SocialLinks`.

**Envelope HTTP:** o `WrapperDataInterceptor` global (`src/nest-modules/shared-module/interceptors/wrapper-data/`) embrulha toda resposta em `{ data: ... }`; o wrap é pulado quando o body é falsy ou já contém a chave `meta` (listas paginadas do CollectionPresenter já saem como `{ data, meta }`). **Todo cliente HTTP (mobile/web) deve ler `data.data`** — nunca o body cru.

## Banco de dados (Prisma)

- Status de **máquina de estado de domínio** usam enums Prisma: `EventStatus`, `EventMusicianStatus`, `BookingStatus`, `InquiryStatus`, `TipStatus`, `TransactionStatus`, `CurrencyEnum`.
- Status **operacionais de worker** (ai-audio, ai-cifra, synced-lyrics) permanecem `String` (telemetria evolutiva).
- Gamificação: `UserScore` (tabela `user_scores`) é o **ledger** (fonte de verdade de eventos de pontos); `UserPoints` (tabela `user_points`, `audienceId @unique`) é a **projeção/resumo**.
- Relations financeiras religadas via `@relation`: `Transaction` → Audience/Musician/Band; `MusicianWallet` → Musician.

## Checklist antes de implementar

- [ ] Comparei com `musician`/`establishment` e com o FC3.
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
