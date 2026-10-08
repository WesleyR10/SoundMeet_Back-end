# Pedidos de música

> Parte das [regras de negócio](../README.md) — o que a API já faz, por domínio.
> Marcações: `[x]` implementado · `[~]` parcial · `[ ]` pendente.

*Seção original: “Domínio Request (Pedidos Musicais)”.*


**Criação e ciclo de vida do pedido**

- [x] Pedido musical ligado a público, músico, música e artista  
       Código: request.aggregate.ts ([17]).  
       Regras:
  - Campos principais: `audience_id`, `musician_id`, `song_title`, `artist`, mensagem opcional, flags e metadados.
  - `status` inicial é `pending`; estados: `pending` → `accepted`/`rejected`, e `accepted` → `played` quando o músico toca o pedido no set ao vivo (ver "Domínio Performance").
  - Datas: `created_at`, `responded_at`.

- [x] **`CreateRequestUseCase` exige presença comprovada, via `CanMakeRequestPolicy`**
       (`core/request/domain/policies/can-make-request.policy.ts`) — não documentado antes de
       14/ago/2026, achado por teste real contra o backend (não por leitura de DTO, que marca
       `event_id` como opcional):
  - `MusicianMustBePerformerPolicy`: `event_id`+`musician_id` precisa ter uma linha `EventMusician`
    com `status != cancelled` (`eventRepo.isMusicianPerformer`).
  - `AudienceMustBePresentPolicy` (era `AudienceMustBeAttendeePolicy` até 02/out/2026): o audience
    precisa ter `EventAttendee.is_active = true` para aquele evento **e**, neste pedido, estar no
    raio da casa — ver "Presença verificada no show" logo abaixo. Não existe endpoint de consulta
    de status para o audience saber se já é attendee — só tentar e tratar o 422
    (`EntityValidationError`, mensagens de todas as policies que falharem).

- [x] **Presença verificada no show** (02/out/2026) — `core/events/domain/presence/`
  - 🔴 **O buraco que fechou:** o registro de presença não verificava nada. A Home lista shows do
    país inteiro, abrir a tela de pedido chamava `attend-event` em silêncio, e o backend registrava
    a presença sem localização, sem QR e sem checar o status do evento. Quem estava no sofá pedia
    música (e destaque pago) num bar de outra cidade, e contava no público do músico.
  - **Regra:** pedido de música (inclusive destaque) exige evento `active` e o fã a até
    `PRESENCE_RADIUS_METERS` (250) da casa, mais a incerteza do GPS limitada a
    `PRESENCE_ACCURACY_TOLERANCE_CAP_METERS` (150). Leitura com incerteza acima de
    `PRESENCE_MAX_ACCURACY_METERS` (500) é recusada ("sinal fraco"); `mocked: true` (Android) é
    recusada. **Gorjeta não passa por isso** (decisão de produto): não mexe na fila nem no palco.
  - **Uma leitura pontual, nunca rastreamento.** O app lê o GPS no check-in e **a cada pedido**
    (`readVenuePresence`), e o servidor reverifica a cada pedido — o fã pode ter saído do bar. A
    coordenada do fã **não é gravada**: `event_attendees` guarda só `presenceVerifiedAt`,
    `presenceMethod` e `presenceDistanceM` (arredondada). A mensagem de recusa **não revela a
    distância** — ensinaria a quem frauda quanto ajustar.
  - `PresenceVerifier` é serviço de domínio puro; as coordenadas da casa vêm de
    `IVenueLocationPort` (colunas `EstablishmentProfile.location_lat/lng`). Provider único no
    `EventModule` (@Global), usado pelo check-in e pelo `CreateRequestUseCase` — mesma regra, mesma
    config.
  - **Métodos de presença:** `geo` (GPS no raio); `establishment` (a casa ou admin adicionou o fã
    pela rota de attendees — a liberação manual para GPS ruim lá dentro; não exige evento ativo);
    `venue_without_coords` — ⚠️ **exceção deliberada**: casa sem coordenada cadastrada não tem como
    verificar, e reprovar tiraria o pedido do músico por falha da casa. Aceita e loga `warn`.
  - **Evento precisa estar `active`** para o fã fazer check-in (antes aceitava futuro/encerrado).
  - ⚠️ **O que isto NÃO é:** prova forense. GPS falso existe e o iOS não o denuncia. O alvo é o
    caminho trivial; o limite diário e o anti-spam continuam valendo.
  - ⚠️ **Desenvolvimento longe das casas do seed:** suba `PRESENCE_RADIUS_METERS` no `envs/.env`
    local para testar pedido pelo app. Nunca em produção.
  - **Fora do escopo:** `scan_qr` ainda pontua sem presença (foto do QR, até 5/dia por músico).
  - `EventMustBeActivePolicy`, `DailyRequestLimitPolicy`, `NoPendingRequestForMusicianPolicy`,
    `AntiSpamSimilarRecentRequestPolicy` completam a policy chain (`CanMakeRequestPolicy`).
  - 🔴 **Bug corrigido em 14/ago/2026** — `EventPrismaRepository.addAttendee`/`removeAttendee`
    (raw SQL de `current_capacity`) tinham DOIS erros que faziam `POST /audiences/:id/attend-event`
    responder 500 sempre, para qualquer chamador: (1) `${event_id.id}::uuid` — `Event.id` é `String`
    sem `@db.Uuid()` no schema, ou seja, é `text` no Postgres, e o cast produzia
    `operator does not exist: text = uuid`; (2) `current_capacity`/`max_capacity` em snake_case sem
    aspas — as colunas reais são `"currentCapacity"`/`"maxCapacity"` (camelCase, sem `@map` no
    schema), então o Postgres respondia `column "max_capacity" does not exist`. Sem o check-in
    funcionando, a policy de presença (`AudienceMustBeAttendeePolicy` na época) nunca passava — o fluxo de pedido de música estava
    quebrado ponta a ponta para qualquer client (web, mobile), não só para uma integração nova.

- [x] Aceitar e rejeitar pedidos com validações de estado  
       Código: request.aggregate.ts ([17]) (`accept`, `reject`).  
       Regras:
  - Só pedidos `pending` podem ser aceitos ou rejeitados; caso contrário, é lançada exceção.
  - Ao aceitar: `status = accepted`, `responded_at` preenchido, `rejection_reason = null`.
  - Ao rejeitar: `status = rejected`, `responded_at` preenchido, `rejection_reason` opcional.
  - Eventos `RequestAcceptedEvent` e `RequestRejectedEvent` são disparados com dados completos (audiência, músico, música, motivo).

- [x] Edição de pedido restrita a status pendente  
       Código: request.aggregate.ts ([17]).  
       Regras:
  - Métodos como `changeSongTitle`, `changeArtist`, `changeMessage` só funcionam para `status.pending`.
  - Se o status não é pendente, é adicionada uma notificação de erro em vez de lançar exceção, seguindo o padrão de validação.

**Prioridade, anti-spam e insights**

- [x] Cálculo de prioridade e idade do pedido  
       Código: request.aggregate.ts ([17]).  
       Regras:
  - `ageInMinutes`, `isRecent`, `isOld`.
  - `isUrgent`: pedido `pending` há mais de 15 minutos.
  - `priority`: `high` se urgente, `medium` acima de 30 minutos, senão `low` — só idade e status. O antigo `is_priority` afirmado pelo cliente foi **removido** no Bloco 15; prioridade paga é o destaque (ver "Destaque pago").

- [x] Anti-spam por similaridade de pedidos  
       Código: request.aggregate.ts ([17]) (`isSimilarTo`).  
       Regra: pedidos são considerados similares quando possuem mesmo `audience_id`, `musician_id`, `song_title` e `artist`, permitindo filtros na camada de aplicação para evitar spam de duplicatas.

- [x] Limite explícito de pedidos por pessoa/evento  
  `DailyRequestLimitPolicy` com `MAX_REQUESTS_PER_USER_PER_EVENT` — ver "Limite anti-spam" em Audience.

## Escopo do pedido — catálogo da plataforma × repertório do músico *(09/set/2026)*

- [x] 🔴 **O fã busca no catálogo da PLATAFORMA, não no repertório de um músico.**
      `GET /musicians/:musician_id/song-catalog` devolve os pares (título, artista)
      que a SoundMeet já cifrou, **deduplicados entre todos os músicos**.
      ⚠️ "O catálogo do SoundMeet" **não é uma tabela** — `MusicLibrary` é
      biblioteca *pessoal* (`musicianId`), e cada músico tem a própria linha da
      mesma música, com a própria análise. O catálogo é a UNIÃO dessas linhas,
      montada em SQL cru (`searchSongCatalog`), porque `groupBy` do Prisma não
      aceita expressão (`lower(btrim(title))`) como chave — e sem normalizar,
      "Garota de Ipanema" e "garota de ipanema " viram duas entradas.
- [x] 🔴 **O dono de cada linha NUNCA sai na resposta.** A entrada diz "a
      plataforma tem esta música", jamais "fulano toca esta música". O único id
      que sai é `library_id`, e ele é sempre do músico **alvo** da busca.
      Allowlist explícita em `SongCatalogItemPresenter`, mesmo desenho do
      `PublicMusicLibraryItemPresenter`.
- [x] **A rota é AUTENTICADA** (`@Roles("audience","musician","admin")`), ao
      contrário de `GET /musicians/:id/repertoire`, que é `@Public()`.
      `POST /requests` já exige fã autenticado, então uma busca anônima só
      acrescentaria uma superfície raspável do catálogo inteiro — o buraco do
      SM-026, agora com o nosso banco no lugar da LRCLIB.
      ⚠️ Consequência no `soundmeet-web`: o catálogo **não pode** ser
      pré-carregado na RSC de `/evento/[id]`, que renderiza antes do
      cadastro-relâmpago. Quem busca é o formulário, via
      `GET /api/public/audience/song-catalog`.
- [x] **Só entra no catálogo música com conteúdo de cifra**
      (`lrc_normalized IS NOT NULL OR chords IS NOT NULL`) — é a definição de
      "música que ciframos". O predicado é o mesmo de
      `MusicLibrary.hasChordSheetContent()`, **não** `chord_sheet`, que é
      projeção materializada e marcaria como "sem cifra" músicas que o
      `GET .../chord-sheet` serve normalmente.
- [x] 🔴 **`Musician.accepts_requests_outside_repertoire` (default `true`) é
      regra, não filtro de busca.** Com `false`, `CreateRequestUseCase` **recusa**
      pedido que não venha acompanhado de um `library_id` daquele músico
      (`InvalidOperationError` → 422). Um switch que só estreitasse a busca do
      cliente prometeria um limite que o campo de texto livre desfaz no primeiro
      toque — o cliente esconde o campo por conveniência, não por segurança.
      Rota: `PATCH /musicians/:id/request-scope` (`MusicianOwnershipGuard`).
- [x] **Default `true`, e não `null` como `open_to_gigs`.** São consentimentos
      diferentes: `open_to_gigs` expõe o músico a um público novo e exige decisão
      explícita; este só descreve o que o produto já fazia (o fã pede o que quiser,
      o músico recusa). `null` obrigaria todo leitor a inventar a resposta.
- [x] 🔴 **`library_id` de OUTRO músico é recusado nos DOIS escopos** (422,
      `InvalidArgumentError`). Fosse checado só no modo restrito, bastaria o
      músico religar o switch para o pedido passar a apontar para a linha de
      terceiro. A posse é verificada por porta (`IRepertoireMembershipPort`),
      obrigatória no construtor do use-case — opcional, um wiring que a
      esquecesse desligaria a restrição em silêncio.
- [x] **`library_id` nulo é caso legítimo e comum**: o fã digitou à mão, editou o
      texto depois de escolher, ou escolheu música que a plataforma tem e **este**
      músico ainda não cadastrou. Nos três o pedido segue por título e artista.
      A coluna `music_requests.libraryId` **já existia e nunca era preenchida** —
      `MakeMusicRequestUseCase` lê `metadata.library_id` desde sempre e nenhum
      cliente mandava.
- [x] **Quem escolhe o escopo é o SERVIDOR.** Não existe parâmetro de escopo na
      query, de propósito: o use-case lê o músico e devolve
      `scope: "platform" | "repertoire"` já resolvido. O cliente usa isso para
      **explicar** ao fã ("Este artista prefere pedidos do próprio repertório"),
      nunca para decidir.
- [x] **No modo restrito os clientes escondem o texto livre** e o botão só habilita
      com uma escolha que tenha `library_id`. É conveniência: evita o fã escrever
      um pedido inteiro para levar 422.
- ⚠️ **Verificação pendente:** `test/music-library/song-catalog.e2e-spec.ts` existe
      e cobre dedupe, escopo de `library_id` e os dois `scope` contra Postgres real
      — mas **não foi executado** (Docker indisponível na sessão de 09/set/2026).
      O SQL cru desta consulta nunca rodou no banco. Precedente que justifica o
      alerta: os dois bugs de SQL de `event-prisma.repository.ts`, que só
      apareceram contra Postgres real.

## Destaque pago — gorjeta acoplada ao pedido *(27/ago/2026)*

> 🔴 **REVISTO em 28/set/2026 — PAGA ANTES, destaca DEPOIS.** Os itens abaixo
> marcados ~~riscados~~ descrevem o modelo antigo (cobrar no aceite). O que vale:
>
> - [x] **O PIX nasce no PEDIDO** (`CreateRequestUseCase.chargeBoost`), depois das
>       regras e antes de gravar. Provedor fora do ar ⇒ o pedido COM destaque não é
>       criado (o fã tenta de novo ou pede sem); sem a porta de cobrança, recusa
>       (fail closed). O aceite não cobra mais nada.
> - [x] **Só `paid` destaca** — VO (`BOOSTING_STATUSES`) e `ORDER BY` (nível E
>       valor só contam pagos). Fecha a brecha "prometo R$20, furo a fila e não pago".
> - [x] **Recusa:** PIX não pago → `cancelled`; já pago → **`refund_pending`** +
>       `RequestBoostRefundPendingEvent`. Pagamento que chega depois da recusa →
>       `refund_pending`; pagamento atrasado com o pedido ainda aberto → `paid`.
> - [x] A janela (`REQUEST_BOOST_PAYMENT_WINDOW_MINUTES`) conta do PEDIDO; vencida,
>       o pedido segue como comum.
> - [ ] 🔴 **Custódia, reembolso e taxas são TAREFA ABERTA** —
>       `Docs/funcionalidades/reembolso-do-destaque-pago.md`. Hoje o dinheiro cai na conta
>       MP do músico no pagamento (não há retenção até o pedido ser tocado), e
>       `refund_pending` ainda não devolve nada.

- [x] ~~(modelo antigo)~~ 🔴 **A cobrança só nasce no ACEITE do músico.** Antes disso o que existe é
      uma PROMESSA do fã, e nenhum centavo saiu da conta de ninguém. É a decisão
      que dispensa **todo** o código de estorno neste fluxo: recusa em
      `promised` vira `cancelled` e a história acaba.
      Código: `RequestBoost` (VO), `RespondToRequestUseCase.chargeBoostIfPromised`.
- [x] **Estados:** `promised` → `awaiting_payment` → `paid`, com `expired` e
      `cancelled` como saídas. Os três terminais são irreversíveis — reabrir
      qualquer um significaria cobrar de novo ou destacar um pedido que ninguém
      pagou.
- [x] ~~(modelo antigo)~~ **`promised` já destaca a fila, mesmo sem pagamento.** Não é descuido: quem
      paga só depois do aceite precisa que o destaque exista ANTES do aceite,
      senão o músico nunca vê o pedido para aceitar. O risco (o fã promete e
      some) é limitado ao mesmo resultado de um pedido comum — o músico tocou de
      graça — e `NoPendingRequestForMusicianPolicy` já limita a um pedido
      pendente por músico.
- [x] ~~(modelo antigo)~~ 🔴 **O aceite NUNCA falha por causa do gateway.** Provedor fora do ar,
      token expirado: o `accept` conclui e o destaque vai para `cancelled`.
      Derrubar o aceite deixaria o músico travado no palco, e o pedido de música
      — que é o produto — deixaria de funcionar por um problema de pagamento.
- [x] **Ordem obrigatória: cobrança primeiro, pedido depois.** A FK
      `music_requests.boostTipId -> tips.id` faz o banco EXIGIR isso. No pior
      caso sobra uma cobrança `pending` que ninguém paga — barulho, não dano; a
      ordem inversa deixaria o pedido apontando para cobrança inexistente.
- [x] **Elegibilidade é checada na CRIAÇÃO, não no aceite**
      (`MusicianAcceptsTipsPolicy` + `ITipEligibilityPort`). Sem conta do
      provedor vinculada não há para onde o dinheiro ir; descobrir isso só no
      aceite faria o músico aceitar no meio do show e a cobrança quebrar — com o
      fã achando que ia pagar e o músico achando que ia receber.
- [x] **Piso configurável** (`REQUEST_BOOST_MIN_AMOUNT`, default R$2). Sem piso o
      destaque vira grátis na prática, porque a ordenação entre destacados é por
      valor. Mora em config: reajustar piso não pode custar mudança de domínio.
- [x] ~~(modelo antigo)~~ 🔴 **A janela de pagamento conta do ACEITE (`charged_at`), nunca da
      promessa.** O fã promete quando faz o pedido; o músico pode aceitar meia
      hora depois, e contar da promessa entregaria um QR já vencido no instante
      em que o fã o recebe. `REQUEST_BOOST_PAYMENT_WINDOW_MINUTES`, default 15.
- [x] **Expirar tira o destaque, não o aceite.** O pedido continua `accepted` —
      o músico já disse sim, muitas vezes já tocou, e desfazer isso puniria o
      artista pelo comportamento do fã. Perde-se a posição na fila e a
      dedicatória pública. Job a cada 5 min (`ExpireRequestBoostsJob`).
- [x] **Ordenação da fila:** destaque primeiro, maior valor primeiro, depois a
      prioridade por idade que já existia.
      🔴 Os dois níveis de destaque são **sempre DESC**, independentes de
      `sort_dir` — deixá-los seguir o parâmetro faria `?sort_dir=asc` enterrar no
      fim da fila exatamente os pedidos pagos. Verificado contra Postgres real em
      `test/request/boosted-request-ordering.e2e-spec.ts` (o `ORDER BY` é SQL
      cru; o repositório in-memory não prova nada sobre ele).
- [x] 🔴 **A dedicatória é pública SÓ depois de paga.** `Request.publicDedication`
      é o único portão, e quem o lê é o "tocando agora"
      (`GetLivePerformanceUseCase`). O campo cru continua saindo em
      `RequestOutput` porque toda rota que o serve passa por
      `assertRequestParticipant` — e o **músico precisa ler a dedicatória para
      decidir se aceita**, que é metade do motivo para aceitar.
- [x] **A UI do músico nunca diz "recebido" antes do webhook.**
      `awaiting_payment` mostra "a confirmar". Mesma disciplina que mantém
      `held_balance` fora de `balance`. Regra no domínio do mobile
      (`request-boost.rules.ts`), com teste — dentro do JSX seria intestável.
- [x] 🔴 **`is_priority` foi REMOVIDO.** Era campo fantasma: o cliente mandava
      `true`, `MakeMusicRequestUseCase` ecoava `true` em `request_metadata`, e
      nada era persistido — não chegava ao `CreateRequestUseCase` nem ao
      agregado. Além de morto, era prioridade afirmada pelo próprio cliente. A
      prioridade real agora custa dinheiro e é verificada pelo domínio.

**Rotas**

- `POST /audiences/:id/music-requests` e `POST /requests` — body aceita
  `boost { amount, dedication? }`.
- `GET /requests/:id/boost/payment` — o QR da cobrança, relido a qualquer
  momento. Existe porque a cobrança nasce no aceite, com o fã fora da tela.
- `GET /requests/musicians/:id/suggestions` ganhou `accepts_tips` — a UI esconde
  o destaque em vez de oferecer algo que a escrita vai recusar. Viaja aqui, e
  não no perfil do músico, porque `musicians-module` lendo `MusicianWallet`
  criaria ciclo com `PaymentModule`.

**Notificações** (socket `/notifications`, rooms `user:<id>`)

- `request.boost.payment_ready` → fã, no aceite (com o QR).
- `request.boost.paid` → fã, na confirmação (gatilho da celebração).
- `request.boost.confirmed` → músico, para o card virar "confirmado" ao vivo.
- ⚠️ **Só socket para o fã, sem push.** Desde 02/out/2026 (Bloco 19.B) o fã tem
  push token, mas só os avisos de quem ele **segue** o usam; os eventos de pedido
  ainda não. Quem está com o app fechado no momento do aceite não é avisado —
  o caminho de recuperação é o banner de pendência na Home, alimentado por
  `GET /requests/:id/boost/payment`. Registrar push de audience é bloco à parte.

**Gamificação integrada ao pedido**

- [x] Pontos por pedido criado e pedido aceito  
       Implementado via integração entre `Request`, `UserPoints`/`AudiencePoints` e `PointsSource` em:
  - request.aggregate.ts ([17]) (métodos que calculam valor em pontos).
  - user-points.aggregate.ts ([18]) (`makeMusicRequest`, `acceptedMusicRequest`).  
    Regras:
  - Pedido criado: +25 pts.
  - Pedido aceito/tocado: +50 pts adicionais.

[17]: ../../src/core/request/domain/request.aggregate.ts
[18]: ../../src/core/gamification/domain/user-points.aggregate.ts