# SoundMeet Backend — instruções para agentes e colaboradores

Plataforma que conecta músicos, público e estabelecimentos em eventos ao vivo: QR code, pedidos de
música, gorjetas PIX, contratação de shows e gamificação. Este repositório é a API (NestJS).

Comece pelo [`CONTRIBUTING.md`](CONTRIBUTING.md) (setup, fluxo de Git, definição de pronto).

> Alguns docs e comentários citam arquivos em `Docs/_privado/` — são internos e não fazem parte do
> repositório. Link quebrado para lá é esperado; o contexto necessário vem na tarefa do Jira.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | NestJS 11 + TypeScript (Express 5) |
| Arquitetura | DDD + Clean Architecture + Hexagonal |
| Banco | Prisma 7 + PostgreSQL (driver adapter obrigatório) |
| Cache | Redis via `@nestjs/cache-manager` 3 + `cache-manager` 7. **TTL em MILISSEGUNDOS** |
| Mensageria | RabbitMQ (`@golevelup/nestjs-rabbitmq` 9) |
| Auth | Keycloak (JWT validado por JWKS em `auth-jwt.verifier.ts`) |
| Mídia | AWS SDK v3 (S3 / Cloudflare R2) |
| Qualidade | ESLint + Prettier, Jest, Swagger, class-validator |

## Documentação

| Doc | Quando usar |
|-----|-------------|
| `Docs/arquitetura/padrao-ddd-e-estrutura-de-pastas.md` | Criar ou alterar qualquer código |
| `Docs/regras-de-negocio/` | Ver o que já existe (`[x]` feito / `[~]` parcial / `[ ]` pendente) **antes** de assumir — um arquivo por domínio |
| `Docs/autenticacao/` | Keycloak (realm, clients, claims), como proteger uma rota, fluxos de login e usuários de teste |
| `Docs/fluxo-de-trabalho/git-branches-e-commits.md` | Branches e commits |
| `Docs/README.md` | Índice completo e o mapa dos nomes antigos de arquivo |

---

## Regras de ouro

- Consistência > inovação. Compare com os módulos de referência antes de alterar.
- Nunca criar estrutura divergente de `src/core/musician/` e `src/core/establishment/`.
- Raiz de agregado é sempre `.aggregate.ts`, nunca `.entity.ts`.
- Domínio não depende de infra.
- Nunca commitar `.env`, segredos, `node_modules`.
- Diff mínimo: não refatorar código fora da tarefa.
- Não implementar nada fora do escopo da tarefa do Jira sem combinar antes.
- Agente de IA: **não commita nem faz push** sem pedido explícito; nunca force push.

## Módulos de referência

- Domínio: `src/core/musician/`, `src/core/establishment/`
- NestJS: `src/nest-modules/musicians-module/`, `src/nest-modules/establishments-module/`

## Estrutura de domínio (`src/core/[domain]/`)

```
domain/
  [entity].aggregate.ts          # export class [Entity] extends AggregateRoot
  [entity].repository.ts         # interface I[Entity]Repository + SearchParams/SearchResult/Filter
  [entity].validator.ts          # [Entity]ValidatorFactory
  [entity]-fake.builder.ts       # fake builder para testes
  value-objects/  events/  __tests__/
application/
  use-cases/  (common/, create-*/, get-*/, list-*/, update-*/, delete-*/, index.ts)
infra/
  db/in-memory/                  # OBRIGATÓRIO
  db/prisma/                     # [entity]-model-mapper.ts + [entity]-prisma.repository.ts
index.ts
```

## Convenções

- **Agregado:** `class [Entity]Id extends Uuid`; construtor com defaults → `static create(command)` →
  `validate()` → `notification.hasErrors()` → `EntityValidationError`. Métodos `change*`/`update*`,
  estado `activate`/`deactivate`/`verify`. Propriedades em **snake_case**; o mapper reconcilia com o
  camelCase do Prisma. `static fake()` e `toJSON()` obrigatórios.
- **Repositório:** sempre três — interface em `domain/`, in-memory, Prisma.
- **Mapper Prisma:** `toModel` / `toEntity`; erro de carga → `LoadEntityError`.
- **VOs compartilhados:** `Uuid` · `Email` · `Phone` · `QRCode` · `Rating` · `Address` · `CNPJ` ·
  `Money` · `PriceRange` · `OperatingHours` · `SocialLinks` · `ChordSymbol`.
- **Módulo NestJS:** `[domain].module.ts`, controller fino, `providers.ts` com tokens, `presenter.ts`,
  `dto/`, `__tests__/`, `testing/`. Prefixo global `api/v1`. Swagger em todo endpoint. DTO é classe
  com class-validator. ValidationPipe responde **422**. Regra de negócio fica no `core`, nunca no
  controller ou no DTO.
- **Prisma:** status de máquina de estado = enum; status de worker = `String`. Após mudar o schema,
  `npm run prisma:generate`. Nunca alterar tipo de coluna direto: coluna nova, backfill, remoção em
  migration separada. Migrations usam o nome do `@@map`, não o do modelo.
- **RabbitMQ:** `[domain].dispatcher.ts` publica, `[domain].consumers.ts` consome (idempotente,
  delega a use case), config em `rabbitmq/[domain].rabbitmq.ts`.

---

## Armadilhas técnicas — leia antes de mexer na área

Cada uma já quebrou algo em silêncio, sem erro de compilação nem teste vermelho.

- **Rota nasce FECHADA.** O `AuthGuard` é global; rota anônima exige `@Public()` e entrada na
  allowlist de `__tests__/route-auth-coverage.spec.ts`, com motivo. Rotas `internal/` de worker usam
  `@Public()` **e** `@UseGuards(InternalTokenGuard)` **e** `@InternalToken({...})` — sem o último o
  guard libera tudo.
- **`forbidNonWhitelisted` está ligado.** Campo sem decorator no DTO = 422. `implements` não herda
  validação (só `extends` de classe). A config do pipe é uma só: `GLOBAL_VALIDATION_PIPE_OPTIONS`.
  O `.swcrc` tem `useDefineForClassFields: false` de propósito — não remova.
- **Erro que a UI precisa distinguir herda de um `DomainError` conhecido** pelo
  `GlobalExceptionFilter` (`NotFoundError`, `ConflictError`, `InvalidOperationError`…). `extends Error`
  vira 500 em silêncio.
- **`SearchParams.filter` exige override na subclasse.** Sem o `protected set filter`, o filtro some
  e o repositório devolve dados de **todos** os usuários.
- **`ClassValidatorFields.validate`: `fields` vira `groups`.** Passe `[]` quando não houver campos.
- **Dinheiro é `Money`, em centavos inteiros.** Nunca some/subtraia reais em float. Repartir entre
  pessoas é `allocate(n)`, não `divide`.
- **Sub-recurso usa `:<recurso>_id`, nunca `:id`.** O `MusicianOwnershipGuard` lê `id` primeiro e
  dá 403 no dono legítimo. O guard prova quem é o usuário, nunca de quem é o sub-recurso: a posse do
  filho é checada no use-case.
- **Identidade:** `musician_id` e `audience_id` == `sub` do Keycloak. Estabelecimento e banda têm
  UUID próprio e são autorizados pelos claims `establishment_ids` / `band_ids`.
- **Ordem de rota:** `@Get(":id")` depois das rotas literais; entre controllers, a ordem no array
  `controllers` do módulo também conta.
- **Índices e CHECKs fora do Prisma** (ex.: `performances_one_live_per_event_musician`,
  `conversations_exactly_one_negotiation`): se um `migrate dev` gerar `DROP` deles, remova o DROP.
- **`X-Forwarded-For` nunca entra em chave de rate limit.**
- **URL externa só com allowlist** (`shared/domain/value-objects/external-url.vo.ts`).
- **Upload:** o tipo vem dos magic bytes (`detect-file-mime.ts`), nunca do header do cliente.
- **Dockerfile:** `RUN ln -s ./dist ./src` é o que faz a imagem subir. Não apague.
- **"Hoje" é o dia da casa, nunca o do servidor** (que roda em UTC). Regra com "por dia" usa
  `localDayWindow` + o fuso da casa (`Establishment.venueTimezone()` / `resolveVenueTimezone`);
  `setHours(0, 0, 0, 0)` é bug. Horário de show exibido também vai no fuso da casa.
- **E-mail só muda no clique do link.** `requestEmailChange` não altera o agregado; quem troca banco
  e login (Keycloak) é o `VerifyEmailService`.
- **O container `soundmeet-app` roda imagem buildada:** mudou código, rebuild.

## Testes

| Sufixo | Tipo | Comando |
|--------|------|---------|
| `.spec.ts` | Unitário | `npm test` |
| `.int-spec.ts` | Integração (controller + in-memory) | `npm test` (o mesmo comando roda os dois) |
| `test/**/*.e2e-spec.ts` | E2E com **Postgres real** | `npm run test:e2e` (só estes) |

Fake builders (`Entity.fake()`), testes de domínio em `domain/__tests__/`, fixtures em
`[module]/testing/`. Use case novo exige testes de domínio. Teste de regressão deve ser exercitado
contra o caso negativo: se ele não falha sem a correção, não é teste.

`prisma/seed.ts` fica fora do `tsconfig.json`: verifique com `npx tsc -p tsconfig.seedcheck.json`.

## Seed e usuários de teste

`npx prisma migrate deploy` e depois `npm run seed -- --reset`. Senha de todos os usuários de
teste: `Seed@123` (lista em `Docs/autenticacao/usuarios-de-teste.md`). Toda data do seed é relativa ao momento em que
ele roda; dado "vencido" se renova com `--reset`. Nunca use dado real em desenvolvimento.

## O que não está neste repositório

- O **worker de IA** (análise de cifra e separação de stems) é um serviço à parte. Os serviços do
  `docker-compose.yml` que o constroem não sobem sem ele — trabalhe com os demais.
- **Produção:** segredos, deploy e servidor ficam só com o fundador.

## Git

Branch por tarefa a partir de `develop`: `feature/<JIRA-ID>-nome` ou `bugfix/<JIRA-ID>-nome`.
Commits em Conventional Commits: `type(scope): description` (tipos e escopos em
`Docs/fluxo-de-trabalho/git-branches-e-commits.md`). PR para `develop` com CI verde e aprovação do fundador.

---

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
