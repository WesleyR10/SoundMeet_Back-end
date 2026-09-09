# Roadmap Web + Próximos Passos — SoundMeet

> Documento gerado em **06/ago/2026** a partir de uma auditoria completa cruzando os 4 docs
> canônicos do backend, os 4 do mobile e o **código real** dos dois projetos.
> Substitui as suposições de estado que estavam espalhadas em `CLAUDE.md` e `roadmap.md` —
> várias estavam desatualizadas (ver §2).
>
> Decisões tomadas com o usuário nesta sessão:
> 1. **Destravar o backend primeiro, depois o web.**
> 2. **Escopo do web v1 = completo** (conta/perfil/cardápio/horários · eventos · contratação+chat · analytics/campanhas/assinatura).
> 3. **Stack:** Next.js + Tailwind + Aceternity **como ponto de partida, não como destino** — direção visual autoral, ousada, sem cara de template gerado por IA.
> 4. **Gorjeta PIX é Mercado Pago** (músico vincula a conta no app). O web do estabelecimento não
>    tem — e não deve ter — UI de vínculo MP.

---

## 1. Diagnóstico — onde o SoundMeet realmente está

| Camada | Estado real | Evidência |
|---|---|---|
| **Backend** | 24 módulos de feature em `app.module.ts`, **31 controllers**, ~2.700 testes, 20 domínios DDD. Auth Keycloak (JWKS + ownership guards + throttler), RabbitMQ, Redis, WebSocket com Redis adapter, S3/R2, Asaas (saque **e** assinatura), Google Calendar sync, pipeline de IA de cifra com modelo próprio. **Maduro.** | `src/nest-modules/`, `src/main.ts` |
| **Mobile** | **~36.200 linhas**, **47 telas** em 6 slices. Músico completo (perfil, QR, pedidos ao vivo, carteira, analytics, repertório, Play Mode, afinador, agenda, chat, banda, cifra pessoal + comunidade) + MVP público completo (scanner, explorar, pedido, gorjeta, gamificação) + multi-role. | `soundmeet-mobile/src/` |
| **Web** | **Não existe.** Zero código. Nenhum `next.config`/`vite.config` no monorepo. | — |
| **Estabelecimento** | Backend ~90% pronto. **UI: zero, em qualquer plataforma.** | `RootNavigator.tsx`: *"estabelecimento é web-only"* |

**Leitura franca:** o produto tem duas das três pernas construídas em profundidade e a terceira
(estabelecimento) só existe como API. A intuição de que "agora é a hora do web" está **certa** —
mas o backend do estabelecimento tem três buracos que impedem o dashboard de sequer ter usuários.

---

## 2. ⚠️ Correções de documentação — não confie nos docs antes de ler isto

Encontrei afirmações **ativamente erradas** nos docs canônicos. Se você (ou um agente) planejar em
cima delas, vai reimplementar coisa que já existe ou pular coisa que não existe.

| Doc diz | Realidade no código |
|---|---|
| `CLAUDE.md` + `roadmap.md` + `roadmap-mobile.md`: *"`plans-module` não tem controller HTTP / sem endpoint de checkout"* | **Falso.** `src/nest-modules/plans-module/plans.controller.ts` existe com 7 rotas: `GET /plans` (`@Public`), `GET/POST/DELETE /musicians/:id/subscription[/checkout]` e **`GET/POST/DELETE /establishments/:id/subscription[/checkout]`**. Gateway real: `AsaasSubscriptionGateway` (`POST /v3/subscriptions`, fatura hospedada — não coleta cartão). |
| `CLAUDE.md`: *"Bandas: backend 100% pronto mas **zero UI no mobile**"* | **Falso.** `MyBandsScreen.tsx` + `BandDetailScreen.tsx` existem (commit `0cf1138`). O gap real é mais estreito: o adapter `band.api.ts` **não cobre `POST /bands`** (criar), `DELETE /bands/:id` (dissolver) nem `PATCH /bands/:id/leadership`. Ou seja: o músico entra numa banda pelo app, mas **não consegue criar uma**. |
| `plans/musician-plans.md` §"Features pendentes": Repertório, Play Mode, enforcement de analytics/split/saque como *"Pendente"* | **Falso** — todos concluídos (Blocos 4C/4D). Essa tabela ficou congelada em jun/2026. |
| `roadmap.md` linha 251/258/262/424 apontava para `roadmap-frontend.md` | **Arquivo nunca existiu** — eram 4 links quebrados. ✅ Repontados para este documento em 06/ago/2026, e o texto de cada um foi reescrito para dizer a verdade (o afinador está pronto no mobile; o formulário de horários não existe em plataforma nenhuma). |
| `business-rules.md`: *"Planos de assinatura … ainda não há agregados de plano, cobrança recorrente ou pricing"* | **Falso.** `src/core/plans/` completo: `Subscription` aggregate, `BillingCycle`, `PlanCheckService`, `plan-features.config.ts`, repositório Prisma, 5 use-cases. |

Mais dois achados durante a própria execução das correções (06/ago/2026):

| Doc diz | Realidade no código |
|---|---|
| `CLAUDE.md:251` (raiz): *"Ownership incompleto: `POST /requests/:id/feedback` sem checagem…, `GET /requests/:id` sem scoping a participantes, `GET /campaigns` sem guard"* | **Os três já foram corrigidos** (commits `a98c6f4`, `4f73a0d`). Hoje o feedback usa `currentUser.userId`, os GETs usam `resolveParticipantIds(currentUser)` e as campanhas recebem `requesting_establishment_id`. Item removido. |
| `soundmeet-mobile/CLAUDE.md:392`: *"`MyRequestsScreen` — desabilitado, backend ainda não expõe o endpoint"* | **Falso.** `GET /requests/audiences/:audience_id` existe (`requests.controller.ts:204`, backend 7.12, jul/2026). A tela está desabilitada sem motivo técnico. Virou a tarefa mobile 11.14f. |

> ✅ **Status:** as 7 correções foram aplicadas em 06/ago/2026, junto com as tabelas congeladas de
> `plans/musician-plans.md` e `plans/establishment-plans.md` e os 4 links quebrados de `roadmap.md`.
> As duas tarefas de mobile que a auditoria destravou foram registradas como **11.14** (checkout de
> assinatura real) e **11.15** (criar banda pelo app) em `roadmap-mobile.md`.

---

## 3. Os três bloqueios reais do dashboard web

Verificados linha a linha no código, não inferidos dos docs.

### 🔴 B1 — Um estabelecimento não consegue criar conta. De jeito nenhum.

```ts
// src/core/auth/application/use-cases/register/register.input.ts:12
export type RegisterRole = "musician" | "audience";

// src/core/auth/application/use-cases/add-role/add-role.input.ts:1
export type AddRoleRole = "musician" | "audience";
```

E `POST /establishments` é `@Roles("establishment", "admin")` — ou seja, **você já precisa ter a
role `establishment` para criar um estabelecimento.** Ovo e galinha fechado.

**A boa notícia:** falta pouco. Tudo o mais já está no lugar:
- A role `establishment` (e `establishment_owner`/`establishment_staff`) já existe no `realm-soundmeet.json`.
- `CreateEstablishmentUseCase` **já escreve o claim** `establishment_ids` no usuário Keycloak
  (`identityClaims.addClaimValue`, linha 73) — que é exatamente o que o `EstablishmentOwnershipGuard`
  lê (`currentUser.establishmentIds.includes(...)`).
- O client Keycloak `soundmeet-web` já existe: `publicClient`, PKCE S256, redirects
  `localhost:3000/*`, `localhost:3001/*`, `https://soundmeet.com.br/*`.
- O CORS do backend já libera `localhost:3000`, `3001`, `8080` e `FRONTEND_URL`.

**O que falta é só:** aceitar `role: "establishment"` no `RegisterUseCase` (+ `AddRoleUseCase`) e,
no mesmo fluxo transacional, criar o aggregate `Establishment` com o claim já ligado.

> ⚠️ **Diferença de invariante que NÃO pode ser copiada do músico.** Para músico e público vale
> `aggregate.id === sub` do Keycloak. Para estabelecimento **não vale** — um usuário pode ter N
> estabelecimentos, e a posse é resolvida pelo claim `establishment_ids`, não pelo `sub`.
> O registro de estabelecimento **não é** o `RegisterUseCase` com um `if` a mais; é um fluxo irmão.

### 🔴 B2 — Não existe nenhuma listagem de contratações

`src/core/scheduling/application/use-cases/` tem `propose-booking`, `confirm-booking`,
`cancel-booking`, `create-inquiry`, `accept-inquiry`, `reject-inquiry`,
`convert-inquiry-to-booking`… e **nenhum `list-bookings`, `get-booking`, `list-inquiries`**.

Consequência prática: **o estabelecimento propõe uma reserva e nunca mais consegue vê-la.**
O músico também não. As únicas leituras de agenda são `GET /scheduling/calendar/free-busy` e
`month-slots`, ambas `@Public()` e agregadas (ocupado/livre) — sem identidade, sem status, sem valor.

Isso bloqueia, simultaneamente:
- todo o funil de contratação do dashboard web;
- o card **"Próximo Show"** da Home do músico (hoje é placeholder — o próprio `roadmap-mobile.md`
  10.3 registra: *"sem GET/listagem de booking confirmado no scheduling-module"*);
- a tela de agenda do mobile, que hoje deriva shows do free-busy (perde status e cachê).

**É o item de maior alavancagem do projeto inteiro agora.** Um único trabalho de backend
destrava web + duas telas do mobile.

### 🔴 B3 — Reputação não entra no sistema

`musician.addRating()` e `establishment.addRating(value, ratedBy, comment)` existem nos agregados,
com evento de domínio e tudo. **Nenhum controller expõe rota de rating** (`grep ratings` em
`*.controller.ts` → vazio).

Ou seja: o `rating`/`total_ratings` que a busca de músicos ordena, que o `hiring-dashboard` mostra
e que o app exibe **nunca sobe de zero em produção**, porque não há caminho de escrita.
`features-debate.md` marcou isso como P1 há dois meses.

---

## 4. Bloco 9 — Destravar o backend (fazer ANTES do web)

Ordem de execução. Estimativa realista para dev solo: **8 a 12 dias**.

### 9.1 — Cadastro e identidade do estabelecimento — 🟡 parcial (a/b/e feitos em 06/ago/2026)

- [x] **9.1a** `RegisterEstablishmentUseCase` (`src/core/auth/application/use-cases/register-establishment/`)
      — irmão de `RegisterUseCase`, **não** um `if` dentro dele. Fluxo: checagem local de e-mail/CNPJ →
      cria usuário Keycloak → `assignRealmRole("establishment")` → cria `Establishment` **com UUID
      próprio** → `addClaimValue("establishment_ids", <uuid>)` → insert → token de verificação de
      e-mail (best-effort) → Direct Access Grant.
  - **Duplicidade é checada ANTES de tocar o Keycloak** — 409 limpo, sem usuário órfão e sem depender
    de compensação (precedente do CPF no `RegisterUseCase`). Exigiu `findByCnpj` novo em
    `IEstablishmentRepository` + Prisma + in-memory: a coluna já era `@unique`, mas sem o método a
    violação só apareceria como erro cru do Postgres, depois de já ter criado a conta.
  - **Claim escrito ANTES do insert**, mesma ordem (e mesmo motivo) do `CreateEstablishmentUseCase`:
    falhar antes não deixa nada criado. A ordem inversa deixaria um estabelecimento no Postgres que o
    dono nunca conseguiria operar — o pior estado possível, porque **parece sucesso**.
  - **Falha do login automático NÃO compensa.** Conta e agregado já commitados; destruí-los por falha
    de autenticação é pior que pedir login manual.
  - ⚠️ **Correção de premissa:** este roadmap dizia que o aggregate exige `address`. **Não exige** —
    `Establishment.create` valida só `name`/`email`/`establishment_type`; endereço vive em
    `EstablishmentProfile`. Por isso o cadastro **não** pede endereço nem CNPJ (opcional — exigir
    barraria MEI/bar em processo de abertura).
  - `IdentityRealmRole` e `EmailVerificationSubjectType` ganharam `"establishment"`. `assignRealmRole`
    já era genérico (resolve por nome em `GET /roles/{name}`) e a role já existia no realm. O lado de
    **consumo** do token de e-mail (`VerifyEmailService.verify`/`findByToken`/`confirmEmail`) já
    tratava os três tipos desde sempre — só a **emissão** estava restrita, então a conta de
    estabelecimento nunca receberia e-mail de verificação. Corrigido.
- [x] **9.1b** `POST /auth/register-establishment` (`@Public()`, `@Throttle(5/60s)`) + `RegisterEstablishmentDto`.
      Obrigatórios: `name`, `email`, `password`, `phone`, `establishment_type`. Opcionais: `cnpj`,
      `description`, `website`, `owner_name` (nome da pessoa que administra — vai para a conta do
      Keycloak; `Establishment.name` continua sendo o do local).
      Output: tokens + `establishment_id` + **`needs_token_refresh: true`**.
  - ⚠️ **O cliente precisa fazer refresh antes da primeira chamada protegida.** O claim só entra no
    **próximo** token; usar o `access_token` do registro numa rota com `EstablishmentOwnershipGuard`
    dá **403**. O campo `needs_token_refresh` existe para o front não depender de conhecer essa regra.
- [ ] **9.1c** `AddRoleUseCase` aceita `"establishment"` — músico que também é dono de bar.
      **Não é um `if` a mais:** diferente de músico/público, o agregado precisa de dados próprios
      (nome do local, telefone, tipo), então o input de `add-role` não serve. Na prática é "registrar
      estabelecimento para uma conta que já existe" — reusar `RegisterEstablishmentUseCase` sem a
      etapa de `createUser`.
- [ ] **9.1d** Convite de equipe: `POST /establishments/:id/members` — adiciona um segundo usuário ao
      claim `establishment_ids` com role `establishment_staff`. *(Pode ficar para o v1.1 — decidir.)*
- [x] **9.1e** Testes: **19 unitários** (happy path · role atribuída · **id ≠ sub** · claim escrito ·
      e-mail de verificação · `owner_name` vs. nome do local · e-mail e CNPJ duplicados, com e sem
      máscara · CNPJ malformado deferido ao agregado · 6 cenários de compensação, incluindo falha da
      própria compensação e o caso em que **não** se deve compensar) · **4 de integração** no
      `register.controller.int-spec.ts` · **3 de regressão** em `ownership.int-spec.ts` fechando o
      ciclo: token do registro → 403, token pós-refresh → 200, e o `sub` **não** autoriza.
      Suíte completa: **321 suítes / 2765 testes** ✅ (baseline anterior 321/2762)

> 💡 O front precisa fazer **refresh silencioso do token** logo após o registro — o claim
> `establishment_ids` só entra no JWT no próximo token. Mesmo padrão do `POST /auth/add-role` no mobile.

### 9.2 — Leitura de agenda e contratações — ✅ concluído em 07/ago/2026

> **Descoberta ao ler o código antes de implementar:** o repositório já estava **inteiro** —
> `BookingSearchParams`/`InquirySearchParams` **já tinham** o override de `protected set filter`, e
> `search()`/`buildWhereClause()`/`applyFilter()` já existiam nos quatro repositórios. A armadilha do
> `CLAUDE.md` não se aplicava aqui. Faltava só a camada de aplicação e a HTTP — bem menos do que o
> plano supunha.

- [x] **9.2a** `participant_ids` novo em `BookingFilter`/`InquiryFilter`, tratado no override de
      `filter` e traduzido em **OR** nos quatro repositórios (Prisma + in-memory × booking + inquiry).
  - **Por que campo de filtro e não um `findByParticipant`** (precedente do
    `ConversationPrismaRepository`): aquele método devolve tudo, sem paginação nem filtros. O
    dashboard precisa de `status`, janela de datas e paginação — como campo de filtro tudo isso vem
    de graça pelo `search()` já existente, e o escopo entra em **AND** com o refino.
  - ⚠️ **É ARRAY**, então **não** pode passar pela coerção `${...}` que o override aplica aos
    escalares — viraria `"id-a,id-b"` e não casaria com nada.
  - ⚠️ **Array vazio é preservado de propósito** e vira condição impossível (`where.id = { in: [] }`).
    Descartá-lo faria o `where` sair sem escopo e devolver a agenda de **todos os usuários** — é
    exatamente o vazamento que já aconteceu em `repertoire`/`transaction`/`musician-wallet`.
- [x] **9.2b** `GET /scheduling/bookings` — escopo **sempre** do `@CurrentUser()` via
      `resolveParticipantIds()` (`sub` + `establishment_ids` + `band_ids`). Duas camadas impedem
      forjar escopo pela query: `whitelist: true` no ValidationPipe global remove os campos, e a
      atribuição explícita vem **depois** do spread de `...query`.
- [x] **9.2c** `GET /scheduling/bookings/:id` com `assertNegotiationViewer` — função **nova**, irmã de
      `assertNegotiationParticipant`.
  - **Distinção arquitetural deliberada:** *ver* a agenda da banda é direito de todo integrante;
    *decidir* por ela (confirmar/cancelar) é do líder. Reusar `assertNegotiationParticipant` na
    leitura daria **403 no integrante tentando abrir o próprio show**, porque ela falha fechada sem
    `bandRepo`.
- [x] **9.2d** `ListInquiriesUseCase` + `GET /scheduling/inquiries` — caixa de entrada dos dois lados.
- [x] **9.2e** **44 testes novos**: escopo cruzado (A não vê booking de B) · integrante vê o show da
      banda · `status` em AND com o escopo · pedir `establishment_id` alheio devolve zero ·
      **fail-closed** (ator sem identidade → 403, nunca lista aberta) · admin e job interno ·
      paginação · tentativa de forjar escopo pela query · e um spec dedicado ao **caminho Prisma**
      (`scheduling-participant-scope.spec.ts`), porque os use-cases rodam contra in-memory e foi
      exatamente assim que o bug do `findByParticipant` do chat passou despercebido em produção.
      Suíte: **326 suítes / 2812 testes** ✅
- **Destrava:** dashboard web inteiro · `NextShowCard` da Home do músico · `AgendaScreen` com
  status/cachê reais (hoje deriva do free-busy e perde os dois).
- **Pendente, não bloqueante:** `GET /scheduling/inquiries/:id`. A listagem já devolve o registro
  completo, então o detalhe é conveniência, não dependência.

### 9.3 — Reputação — ✅ concluído em 07/ago/2026

> **Achado que mudou o desenho da tarefa.** O plano dizia "falta só a rota HTTP, o domínio está
> pronto". Ao ler o código: `rating`/`total_ratings` nos dois agregados são **apenas contadores**
> (média incremental, sem autor), **não existe tabela de avaliações**, e `EstablishmentRatedEvent`
> é **evento morto** — ninguém escuta. Com esse modelo, 9.3c e 9.3d eram **impossíveis**, e uma rota
> solta permitiria a mesma pessoa postar cem vezes e definir a média que ordena a busca do
> dashboard de contratação.
>
> **Solução:** aplicar o par que o projeto já usa em gamificação — `UserScore` (ledger, fonte de
> verdade) × `UserPoints` (projeção). Nasce o domínio `src/core/review/` com a tabela `reviews` como
> ledger; `rating`/`total_ratings` continuam existindo, mas viram **projeção derivada**.

- [x] **9.3a/9.3b** `SubmitReviewUseCase` + `POST /musicians/:id/ratings` e
      `POST /establishments/:id/ratings` (módulo novo `reviews-module`).
  - **Um use-case para os dois alvos**, não dois quase idênticos: a única diferença é qual agregado
    recebe a projeção; a regra que importa (vínculo, unicidade, recálculo) é a mesma e divergiria na
    primeira mudança.
  - **`reviews-module` é nó-folha orquestrador** (precedente `musician-analytics-module`): avaliar
    cruza 4 contextos (ledger + scheduling + events + musician/establishment). Dentro de
    `MusiciansModule` criaria ciclo estático de import, que quebra no carregamento antes da DI.
  - **O autor NUNCA vem do corpo** (`review-author.resolver.ts`) — aceitá-lo seria o caminho mais
    barato para inflar ou destruir a nota de um perfil. ⚠️ E o `author_id` do estabelecimento **não é
    o `sub`**: vem do claim `establishment_ids`, com `author_establishment_id` exigido quando a conta
    opera mais de uma unidade (adivinhar seria escolher errado em silêncio).
- [x] **9.3c** **Regra fechada: só avalia quem tem vínculo comprovado.**
  - Público → precisa de `EventAttendee` **e** o alvo precisa estar ligado àquele evento
    (`EventMusician` para músico, `event.establishment_id` para local). ⚠️ **Só presença não basta** —
    permitiria avaliar qualquer músico do país usando um evento assistido.
  - Músico ↔ estabelecimento → `Booking` com status **`COMPLETED`**. Confirmado não conta: além de
    não ter havido show, abriria retaliação por cancelamento.
  - Ninguém avalia a si mesmo (relevante com multi-role, Bloco 4E.14).
  - **Unicidade por `(target, author, context)`** — unique **no banco**, porque checagem só na
    aplicação não sobrevive a dois POSTs simultâneos. Reavaliar o mesmo contexto **atualiza**.
- [x] **9.3d** `GET /musicians/:id/ratings` e `GET /establishments/:id/ratings` (`@Public()`,
      paginado, filtro `has_comment`, mais recentes primeiro).
- **Decisões de modelagem registradas:**
  - `rating` é `number` inteiro 1–5, **não** o VO `Rating` — o VO aceita `0` e uma casa decimal
    porque foi feito para médias, então não protegeria a nota de entrada. Precedente no schema:
    `RequestFeedback.rating Int`.
  - `syncRatingProjection(average, total)` novo nos dois agregados: `addRating` só sabe **somar**, o
    que fica errado assim que alguém reavalia (a nota antiga continuaria no acumulado) ou uma
    avaliação é removida por moderação. A projeção é sempre recalculada sobre o ledger inteiro.
  - Colunas de alvo/autor são polimórficas e **sem FK** (precedente `UserScore.reference_id`); a
    existência do alvo é conferida no use-case antes de gravar.
  - `review-types.ts` separado do agregado: o validator precisa das listas em runtime e o agregado
    importa o validator — o ciclo quebrava com `Cannot access before initialization` (aconteceu de
    fato durante a implementação). Precedente: `musician/domain/band-member-role.ts`.
- **Testes:** 23 novos — as duas provas de vínculo e suas brechas, reavaliação não somando duas
  vezes na projeção, média recalculada, nota inválida, alvo inexistente, derivação do autor
  (7 casos, incluindo a assimetria sub × claim) e smoke de DI.
  Migration `20260807120000_add_reviews_ledger`.
  Suíte: **328 suítes / 2835 testes** ✅

### 9.4 — Quick wins que o dashboard vai pedir 🟢
- [ ] **9.4a** `GET /establishments/:id/events/active` (`@Public()`) — atalho do fluxo de QR.
      `ListEventsUseCase` já suporta o filtro; é uma rota nova, nada mais. (`features-debate` #2, P0)
- [ ] **9.4b** `AutoFinishEventsJob` (`@Cron` 15min) — evento `active` com `end_date` no passado
      polui busca, leaderboard e o badge "ao vivo". Padrão pronto em `ExpirePendingBookingsJob`. (P0)
- [ ] **9.4c** `POST /requests/batch-respond` — músico volta do intervalo com 30 pedidos.
      Best-effort com erros por `request_id`, limite 50. (P1)
- [ ] **9.4d** Fechar `GET /establishments/:id/events` — hoje é `@Public()` **sem forçar `is_public: true`**,
      então evento privado vaza para quem souber o `establishment_id`. Registrado no 7.13b como
      "observado, não corrigido". Corrigir agora, é uma linha.
- [ ] **9.4e** `GET /audiences/public-profiles?ids=` (roadmap 7.16) — o leaderboard hoje é anônimo
      ("Fã #a3f2"), o que anula a gamificação inteira. Alternativa mais barata: popular
      `nickname`/`avatar` direto no `UserPointsPresenter`.

### 9.4 — Quick wins — ✅ concluído em 07/ago/2026

- [x] **9.4a** `GET /establishments/:id/events/active` — atalho do fluxo de QR. Rota estática
      declarada **antes** de `@Get(":event_id")`, senão "active" seria capturado como id.
- [x] **9.4b** `AutoFinishEventsJob` (`@Cron` a cada 10 min) + `AutoFinishEventsUseCase` +
      `findActiveEndedBefore` nos dois repositórios. Espelha `ExpirePendingBookingsJob`, incluindo o
      curto-circuito em `NODE_ENV=test`. Item inválido no lote é **pulado, não aborta** — o job roda
      sem ninguém olhando. `cancelled` fica de fora: cancelado não vira concluído.
- [x] **9.4c** `POST /requests/batch-respond` — best-effort com relatório `succeeded`/`failed` por
      `request_id`, teto de 50, deduplicação de ids e execução **sequencial** (paralelizar trocaria
      milissegundos por corrida de escrita na gamificação do músico). Compõe
      `RespondToRequestUseCase` em vez de reimplementar — é lá que moram a checagem de destinatário,
      a transição de estado e os eventos de domínio.
- [x] **9.4d** 🔴 **Vazamento de evento privado corrigido — e era maior do que o registrado.**
      O roadmap citava só a listagem; o `GET /establishments/:id/events/:event_id` tinha o mesmo
      furo. As duas rotas são `@Public()`, e pinar `establishment_id` desligava a proteção de
      `is_public`: qualquer pessoa que soubesse o UUID do estabelecimento lia a agenda privada dele.
      Corrigido com o **soft-auth** que o `AuthGuard` já oferece (precedente `GET /musicians/:id`):
      anônimo e terceiro só veem público, o dono segue vendo os próprios privados.
      O detalhe devolve **404, não 403** — dizer "existe mas você não pode ver" já confirma a
      existência de um evento privado a quem não deveria saber dele.
      ⚠️ **Mudança de comportamento deliberada:** havia um teste chamado *"preserving is_public as
      given"* que **codificava o vazamento**. Foi reescrito, não deletado, com o motivo no corpo.
- [x] **9.4e** Leaderboard identificável — **já estava implementado** (`findTopUsersWithProfile` +
      `nickname`/`avatar` no output e no presenter). Nenhum código novo.
- **Testes:** 22 novos (10 de visibilidade, 6 do job, 6 do batch). Suíte: **331 / 2858** ✅

---

## Revisão do Bloco 9 (9.1 → 9.4) — 07/ago/2026

Revisão pedida ao fim do bloco, cobrindo correção, aderência ao padrão do projeto, performance e
segurança. Achados **corrigidos nesta passada**:

| # | Achado | Correção |
|---|---|---|
| 1 | **`events` não tinha índice nenhum.** O job novo roda a cada 10 min filtrando `status` + `endTime` — seria sequential scan recorrente; a listagem por estabelecimento também não tinha cobertura. | Migration `20260807140000_add_event_indexes`: `(status, endTime)` e `(establishmentId, status, startTime)`. |
| 2 | **Leitura duplicada** em `SubmitReviewUseCase`: o alvo era carregado uma vez para validar existência e **de novo** para atualizar a projeção — um round-trip extra em toda avaliação. | Carregado uma vez e repassado. |
| 3 | **Amplificação de escrita** em `batch-respond`: 1 requisição vira até 50 escritas com eventos de domínio, e o throttle global conta requisições, não trabalho. | `@Throttle(6/min)` dedicado na rota. |
| 4 | **25 erros de lint** no código novo (Prettier + `simple-import-sort`) — fora do padrão do projeto. | `eslint --fix`; lint agora limpo. |
| 5 | Regressão em `requests.controller.int-spec` (DI do use-case novo) e em `list-events.use-case.spec` (teste que codificava o vazamento). | Ambos corrigidos; o segundo reescrito com justificativa. |

**Verificado e OK:**
- `bookings` e `inquiries` **já tinham** índice nas três colunas de participante, então o `OR` do
  escopo (9.2) é servido por BitmapOr — nenhum índice novo foi necessário.
- Todas as rotas novas têm guard de classe + `@Roles`; nenhuma escrita ficou sem papel exigido.
- Nenhuma autorização vem de input do cliente: escopo de agenda, autor de avaliação e músico do
  batch saem **sempre** do JWT. Onde o cliente informa id (`author_establishment_id`), o valor é
  conferido contra o claim.
- `whitelist: true` no ValidationPipe global + atribuição explícita **depois** do spread de
  `...query`/`...dto` — duas camadas contra forjar escopo.
- Enumeração: o detalhe de evento privado responde 404; o registro de estabelecimento responde 409
  em e-mail duplicado — este último **é enumeração de conta**, mas idêntico ao `POST /auth/register`
  já existente, então mantido por consistência (mudar exigiria decisão de produto nos dois).

**Registrado, não corrigido (decisão consciente):**
- `SubmitReviewUseCase` grava ledger e projeção **sem transação compartilhada**. Falha no segundo
  passo deixa a média velha até a próxima avaliação daquele alvo — inconsistência temporária e
  auto-corrigível, nunca perda de dado. Fechar exigiria os três repositórios no mesmo
  `PrismaUnitOfWork` (precedente do Bloco 2.5).
- `GET /:id/ratings` (`@Public()`) devolve `author_id`. É pseudônimo e **consistente** com o
  `GET /gamification/leaderboard`, que já expõe `user_id` publicamente. Vale uma decisão de produto
  única para os dois, não um ajuste isolado aqui.
- Admin pode assinar avaliação em nome de um estabelecimento (`author_establishment_id` sem
  checagem de posse quando `isAdmin`). Coerente com o bypass de admin no resto do projeto.

### Ideias novas surgidas do Bloco 9

Registradas aqui porque nasceram do código, não de brainstorm:

- **9.8 — `EstablishmentRatedEvent` está morto.** O agregado dispara, ninguém escuta. Com o ledger
  do 9.3 existindo, o caminho natural é o evento alimentar notificação ("você recebeu uma
  avaliação") e o relatório pós-show. Hoje é código que só custa manutenção.
- **9.9 — Recalcular projeções órfãs.** Um comando/job que reconstrói `rating`/`total_ratings` a
  partir do ledger fecha o buraco da não-atomicidade acima **e** corrige os contadores legados, que
  hoje vêm de `addRating` incremental sem lastro. Barato: `aggregateForTarget` já existe.
- **9.10 — Convite de avaliação.** O gargalo de reputação não é a rota, é o volume: ninguém avalia
  espontaneamente. Com `Booking` concluído e `EventAttendee` já registrados, dá para disparar o
  convite no momento certo — e é o mesmo gatilho do relatório pós-show do catálogo de ideias.
- **9.11 — `GET /scheduling/inquiries/:id`.** Único item de leitura que ficou fora do 9.2 (a
  listagem já devolve o registro completo, então é conveniência).
- **9.12 — Índices ausentes fora do Bloco 9.** `events` não tinha nenhum. Vale uma varredura das
  demais tabelas quentes antes do web multiplicar o volume de leitura.

---

### 9.5 — Notificação do estabelecimento — ✅ concluído em 07/ago/2026

- [x] **9.5a** `NotificationsSchedulingEventsHandler` — os templates
      `booking-confirmed.tsx`/`booking-cancelled.tsx` existiam **sem nenhum chamador**, e
      `BookingEventsHandlers` (scheduling-module) apenas **logava** os eventos: fechava-se um show e
      ninguém era avisado.
  - **Divisão de canal seguindo `email.md`:** booking → **e-mail para os dois lados** (é
    *comprovante*: o músico precisa do registro com data, horário e cachê meses depois);
    inquiry → **tempo real** (socket + push), porque é etapa de negociação e um e-mail por proposta
    viraria ruído.
  - `BookingConfirmedEvent` carrega só o id, então os participantes são resolvidos no handler.
    Todo o corpo é **best-effort**: falha de e-mail não desfaz um booking já commitado, e falha
    para um destinatário não impede o outro de ser avisado.
- [x] **9.5b** ⚠️ **A room `user:${sub}` NÃO servia para o estabelecimento.** O `sub` é a pessoa; o
      estabelecimento tem UUID próprio e uma conta opera até 3 unidades — sem isso não havia como
      empurrar nada para o dashboard web.
      O gateway passou a entrar também em **`establishment:${id}`**, derivada do claim
      `establishment_ids` no connect, reusando `toAuthenticatedUser` (a mesma leitura de claims do
      HTTP — duplicar abriria espaço para um transporte aceitar o que o outro recusa).
      Eventos novos: `booking.updated` e `inquiry.updated`.
- **Achado de wiring:** `SchedulingModule` não exportava `INQUIRY_REPOSITORY`. O `tsc` não pega
  isso — só um teste que instancia o handler. Exportado.
- **Testes:** 7 novos. Suíte: **332 suítes / 2865 testes** ✅

### 9.6 — Pré-requisito da fatia pública W5 — ✅ concluído em 07/ago/2026

> ⚠️ **A premissa do 9.6a estava errada, e a fonte do erro era um doc.**
> O plano dizia *"`Tip.user_id` já é opcional no agregado — a restrição é só de rota"*, repetindo
> `business-rules.md:369`. **É falso:** o campo é `audience_id`, obrigatório no agregado e
> `NOT NULL` com FK `onDelete: Restrict` no Prisma. Doc corrigido.

- [x] **9.6a — Decisão: gorjeta anônima NÃO será implementada como ausência de identidade.**
  - Tornar `audienceId` nulável quebraria a FK que protege a integridade financeira e a lógica de
    wall/gamificação que assume um fã. **Gorjeta sem identidade não pode ser estornada, contestada
    nem ter recibo.**
  - O domínio **já resolve** o problema real: `is_anonymous` esconde o nome do fã na exibição e na
    notificação, mantendo o registro. Anonimato é propriedade de **exibição**, não de ausência.
  - Conversão no W5 vem de **fricção baixa**, não de ausência de conta — ver 9.6b.
- [x] **9.6b — Decisão: cadastro leve inline, com ZERO backend novo.**
  - `POST /auth/register` com `role=audience` já exige apenas **nome, e-mail e senha** — CPF e
    celular são `@ValidateIf(role === "musician")`. O comentário no código já dizia o porquê:
    *"audience é público casual escaneando QR — fricção extra aqui mataria conversão"*.
  - Logo, 9.6a e 9.6b **colapsam num mecanismo só**: o mesmo cadastro de 2 campos serve gorjeta e
    pedido no navegador. Nada a implementar no backend; é trabalho de UI da fatia W5.
- [x] **9.6c** `GET /musicians/:musician_id/repertoire` (`@Public()`, `@Throttle` 30/min) +
      `PublicMusicLibraryItemPresenter`.
  - **Controller separado, não afrouxamento do existente.** `MusicLibraryController` é
    `@Roles("musician","admin")` na classe; relaxá-lo exigiria lembrar, em toda mudança futura, de
    não deixar `chords`/`lyrics` escaparem. Aqui a rota nasce com um presenter que **só sabe montar
    metadado**. Mesmo precedente de `AiCifraSearchController` (6.6).
  - **Allowlist explícita, nunca omissão.** Campos copiados um a um: `id`, `musician_id`, `title`,
    `artist`, `genre`, `difficulty`, `duration_seconds`. `chords`, `chord_sheet`,
    `renderable_chord_sheet`, `structure_segments`, `lyrics` e `notes` **não saem** — os cinco
    primeiros por risco de licenciamento (a mesma razão do kill-switch da comunidade de cifras), e
    `notes` porque é anotação **privada** do músico.
  - `musician_id` vem do **path** e sobrescreve qualquer valor da query: não existe "listar a
    biblioteca inteira" para terceiro — `MusicLibrary` é biblioteca pessoal.
  - **Testes:** 11, incluindo um que fixa a allowlist — se alguém adicionar campo ao output no
    futuro, o teste falha em vez de deixar vazar em silêncio.
- **Fecha também o roadmap 7.14** (navegação de repertório para o público), que estava aberto.
- Suíte: **333 suítes / 2876 testes** ✅


### 9.7 — ✅ Features vendidas nos planos que nenhum gate aplicava *(resolvido em 16/ago/2026)*

> **Decisões tomadas com o usuário (16/ago/2026), feature a feature.** As quatro respostas estão
> implementadas; o quadro abaixo descreve o estado ANTES, preservado porque explica por que cada
> escolha foi feita.
>
> | Flag | Decisão | O que foi feito |
> |---|---|---|
> | `advanced_analytics` · `realtime_analytics` | **Aplicar o gate, 402 no endpoint inteiro** | `assertEstablishmentFeature`/`assertMusicianFeature` nos dois use-cases de analytics. Escolhido sabendo que quebra duas telas vivas — por isso a fatia inclui os estados de paywall no web (`AnalyticsPlanGateNotice`) e no mobile (`isPlanLimitError` + CTA "Ver planos"), entregues junto |
> | `max_qr_codes` (1/3/∞) | **Remover a promessa** | Fora de `EstablishmentPlanFeatures` e dos 3 tiers. Múltiplos QR volta como feature (agregado próprio), nunca como gate — `Establishment.qr_code` é campo único |
> | "1 evento ativo no Free" | **Não aplicar agora** | Os eventos de estabelecimento FREE são o inventário que alimenta a `/agenda` pública do W5; estrangular isso mataria o funil de aquisição recém-construído. Revisitar quando houver oferta sobrando |
> | `api_access` (×2) · `white_label` | **Manter como "em breve"** | Continuam no catálogo, agora declaradas em `coming_soon` no `GET /plans`. As UIs renderizam badge "Em breve" em vez de ✓/✗ — e o `Exclude<>` nas uniões de `assertMusicianFeature`/`assertEstablishmentFeature` torna **erro de compilação** gatear uma capacidade que não existe |
>
> **Dois achados durante a implementação, não previstos no plano:**
> 1. **`ListEstablishmentAnalyticsUseCase` devolvia o analytics de todos os estabelecimentos** se
>    chamado sem `filter.establishment_id` — era campo opcional do filtro. O controller sempre o
>    fixava, então nunca vazou por HTTP, mas o buraco estava no use-case. Virou parâmetro
>    obrigatório de topo que **sobrescreve** o filtro (precedente do 9.6c), o que também é o que
>    permite ao gate resolver o plano. O teste que esperava `filter: null` com entrada inválida foi
>    **reescrito com o motivo no corpo** — ele codificava a busca sem escopo.
> 2. **Um teste provava a promessa quebrada.** `"FREE: realtime_available=false"` e `"não lança erro
>    para músico FREE"` documentavam com precisão que o FREE recebia os mesmos números do PRO. Foram
>    invertidos, não deletados.
>
> **Gates:** backend **354 suítes / 3308 testes** · web **88 arquivos / 817 testes** · mobile
> **10 suítes / 137 testes** · `tsc` limpo nos três · lint limpo no backend e no web.

<details>
<summary>Estado anterior (jun–ago/2026) — por que este bloco existiu</summary>



**Como foi achado:** ao corrigir a tabela de "features pendentes" do estabelecimento, conferi
campo a campo o `plan-features.config.ts` contra os call-sites reais de `assertMusicianFeature` /
`assertEstablishmentFeature`. O resultado não estava documentado em lugar nenhum.

**Estabelecimento — 2 de 6 flags aplicadas:**

| Flag | Situação real | Consequência |
|---|---|---|
| `promotional_campaigns` | ✅ aplicada (`CreateCampaignUseCase`) | — |
| `multi_establishment` | ✅ aplicada (`CreateEstablishmentUseCase`) | — |
| `advanced_analytics` | ❌ **nunca lida** | Free tem o mesmo analytics do Pro |
| `max_qr_codes` (1/3/∞) | ❌ nunca lida **e o domínio não suporta** — `Establishment.qr_code` é campo único e `generateQRCode()` sobrescreve | "3 QR codes no Growth" exige mudança de agregado, não só um gate |
| `api_access` | ❌ nunca lida — não existe noção de API key no código | Promessa sem lastro |
| "1 evento ativo no Free" | ❌ **não existe nem como flag** | Qualquer tier cria eventos sem limite |

**Músico — 13 de 18 aplicadas** (bem melhor). Problemas:

| Flag | Situação real |
|---|---|
| `realtime_analytics` | ⚠️ **soft gate** — `GetMusicianAnalyticsUseCase` só reporta `realtime_available`, não retém dado nenhum. O `roadmap.md` 4C.1 afirmava que havia um `assertMusicianFeature` ali; **nunca houve** (corrigido em 06/ago) |
| `api_access` · `white_label` | ❌ nunca lidas — só aparecem na união de tipos de `plan-check.service.ts` |
| `banner_generation_per_month` | ✅ gate pronto (`assertMusicianCanGenerateBanner`), sem feature que o chame — não é gap, é 4D.5 |

**Por que isso é sério:** o checkout de assinatura **já funciona** (`plans.controller.ts` +
`AsaasSubscriptionGateway`). No dia em que a fatia W4 ligar a cobrança no web, o estabelecimento
que pagar Growth recebe quase a mesma coisa que tinha de graça. É receita perdida e exposição a
reclamação legítima.

- [x] **9.7a** Decidir, feature a feature: **aplicar o gate** ou **remover a promessa** da tabela de
      preços. Decidido com o usuário em 16/ago/2026 — ver a tabela de decisões no topo deste bloco.
- [x] **9.7b** Implementar as decisões seguindo o padrão dos dois gates que já funcionam
      (`CreateCampaignUseCase` foi o molde).
- [x] **9.7c** Teste por gate (padrão 4C.8): FREE bloqueado (`PlanLimitExceededError` → 402), tier
      pago liberado, assinatura cancelada volta ao FREE — nos dois lados, mais um teste no
      **controller** do músico (a fronteira HTTP, onde o 9.7 mostrou que os testes não chegam).
- [x] **9.7d** ✅ Auditoria do lado do músico — **feita**, resultado na tabela abaixo.

> ⚠️ **O aviso abaixo era real e a decisão foi tomada sabendo dele:** transformar o soft gate em 402
> **quebra a `AnalyticsScreen` do mobile para todo músico FREE**, que até então funcionava. Por isso
> a fatia não terminou no backend — os dois estados de paywall (web e mobile) fazem parte dela.

</details>

---

## 5. `soundmeet-web` — arquitetura e stack

### 5.1 Decisão estrutural

```
SoundMeet/
  soundmeet-backend/
  soundmeet-mobile/
  soundmeet-web/          ← criar
    src/
      app/                # Next.js App Router
        (public)/         # SSR + SEO: /musico/[id], /local/[id], /evento/[id]
        (dashboard)/      # RSC + client islands: área do estabelecimento
      features/           # MESMO FSD do mobile: domain / application / infrastructure / ui
      shared/
        design-system/    # tokens portados de soundmeet-mobile/Docs/design-system.md
        services/http/    # Axios + interceptors + ApiEnvelope<T>  ← reaproveitar do mobile
        services/auth/    # Keycloak PKCE (client `soundmeet-web`, já existe no realm)
      components/ui/      # shadcn (código nosso, restilizado)
      motion/             # ⭐ a linguagem de movimento da marca (§5.3)
```

**Continuar sem Turborepo.** Três projetos independentes, como já está. O que vale copiar do mobile
(não importar — copiar, são runtimes diferentes): os **tipos de domínio** e os **adapters de API**.

> ⚠️ **Envelope HTTP.** O `WrapperDataInterceptor` embrulha **toda** resposta em `{ data: ... }`
> (listas saem como `{ data, meta }`). Todo adapter tem que retornar `data.data`. Isso já causou
> um bug real no mobile ("cadastro criava a conta mas o app lia `access_token` undefined").
> Tipar com `ApiEnvelope<T>` desde o primeiro adapter.

> ⚠️ **Conflito de porta.** O backend sobe em `PORT || 3000` e o Next dev também quer 3000.
> Rodar o web em `3001` (já está no CORS e nos redirects do Keycloak) ou mover o backend.

### 5.2 Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | SSR para as páginas públicas (SEO/QR sem app) + RSC para o dashboard. É a única escolha que serve os dois. |
| Estilo | **Tailwind v4 + CSS vars** | Tokens do `design-system.md` (teal `#00E0B8`, bg `#0C0C14`, Space Grotesk/Inter/JetBrains Mono) viram CSS vars — **uma fonte de verdade visual** entre mobile e web. |
| Componentes | **shadcn/ui** como base do dashboard | O código fica no nosso repo, 100% restilizável. Table/Form/Dialog/Command de dashboard não devem ser reinventados. |
| Dados | **TanStack Query v5 + Zustand** | Mesmo modelo mental do mobile. Curva zero. |
| Formulários | **Zod + react-hook-form** | Já é o padrão obrigatório do mobile (item 1.21). Os schemas Zod são portáveis quase 1:1. |
| Auth | **Keycloak PKCE** (client `soundmeet-web`) | Já configurado no realm. |
| E2E | **Cypress** | Já decidido em `roadmap-mobile.md` (linha de "Decisões fechadas"). |

### 5.3 ⭐ Direção visual — como NÃO parecer gerado por IA

Você pediu explicitamente: **ousado, impressionador, autoral.** Sendo direto sobre o risco:

> **Aceternity cru é exatamente o visual "gerado por IA".** Aurora background, spotlight, bento
> grid, glare card e text-reveal são reconhecíveis à distância porque estão em milhares de landing
> pages. Usar os componentes como vieram é o caminho mais rápido para o resultado que você não quer.

**A regra que resolve isso:** Aceternity/21st.dev entram como **código-fonte de partida**
(você cola, é seu, é Tailwind puro) e **saem restilizados** para os tokens da marca — nunca com a
paleta e a curva de animação padrão deles. E o *hero* das páginas de marca não usa componente de
biblioteca nenhum: é autoral.

**A ideia autoral que eu recomendo — a marca já te deu a resposta:**
o logo do SoundMeet é **barras de equalizador convergindo** (`design-system.md`). Então a linguagem
de movimento do site inteiro deve ser **derivada de áudio**, não decorativa:

1. **Motion system "waveform"** — separadores de seção, barras de progresso, estados de loading,
   hover de card e transições de página são todos variações da mesma forma de onda. Um site inteiro
   com uma assinatura de movimento coerente é a coisa que template nenhum entrega.
2. **Hero áudio-reativo (WebGL)** — a landing toca um trecho real de um músico da plataforma e um
   shader reage ao áudio de verdade (Web Audio API `AnalyserNode` → uniform do shader). Isso é
   *literalmente* impossível de confundir com template, e é honesto com o produto: o site **soa**
   como o produto.
3. **Motivo tipográfico de cifra** — JetBrains Mono com acordes em teal flutuando sobre a letra
   (o mesmo token grid do Play Mode) como textura de fundo em seções de conteúdo. Ninguém mais
   tem esse ativo visual porque ninguém mais tem esse produto.
4. **Scroll como um show** — a página pública do evento se revela em "seções" com nomes de estrutura
   musical (Intro / Verso / Refrão) no scroll — o mesmo vocabulário do `SectionTransitionBadge` que
   já existe no Play Mode.

**Libs (todas verificadas em ago/2026):**

| Lib | Papel | Nota |
|---|---|---|
| **GSAP + ScrollTrigger + SplitText + Flip** | Timeline, scroll-driven, tipografia | **100% grátis desde abr/2025**, incluindo todos os ex-plugins Club (SplitText, MorphSVG, DrawSVG, ScrollSmoother) após a aquisição pela Webflow. É a espinha dorsal de praticamente todo Awwwards. |
| **Lenis** | Smooth scroll | Aparece em quase todo site Next.js premiado no Awwwards 2025/26. É a camada que faz o scroll "sentir caro". |
| **Motion** (ex-Framer Motion) | Transições de UI React, layout animations, gestos | Melhor que GSAP para estado/entrada-saída de componente. Os dois convivem: GSAP para scroll/timeline, Motion para UI. |
| **Three.js / React Three Fiber** | Hero WebGL áudio-reativo | Só nas páginas de marca. **Nunca** no dashboard. |
| **Lottie** | Micro-ilustrações | Já é padrão no mobile — reaproveitar assets. |
| **Aceternity / 21st.dev / Motion Primitives** | Banco de referência e ponto de partida | Motion Primitives é o mais discreto dos três — melhor para o *dashboard*, onde teatralidade atrapalha. |

**Princípio de partição — importante:**
- **Páginas públicas / marca** → ousadia máxima. WebGL, scroll narrativo, SplitText, som.
- **Dashboard do estabelecimento** → o dono do bar quer ver a agenda de sexta em 3 segundos.
  Ali "ousado" significa **densidade de informação, hierarquia e velocidade**, não parallax.
  Animação só onde comunica estado (skeleton, otimista, transição de rota). Confundir os dois
  é como um dashboard fica ruim.

**Acessibilidade não é opcional:** `prefers-reduced-motion` desliga todo o sistema de movimento —
não é detalhe, é o que separa trabalho profissional de demo.

---

## 6. Fatiamento do web v1

Ordem por **desbloqueio de valor**, não por facilidade. Cada fatia é entregável sozinha.

### W0 — Fundação (2–3 dias)
Projeto, Tailwind + tokens da marca, shadcn, cliente HTTP com `ApiEnvelope`, auth PKCE, layout do
dashboard, `motion/` com o sistema waveform base, tema dark padrão.

### W1 — Conta + Perfil + Cardápio + Horários *(depende de 9.1)*
Cadastro/login do estabelecimento, perfil completo, **upload de cardápio PDF** (`POST /establishments/:id/menu-pdf`,
já pronto), **formulário de horário de funcionamento** — o `OperatingHours` VO é completo há meses
(turnos overnight, feriados, férias) e **nunca teve UI em lugar nenhum**; é o que liga o badge
"Aberto agora" que o app do fã já sabe renderizar.
> Maior relação valor/esforço de todo o v1: backend 100% pronto, só falta o formulário.

### W2 — Eventos + Line-up *(backend 100% pronto)*
CRUD de evento, ativar/cancelar/finalizar, escalar músicos (`performers`), lista de presentes.
14 rotas prontas em `events.controller.ts`, zero UI hoje.

### W3 — Descoberta + Contratação + Chat *(depende de 9.2)*
Busca de músicos (gênero, instrumento, **raio geográfico**, faixa de preço — tudo pronto no 7.13c),
perfil do músico com agenda (`free-busy`), inquiry → **chat** (backend pronto, `/chat` + REST) →
booking. `hiring-dashboard` já existe.
> É o coração do produto B2B. **Não começa antes do 9.2.**

### W4 — Analytics + Campanhas + Assinatura
`GET /establishments/:id/analytics`, campanhas promocionais (backend pronto, zero UI),
e checkout Growth/Pro via `POST /establishments/:id/subscription/checkout` (Asaas devolve
`invoiceUrl` — o web só redireciona, não coleta cartão).

### W5 — Páginas públicas SSR — ⭐ **entregável obrigatório do v1** *(decisão do usuário, 06/ago/2026)*

`/musico/[id]`, `/local/[id]`, `/evento/[id]` renderizadas no servidor + `/agenda`
("o que rola hoje perto de você", usando `GET /events` com `lat/lng/radius_km` — pronto no 7.13b).

**Racional:** hoje o QR na mesa (`soundmeet://musician/<uuid>`) **só funciona para quem já tem o
app instalado**. Um fã num bar não baixa um app para pedir uma música — a fricção mata a conversão
exatamente no momento de maior intenção. Uma página SSR transforma cada adesivo de mesa em funil de
aquisição e dá ao Google um índice de "música ao vivo em BH hoje", conteúdo que nenhum concorrente
tem. Reaproveita ~70% dos componentes do dashboard.

**Conteúdo do v1:**
- Perfil do músico / venue / evento, read-only, com OG tags e JSON-LD (`MusicEvent`) para indexação
- **Gorjeta PIX direto no navegador** (depende de 9.6a)
- Pedido de música com cadastro leve inline (depende de 9.6b)
- Deep link "abrir no app" para quem já tem
- `prefers-reduced-motion` respeitado em todo o sistema de movimento

> ⚠️ **Dependência descoberta na auditoria (Bloco 9.6) — sem ela W5 vira só vitrine.**
> `POST /tips` é `@Roles("audience")` e `POST /audiences/:id/music-requests` idem, ou seja **nada
> de gorjeta ou pedido sem conta**. A boa notícia: `Tip.user_id` já é **opcional no agregado** — a
> restrição é puramente de rota, não de domínio. Liberar uma variante `@Public()` (throttle
> agressivo, sem gamificação) resolve a gorjeta anônima. Para o pedido, a saída barata é cadastro
> leve inline reusando `POST /auth/register` role=audience — **zero backend novo**.

---

## 7. Catálogo de ideias

Ordenadas por **relação impacto/esforço**, com nota de quanto já existe.

### 7.1 Macro — estratégia

**M1. O web público é o motor de aquisição, não um extra.** (ver W5)
A tese de posicionamento do `features.md` — *artista + cardápio + preço + localização num só lugar* —
só se realiza numa superfície indexável e sem instalação. Hoje ela existe só dentro de um app que
o público precisa baixar antes de saber que o produto é bom.

**M2. "O que rola hoje perto de você" como produto de consumo.**
`GET /events` com `lat/lng/radius_km` já existe (7.13b). Um mapa/feed público de shows hoje à noite
com cardápio e faixa de preço é o **único** ativo capaz de resolver o problema de galinha-e-ovo do
B2B: o estabelecimento quer o dashboard porque a vitrine traz gente. Vender dashboard para bar sem
tráfego é vender software; vender vitrine com público é vender clientes.

**M3. Transformar a IA de cifra em fosso competitivo e segunda receita.**
Você **treinou um modelo próprio** (ChordFormer v22/v23, com destilação e harness de avaliação).
Isso é raro e o produto quase não capitaliza:
- *"Cifra da sua própria banda"* — o músico sobe a gravação dele e recebe uma cifra que **não existe
  em lugar nenhum**. O Cifra Club estruturalmente não pode fazer isso. É a feature que justifica o
  Pro sozinha.
- *Modo estudo com stems* — `ai-audio-module` está pronto e **sem nenhuma UI**: "toque junto sem a
  guitarra" / "só a voz e o baixo". Feature de altíssimo valor percebido, backend já entregue.
- *Custo:* `music_library` é **por músico** hoje — 100 músicos com a mesma música = 100 análises de
  GPU. Vale decidir uma camada canônica compartilhada antes de escalar, ou o custo de GPU cresce
  linear com usuários sem necessidade.

**M4. Ativar as indicações — aquisição B2B de graça.**
`IndicateMusicianUseCase` existe do lado do público; o lado do estabelecimento nunca foi construído
(`business-rules.md` registra). *"Seu público indicou 4 músicos essa semana"* é um e-mail de
aquisição que só o SoundMeet consegue mandar, porque só ele tem os dois lados.

**M5. Não abra a terceira plataforma sem fechar o ciclo do dinheiro.**
A receita principal do produto (9%/7%/5%) hoje passa pelo Mercado Pago (`MercadoPagoPixGateway`).
O risco que resta não é "ainda está no mock": é o vínculo OAuth do músico (`CLIENT_SECRET` +
redirect HTTPS) e a prova ponta a ponta webhook → gorjeta `completed`. Sem isso, a cobrança nasce
e fica `pending` para sempre.

**M6. Uma verdade desconfortável sobre o mobile.**
São ~47.200 linhas em 56 telas (recontado em 22/ago/2026), e os blocos 3, 4.9, 5, 6, 7, 7.11, 8, 9 e 11 estão todos marcados
`[~]` com a mesma frase: *"falta confirmação manual em device"*. Push notification nunca foi vista
chegando num aparelho. Um dia de teste com dois aparelhos reais e o backend real vale mais, em
informação, do que uma semana de features novas — e provavelmente encontra 10 bugs que hoje estão
invisíveis. Não precisa bloquear o web; precisa acontecer antes de qualquer usuário real.

### 7.2 Micro — músico

| Ideia | Já existe | Esforço |
|---|---|---|
| **Relatório automático pós-show** — "18 músicas, 6 pedidos aceitos, R$ 210 em gorjetas" + card compartilhável | 100% dos dados (`requests`, `tips`, `repertoire`) | Baixo |
| **Cifras offline no Play Mode** — palco não tem wi-fi; hoje o Play Mode simplesmente falha sem rede | — | Médio · **é um bug de produto, não feature** |
| **Inteligência de cachê** — "sertanejo na sua região cobra R$ 400–700/evento" | `priceRanges` + geo já coletados | Baixo |
| **"Esquenta o repertório"** — músicas que o público mais pede e **não estão** no seu repertório | `findPopularSongs` já existe | Baixo |
| **Responder pedidos em lote** | — (9.4c) | Baixo |
| **Criar banda pelo app** | Backend pronto; falta `POST /bands` no adapter mobile | Muito baixo |
| **Split de banda por percentual** | Hoje é igualitário hardcoded; líder fica com o resto da divisão | Alto |
| **Relatório semanal por e-mail** | Template planejado em `email.md`, dados prontos | Baixo |

### 7.3 Micro — estabelecimento (web)

| Ideia | Já existe | Esforço |
|---|---|---|
| **Radar de sexta vazia** — "22/08 sem música marcada" + músicos livres naquela data | `free-busy` + `searchByProximity` prontos | Baixo · **feature matadora de dashboard** |
| **Caixa de indicações do público** (M4) | Metade | Médio |
| **Banner de divulgação gerado** (4D.5) | Nada — mas é `sharp` + template SVG | Médio · valor percebido enorme |
| **Relatório pós-show para o dono** — scans, pedidos, gorjetas, perfil musical do público | Dados prontos | Baixo · **é o que justifica a assinatura** |
| **Aviso de cardápio desatualizado (>30 dias)** | `menu_pdf_updated_at` já persistido | Muito baixo |
| **Campanhas promocionais** | Backend pronto, zero UI | Médio |

### 7.4 Micro — público

| Ideia | Já existe | Esforço |
|---|---|---|
| **Pedir música / dar gorjeta pelo navegador** (W5) | Endpoints prontos | Médio · **remove a maior fricção do produto** |
| **Avaliar músico e local** | Agregado pronto, sem rota (9.3) | Médio |
| **Leaderboard com nome e rosto** | Hoje é anônimo → gamificação inerte (9.4e) | Baixo |
| **"Meu ano em shows"** (Wrapped) — timeline dos shows que você foi, artistas descobertos, quanto apoiou | `UserInteraction` já grava tudo | Médio · **altíssima viralidade** |
| **Missão de compartilhamento social** (7.11) | Especificado, não implementado | Médio |

### 7.5 Transversal

- **Observabilidade:** o backend já tem `instrument.ts` (Sentry). O mobile e o web não têm nada
  decidido. Antes de usuário real, os três precisam reportar erro no mesmo lugar.
- **Feature flags:** já há precedente bom (`PERSONAL_CHORD_SHEET_COMMUNITY_ENABLED`).
  Adotar como padrão para tudo que for novo no web.
- **Um design system, três consumidores:** os tokens de `design-system.md` deveriam virar um pacote
  (ou ao menos um JSON compartilhado) antes que web e mobile divirjam. Divergem em semanas.

---

## 8. O que **não** fazer agora

- ❌ **Não começar pelo dashboard sem o 9.1 e o 9.2.** Sem 9.1 o dashboard não tem como ter um
  usuário; sem 9.2 a tela principal dele não tem o que mostrar.
- ❌ **Não usar componente de biblioteca cru na página de marca.** É a diferença entre "site de
  produto" e "template".
- ❌ **Não levar WebGL/scroll narrativo para dentro do dashboard.**
- ❌ **Não montar Turborepo agora.** Continua sem benefício.
- ❌ **Não começar Marketplace/Reels/Memórias** (`features.md`) antes do estabelecimento existir.
- ❌ **Não confiar nos docs sem checar o código** até a §2 estar corrigida.

---

## 9. Verificação

**Bloco 9 (backend)**
```bash
cd soundmeet-backend
npm test                       # baseline atual: 387 suítes / 3622 testes (22/ago/2026)
npm run test:e2e               # int-specs (controller + Postgres)
npx tsc --noEmit
npx prisma migrate deploy      # ⚠️ ANTES do seed. `deploy`, nunca `dev`: o dev faz diff
                               # do schema e não enxerga índice parcial, então pode gerar
                               # DROP de performances_one_live_per_event_musician e de
                               # band_members_one_accepted_leader (vivem só no SQL).
npm run seed -- --reset        # 52 dos 56 modelos; 14 logins (senha Seed@123) se o
                               # Keycloak estiver de pé. Ver o cabeçalho de prisma/seed.ts
                               # para os 4 modelos deixados de fora e o porquê.
```
Critério de pronto do Bloco 9, ponta a ponta via Swagger (`http://localhost:3000/api/docs`):
1. `POST /auth/register-establishment` → 201 com tokens;
2. com esse token, `POST /establishments/:id/events` → 201 (prova que o claim `establishment_ids`
   foi escrito **e** que o `EstablishmentOwnershipGuard` aceita);
3. `POST /scheduling/inquiries` → `PATCH /:id/accept` (como músico) → `POST /:id/convert-to-booking`;
4. `GET /scheduling/bookings` como estabelecimento → aparece; como **outro** estabelecimento → não aparece;
5. `POST /musicians/:id/ratings` → `GET /musicians/:id` reflete a nova média.

**soundmeet-web**
```bash
cd soundmeet-web
npm run dev -- -p 3001         # 3000 é do backend
npx tsc --noEmit
npm run build                  # SSR das páginas públicas tem que passar
```
Critério de pronto de cada fatia: fluxo completo no navegador contra o backend real (não mock),
com Lighthouse ≥ 90 em Performance e Acessibilidade nas páginas públicas, e
`prefers-reduced-motion: reduce` desligando o sistema de movimento.

---

## 10. Próxima tarefa

> ⚠️ **Este bloco apontava para "9.1a — `RegisterEstablishmentUseCase`" muito depois de o 9.1a estar
> concluído** (06/ago/2026). Corrigido em 19/ago/2026.

> ~~**1. Aplicar as migrations pendentes.**~~ ✅ feito em 19/ago/2026 — 38 migrations, schema em dia.
>
> **1. Decidir o gateway da gorjeta** — ver
> [payment-gateway-research-2026-08.md](payment-gateway-research-2026-08.md). A taxa fixa do Asaas
> torna deficitária toda gorjeta abaixo de R$22, e isso bloqueia a receita principal do produto.
>
> **2. Fatia HTTP do escrow (F1.3a):** ✅ check-in e contestação entregues em 19/ago. Faltam a
> criação da subconta (F1.0) por HTTP e os webhooks de `PAYMENT_RECEIVED`/escrow.

---

## Fontes (pesquisa de stack, ago/2026)

- [Comparing the best React animation libraries for 2026 — LogRocket](https://blog.logrocket.com/best-react-animation-libraries/)
- [GSAP — npm / licença pós-Webflow](https://www.npmjs.com/package/gsap)
- [From SplitText to MorphSVG: free GSAP plugins — Codrops](https://tympanus.net/codrops/2025/05/14/from-splittext-to-morphsvg-5-creative-demos-using-free-gsap-plugins/)
- [Best Three.js Websites 2026 — Utsubo](https://www.utsubo.com/blog/best-threejs-websites-2026)
- [Best Animated Website Libraries for Next.js and React in 2026](https://snigdhachandrapaik.vercel.app/blogs/animated-website-libraries-nextjs-react)
- [Aceternity UI vs Magic UI vs shadcn/ui 2026 — PkgPulse](https://www.pkgpulse.com/guides/aceternity-ui-vs-magic-ui-vs-shadcn-animated-react-2026)
