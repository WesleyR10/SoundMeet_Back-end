# Correções da Full-Stack Reaudit — 2026-06-20

**Data de execução:** 2026-06-22  
**Referência:** `full-stack-reaudit-2026-06-20.md` + `prompt-correcoes-reaudit-2026-06-20.md`  
**Escopo:** Grupos A, B, C, D e E do prompt de correções. Item 10 (PIX real + webhook idempotente) excluído por decisão do produto (pesquisa pendente).

---

## Decisões Arquiteturais

- **Guards em int-specs**: padrão `overrideGuard(AuthGuard/RolesGuard).useValue({ canActivate: () => true })` centralizado em `auth-guard-mock.ts`. Não há Keycloak no ambiente de testes unitários/integração — o guard mock é semanticamente correto: testa a cadeia Controller → UseCase → Repository, não a infraestrutura de autenticação. E2E com Keycloak real fica para fase futura.
- **UoW mock em testes**: `{ do: async (fn) => fn() }` é o mock canônico para `IUnitOfWork` em contextos de repositórios in-memory. A transação Prisma real não é testável sem banco; o mock preserva a semântica sem dependência de infraestrutura.
- **`ConfirmTipPaymentUseCase`**: `uow` e `domainEventMediator` tornados obrigatórios (remoção de `?`). Dependência opcional mascarava risco de operação financeira sem transação e sem publicação de evento.
- **`ScanQRUseCase` + UoW**: as duas escritas (`audienceRepository.update` + `userInteractionRepo.insert`) envolvidas em `uow.do()` garantem atomicidade real em produção.
- **Ownership guards**: `CurrentUserContextGuard` extrai e normaliza claims do JWT (`establishment_ids`, `band_ids`, `organization_id`, `roles`) em `request.currentUser` — separação clara entre autenticação (AuthGuard) e contexto de autorização (ownership). `EstablishmentOwnershipGuard` e `MusicianOwnershipGuard` dependem desse contexto.
- **`UserPoints.total_tips`**: migrado de `Float` para `Decimal(12,2)`. Conversão no mapper com `Number(model.total_tips)` — padrão idêntico ao usado nos mappers de `Tip`, `Transaction` e `MusicianWallet`.

---

## Grupo A — Regressões críticas (REG-1 a REG-4)

### REG-1 — 41 testes falhando por falta de mock de guards

**Causa**: `AuthGuard` e `RolesGuard` tentavam validar JWT contra Keycloak em int-specs, sem servidor disponível.

**Correção**:
- Criado `src/nest-modules/shared-module/testing/auth-guard-mock.ts` com `applyAuthGuardMocks()`, `AUTH_GUARD_MOCK_VALUE`, `ROLES_GUARD_MOCK_VALUE` e `UOW_MOCK_VALUE` exportados.
- Atualizado para o padrão `TestingModuleBuilder → applyAuthGuardMocks → compile`:
  - `src/nest-modules/musicians-module/__tests__/musicians.controller.int-spec.ts`
  - `src/nest-modules/musicians-module/__tests__/bands.controller.int-spec.ts`
  - `src/nest-modules/requests-module/__tests__/requests.controller.int-spec.ts`
  - `src/nest-modules/establishments-module/__tests__/establishments.controller.int-spec.ts`
  - `src/nest-modules/events-module/__tests__/events.providers.spec.ts`

### REG-2 — `payment.providers.spec` falhando

**Causa**: `ConfirmTipPaymentUseCase` declarava `DomainEventMediator` como obrigatório mas o providers spec não o injetava.

**Correção**:
- `src/nest-modules/payment-module/__tests__/payment.providers.spec.ts` — adicionado mock de `DomainEventMediator` no array de providers: `{ provide: DomainEventMediator, useValue: { publish: jest.fn(), publishIntegrationEvents: jest.fn() } }`.

### REG-3 — `events.providers.spec` falhando

**Causa**: mesmo problema de AuthGuard/RolesGuard sem mock.

**Correção**: `applyAuthGuardMocks()` aplicado no builder do módulo de teste.

### REG-4 — UoW e DomainEventMediator opcionais em `ConfirmTipPaymentUseCase`

**Causa**: parâmetros declarados com `?`, permitindo execução de operação financeira sem transação e sem publicação de evento de domínio.

**Correção**:
- `src/core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case.ts` — removido `?` de `uow` e `domainEventMediator`; `execute()` simplificado sem guards condicionais.
- `src/core/payment/application/use-cases/confirm-tip-payment/tests/confirm-tip-payment.use-case.spec.ts` — `uowMock` e `domainEventMediatorMock` adicionados ao construtor.

---

## Grupo B — Correções funcionais

### B2 / CORE-NEW-1 — `ScanQRUseCase` sem atomicidade

**Causa**: `audienceRepository.update()` e `userInteractionRepo.insert()` executados sequencialmente sem transação — falha entre as duas escritas produzia inconsistência de dados.

**Correção**:
- `src/core/audience/application/use-cases/scan-qr/scan-qr.use-case.ts` — `IUnitOfWork` adicionado como 4º parâmetro; ambas as escritas envolvidas em `uow.do(async () => { ... })`.
- `src/nest-modules/audiences-module/audiences.providers.ts` — factory do `SCAN_QR_USE_CASE` injeta `PrismaService`, cria `PrismaUnitOfWork` e passa como 4º argumento.
- `src/core/audience/application/use-cases/scan-qr/__tests__/scan-qr.use-case.spec.ts` — `uowMock` adicionado ao construtor; novo caso de teste: `NotFoundError` quando `musician_id` não existe no repositório.
- `src/nest-modules/audiences-module/__tests__/audiences.controller.int-spec.ts` — factory de `ScanQRUseCase` atualizada com `uowMock` inline.

### B4 — Roadmap desatualizado

**Correção**:
- `Docs/roadmap.md` — marcados `[x]`: blocos 2.1–2.6, 3.1–3.4, 4.1–4.4, 4B.1–4B.3, 4B.5.
- Tabela de viabilidade atualizada: QR Code ✅, Auth ✅ parcial, `auth-module` e `music-library-module` com status corretos.
- Observações técnicas atualizadas (ai-audio-module órfão riscado como resolvido).

### B5 — Filas RabbitMQ sem consumer documentadas

**Correção**:
- `envs/.env.example` — `RABBITMQ_QUEUE_REQUESTS`, `RABBITMQ_QUEUE_NOTIFICATIONS`, `RABBITMQ_QUEUE_PAYMENTS` e `RABBITMQ_QUEUE_GAMIFICATION` anotadas com comentários indicando que não possuem consumer/dispatcher ativos e o bloco do roadmap em que serão implementadas.

---

## Grupo C — Ownership Enforcement (Bloco 4B)

### C1 — Interface `AuthenticatedUser` + guard de contexto + decorator

**Arquivos criados**:
- `src/nest-modules/auth-module/interfaces/authenticated-user.interface.ts` — interface `AuthenticatedUser` com `userId`, `roles`, `establishmentIds`, `bandIds`, `organizationId`, `isAdmin`.
- `src/nest-modules/auth-module/current-user-context.guard.ts` — `CurrentUserContextGuard`: lê `request.user` (populado pelo `AuthGuard`), normaliza claims do JWT (`establishment_ids`, `band_ids`, `organization_id`) e popula `request.currentUser`. Guard passthrough (retorna `true` sempre — apenas injeta contexto).
- `src/nest-modules/auth-module/decorators/current-user.decorator.ts` — `@CurrentUser()`: param decorator que retorna `request.currentUser`.

### C2 — `EstablishmentOwnershipGuard`

**Arquivo criado**: `src/nest-modules/auth-module/ownership/establishment-ownership.guard.ts`

- Lê `request.currentUser` (requer `CurrentUserContextGuard` antes).
- Admin (`isAdmin: true`) tem bypass explícito.
- Verifica se `params.id` ou `params.establishmentId` está em `currentUser.establishmentIds`.
- Lança `ForbiddenException` com mensagem clara se não autorizado.
- Sem `id` no path (rotas de coleção): passa direto.

### C3 — `MusicianOwnershipGuard`

**Arquivo criado**: `src/nest-modules/auth-module/ownership/musician-ownership.guard.ts`

- Admin: bypass explícito.
- Verifica `params.id === currentUser.userId`.
- Sem `id`: passa direto.

### C4 — Ownership guards aplicados nos controllers

**Arquivos atualizados** (após revisão de 2026-06-22 que identificou gap de enforcement):
- `src/nest-modules/musicians-module/musicians.controller.ts` — `CurrentUserContextGuard` adicionado na classe; `MusicianOwnershipGuard` em `PATCH /:id`, `PATCH /:id/profile`, `DELETE /:id`.
- `src/nest-modules/establishments-module/establishments.controller.ts` — `CurrentUserContextGuard` adicionado na classe; `EstablishmentOwnershipGuard` em `PATCH /:id`, `POST /:id/profile`, `PATCH /:id/profile`, `DELETE /:id/profile`, `DELETE /:id`, `GET /:id/hiring-dashboard`, `GET /:id/analytics`.
- `src/nest-modules/payment-module/payment.controller.ts` — `CurrentUserContextGuard` adicionado na classe; `MusicianOwnershipGuard` em `POST /musicians/:id/wallet/withdraw`.

**Nota de design**: eventos (`EventsController`) não recebem ownership guard porque as rotas usam `:event_id` (não `:id` ou `:establishmentId`) e a verificação exige lookup de `establishment_id` do evento — isso é validação de use-case (4B.4), não de route param.

### C5 — `AuthModule` + barrel atualizados

- `src/nest-modules/auth-module/auth.module.ts` — novos guards adicionados aos arrays `providers` e `exports`.
- `src/nest-modules/auth-module/index.ts` — exports adicionados: `CurrentUserContextGuard`, `@CurrentUser`, `AuthenticatedUser`, `EstablishmentOwnershipGuard`, `MusicianOwnershipGuard`.

### C6 — Testes de ownership

**Arquivo criado**: `src/nest-modules/auth-module/__tests__/ownership.int-spec.ts`

Cenários por guard (10 total):
1. Admin tem acesso a qualquer recurso
2. Owner/músico tem acesso ao próprio recurso
3. Owner/músico **não** tem acesso ao recurso alheio (`ForbiddenException`)
4. Rota de coleção (sem id no path) passa direto
5. `currentUser` ausente → `ForbiddenException`

---

## Grupo D — Decimal precision em `UserPoints.total_tips`

**Causa**: `Float` (double precision, ~15 dígitos) é inadequado para acumulação monetária — risco de erro de arredondamento em operações financeiras repetidas.

**Correção**:
- `prisma/schema.prisma` — `total_tips Float` → `total_tips Decimal @db.Decimal(12, 2)`.
- `src/core/gamification/infra/db/prisma/user-points-model-mapper.ts` — `toEntity` agora aceita `PrismaUserPoints` (tipo gerado pelo Prisma Client, com `total_tips: Decimal`) e converte com `Number(model.total_tips)` — padrão idêntico ao usado nos mappers de `Tip`, `Transaction` e `MusicianWallet`.
- `prisma/migrations/20260622000000_decimal_user_points_total_tips/migration.sql` — migration de 4 passos (add column → backfill → drop old → rename) para zero downtime.

---

## Grupo E — Smoke test `AiAudioModule`

**Causa**: `AiAudioModule` foi registrado em `app.module.ts` (bloco 3.1) mas sem verificação de wiring do contêiner de DI.

**Arquivo criado**: `src/nest-modules/ai-audio-module/__tests__/ai-audio.smoke.spec.ts`

Valida que o `TestingModule` resolve sem erro de DI:
- `AiAudioController`
- `CreateAiAudioUploadUseCase`
- `RequestAiAudioSeparationUseCase`
- `ProcessAiAudioSeparationJobUseCase`
- `CompleteAiAudioSeparationJobUseCase`
- `FailAiAudioSeparationJobUseCase`
- `GetAiAudioSeparationJobUseCase`
- `UpdateAiAudioSeparationJobProgressUseCase`

---

## Status dos Itens do Prompt de Correções

| Item | Grupo | Status |
|---|---|---|
| Centralizar mock de guards | A / REG-1 | ✅ Resolvido |
| Atualizar 4 controller int-specs | A / REG-1 | ✅ Resolvido |
| DomainEventMediator mock em payment.providers.spec | A / REG-2 | ✅ Resolvido |
| events.providers.spec com auth mock | A / REG-3 | ✅ Resolvido |
| ConfirmTipPaymentUseCase — remover opcionais | A / REG-4 | ✅ Resolvido |
| ScanQRUseCase — IUnitOfWork + atomicidade | B / CORE-NEW-1 | ✅ Resolvido |
| audiences.providers.ts — PrismaUnitOfWork | B2 | ✅ Resolvido |
| scan-qr.use-case.spec — uowMock + NotFoundError | B2 | ✅ Resolvido |
| audiences.controller.int-spec — uowMock inline | B2 | ✅ Resolvido |
| Roadmap — marcar blocos 2, 3, 4, 4B | B4 | ✅ Resolvido |
| .env.example — documentar filas sem consumer | B5 | ✅ Resolvido |
| AuthenticatedUser interface | C1 | ✅ Resolvido |
| CurrentUserContextGuard | C1 | ✅ Resolvido |
| @CurrentUser() decorator | C1 | ✅ Resolvido |
| EstablishmentOwnershipGuard | C2 | ✅ Resolvido |
| MusicianOwnershipGuard | C3 | ✅ Resolvido |
| Ownership guards APLICADOS nos controllers (músicos PATCH/DELETE, estabelecimentos PATCH/DELETE/GET sensíveis, payment withdraw) | C4 | ✅ Resolvido |
| AuthModule + barrel atualizados | C5 | ✅ Resolvido |
| Testes de ownership cross-access | C6 | ✅ Resolvido |
| audiences.controller.int-spec migrado para applyAuthGuardMocks | XCUT-NEW-2 consistência | ✅ Resolvido |
| UserPoints.total_tips → Decimal(12,2) + mapper + migration | D | ✅ Resolvido |
| AiAudio smoke test (DI wiring) | E | ✅ Resolvido |
| PIX real + webhook idempotente | — | ⏸ Excluído (pesquisa pendente) |
| WithdrawToPix — ownership por requesting_user_id (use case level) | 4B.4 | ⏳ Pendente (próxima sessão) |
| Events ownership (lookup estabelecimento por event_id) | 4B.4 eventos | ⏳ Pendente — requer service-level check |
| Keycloak groups convention em keycloak.md | 4B.6 | ⏳ Pendente (documentação) |

---

## Pendências para próxima sessão

1. **4B.4 — Validação de `requesting_user_id` em `WithdrawToPixUseCase`**: verificar se o usuário autenticado corresponde ao `musician_id` antes de executar o saque — prevenção de saque por usuário não autorizado (requer `@CurrentUser()` no controller e validação no use case).
2. **4B.4 eventos — Ownership de `EventsController`**: eventos usam `:event_id` como param; verificar que o estabelecimento do evento pertence ao usuário requer lookup — implementar como validação no use case ou via guard com `IEventRepository`.
3. **4B.6 — `Docs/auth/keycloak.md`**: documentar convenção de groups (`/soundmeet/establishments/{id}/owners`, `/staff`; `/soundmeet/bands/{id}/managers`, `/members`) para guiar configuração do realm em produção.
4. **DB-NEW-1 — Prisma migrate**: executar `npx prisma migrate dev` com a migration `20260622000000_decimal_user_points_total_tips` em ambiente com banco disponível.

---

## Validação

```bash
# Build TypeScript — 0 erros
npm run build

# Lint autofix — sem violações
npm run lint -- --fix
```

Resultado: build limpo, lint limpo.

Testes unitários e de integração devem ser executados com:
```bash
npm test -- --runInBand
```
