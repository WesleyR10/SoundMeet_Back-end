# Regras de Negócio – SoundMeet (Mapa Atual x Visão Alvo)

Este documento resume as principais regras de negócio da plataforma SoundMeet, cruzando:

- o que foi especificado em [features.md](features.md) ([1])
- com o que já está implementado no código

Marcações:

- `[x]` Implementado (com índice de código)
- `[~]` Parcialmente implementado (há estrutura, mas falta completar)
- `[ ]` Ainda não implementado

Índice de código:

- use o identificador `[N]` para abrir o arquivo correspondente

---

## Domínio Auth (Registro e Identidade)

- [x] Registro de novos usuários via `POST /api/v1/auth/register` (`src/core/auth/application/use-cases/register/register.use-case.ts`) — única porta de entrada, já que `registrationAllowed: false` no realm Keycloak.
  **Invariante crítica — NUNCA quebrar:** o ID do aggregate criado (`musician_id` ou `audience_id`) é sempre **igual ao `sub`** do usuário no Keycloak. O sistema de ownership (`MusicianOwnershipGuard`/`AudienceOwnershipGuard`, Bloco 4B) compara `currentUser.userId` (== `sub` do JWT) diretamente contra o ID do recurso na URL — se um fluxo de criação de conta usar um ID diferente do `sub`, o ownership dessa conta quebra silenciosamente (o dono nunca consegue editar o próprio recurso). Qualquer novo fluxo de criação de `Musician`/`Audience` vinculado a uma conta Keycloak deve respeitar essa invariante.
  Detalhes de arquitetura em [auth/keycloak.md](auth/keycloak.md).
- [x] Login por email/senha via `POST /api/v1/auth/login` (`src/core/auth/application/use-cases/login/login.use-case.ts`) — resolve `role`/`profile_id` consultando os repositórios locais por email, nunca decodificando o JWT no backend.
- [x] Registro de estabelecimento via `POST /api/v1/auth/register-establishment` (`src/core/auth/application/use-cases/register-establishment/register-establishment.use-case.ts`, 06/ago/2026) — rota **separada** do `POST /auth/register`, que só aceita `musician`/`audience`. Antes disto não existia caminho nenhum para criar a primeira conta de estabelecimento: `POST /establishments` já exigia a role `establishment`.
  **A invariante `aggregate_id == sub` NÃO se aplica aqui — e isso é deliberado.** Uma conta pode operar até 3 estabelecimentos, então o `Establishment` tem UUID próprio e quem autoriza o dono é o claim multivalorado `establishment_ids` (escrito via `IIdentityClaimsWriter`), lido pelo `EstablishmentOwnershipGuard`. Qualquer fluxo novo que crie `Establishment` vinculado a uma conta deve escrever esse claim — sem ele o dono fica trancado para fora do que acabou de criar.
  Ordem importa: o claim é gravado **antes** do insert. Falhar antes não cria nada; a ordem inversa deixaria um estabelecimento inoperável que *parece* ter sido criado com sucesso.
  ⚠️ O claim só entra no **próximo** token — o output devolve `needs_token_refresh: true` e o cliente precisa renovar antes da primeira chamada protegida, senão toma 403.
- [x] Login social + cadastro pendente via `POST /api/v1/auth/social-signup` (`src/core/auth/application/use-cases/social-signup/social-signup.use-case.ts`) — cobre usuário autenticado via provedor externo (Google) no Keycloak mas ainda sem role/aggregate local. **A invariante `musician_id`/`audience_id` == `sub` também vale neste caminho** — o aggregate é criado usando o `userId` do token (`@CurrentUser()`), nunca um ID novo. Compensação em caso de falha remove só a role atribuída (`removeRealmRole`), nunca deleta o usuário Keycloak (a conta não foi criada por nós).

---

## Domínio Musician (Músico/Banda)

**Perfil, QR Code e dados básicos**

- [x] Perfil de músico/banda com dados básicos (nome, stage_name, bio, contatos)  
       Código: musician.aggregate.ts ([2]).  
       Regra: criação exige dados obrigatórios (nome, email), usando VO como `Email` e `Phone`.

- [x] QR Code permanente vinculado ao perfil do músico (não por apresentação)  
       Código: musician.aggregate.ts ([2]) (`generateQRCode`).  
       Regra: QR usa esquema `soundmeet://musician/{id}` + URL pública `https://soundmeet.com.br/musician/{id}` e é gerado na criação.

- [x] Ativação/desativação e verificação de perfil  
       Código: musician.aggregate.ts ([2]).  
       Regras:
  - `activate`/`deactivate` mudam `is_active`.
  - `verify` define `is_verified = true` e dispara evento de domínio.

**Gêneros, instrumentos e experiência**

- [x] Lista de gêneros e instrumentos com validação de negócio  
       Código: musician.aggregate.ts ([2]).  
       Regra: `changeGenres`/`changeInstruments` utilizam o validator de Musician; listas vazias ou inválidas geram erros de notificação.

- [x] Anos de experiência com regras de consistência  
       Código: musician.aggregate.ts ([2]).  
       Regra: experiência não pode ser negativa; há flags derivadas (ex.: músico experiente a partir de certo limiar).

**Avaliações, reputação e analytics básicos**

- [x] Sistema de rating do músico com média e contagem de avaliações  
       Código: musician.aggregate.ts ([2]) usando VO `Rating`.  
       Regras:
  - `addRating` recebe valor e autor; atualiza média ponderada e `total_ratings`.
  - Ratings fora da faixa permitida são rejeitados via notification + `EntityValidationError`.
  - Flags como `isHighlyRated` usam limite mínimo de notas e quantidade.

- [~] Analytics detalhados (engajamento, comparação entre eventos, demografia musical)  
  Parcialmente suportado pelos campos e métodos de rating do Musician e pelas entidades de Request e Gamification (pontos, interações).  
  Ainda **não existem** agregados/relatórios dedicados a analytics de músico conforme detalhado em _Features_.

**Bandas e divisão de ganhos**

- [x] Agregado Band com membros e papéis  
       Código: band.aggregate.ts ([3]).  
       Regras principais:
  - Cada banda possui `band_id`, nome, membros (`musician_id`, role, joined_at).
  - `addMember` impede duplicidade de músico na mesma banda.
  - `removeMember` falha se o membro não existir.
  - Flags de status (`is_active`) e validação de campos via validator próprio.

- [x] Divisão automática de gorjetas entre membros da banda (split igualitário)  
       Código: confirm-tip-payment.use-case.ts ([4]).  
       Regras:
  - Se `Tip` tem `band_id`, o valor líquido é dividido igualmente entre os membros ativos.
  - Resto da divisão fica com o primeiro membro (tratado como líder).
  - Cada membro recebe crédito em sua `MusicianWallet` e é criada uma `Transaction` individual com metadata (`parent_transaction_id`, `tip_id`, `is_split`).

- [ ] Percentuais customizáveis de split por membro  
       Não implementado: hoje o split é igualitário, sem configuração de percentuais personalizados como previsto em _Monetização Especializada_.

**Busca de músicos para contratação**

- [x] Filtros por nome, e-mail, gêneros, instrumentos e status ativo  
       Código: musician-in-memory.repository.ts ([5]).  
       Regra: `applyFilter` suporta filtros por `name`, `stage_name`, `email`, `genres`, `instruments`, `is_active`, e ordenação por `name` e `created_at`.

- [x] Dashboard de contratação com histórico de performances e engajamento  
       Código: get-hiring-dashboard.use-case.ts ([5]).  
       Regra: `GetHiringDashboardUseCase` consolida histórico de eventos/performance/engajamento por músico para o estabelecimento; exposto em `GET establishments/:id/hiring-dashboard`, protegido por `EstablishmentOwnershipGuard`. **(corrigido jul/2026 — texto anterior estava desatualizado)**

---

## Domínio Establishment (Estabelecimentos)

**Cadastro, QR Code e tipos de estabelecimento**

- [x] Cadastro de estabelecimento com endereço e tipo (bar, restaurante, etc.)  
       Código: establishment.aggregate.ts ([6]).  
       Regras:
  - `create` valida **apenas `name`, `email` e `establishment_type`** — ver `establishment.validate(["name", "email", "establishment_type"])`. **(corrigido 07/ago/2026: o texto anterior dizia que `address` era obrigatório; não é, e essa premissa errada quase entrou no DTO de cadastro do Bloco 9.1.)**
  - Endereço **não** pertence ao agregado raiz: vive em `EstablishmentProfile`, preenchido depois. `Address` é VO com campos obrigatórios (`street`, `number`, `city`, `state`, `zipCode`) quando informado.
  - `CNPJ` opcional, validado via VO específico (`CNPJ`), **único no banco** e checado antes de tocar o provedor de identidade no registro (`findByCnpj`, Bloco 9.1).

- [x] QR Code permanente do estabelecimento  
       Código: establishment.aggregate.ts ([6]) (`generateQRCode`).  
       Regra: QR segue o padrão `soundmeet://establishment/{id}` com URL pública `https://soundmeet.com.br/establishment/{id}`.

- [x] Validação de CNPJ com tratamento de erro de domínio  
       Código: establishment.aggregate.ts ([6]).  
       Regra: `changeCnpj` captura `InvalidCNPJError`, adiciona erro de notificação em `cnpj` e evita lançamento de exceção genérica.

**Avaliações e reputação do estabelecimento**

- [x] Sistema de rating com média ponderada e contagem de avaliações  
       Código: establishment.aggregate.ts ([6]).  
       Regras:
  - `addRating` cria novo `Rating` e recalcula média para 1 casa decimal.
  - Evento `EstablishmentRatedEvent` é disparado com `ratedBy` e `comment` (opcional).
  - Flags derivadas:
    - `isHighlyRated`: rating bom e `total_ratings >= 10`.
    - `isPopular`: `total_ratings >= 50`.
    - `isBar`/`isRestaurant`/`isClub` conforme `establishment_type`.

- [x] Verificação de estabelecimento  
       Código: establishment.aggregate.ts ([6]).  
       Regra: `verify` define `is_verified = true` e dispara `EstablishmentVerifiedEvent`.

**Funcionalidades avançadas para estabelecimentos (planejadas)**

- [x] Dashboard de contratação com histórico de performances e engajamento — ver Domínio Musician acima (`get-hiring-dashboard.use-case.ts`) **(corrigido jul/2026)**
- [ ] Sistema de avaliações/reviews entre estabelecimentos e músicos
- [~] Agenda compartilhada com disponibilidade de músicos e bandas — leitura já existe (`GET scheduling/calendar/free-busy`, `GET scheduling/calendar/month-slots`, ambos `@Public()`); falta o "tempo real" (push via WebSocket) **(corrigido jul/2026 — estava `[ ]`)**
- [x] Sistema de comunicação (chat seguro, histórico de conversas) — `src/core/chat/` (Conversation + Message) + `chat-module` (gateway `/chat`, REST, 15 testes de integração), registrado em `app.module.ts` **(corrigido jul/2026 — estava `[ ]`, contradizia roadmap.md Bloco 7.1 que já marca `✅`)**
- [x] **Caixa de indicações do estabelecimento (28/set/2026)** — `GET /establishments/:establishment_id/indications` + `PATCH .../:indication_id` (vista/arquivada), com tela em `/dashboard/indicacoes` no web. 🔴 **Antes disso a indicação era DESCARTADA:** `IndicateMusicianUseCase` só dava pontos ao fã e emitia `MusicianIndicatedEvent`, que **nenhum handler escutava** — não faltava tela, faltava dado. Ver seção "Indicação de talentos" abaixo. Priorização por relevância segue pendente (a ordenação é cronológica)
- [ ] Gestão completa de eventos (confirmação, lembretes, pagamentos automatizados)
- [ ] Módulo de marketing (integração social, geração de artes, campanhas, cupons)

Essas funcionalidades estão descritas em detalhes em _Features_, mas ainda não possuem fluxos completos (ex.: controllers, realtime, chat). A base de reservas e disponibilidade está concentrada no domínio _Scheduling_.

---

## Domínio Scheduling (Agenda, Reservas e Disponibilidade)

**Booking (Reserva)**

- [x] Booking representa uma reserva negociada com janela de tempo e status  
       Código: booking.aggregate.ts ([7]).  
       Regras:
  - Reserva tem `start_at` e `end_at`, com `buffer_minutes` (janela efetiva usada para conflitos é a janela com buffer).
  - Ciclo de vida inclui `pending`, `confirmed`, `cancelled`, `expired`, `completed` (com timestamps por transição quando aplicável).
  - Confirmação é permitida somente quando `status = pending`.

**Use cases de agendamento**

- [x] Propor reserva (pending) para músico ou banda com validação de disponibilidade e conflitos confirmados  
       Código: propose-booking.use-case.ts ([8]).  
       Regras:
  - Para músico: valida `Availability` do músico (se existir) e impede conflito com bookings confirmados.
  - Para banda: valida `Availability` da banda (se existir) e impede conflito com bookings confirmados da própria banda.
  - A proposta de reserva da banda não depende da disponibilidade dos membros.

- [x] Confirmar reserva (pending → confirmed) com validações e bloqueio operacional de membros  
       Código: confirm-booking.use-case.ts ([9]).  
       Regras:
  - A confirmação valida disponibilidade do alvo (músico ou banda) e conflitos confirmados do próprio alvo.
  - Em reservas de banda, após confirmar, o sistema tenta bloquear a agenda dos membros no intervalo com buffer, criando `unavailabilities` para cada membro. Esse bloqueio é operacional e não impede a confirmação caso algum membro já esteja indisponível.

**Leitura de agenda (Bloco 9.2 — 07/ago/2026)**

- [x] Listar reservas e propostas do usuário autenticado — `GET /scheduling/bookings`,
      `GET /scheduling/bookings/:id`, `GET /scheduling/inquiries`.
      Código: `list-bookings.use-case.ts`, `get-booking.use-case.ts`, `list-inquiries.use-case.ts`.
      Regras:
  - Antes disto o domínio só tinha propose/confirm/cancel e create/accept/reject: **o estabelecimento propunha uma reserva e nunca mais a via**. As únicas leituras eram `free-busy`/`month-slots`, agregadas e sem status/cachê.
  - **O escopo vem do token, nunca da query.** `participant_ids` recebe todas as identidades (`sub` + claims `establishment_ids`/`band_ids`) e casa em **OR** contra `establishment_id`/`musician_id`/`band_id` — um id só não dá conta, porque o lado pelo qual a pessoa participa depende do papel. Filtros de query apenas **refinam** dentro do escopo (AND); pedir o `establishment_id` de outro devolve zero.
  - **Fail-closed:** ator identificado mas sem nenhuma identidade utilizável recebe 403. Lista vazia de identidades **nunca** vira "sem filtro" — isso devolveria a agenda de todos os usuários.
  - **Ver ≠ decidir.** `GetBooking` usa `assertNegotiationViewer`: qualquer integrante da banda lê o show marcado, sem precisar ser líder. Liderança segue exigida para confirmar/cancelar (`assertNegotiationParticipant`).
  - Admin e chamadas internas sem ator (jobs) não são restringidos.

**Availability (Agenda/Disponibilidade)**

- [x] Disponibilidade pode ser de músico ou de banda (exclusivo)  
       Código: availability.aggregate.ts ([10]).  
       Regras:
  - `musician_id` e `band_id` são mutuamente exclusivos (um ou outro).
  - `timezone` influencia a avaliação de regras semanais.
  - `weekly_rules` e `unavailabilities` são usados para decidir `isAvailable(start, end)`.

- [x] Persistência de agenda para músico e banda, incluindo regras semanais  
       Código: availability-prisma.repository.ts ([11]) e schema.prisma ([12]).  
       Regras:
  - Músico: `musician_calendar_settings`, `musician_availability_rules`, `musician_unavailability`.
  - Banda: `band_calendar_settings`, `band_availability_rules`, `band_unavailability`.

- [~] Limite de shows por dia configurável  
  O campo existe (`max_shows_per_day`), mas ainda não há regra consolidada aplicando esse limite no cálculo de disponibilidade.

**Google Calendar (sync one-way de bookings — jul/2026)**

- [x] Músico (ou líder de banda) conecta a própria conta Google e bookings confirmados viram eventos na agenda pessoal dele; cancelamentos removem o evento  
       Código: domínio `src/core/google-calendar/`, módulo `src/nest-modules/google-calendar-module/`.  
       Regras:
  - Sync é **one-way** (SoundMeet → Google). Nunca lê a agenda do Google de volta.
  - Conexão é sempre por `musician_id` (1:1, tabela `google_calendar_integrations`). Em booking de banda, sincroniza **apenas a agenda do líder** (`role === "leader"` em `Band.members`); banda sem líder é no-op. O registro `google_calendar_synced_events` guarda em qual agenda o evento foi criado — cancelamento usa esse registro, nunca re-resolve o líder (troca de liderança não aponta pra agenda errada).
  - Tokens OAuth persistidos **cifrados** (AES-256-GCM, chave `TOKEN_ENCRYPTION_KEY` de 32 bytes via env; IV único por operação). Nunca em texto claro, nunca logados, nunca expostos em presenter/`toJSON()`.
  - Client OAuth **separado** do login social (`GOOGLE_CALENDAR_CLIENT_ID/SECRET` ≠ `GOOGLE_KEYCLOAK_CLIENT_ID/SECRET` — o IdP do Keycloak tem `storeToken:false` e é inutilizável para Calendar). Escopo mínimo: `calendar.events` + `openid email`.
  - Callback OAuth é rota fixa `GET /google-calendar/oauth/callback` (`@Public()` — redirect de navegador sem Bearer): a autenticidade vem do `state` assinado (HMAC-SHA256 + nonce + expiração de 10min), validado antes de qualquer troca de `code`.
  - Sync é assíncrono via RabbitMQ (`GOOGLE_CALENDAR_SYNC_TRANSPORT`, default `noop` = feature inerte): handler `@OnEvent` cross-module só enfileira, o consumer chama a API do Google. Idempotência em 3 camadas: `messageId` na fila, status em `google_calendar_synced_events` e id determinístico do evento no Google (UUID do booking sem hífens; 409 = já criado = sucesso). Corrida confirm/cancel entre filas tem compensação: re-check do status pós-create remove evento órfão.
  - `GoogleCalendarAuthError` (token revogado) é **não-retriável** (listado no `RabbitmqConsumeErrorFilter`) e desativa a integração — o músico reconecta pelo app. Indisponibilidade do Google é retriável (backoff da fila). Músico sem conta conectada é estado normal → no-op silencioso, nunca erro.
  - Disconnect (`DELETE /musicians/:id/google-calendar`) revoga o token no Google best-effort e **sempre** zera os tokens locais (indisponibilidade do Google não bloqueia o disconnect).

---

## Domínio Audience (Público)

**Cadastro, perfil e preferências**

- [x] Perfil de público com preferências musicais e configurações de descoberta  
       Código: audience.aggregate.ts ([13]).  
       Regras:
  - Campos principais: `email`, `name`, `nickname`, `avatar`, `phone`.
  - Preferências: `favorite_genres`, `favorite_artists`, `favorite_instruments`, `preferred_languages`.
  - Configurações: `notification_settings`, `privacy_settings`, `discovery_settings`, `musicDiscoverySettings`.
  - Flags derivadas: `isProfileComplete`, `isNewUser`, etc.

- [x] Validação de dados via notification pattern  
       Código: audience.aggregate.ts ([13]).  
       Regra: `validate` utiliza `AudienceValidatorFactory`; erros geram `EntityValidationError` conforme padrão da camada de domínio.

- [x] 🔴 **O registro é o ÚNICO caminho de nascimento de um Audience** (SM-021, 26/ago/2026)  
       Código: `register.use-case.ts`; `audiences.controller.ts` (pela ausência).  
       Regras:
  - **`POST /audiences` não existe** — a rota era `@Public()` e foi removida junto
    com o `CreateAudienceUseCase`, o input e o DTO.
  - O motivo não é só a rota estar aberta: o use-case criava o agregado com **UUID
    aleatório**, enquanto o canônico faz `new AudienceId(externalId)` — o `sub` do
    Keycloak. O resultado era perfil órfão: gente que não loga, não é dona de
    e-mail nenhum e ocupa banco. Qualquer automação podia despejá-los à vontade.
  - **Restringir a `admin` não resolveria.** Uma capacidade que só sabe produzir
    agregado violando a invariante de identidade do sistema não fica melhor com
    autorização — fica mais discreta. Ver a nota de identidade: músico e público
    usam o `sub` como id; estabelecimento e banda têm UUID próprio.
  - Regressão em `audiences.controller.spec.ts`: uma varredura da metadata do Nest
    afirma que nenhuma rota do controller é `@Public()` e que não há `POST` na raiz
    do recurso — porque o risco real não é restaurarem o método com o mesmo nome, é
    alguém adicionar um `@Post()` novo sem saber por que ele não existia.

**Gamificação por Audience (pontos e níveis)**

- [x] Pontuação por ações do público (scan, pedidos, acertos, gorjetas, social, etc.)  
       Código: audience.aggregate.ts ([13]) em conjunto com VO `Points` e `AudiencePoints`.  
       Regras alinhadas com _Gamificação Avançada_ em _Features_:
  - Scan QR: +10 pts
  - Pedido musical: +25 pts
  - Pedido aceito/tocado: +50 pts
  - Gorjetas: 1 pt por real (via fluxo de tipagem)
  - Social share: +50 pts
  - Outras ações: indicação, presença em eventos, completar perfil, etc.

- [x] Sistema de níveis com benefícios por faixa de pontos  
       Código: user-level.vo.ts ([14]).  
       Regras:
  - Níveis 1 a 5 (Novato, Fã, Apoiador, VIP, Lenda) com intervalos de pontos bem definidos.
  - Cada nível define benefícios (`benefits`) como prioridade em pedidos, descontos em gorjetas, acesso a eventos VIP.
  - `getLevelByPoints` determina o nível a partir do total de pontos.

- [x] Badges básicos por milestones de interação  
       Código: audience.aggregate.ts ([13]).  
       Exemplo:
  - Badge “Iniciante Musical” no primeiro scan.
  - Badge “Sugestor” concedido no primeiro pedido via make-music-request.use-case.ts ([15]).  
    Outras badges avançadas (Mecenas, Discoverer, Socializer, Super Fã, etc.) estão estruturadas no domínio de Gamification, mas ainda não totalmente integradas ao fluxo de Audience.

**Pedidos musicais e votação**

- [x] Criação de pedido musical pelo público a partir do perfil do músico  
       Código: audience.aggregate.ts ([13]) (`makeMusicRequest`) e make-music-request.use-case.ts ([15]).  
       Regras:
  - Verificação de permissão (`canMakeRequest`) baseada no nível/pontos.
  - Pontuação +25 pts e possível badge “Sugestor”.
  - Emissão de evento de domínio `MusicRequestMadeEvent` com metadados (músico, música, artista, etc.).

- [x] Votação em músicas/pedidos  
       Código: audience.aggregate.ts ([13]) (`voteForSong`).  
       Regras:
  - Incremento de pontos por voto.
  - Emissão de evento `SongVotedEvent` com `request_id` e tipo de voto (`up`/`down`).
  - O intervalo de 2–3 minutos entre músicas e algoritmos de votação avançados ainda não estão encapsulados em um agregado próprio.

- [~] Limite anti-spam de pedidos por pessoa/evento  
  Parcialmente suportado via lógica de `Request.isSimilarTo` (anti-duplicação por usuário/música) e validações no agregado de `Request`.  
  Ainda não existe uma regra global consolidada de “máximo de pedidos por evento por usuário”.

**Gorjetas e interação social pela Audience**

- [x] Registro de gorjetas enviadas pelo público para músicos/bandas  
       A lógica financeira está no domínio Payment (ver seção Payment). Em Audience, o envio de gorjeta gera pontos e interações gamificadas (`sendTip`, `addTipPoints`).

- [~] Wall de apoiadores e dashboard visual de gorjetas para o público  
  Estruturas de transações e wallets já existem (Payment), mas não há ainda projeções dedicadas para um “Wall de Apoiadores” do ponto de vista do público.

**Descoberta de músicos e indicação para estabelecimentos**

- [x] Recomendação de músicos com base nas preferências do público  
       Código: recommend-musicians.use-case.ts ([16]).  
       Regra: usa `favorite_instruments` e `favorite_genres` do Audience para filtrar músicos ativos via `MusicianRepository.search`.

- [x] **Sistema de indicação de talentos para estabelecimentos (28/set/2026)** — ciclo fechado: domínio `src/core/indication/` (agregado + 3 repositórios), `IndicateMusicianSheet` no perfil público do músico (mobile), caixa de entrada no dashboard do estabelecimento (web) e pontos no ledger da gamificação. Ver seção dedicada abaixo.

---

## Domínio Request (Pedidos Musicais)

**Criação e ciclo de vida do pedido**

- [x] Pedido musical ligado a público, músico, música e artista  
       Código: request.aggregate.ts ([17]).  
       Regras:
  - Campos principais: `audience_id`, `musician_id`, `song_title`, `artist`, mensagem opcional, flags e metadados.
  - `status` inicial é `pending`.
  - Datas: `created_at`, `responded_at`.

- [x] **`CreateRequestUseCase` exige presença comprovada, via `CanMakeRequestPolicy`**
       (`core/request/domain/policies/can-make-request.policy.ts`) — não documentado antes de
       14/ago/2026, achado por teste real contra o backend (não por leitura de DTO, que marca
       `event_id` como opcional):
  - `MusicianMustBePerformerPolicy`: `event_id`+`musician_id` precisa ter uma linha `EventMusician`
    com `status != cancelled` (`eventRepo.isMusicianPerformer`).
  - `AudienceMustBeAttendeePolicy`: o audience precisa ter `EventAttendee.is_active = true` para
    aquele evento (`eventRepo.isAudienceAttendee`) — ou seja, precisa ter passado por
    `POST /audiences/:id/attend-event` (ou `POST /establishments/:id/events/:event_id/attendees`)
    ANTES do pedido. Não existe endpoint de consulta de status para o audience saber se já é
    attendee — só tentar e tratar o 422 (`EntityValidationError`, mensagens concatenadas de todas
    as policies que falharem, ex.: `"Musician is not a performer in this event, Audience is not an
    active attendee in this event"`).
  - `EventMustBeActivePolicy`, `DailyRequestLimitPolicy`, `NoPendingRequestForMusicianPolicy`,
    `AntiSpamSimilarRecentRequestPolicy` completam a policy chain (`CanMakeRequestPolicy`).
  - 🔴 **Bug corrigido em 14/ago/2026** — `EventPrismaRepository.addAttendee`/`removeAttendee`
    (raw SQL de `current_capacity`) tinham DOIS erros que faziam `POST /audiences/:id/attend-event`
    responder 500 sempre, para qualquer chamador: (1) `${event_id.id}::uuid` — `Event.id` é `String`
    sem `@db.Uuid()` no schema, ou seja, é `text` no Postgres, e o cast produzia
    `operator does not exist: text = uuid`; (2) `current_capacity`/`max_capacity` em snake_case sem
    aspas — as colunas reais são `"currentCapacity"`/`"maxCapacity"` (camelCase, sem `@map` no
    schema), então o Postgres respondia `column "max_capacity" does not exist`. Sem o check-in
    funcionando, `AudienceMustBeAttendeePolicy` nunca passava — o fluxo de pedido de música estava
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
  - `isUrgent`: pedidos pendentes com idade acima de um certo limiar.
  - `priority`: classificação (alta/média/baixa) combinando idade, status e flags de prioridade.

- [x] Anti-spam por similaridade de pedidos  
       Código: request.aggregate.ts ([17]) (`isSimilarTo`).  
       Regra: pedidos são considerados similares quando possuem mesmo `audience_id`, `musician_id`, `song_title` e `artist`, permitindo filtros na camada de aplicação para evitar spam de duplicatas.

- [~] Limite explícito de pedidos por pessoa/evento  
  Ainda não há uma contagem consolidada “X pedidos por usuário por evento”. O que existe é a detecção de duplicidade via `isSimilarTo` e lógica de priorização por idade/estado.

### Destaque pago — gorjeta acoplada ao pedido *(27/ago/2026)*

- [x] 🔴 **A cobrança só nasce no ACEITE do músico.** Antes disso o que existe é
      uma PROMESSA do fã, e nenhum centavo saiu da conta de ninguém. É a decisão
      que dispensa **todo** o código de estorno neste fluxo: recusa em
      `promised` vira `cancelled` e a história acaba.
      Código: `RequestBoost` (VO), `RespondToRequestUseCase.chargeBoostIfPromised`.
- [x] **Estados:** `promised` → `awaiting_payment` → `paid`, com `expired` e
      `cancelled` como saídas. Os três terminais são irreversíveis — reabrir
      qualquer um significaria cobrar de novo ou destacar um pedido que ninguém
      pagou.
- [x] **`promised` já destaca a fila, mesmo sem pagamento.** Não é descuido: quem
      paga só depois do aceite precisa que o destaque exista ANTES do aceite,
      senão o músico nunca vê o pedido para aceitar. O risco (o fã promete e
      some) é limitado ao mesmo resultado de um pedido comum — o músico tocou de
      graça — e `NoPendingRequestForMusicianPolicy` já limita a um pedido
      pendente por músico.
- [x] 🔴 **O aceite NUNCA falha por causa do gateway.** Provedor fora do ar,
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
- [x] 🔴 **A janela de pagamento conta do ACEITE (`charged_at`), nunca da
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
- ⚠️ **Só socket para o fã, sem push.** `Audience` não tem `push_token` (só
  `Musician`). Quem está com o app fechado no momento do aceite não é avisado —
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

---

## Domínio Payment (Gorjetas, Transações e Carteiras)

**Gorjetas (Tip)**

- [x] Agregado Tip com vínculo a público, músico e banda  
       Código: tip.aggregate.ts ([19]).  
       Regras:
  - Campos: `tip_id`, `audience_id`, `musician_id`, `band_id`, `amount`, `message`, `is_anonymous`, `show_in_wall`, `status`, `payment_method`, `pix_key`.
  - ⚠️ **Correção (07/ago/2026):** o texto anterior dizia `user_id` **(opcional)**. **É `audience_id` e é obrigatório** — `Tip.audience_id: Uuid` no agregado e `audienceId String` **NOT NULL** com FK `onDelete: Restrict` no Prisma. A premissa errada quase virou uma tarefa de "gorjeta anônima" no Bloco 9.6.
  - **Anonimato é propriedade de EXIBIÇÃO, não ausência de registro.** `is_anonymous` esconde o nome do fã no wall e na notificação; a identidade continua gravada. É o modelo correto para dinheiro: gorjeta sem identidade não pode ser estornada, contestada nem ter recibo, e a FK existe justamente para proteger a integridade financeira.
  - `create` valida valores (amount > 0, pelo menos um destinatário).
  - Estados: `pending`, `completed`, `failed`.
  - `complete` e `fail` aplicam eventos de domínio e congelam certos campos.

- [x] QR code PIX único permanente associado ao perfil do músico  
       A base está nos QR codes de Musician/Establishment e na entidade `Tip` com `pix_key`. O fluxo completo de geração/gestão de PIX está modelado, mas ainda não há integração real com provedores externos de PIX.

- [x] **O payload da cobrança PIX é persistido** (`tips.pixQrCode`/`pixCopyPaste`,
      27/ago/2026). Antes ele só existia na resposta HTTP da criação: quem
      fechasse a tela perdia o QR para sempre e a gorjeta ficava `pending` sem
      caminho de volta. No fluxo de destaque isso deixaria de ser inconveniente
      e viraria impossibilidade — a cobrança nasce no aceite do músico, com o fã
      fora da tela. **Não** entra no regime de cifragem do `pix_key`: aquela é a
      chave de RECEBIMENTO do músico (dado permanente dele); isto é um código de
      cobrança de uso único que o pagador precisa enxergar para pagar.

- [x] **`GET /tips/:id` — o fã relê a própria gorjeta** (27/ago/2026). O PIX é
      assíncrono e, sem esta rota, o app mostrava o QR e nunca ficava sabendo do
      resultado. Só o dono lê (`ForbiddenException` caso contrário): o guard de
      rota prova quem é o usuário, não de quem é a gorjeta. Presenter próprio
      (`AudienceTipPresenter`), distinto do `TipPresenter` que serve a carteira
      do músico — nenhum dos dois expõe `pix_key`.

- [x] **`tip.confirmed` também vai para o FÃ.** Até aqui o `TipCompletedEvent` só
      notificava o músico; quem pagou não recebia nada. ⚠️ Num pedido com
      destaque este evento e `request.boost.paid` chegam os dois — o app
      deduplica por `tip_id`, e o payload mais rico ENRIQUECE o que já está na
      tela em vez de ser descartado (a ordem entre os dois handlers não é
      garantida).

- [x] Mensagem personalizada com a gorjeta  
       Código: tip.aggregate.ts ([19]).  
       Regra: mensagem opcional é persistida juntamente com a gorjeta.

- [~] Wall público de apoiadores  
  O dado necessário existe (`show_in_wall`, `is_anonymous` em `Tip`), porém não existe ainda agregado ou endpoint dedicado para construir e expor o “Wall de apoiadores”.

**Carteiras e transações**

- [x] Carteira financeira para músicos (MusicianWallet)  
       Código: musician-wallet.aggregate.ts ([20]).  
       Regras:
  - Cada músico possui uma `MusicianWallet` com `balance` (`Money` VO), `pix_key` e histórico de timestamps.
  - `receiveFunds` e `withdrawFunds` validam saldo e valores positivos.
  - `updatePixKey` atualiza a chave de saque.

- [x] Registro de transações financeiras (Transaction)  
       Código: transaction.aggregate.ts ([21]).  
       Regras:
  - Tipos: `TIP`, `WITHDRAWAL`, etc.
  - Cálculo de `net_amount` = `amount - fee`.
  - Estados de processamento e timestamps.
  - Métodos para concluir/cancelar transações com validação.

- [x] Confirmação de pagamento de gorjeta (PIX) e distribuição  
       Código: confirm-tip-payment.use-case.ts ([4]).  
       Regras:
  - Localiza `Tip` por ID, cria `Transaction` com informações de pagamento real (valor, taxa, método, metadata).
  - Marca a gorjeta como `completed`.
  - Credita valor líquido na carteira do músico ou divide entre membros da banda.
  - Gera transações secundárias para cada membro da banda em caso de split.

- [x] Saque do músico para PIX com validação de saldo  
       Código: withdraw-to-pix.use-case.ts ([22]).  
       Regras:
  - Atualiza `pix_key` da wallet (se necessário).
  - Verifica saldo suficiente em `MusicianWallet`.
  - Deduz o valor, cria `Transaction` de tipo `WITHDRAWAL` e retorna saldo atualizado.

- [x] 🔴 **Saque é RESERVA → PROVEDOR, nunca o contrário** (SM-023, 26/ago/2026)  
       Código: `withdraw-to-pix.use-case.ts`, `refund-failed-withdraw.use-case.ts`.  
       Regras:
  - **A ordem é o oposto da custódia.** Em `ReleaseBookingEscrowUseCase` o provedor
    vem primeiro (o dinheiro já está lá, nosso registro é espelho). No saque a
    transferência **cria** o fato e quem autoriza é o saldo que só nós conhecemos:
    o débito é persistido **antes** da chamada. Chamar o provedor antes de
    persistir deixava a janela inteira da chamada HTTP com o saldo antigo visível
    — dois saques simultâneos de R$110 sobre R$200 emitiam **duas transferências
    reais** e gravavam **um só débito**.
  - ✅ **As três barreiras foram verificadas contra Postgres real** em
    `test/payment/withdraw-concurrency.e2e-spec.ts` (26/ago/2026). Os testes
    unitários **não conseguem** prová-las: lá o `UnitOfWorkFakeInMemory` não abre
    transação e o repositório in-memory devolve a mesma instância do agregado —
    o que faz a segunda leitura enxergar o débito da primeira é a referência
    compartilhada, não o lock.
    🔴 Verificado por remoção deliberada do `FOR UPDATE`: sem ele, cinco saques
    concorrentes com saldo para dois são **todos aceitos**, cinco transferências
    reais são emitidas e o saldo cai só duas vezes (R$550 saindo, R$220
    debitados). ⚠️ O caso de **dois** concorrentes é flaky sem o lock (às vezes o
    escalonamento do Node os põe em fila e o teste passa com o código quebrado);
    quem dá a garantia determinística é o de cinco — não remova um achando que o
    outro cobre.
  - **Três barreiras, nenhuma substitui a outra:** o lock da carteira
    (`findByMusicianIdForUpdate`, `SELECT ... FOR UPDATE`) serializa execuções
    concorrentes; o saldo barra o segundo saque quando não há fundo para os dois;
    e a chave de idempotência do cliente (header `Idempotency-Key`, coluna
    `transactions.idempotencyKey` UNIQUE) cobre o duplo clique — o caso em que os
    dois pedidos são um só e o saldo sobra para ambos.
  - **O `insert` do lançamento vem ANTES do `update` da carteira.** As duas
    escritas estão na mesma transação, mas depender do rollback para não debitar
    é depender de uma garantia que some se alguém injetar um repositório sem
    UnitOfWork. Nesta ordem a colisão do UNIQUE aborta antes de tocar o saldo.
  - **Reenvio com a mesma chave e valor diferente é recusado** (`ConflictError`),
    e o re-despacho usa a chave PIX que a **reserva** registrou, não a do corpo
    atual: o dinheiro vai para onde o saque original mandou.
  - 🔴 **Recusa e silêncio do provedor não são a mesma coisa.** Só
    `PixWithdrawRejectedError` (400/401/403/422 — o provedor recusou
    conclusivamente) estorna. Timeout, 5xx e erro de rede **não** estornam: a
    transferência pode ter sido processada com a resposta perdida no caminho, e
    devolver o saldo aí reabriria o duplo pagamento pela porta dos fundos. O
    desempate é `findTransferByExternalReference` sobre a referência que nós
    mesmos geramos (`external_reference = transaction_id`); sem resposta, a
    transação fica `pending` para o webhook resolver.

- [x] 🔴 **`TRANSFER_FAILED` devolve o dinheiro à carteira** (SM-023, 26/ago/2026)  
       Código: `refund-failed-withdraw.use-case.ts`, `asaas-webhook.controller.ts`.  
       Regras:
  - Até 26/ago/2026 o webhook marcava a transação `failed` e **deixava o saldo
    debitado**: o provedor recusava, o dinheiro não chegava na conta do músico e
    também não voltava para a dele aqui — sumia, sem erro em lugar nenhum.
  - `refundWithdrawal` desfaz `withdrawFunds` por inteiro: devolve `balance` **e**
    reverte `total_withdrawn`, que é o número que o músico confere contra o
    próprio banco.
  - Idempotência dupla: `processOnce` barra a reentrega do evento; o `pending`
    conferido **sob o lock da carteira** barra a colisão com o caminho de recusa
    do próprio saque. Transação já `completed` nunca é estornada — seria devolver
    saldo sacável de dinheiro que já está com o músico.

- [x] 🔴 **Aritmética monetária em CENTAVOS INTEIROS — no `Money` VO** (26/ago/2026)  
       Código: `shared/domain/value-objects/money.vo.ts`.  
       Regras:
  - `add`, `subtract`, `multiply` e `divide` operam em centavos. **A imprecisão
    de ponto flutuante não degradava o valor: ela LANÇAVA**, porque o construtor
    recusa mais de duas casas decimais. `0.1 + 0.2` e `150.30 - 110` derrubavam a
    operação inteira com `InvalidMoneyError`, e são valores comuns — saldo com
    centavos é o normal de quem soma gorjetas.
  - O defeito ficou latente porque **o `Money` não tinha um único teste**. Agora
    tem 29.
  - 🔴 **`allocate(n)` é novo, e é a operação que `divide` não sabe fazer.**
    Reparte um valor em N quotas cuja soma é exatamente o original, distribuindo
    o resto de um centavo por vez. `divide` serve para "valor por unidade"
    (cachê por hora); repartir dinheiro entre pessoas com ele perde centavos.
  - Dois call sites estavam quebrados e foram corrigidos junto:
    - **`Transaction.create`** calculava `net_amount` como `amount - fee` em
      float cru. Um cachê de R$1.111,10 com 10% de comissão dava
      `999.9899999999999` e a transação nascia inválida — a confirmação do
      pagamento falhava com o dinheiro já aprovado no gateway.
    - 🔴 **O split de gorjeta entre membros de banda** usava
      `Math.floor(net / n)` sobre REAIS, tratando centavos como resto
      descartável. R$30,00 entre 4 dava **R$9 ao líder e R$7 a cada um dos
      outros** — o justo é R$7,50, e como a soma fechava em R$30 nada denunciava
      o desvio. R$18,20 entre 3 produzia `6.199999999999999` e derrubava a
      confirmação inteira. Hoje usa `allocate`.

- [x] **`MusicianWallet` expressa intenção, não mecânica** (26/ago/2026)  
       Código: `musician-wallet.aggregate.ts`.  
       Regras:
  - `Money.add`/`subtract` operam em ponto flutuante e o `Money` recusa mais de
    duas casas decimais — a imprecisão não degrada o valor, ela **lança**.
    `150.30 - 110` dá `40.30000000000001` e derrubava o saque inteiro com
    `InvalidMoneyError`. Saldo com centavos é o caso **normal** (gorjetas e cachês
    somados), não a exceção.
  - Vale para `receiveFunds`, `withdrawFunds`, `refundWithdrawal`,
    `recordExternalEarning`, `holdFunds`, `releaseHeldFunds` e `refundHeldFunds`.
    Todos voltaram a usar `balance.add(money)` / `subtract` depois que o `Money`
    foi corrigido — a mecânica de centavos mora no VO, não espalhada pelo
    agregado.
  - ✅ **Corrigido na raiz em 26/ago/2026** — ver "Aritmética monetária" abaixo.
    `Money.add`/`subtract` passaram a operar em centavos, e o agregado voltou a
    expressar intenção (`balance.add(money)`) em vez de mecânica de centavos.

**Monetização e planos**

- [x] Planos de assinatura para músicos e estabelecimentos (valores, limites, taxas diferenciadas) **(corrigido 06/ago/2026 — o texto anterior dizia que "ainda não há agregados de plano, cobrança recorrente ou lógica de pricing", o que estava desatualizado desde jun/2026)**  
       Código: `src/core/plans/` completo — aggregate `Subscription` (com `BillingCycle` mensal/anual e `expires_at` auto-computado), `PlanCheckService`, `plan-features.config.ts` (`MUSICIAN_PLAN_FEATURES`/`ESTABLISHMENT_PLAN_FEATURES` + tabelas de pricing), validator, repositórios in-memory + Prisma, e 5 use-cases (`list-plans`, `get-active-subscription`, `create-subscription-checkout`, `activate-subscription-from-payment`, `cancel-subscription`).  
       Regras:
  - Cobrança recorrente real via `AsaasSubscriptionGateway` (`POST /v3/subscriptions`). `billingType: UNDEFINED` faz o Asaas gerar uma **fatura hospedada** (`invoiceUrl`) em que o pagador escolhe PIX/cartão/boleto — a plataforma **nunca** coleta dados de cartão.
  - Exposto em `src/nest-modules/plans-module/plans.controller.ts`: `GET /plans` (`@Public()`), `GET/POST/DELETE /musicians/:id/subscription[/checkout]` e `GET/POST/DELETE /establishments/:id/subscription[/checkout]`, todos com o ownership guard correspondente.
  - Taxas diferenciadas de gorjeta (9%/7%/5%) e config de saque por tier já aplicadas em `WithdrawToPixUseCase`.
  - ⚠️ **Enforcement é grant-at-action:** o gate é cobrado no momento da ação, nunca revalidado na leitura. Quem faz downgrade mantém o que já concedeu (link compartilhado, convite). Detalhado em [plans/musician-plans.md](plans/musician-plans.md#️-enforcement-de-gates-ação-vs-leitura-ler-antes-de-mexer-em-qualquer-gate-de-plano).

- [x] Gorjeta com gateway PIX real — **Mercado Pago** (`MercadoPagoPixGateway`, Orders API). Sem `MERCADOPAGO_API_URL` o fallback é o `PixGatewayMock` (dev). Saque (`AsaasGatewayAdapter`) e assinatura (`AsaasSubscriptionGateway`) continuam no Asaas. Ver [payment-gateway-decisions.md](payment-gateway-decisions.md).

---

### Gorjeta — Mercado Pago *(19/ago/2026)*
- [x] 🔴 **A gorjeta cai DIRETO na conta do músico.** A cobrança é criada na conta dele (OAuth, `POST /v1/orders`) e a comissão sai por `marketplace_fee` — a plataforma nunca detém esse dinheiro. Consequência: **gorjeta não tem saque pela SoundMeet**; ele saca no próprio Mercado Pago, e a carteira do app mostra a gorjeta como **extrato**.
- [x] **Sem conta vinculada o músico não recebe gorjeta** — não há para onde o valor ir. Por isso a UI trata o estado desconectado como aviso, não como sugestão.
- [x] 🔴 **`marketplace_fee` = percentual do plano MENOS a taxa do gateway.** No marketplace do MP a taxa dele sai do bruto **antes** da nossa comissão; pedir os 9% cheios debitaria 9,99% do músico num plano que anuncia 9%. A tabela de preços promete "(1% gateway incluso)" e o código cumpre: em R$20, `marketplace_fee` = R$1,60 e o total retido é R$1,80.
- [x] 🔴 **Gorjeta liquidada na conta do músico NÃO credita saldo sacável.** `ConfirmTipPaymentUseCase` exige `settlement: "beneficiary" | "platform"` (obrigatório, sem default); `"beneficiary"` chama `MusicianWallet.recordExternalEarning()`, que cresce `total_earned` **sem tocar `balance`**. Creditar `balance` criaria saldo sacável de dinheiro que a plataforma nunca recebeu — e o saque sai do caixa dela.
- [x] **Gorjeta de banda liquida na conta do LÍDER** (`SendTipUseCase.resolveBeneficiary`): banda não tem conta no provedor, o vínculo OAuth é sempre de uma pessoa. A **divisão** entre os integrantes continua na confirmação, sobre o registro — não no provedor.
- [x] **Comissão calculada em centavos** (`splitAmountInCents`) — 9% de R$333,33 em ponto flutuante dá 29,999700000000004, e o provedor recusaria (ou aceitaria com um centavo errado).
- [x] **Gorjeta de banda liquida na conta do LÍDER.** Banda não tem conta no provedor; `beneficiary_musician_id` vai nulo quando só há `band_id`. Mesma decisão de `buildContracted` no contrato.
- [x] **O `state` do OAuth é assinado (HMAC) e tem `purpose` próprio.** O callback chega pelo navegador sem Bearer token — sem a assinatura, qualquer um vincularia a própria conta de pagamento ao músico de outra pessoa; sem o `purpose`, um `state` do fluxo de agenda serviria aqui.
- [x] **O webhook lê o valor da API, nunca do corpo** (`x-signature` validada, fail-closed sem segredo, idempotente pelo `ProcessedEvent`). Confiar no corpo deixaria qualquer POST confirmar uma gorjeta de R$1.000.
- [x] **Token renovado com 15 dias de folga** sobre os 180. Deixar vencer custa reautorização manual — que o músico descobriria quando uma gorjeta falhasse, no palco.

### Custódia do cachê (escrow — F1.3a) *(19/ago/2026)*
- [x] 🔴 **O valor custodiado NÃO transita pelo patrimônio da plataforma.** Fica bloqueado na subconta do músico na instituição de pagamento; `MusicianWallet.held_balance` é **espelho**, não fonte. É o que a cláusula `papel_da_plataforma.com_custodia` afirma — o caminho do "saldo lógico numa conta nossa" foi recusado porque transformaria cláusula assinada em declaração falsa, além de ser custódia de recursos de terceiros (atividade regulada).
- [x] **Custódia não é saldo.** `held_balance` fica **fora** de `balance`: dinheiro retido não é sacável, e somá-lo faria o app oferecer um saque que o gateway recusaria.
- [x] **A comissão só é devida NA LIBERAÇÃO.** `platform_fee` é congelada na criação da custódia, mas só vira receita em `released`. Show não realizado, nenhuma comissão — é o argumento mais forte contra a tese de responsabilidade solidária, e a cláusula o afirma.
- [x] **`total_earned` só cresce na liberação** — é o momento em que o serviço foi prestado. Creditar na retenção anunciaria um ganho estornável.
- [x] **Estorno nunca passa pelo saldo:** o dinheiro nunca foi do músico, então `refundHeldFunds` só reduz o retido. Transitar por `balance` deixaria rastro de um ganho que não existiu.
- [x] **Liberar exige DUAS condições:** check-in registrado **e** ausência de contestação na janela. Só por prazo entregaria o cachê de um show que ninguém confirmou; com contestação aberta seria decidir a disputa por omissão (a mediação é humana de propósito).
- [x] **O prazo conta do FIM DO SHOW**, não da retenção — o pagamento é antecipado, e contar da retenção liberaria antes de o show acontecer para quem pagou cedo. **D+2 no plano pago, D+5 no FREE** (`escrow_release_days`). É prazo, não gate: ninguém é bloqueado.
- [x] **Divisão em centavos inteiros** (`splitAmount`), garantindo `platform_fee + net_amount === amount` exatamente. Centavo perdido em arredondamento é centavo que ninguém recebe.
- [x] **Ordem obrigatória na liberação:** provedor → custódia → carteira. Marcar antes de o provedor confirmar anunciaria um saldo que o gateway recusa a sacar.
- [x] **Idempotente ponta a ponta:** `bookingId` é `@unique`, `markHeld` com a mesma referência é no-op, `release` repetido é no-op. Job e webhook podem chegar os dois — pagar duas vezes o mesmo show não é uma opção.
- [x] 🔴 **A `apiKey` da subconta é cifrada em repouso** (infra de SM-016) e **nunca sai em `toJSON`**. Ela move dinheiro dentro da subconta, e o provedor só a entrega uma vez, na criação — perder é ter de recriar a subconta.
- [x] **Desabilitar a Conta Escrow LIBERA tudo que está sob garantia**, então o agregado recusa desabilitar com saldo retido: seria trocar R$9,90/mês por um pagamento antecipado de shows que talvez não tenham acontecido.

#### Fatia HTTP e webhooks *(21/ago/2026)*

> Documentado retroativamente em 22/ago/2026 — o código foi entregue em 21/ago sem passar por
> aqui, e a seção anterior ainda dizia "faltam as rotas HTTP e os webhooks".

- [x] **A criação é disparada por evento, não por rota.** `CreateBookingEscrowUseCase` roda no
      `BookingConfirmedEvent` — o mesmo que emite o contrato. Não existe "criar custódia" por HTTP:
      custódia sem show confirmado não tem o que garantir.
- [x] **Ordem de criação: persistir `pending` → cobrar no provedor → gravar a referência.** O
      `externalReference` da cobrança é o próprio `escrow_id`, então o registro precisa existir
      antes da cobrança — senão o webhook do pagamento chega antes daquilo que ele referencia.
      Falhar no meio deixa uma custódia `pending` sem cobrança: reexecutável e inofensiva, porque
      ninguém foi cobrado. O inverso deixaria dinheiro bloqueado sem registro local para liberar.
- [x] 🔴 **`findChargeByReference` antes de criar.** Entre o provedor aceitar a cobrança e nós
      gravarmos o `external_id` existe uma janela; sem essa consulta, uma reexecução emitiria um
      **segundo PIX** para o mesmo show.
- [x] **`GET /musicians/:id/wallet/escrow`** é a **única** rota da feature — extrato somente-leitura,
      com `MusicianOwnershipGuard`. A referência da cobrança no provedor não é exposta.
- [x] 🔴 **Não existe rota para reter, liberar ou estornar.** Quem retém é o webhook (o único que
      sabe que o dinheiro entrou); quem libera é o job (depois de conferir check-in e prazo). Expor
      liberação por HTTP transformaria as salvaguardas do `ReleaseBookingEscrowUseCase` em
      formalidade — bastaria chamar a rota.
- [x] **Branch de escrow no `AsaasWebhookController`**, identificado pelo prefixo `escrow:` no
      `externalReference` e avaliado **antes** do caminho de gorjeta (que trata qualquer referência
      restante como UUID de tip).
- [x] 🔴 **O valor vem do NOSSO registro, nunca do corpo do webhook.** `MarkBookingEscrowHeldUseCase`
      retém o `net_amount` congelado na criação; `payment.value` não é lido. Confiar no corpo
      deixaria um POST forjado inflar o `held_balance` de qualquer músico.
- [x] **Custódia e carteira mudam dentro de `UnitOfWork`** (`markHeld` e `release`). Sem transação,
      uma falha entre os dois updates deixava `held_balance` errado **permanentemente** — a
      reexecução retornava cedo por idempotência e nunca corrigia.
- [x] **Guarda de estado antes de chamar o provedor**, e custódia em mediação não sai pela liberação
      automática. `expires_at: null` (garantia inativa) vira log de erro, não silêncio.
- [x] **`booking_fee_percentage` mora em `plan-features.config.ts`**, ao lado de
      `tip_fee_percentage` — 10% nos três tiers hoje, variável por tier sem tocar código de domínio.

### Check-in da apresentação *(19/ago/2026)*
- [x] **Vale por si como prova de execução do serviço** (camada 3 contra chargeback), com ou sem escrow.
- [x] **A hora é do SERVIDOR**, nunca do corpo — este registro existe para provar *quando* algo aconteceu.
- [x] Só em booking **confirmado**, e **não antes do início do show** (declarar fato futuro não prova nada). Depois do fim é aceito: o músico registra ao descer do palco.
- [x] **O estabelecimento também pode registrar** — é a contraparte confirmando, prova ainda mais forte a favor do artista. O campo `checked_in_by` guarda qual lado declarou.
- [x] Idempotente: o primeiro registro é o que vale. Sobrescrever permitiria "ajustar" o horário do fato depois.
- [x] **A contestação NÃO exige check-in prévio** — "o artista não apareceu" é justamente a contestação em que ele não existe.
- [x] 🔴 **Só o CONTRATANTE contesta** (`POST /scheduling/bookings/:id/dispute`, `@Roles("establishment","admin")`). Contestar é dizer "o serviço não foi entregue como combinado" — deixar o artista fazer isso seria deixá-lo travar o próprio pagamento. A checagem **não** é `assertNegotiationParticipant` (que aceita qualquer lado) e é fail-closed sobre lista de identidades vazia.
- [x] **`POST /scheduling/bookings/:id/check-in` aceita as duas partes**, e `checked_in_by` registra qual lado declarou (`band` quando o show é de banda, exigindo o líder).
- [x] **`scheduling` não conhece `payment`.** Marcar o booking já basta para bloquear a liberação automática (`ProcessDueEscrowReleasesUseCase` confere `booking.isDisputed`); congelar o agregado `BookingEscrow` é ato da mediação.

## Domínio Gamification (Pontos, Badges, Rankings)

**Pontos globais de usuário (UserPoints)**

- [x] Acúmulo de pontos por tipo de ação  
       Código: user-points.aggregate.ts ([18]) e points-source.vo.ts ([23]).  
       Regras:
  - `scanQr` → +10 pts
  - `makeMusicRequest` → +25 pts
  - `acceptedMusicRequest` → +50 pts
  - `sendTip` → 1 pt por real doado
  - `shareOnSocial` → +50 pts
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

---

## Domínio Review (Avaliações)

> Introduzido no Bloco 9.3 (07/ago/2026). Antes disto `rating`/`total_ratings` eram apenas
> contadores incrementais, sem registro de autor — não havia como impedir avaliação repetida,
> listar comentários nem recalcular a média.

- [x] **A avaliação é um ledger, não um contador.** `src/core/review/` + tabela `reviews` são a
      fonte de verdade; `Musician.rating`/`total_ratings` e `Establishment.rating`/`total_ratings`
      passam a ser **projeção derivada**, reescrita por `syncRatingProjection()` a partir do ledger
      inteiro. Mesmo par que gamificação já usa (`UserScore` ledger × `UserPoints` projeção).
- [x] **Só avalia quem tem vínculo comprovado** (`ReviewEligibilityService`):
  - Público: precisa ser `EventAttendee` do evento **e** o alvo precisa estar ligado àquele evento —
    `EventMusician` para músico, `event.establishment_id` para estabelecimento. Só presença não
    basta: permitiria avaliar qualquer músico usando um evento assistido.
  - Músico ↔ estabelecimento: precisa de um `Booking` com status **`COMPLETED`**. Confirmado não
    conta (não houve show, e abriria retaliação por cancelamento).
  - Ninguém avalia a si mesmo.
- [x] **Uma avaliação por autor, por alvo, por contexto** — unique `(target_type, target_id,
      author_id, context_id)` **no banco**; checagem na aplicação é só o caminho feliz. Avaliar de
      novo o mesmo contexto **atualiza** a nota, sem somar duas vezes na média.
- [x] **O autor vem do JWT, nunca do corpo** (`review-author.resolver.ts`). ⚠️ Para músico e público
      `author_id` é o `sub`; para estabelecimento **não** — vem do claim `establishment_ids`, e conta
      com mais de uma unidade precisa informar `author_establishment_id` (conferido contra o token).
- [x] Nota é inteiro de 1 a 5. O VO `Rating` **não** é usado na entrada: aceita `0` e uma casa
      decimal porque foi feito para médias.
- [x] Leitura pública paginada: `GET /musicians/:id/ratings`, `GET /establishments/:id/ratings`,
      com filtro `has_comment` e ordenação padrão pela mais recente.
- [ ] Moderação/denúncia de avaliação — não implementado.
- [ ] `EstablishmentRatedEvent` segue sem ouvinte (evento morto, anterior a este bloco).

### UI do músico avaliando o estabelecimento *(21/ago/2026)*

> Documentado retroativamente em 22/ago/2026. Fecha o gap apontado na auditoria de 21/ago: o
> backend estava completo desde 07/ago e o web já tinha a tela do estabelecimento avaliar o
> músico; **o mobile só exibia rating, sem forma de enviar**.

- [x] **A ação mora na tela do CONTRATO** (`ContractReviewAction`), não numa tela de booking. O
      músico não tem lista de bookings no app — `GET /scheduling/bookings` continua sem chamador em
      `src/` —, e o contrato já é a tela do show.
- [x] **Só aparece com o booking `completed`.** `confirmed` não conta, nem com a data já passada:
      é o único status que o backend aceita como prova de vínculo, e a promoção
      `confirmed → completed` é do job horário. A ação surge sozinha em até uma hora após o show.
- [x] 🔴 **Show de banda não oferece a ação, e isso não é caso de borda.** O backend deriva o autor
      do JWT e exige que ele seja parte da reserva; em show de banda a parte é o `band_id`, então
      **nenhum integrante passa — nem o líder**. O CTA aparecia e falhava 100% das vezes; hoje
      `canReviewEstablishment` o esconde. Avaliação em nome da banda depende de o backend aceitar o
      integrante como autor, e enquanto não aceita a UI não finge que aceita.
- [x] **Comentário é opcional** — exigir texto derruba a taxa de resposta, e a nota sozinha já move
      a média que ordena a busca do dashboard de contratação.

---

## Domínio Personal Chord Sheet (Cifra Pessoal e Comunidade)

> A versão que o músico tem de uma cifra gerada pela IA. Guarda **o que ele
> mudou** (overlay), não uma cópia: a original em `music_library.chord_sheet`
> permanece imutável e continua servida a todos.

### Criação e unicidade
- [x] **A cifra original da IA é imutável.** Nenhuma operação da cifra pessoal escreve em `music_library.chord_sheet` — o fork é a camada por cima.
- [x] **Um fork por música por músico.** Índice único `(musician_id, music_library_id)` no banco; a checagem na aplicação é só o caminho feliz. Dois POSTs simultâneos: o segundo recebe **409**.
- [x] **Qualquer música de qualquer artista pode ser cifrada e editada** — não existe restrição de catálogo. O músico busca (`ai-cifra/search`), analisa, e a análise materializa a linha dele em `music_library`.
- [x] O fork é criado sobre a **linha do próprio músico** em `music_library`. Isso não limita *quais músicas* (`music_library` é biblioteca **pessoal**, não catálogo global: `musicianId` é obrigatório e a linha carrega `notes`/`isFavorite`/`difficulty` do dono, e cada músico tem a sua própria linha da mesma música). Limita *qual linha*: o use-case base lança `NotFoundError` quando a linha é de outro músico, que é o que impede editar a cifra pessoal alheia.
- [x] O fork nasce **sem nenhuma edição**, ancorado no `base_fingerprint` (sha256 do timeline normalizado) da análise vigente.

### Overlay de edições
- [x] Seis tipos de edição: `replace_chord`, `insert_chord`, `delete_chord`, `shift_chord`, `relabel_section`, `annotate`. Máximo de **500 por fork**.
- [x] As edições são ancoradas por **(instante, símbolo)**, nunca por índice — índice não sobrevive a uma re-análise que insira ou remova um acorde.
- [x] Edição que não acha mais onde ancorar vira **conflito explícito** e não é aplicada: `anchor_not_found`, `symbol_mismatch`, `ambiguous_match`, `unparseable_symbol`, `out_of_range`. O músico revisa dois conflitos; ele não descobre no palco que a cifra saiu do lugar.
- [x] Símbolo de acorde que o sistema não entende é **preservado verbatim**, nunca descartado.
- [x] O matching é **enarmônico**: o músico gravou `Db`, a IA re-analisou como `C#`, a correção dele continua valendo.

### Visualização
- [x] Tom, capotraste, complexidade, instrumento e velocidade de rolagem são **parâmetros de visualização**, nunca gravados no acorde. Um único artefato serve todos os tons.
- [x] Deslocamento efetivo = `transpose_semitones − capo_fret`. Transpor +2 com capô 2 devolve as **mesmas formas** — que é o ponto do capotraste.
- [x] A rota `/chord-sheet` aceita overrides de query **efêmeros**: sobrepõem a view salva só naquela resposta, sem persistir nada.

### Re-análise da IA (reconciliação)
- [x] Quem detecta que a IA re-analisou é o **`base_fingerprint`**, não `base_version` — `MusicLibrary.updateChords()` não incrementa versão, então a coluna é advisory e está sempre em 0.
- [x] **Leitura não escreve.** A divergência é sinalizada (`base_changed: true`, `reconcile_status: "base_updated"` na resposta) mas o fork no banco não é tocado: reconciliar é ato explícito do músico.
- [ ] Use-case de reconciliação (`markReconciled`) — **pendente**, Bloco 8C do roadmap.

### Compartilhamento
- [x] Fork é **privado por padrão**. Escopos: `private` | `band` | `community`.
- [x] `band` libera para os músicos que dividem alguma banda com o autor, contando só membros com `status = "accepted"`.
- [x] `community` publica para qualquer músico da plataforma, **somente leitura**.
- [x] **As anotações pessoais (`notes`) nunca são visíveis para terceiros** — nem na comunidade, nem para o par de banda, nem para o admin. É o único campo redigido na leitura de terceiro (`is_owner` derivado do dono real do fork, nunca afirmado pelo controller).
- [x] ⚠️ **A edição `annotate` NÃO é privada.** Ela também é texto livre, mas vive em `edits[]` e é publicada junto com as correções — são duas gavetas diferentes: `notes` é o **caderno** (privado), `annotate` é **recado colado na cifra** (compartilhado). Defensável por desenho, mas a UI precisa deixar explícito no momento de escrever, senão o músico publica sem querer.
- [x] Descompartilhar tem **efeito imediato**, sem carência.
- [x] Fork da comunidade não é lido "no lugar" do próprio: o leitor **importa**, e as correções são reancoradas contra a análise dele. As que não ancoram voltam como conflito e não entram.

### Planos
- [x] Editar, transpor e usar cifra é **core em todos os tiers** (coerente com `music_library_access: true` nos três).
- [x] `max_personal_chord_sheets` — FREE: 3; ESSENCIAL e PRO: ilimitado.
- [x] `chord_sheet_community_sharing` — FREE: não; ESSENCIAL e PRO: sim. Compartilhar com a **própria banda não é gateado** em nenhum tier.
- [x] **Grant-at-action:** o limite é cobrado no fork e no import, **nunca na leitura**. Quem cai de plano continua abrindo e tocando as cifras que já tem.

### Moderação
- [x] Admin pode remover **qualquer** fork (takedown) via `DELETE /admin/personal-chord-sheets/:id`.
- [x] A navegação de moderação (`GET /admin/personal-chord-sheets`) só lista o que está **publicado na comunidade** — o admin não *descobre* fork privado por listagem.
- [x] O admin **lê qualquer fork por id**, inclusive `private`, por `GET /community/personal-chord-sheets/:id` e `/:id/chord-sheet`: `resolveAccess` manda `requesting_musician_id: undefined`, que é o bypass de moderação do `CheckPersonalChordSheetAccessUseCase` (retorna antes de consultar `share_scope`). Vê as correções, a view e a cifra renderizada com a letra; **`notes` continua redigido**, porque `is_owner` sai `false`. Decisão consciente (jul/2026): o admin é o próprio fundador, e restringir seria proteger o dono do produto dele mesmo. **Revisar no dia em que existir admin que não seja o dono** — a role passa a dar leitura de qualquer cifra privada a quem a tiver.
- [x] `PERSONAL_CHORD_SHEET_COMMUNITY_ENABLED=false` derruba a comunidade inteira sem deploy; as rotas do dono seguem intactas.
- [ ] Denúncia (`POST /:id/report`) — **pendente**, Bloco 8C.1.

---

## Domínio Contract (Contrato Digital de Show)

> Todo show confirmado gera automaticamente um contrato adaptado àquele artista, àquele local e
> àquele valor. O documento é **congelado** na emissão, tem hash de integridade e página pública de
> verificação. A plataforma **não é parte**.
>
> Arquitetura: [contract/contract-digital.md](contract/contract-digital.md) · Revisão jurídica:
> [contract/legal-checklist.md](contract/legal-checklist.md)

### Catálogo de cláusulas
- [x] **O catálogo é código, não banco.** 23 cláusulas (18 obrigatórias, 5 opcionais) em 38 variantes, em `src/core/contract/domain/catalog/clauses/`. Revisão jurídica vira **code review**, e um teste de snapshot por variante impede que redação mude em silêncio no CI.
- [x] `body` é **função pura de variáveis tipadas**, não template com `{{}}` — variável renomeada é erro de compilação, e não existe classe de bug de escaping.
- [x] Toda cláusula declara `legal_note` com a âncora legal e o motivo de existir. São 22 notas, no próprio arquivo.
- [x] O `consumes` declarado por variante é comparado com o que o corpo realmente lê, **nos dois sentidos**, via Proxy no teste — `consumes` não envelhece.
- [x] **1728 contextos** varridos no teste: toda cláusula obrigatória resolve em todos, e nenhum texto sai com `undefined`, `NaN` ou `[object Object]`.
- [x] ⚠️ **Aplicabilidade tem que ser mutuamente exclusiva** dentro da mesma cláusula e do mesmo tom. `selectVariant` faz `filter` e pega a primeira — duas variantes que casam no mesmo contexto não dão erro, dão a *primeira*, em silêncio.
- [x] `conduta` só existe no tom rigoroso (regra de conduta detalhada aproxima a relação de subordinação) e há teste provando que **não vaza** para contrato de tom formal.
- [x] `camarim_alimentacao` só entra acima de R$ 500 de cachê — cláusula que ninguém cumpre enfraquece o documento inteiro.

### Tetos legais como invariante de código
- [x] Multa de cancelamento **≤ 100% do cachê** (CC art. 412; art. 413 permite redução judicial). Validado em `ContractVariables`, não só escrito: multa acima disso é cláusula nula, e cláusula nula é pior que cláusula ausente.
- [x] Exclusividade com **teto duro de km e de dias** (`assertExclusivityWithinLegalCap`) — restrição à liberdade profissional (CF art. 5º, XIII) só se sustenta limitada em tempo, espaço e atividade. Opcional e ausente por padrão.
- [x] Uso de imagem sempre com finalidade, prazo e território preenchidos (CC art. 20).
- [x] Foro = **comarca do local do show** (CPC art. 63), nunca a sede da plataforma, que não é parte.
- [x] A janela de cancelamento gratuito vem de `Booking.free_cancellation_hours`, **nunca** de constante do catálogo.

### Emissão
- [x] Reativa: `ContractIssuanceHandler` escuta `BookingConfirmedEvent`. **Não bloqueia o show** — o booking vai a `confirmed` com ou sem contrato.
- [x] `ContractModule` é **nó-folha**: `scheduling` não conhece `contract`.
- [x] **Idempotente** — evento reentregue não cria segundo contrato.
- [x] **Qualificação incompleta não emite contrato torto:** o use-case devolve `{ issued: false, missing: [...] }` com chaves estáveis (`contratante.cnpj`, `contratante.representante_legal`, `contratado.cpf`, `booking.cache`, …) e a UI monta a frase, porque é ela que sabe para onde mandar o usuário corrigir. `POST /contracts/issue` é a retentativa.
- [x] 🔴 **Só quem é parte do show emite** *(19/ago/2026)* — checado **antes do primeiro efeito**, e não sobre o resultado. `requesting_participant_ids` é obrigatório e nulável no input: `null` é o caminho do sistema (`ContractIssuanceHandler`), declarado em código, e lista vazia é recusada em vez de pular a checagem. Vale para os dois ramos: emitir de fato **e** consultar a pendência de qualificação, que de outro modo seria um oráculo do estado cadastral alheio. Membro de banda não-líder **pode** disparar (`assertNegotiationViewer`): emitir é retentativa, não ato vinculante — quem se obriga é quem assina.
- [x] **A retentativa manual carrega só o `booking_id`.** `tone`, `outdoor` e `exclusivity_requested` existem no input mas saem do DTO HTTP por `OmitType`: exclusividade é opt-in com tetos legais e não cabe num botão de "tentar de novo", e o tom escolhe a redação que a **outra** parte vai assinar. Quem os preenche é a emissão automática.
- [x] 🔴 **Nenhum documento é jamais fabricado.** O CPF do representante legal **não** é derivado do CNPJ (uma versão anterior compunha com os 11 primeiros dígitos) — vem do cadastro, ou o contrato não é emitido. Endereço que o músico nunca informou sai como "não informado" em vez de inventado.
- [x] Natureza das partes é **derivada, nunca fixa**: `contractor_is_company` de `establishment.cnpj !== null`, `contracted_is_company` de `musician.cnpj !== null`. No dia em que o cadastro aceitar estabelecimento PF, a cláusula de tributos escolhe sozinha a redação certa — muda o cadastro, não o contrato.
- [x] **Músico MEI é qualificado como pessoa jurídica**, com o CNPJ no papel — é o que faz o contrato bater com a nota que ele emite. `legal_name` continua sendo o nome civil: a razão social do MEI *é* o nome da pessoa.
- [x] **Banda contrata pelo líder pessoa física**, mesmo que ele tenha MEI: o MEI é dele, não da banda, e faturar o cachê inteiro pelo CNPJ pessoal cria um repasse que nenhuma cláusula descreve e pode estourar o teto do MEI.
- [x] Integrantes vão **nomeados** no objeto (`findByIds`, `stage_name ?? name`) — "contratei o Trio Maré" sem dizer quem toca é o que permite trocar a banda inteira no dia.
- [x] Retenção previdenciária **não** se aplica a contratado MEI (art. 4º da Lei 10.666/2003 alcança o contribuinte individual) — variante própria de `tributos`, senão o contrato mandaria o bar fazer retenção indevida.
- [x] O cachê é declarado **BRUTO**, com o líquido e o comprovante de retenção descritos. Sem isso o contrato dizia "R$ 1.500" e a cláusula de tributos dizia "o contratante reterá" — ninguém sabia quanto o músico recebia.

### Imutabilidade e integridade
- [x] O agregado é **imutável por construção** — não existe mutador de conteúdo, só de status e assinatura.
- [x] O contrato guarda o **snapshot congelado das cláusulas já renderizadas**. O catálogo só é consultado para *construir*; um contrato de 2026 renderiza igual para sempre.
- [x] O mapper **recalcula o `content_hash` na carga** e recusa contrato adulterado no banco (`LoadEntityError`). Sem isso, publicar o hash na página de verificação seria decoração.
- [x] FKs: `Restrict` em booking/establishment, `SetNull` em musician/band — apagamento por LGPD zera o ponteiro e **o snapshot preserva a prova**.
- [x] Status como enum Prisma (`issued` → `partially_signed` → `signed`, `annulled` como saída lateral) — é máquina de estado de domínio.

### Assinatura
- [x] Própria, atrás de `IContractSignatureProvider`. Válida entre as partes pela **MP 2.200-2/2001, art. 10, §2º**, que exige admissão expressa — daí a cláusula `assinatura_eletronica` ser obrigatória e sem variante.
- [x] Trilha: conta autenticada pelo Keycloak, aceite explícito, timestamp do servidor, IP, user-agent e hash.
- [x] **A âncora de identidade é `signer_user_id`, não o documento do cadastro.** O cadastro diz quem *deveria* assinar; a trilha diz quem assinou. *(19/ago/2026)* O campo passou a ser **obrigatório** no input: os dois use-cases faziam `?? ""` e a âncora degradava para string vazia em silêncio — no exato documento que existe para provar quem assinou, e com a chave do desafio (que inclui o signatário) virando balde compartilhado entre pessoas do mesmo papel.
- [x] **Segundo fator por código de uso único** enviado ao e-mail **congelado** da parte — a conta autenticada prova que alguém com a senha entrou, não quem. O código nunca volta na resposta HTTP: ela traz só o destino mascarado e o vencimento. 10 min de validade, 5 tentativas, uso único, e pedir outro invalida o anterior.
- [x] **O código é guardado como HMAC com segredo do servidor** (`CONTRACT_CHALLENGE_SECRET`, ≥32 chars exigidos em produção), não como hash puro *(19/ago/2026)*: 6 dígitos são 1 milhão de possibilidades, e um SHA-256 sem chave se converte nos códigos vivos por tabela pré-computada assim que o cache vaza. Comparação em tempo constante. `POST /:id/sign/challenge` tem `@Throttle` próprio de 5/60s — cada pedido escreve na caixa de entrada de alguém e mata o código anterior.
- [x] Papel derivado do JWT, nunca do corpo. Em banda, **só o líder assina**; membro **lê** sem ser líder.
- [x] Segunda assinatura do mesmo lado → **422**; quem não é parte → **403**; `annul` de contrato assinado → **422** (e só admin).
- [x] O documento **declara que não é título executivo** (CPC art. 784, III) e que é prova escrita apta a ação monitória (CPC art. 700). Prometer o contrário na UI seria falso.

### Acesso e privacidade
- [x] 🔑 **`IContractStorage` não tem `getPublicUrl`, e isso é a feature.** O documento carrega CPF, CNPJ, endereço e cachê; sem função que produza URL pública, vazar contrato por engano fica impossível por construção. A leitura é `GET /contracts/:id/document`, autorizada e por stream.
- [x] `GET /contracts` é escopado pelo token (OR contra os três lados), **fail-closed**.
- [x] A verificação pública (`GET /contracts/verify/:code`, `@Public()`) devolve o mínimo — código, status, hash, data do show — com os nomes **mascarados** (`"Ana Ribeiro"` → `"Ana R."`).
- [x] A rota pública mora em **controller separado**: um `@Public()` solto num controller com `@UseGuards` é a receita de expor rota autenticada sem querer.
- [x] `SearchParams.filter` com override na subclasse — sem ele o repositório monta `where: {}` e devolve contrato de todos os estabelecimentos.

### Pendente
- [ ] **Revisão por advogado** antes do primeiro contrato em produção — [contract/legal-checklist.md](contract/legal-checklist.md) é o artefato dessa conversa. É gate, não sugestão.
- [ ] `CONTRACT_ISSUER_LEGAL_NAME` e `CONTRACT_ISSUER_DOCUMENT` ainda são placeholder.
- [ ] **UI web** (painel na contratação, assinatura, download, página pública) — Bloco 10, fatia B3.
- [ ] **UI mobile** (lista, detalhe, assinatura, Anexo I) — Bloco 10, fatia B4.
- [ ] **E-mails** de contrato emitido/assinado com PDF anexo — camada 4 de proteção contra chargeback.
- [ ] Auditoria de **vocabulário de emprego** nas telas existentes ("escala", "jornada", "turno") — prova contra o próprio produto num litígio de vínculo.
- [ ] Prazo de retenção do contrato e da trilha — hoje indefinido.
- [ ] Banda com **CNPJ próprio**; endereço estruturado do músico.

---

## Ponte Spotify (fã salva o que ouviu) *(21/ago/2026)*

> Documentado retroativamente em 22/ago/2026. Vive em `src/core/audience/` (agregado satélite
> `AudienceSpotifyLink`), não em domínio próprio — mesmo lugar e mesmo motivo de
> `MusicianWallet` guardar os tokens do Mercado Pago fora de `Musician`.

### Vínculo da conta

- [x] **Agregado satélite, tabela própria** (`audience_spotify_links`): token de terceiro tem ciclo
      de vida próprio (expira em ~1h, é renovado por job, é revogado) e quase nunca é lido junto do
      perfil.
- [x] 🔴 **Os dois tokens são cifrados em repouso** (AES-256-GCM, infra de SM-016) e **nunca saem em
      `toJSON`**. O `access_token` **escreve** na biblioteca do fã: vazá-lo num dump é dar a
      terceiros o direito de mexer na conta dele.
- [x] **`state` HMAC com `purpose` próprio**, compartilhando o `OAuthStateService` com o Mercado
      Pago e o Google Calendar — um `state` de agenda nunca vincula uma conta de música, e
      vice-versa.
- [x] **Callback em controller separado e `@Public()`** — um `@Public()` solto numa classe com
      `@UseGuards` expõe rota autenticada sem querer.
- [x] **Uma conta Spotify não se vincula a dois fãs** (unique em `spotifyUserId`): seria salvar
      música de estranhos na biblioteca de alguém.
- [x] **Job de renovação a cada 30 min**, varrendo por `expiresAt`. Sem o refresh, o vínculo morre
      em uma hora e o fã reautorizaria a cada música.
- [x] **Escopo mínimo: `user-library-modify`.** Nada de leitura de playlist ou histórico — cada
      escopo extra aparece na tela de consentimento, derruba a taxa de autorização, e seria coletar
      dado que a feature não usa.
- [x] **Desconectar é idempotente**: desconectar quem já está desconectado devolve o mesmo estado,
      não erro numa ação que deu certo.

### Buscar e salvar são DOIS atos

- [x] 🔴 **`POST .../spotify/tracks/search` procura e NÃO salva.** Casar título+artista com o
      catálogo é ambíguo por natureza — cover, ao vivo, remaster, tributo e homônimo competem pelo
      mesmo texto. Salvar direto acertaria na maioria das vezes e, na minoria, poria silenciosamente
      a faixa errada na biblioteca de alguém: erro que a pessoa só descobre depois e que queima a
      feature inteira.
- [x] **`POST .../spotify/tracks` recebe o `track_id`**, nunca título e artista — para não recriar a
      adivinhação exatamente no ponto em que ela vira escrita na conta de outra pessoa.
- [x] **A busca usa qualificadores `track:` e `artist:`**, com `market: BR`. Sem eles, o nome do
      artista em texto livre casa com faixas que apenas o citam no título (tributos, participações)
      e a "melhor" resposta vira a errada.
- [x] **"Não vinculado" e "não encontrado" são ESTADOS, não exceções** — a UI mostra caminhos
      diferentes para cada um, e lançar erro obrigaria o cliente a inspecionar mensagem para decidir
      o que exibir.
- [x] **`:id` é sempre o FÃ**, nunca sub-recurso; a faixa viaja no corpo. Um `:id` de outra coisa
      colidiria no `AudienceOwnershipGuard`.

### Casamento da faixa — qual VERSÃO da música *(22/ago/2026)*

> Arquitetura completa em
> [AI-musician/spotify-track-matching.md](AI-musician/spotify-track-matching.md).

- [x] **A faixa é resolvida na MATERIALIZAÇÃO da análise**, logo após o update que
      grava `duration_seconds` e antes do alinhamento da letra. Não sob demanda: no
      palco cobraria latência e multiplicaria a chamada pelo número de fãs na casa.
- [x] 🔴 **A duração da gravação analisada é o que separa as versões.** Mesma escada
      de buckets que o `synced-lyrics` usa (`≤2s→1.0, ≤6s→0.8, ≤12s→0.6, senão 0.3`),
      e pelo mesmo incidente: casar sem pontuar duração pega "radio edit vs. ao vivo
      estendido".
- [x] **A duração pesa mais aqui que no LRCLIB** (0.40 vs 0.10): o Spotify devolve
      título e artista limpos, que casam **inclusive entre versões diferentes** — ali
      eles param de discriminar.
- [x] 🔴 **Artista é eliminatório, não ponderado.** Só com peso, título + duração
      perfeitos passariam do piso com artista zerado, e o cover de banda tributo
      venceria o original.
- [x] **Dois pisos, porque o custo do erro é assimétrico:** 0.62 para gravar o link,
      0.90 para escrever na biblioteca do fã sem confirmação.
- [x] **Negative cache de 30 dias**; falha de rede **não** grava `checked_at` —
      "indisponível" não é "não existe".
- [x] `PerformedSong.spotifyTrackId` é **snapshot** — a leitura do fã é polling.
- [x] Música vinda de **pedido** ou texto livre não recebe link: não tem duração
      analisada, e adivinhar só com texto é o erro que a duração evita.
- [x] **Tom e andamento não entram**, embora o MIR os conheça: `/audio-features` foi
      descontinuado em 27/nov/2024 e responde 403.

### O botão abre o Spotify — e o motivo é a quota *(22/ago/2026)*

- [x] 🔴 **`PUT /v1/me/tracks` atende 5 usuários.** Development Mode limita a 5
      autorizados e exige Premium do dono; Extended Quota exige **pessoa jurídica e
      250k MAU**. Salvar in-app existe e funciona, mas serve a beta testers.
- [x] **O caminho padrão é deep link** (`open.spotify.com/track/{id}`): não usa API,
      funciona para todos, abre a faixa certa e a reprodução conta como stream para o
      artista.
- [x] 🔴 **Resolver a faixa NÃO passa pelo teto** — `SpotifyCatalogAdapter` usa
      **Client Credentials**, sem usuário. Por isso é porta separada de
      `ISpotifyLibraryGateway`. Quando a quota vier, o `spotify_track_id` já está lá e
      só o botão muda.
- [ ] **Sem prévia de 30s:** `preview_url` foi descontinuado para apps novos e vem
      sempre `null`. A confirmação é visual. Não reintroduzir.
- [ ] Decisão de 22/ago/2026: Extended Quota, confirmação do músico e playlist do
      show ficam para depois.

### Onde aparece

- [x] Conectar: `SpotifyLinkCard` no perfil do fã. **Nunca no meio do show** — virar CTA de
      integração na hora do pedido transformaria a tela em funil.
- [x] Salvar: tela de sucesso do pedido de música **e** (desde 22/ago) o `NowPlayingCard` do perfil
      público, com o par vindo do palco. Ver a seção de Performance abaixo.
- [ ] **Só o FÃ tem vínculo.** O músico não conecta Spotify — a feature é "salve o que você ouviu",
      não catálogo do artista.

---

## Domínio Performance (Apresentação ao Vivo) *(22/ago/2026)*

Arquitetura completa em [performance/live-performance.md](performance/live-performance.md).
A primitiva que faltava para o sistema saber o que o músico **tocou**, e não só o que ele sabe
tocar — três read models dependem dela.

### O set ao vivo

- [x] O músico **abre o set explicitamente** (`POST /performances`). Sem set aberto, o Play Mode
      continua privado: registro automático transformaria ensaio em histórico público e
      envenenaria os três read models com repetição de estudo.
- [x] Abrir um set exige estar **escalado no evento** (`EventMusician`) — ownership do JWT prova
      quem é a pessoa, não que ela está no palco. Sem isso, qualquer músico autenticado
      transmitiria "tocando agora" em bar alheio.
- [x] O `establishment_id` é **derivado do evento**, nunca aceito do cliente — é por local que o
      currículo e o setlist inteligente agregam.
- [x] Evento cancelado ou encerrado **não recebe set novo**.
- [x] **Uma música tocando por vez**: `startSong` fecha a anterior automaticamente. Garantido no
      agregado, não no chamador.
- [x] **Um set `live` por (evento, músico)** — índice parcial único no banco
      (`performances_one_live_per_event_musician`), não checagem de aplicação.
- [x] Abrir um set já aberto é **idempotente** (devolve o que está no ar); encerrar duas vezes
      também. Retry com rede ruim no palco é o caso normal, não erro do usuário.
- [x] `position` é atribuída pelo agregado; `ended_at` nunca é anterior a `started_at`.
- [x] O mesmo **pedido** não é registrado duas vezes no set. Música repetida sem pedido é
      permitida — bis existe.
- [x] `title`/`artist` do `PerformedSong` são **snapshot**: renomear na biblioteca não reescreve o
      histórico, e é este par que o fã manda ao Spotify.
- [x] Tocar um pedido marca o pedido como **tocado**, via handler de `SongStartedEvent` com
      idempotência por chave — fecha o ciclo de `PATCH /requests/:id/played`, que existia sem
      chamador.

### Tocando agora (público)

- [x] `GET /performances/live?musician_id=&event_id=` devolve **uma música**, nunca o set inteiro:
      o repertório é o diferencial que o músico monta.
- [x] Sem set aberto responde `is_live: false`, **não 404** — intervalo é estado legítimo.
- [x] Consumido pelo `NowPlayingCard` no perfil público do músico (mobile), com "Salvar no meu
      Spotify" recebendo o par vindo do palco. Leitura por polling de 20s, não socket.

### Relatório pós-show (F6)

- [x] `GET /performances/:performance_id/report` — músicas, pedidos, gorjetas, público.
- [x] Só para set **encerrado**: relatório de show em andamento é número que muda enquanto se olha.
- [x] Só gorjeta `completed` entra, e só a destinada **àquele** artista (evento tem mais de um).
- [x] Gorjeta por música é **heurística de horário**, rotulada como tal no próprio payload
      (`tips_attribution_note`) — não se afirma causalidade que o dado não sustenta.
- [x] `establishment_name` sai no output para o card compartilhável; `null` quando a casa foi
      removida — a UI omite a linha, nunca escreve "Local desconhecido".

### Card compartilhável do pós-show (B1) — 22/ago/2026

- [x] `ShowRecapSection` + `ShowRecapCard` no mobile, dentro da tela de relatório: o post é
      **subproduto** de o músico ter mantido o set aberto, não trabalho extra depois do show.
- [x] 🔴 **Gorjeta é opt-in e o padrão é não mostrar.** O total é a renda do músico naquela noite;
      publicá-lo por padrão transformaria "compartilhar o show" em "divulgar quanto ganhei" num
      toque que parece inofensivo. Mesmo princípio que mantém `Booking.fee` fora do currículo (F4).
      O toggle só aparece quando houve gorjeta. A escolha é **lembrada por músico**
      (`recap-preferences.storage.ts`, `expo-secure-store`), porque o card também tem uso
      informativo/arquivo pessoal — mas a leitura só liga, nunca desliga: enquanto o disco não
      responde o estado é `false`, e falha de leitura cai no lado que não publica renda. Desligar
      **apaga** a chave em vez de gravar `0` — "desligou" e "nunca ligou" ficam indistinguíveis.
- [x] **`tips_during_song` nunca entra no card**, nem com o opt-in ligado. No relatório a estimativa
      viaja com a ressalva (`tips_attribution_note`); num card sem espaço para ela, viraria
      afirmação — que é justamente o que o backend recusa a fazer.
- [x] Set encerrado **sem nenhuma música** não oferece compartilhamento (`songs_count > 0`):
      é um show que não aconteceu, e o botão seria um convite a se expor à toa.
- [x] Sem imagem remota no card — `<Image>` resolve assíncrono e o `ViewShot` não espera o load,
      então a captura sairia com buraco no lugar da foto (armadilha já tratada em `QRShareCard` com
      `Image.prefetch`; aqui é evitada por construção).
- [x] Nenhuma URL no rodapé: não há domínio público configurado no app, e um link inventado num
      card que vai ao Instagram é promessa quebrada para quem tocar nele. Só o wordmark.

### Modo Ensaio — separação de stems (S3) — 22/ago/2026

Domínio `src/core/ai-audio/` (já existia) + `PracticeSeparationController` +
`PracticeModeScreen` no mobile. Ver `Docs/AI-musician/practice-mode.md`.

- [x] `POST /musicians/:id/ai-audio/practice/separations` — separa uma música **da biblioteca**.
      O app **não envia arquivo**: o backend re-resolve o áudio pelo provider, espelhando
      `ai-cifra/uploads/from-provider/analyses`.
- [x] 🔴 **Os stems têm prazo de retenção e isso é a decisão que molda a feature.** O `ai-cifra`
      nunca retém a gravação — apaga o objeto no instante em que a análise conclui e guarda só a
      cifra. **Stem é a gravação, separada**, não um dado derivado como uma folha de acordes; reter
      os quatro por tempo indeterminado seria uma postura de direito autoral diferente da que o
      resto do projeto escolheu, além de storage sem teto. `PurgeExpiredAiAudioStemsUseCase` varre
      de hora em hora (`AI_AUDIO_STEMS_RETENTION_HOURS`, default 72h).
- [x] **`expired` é status próprio, nunca `failed`.** A separação deu certo; o que venceu foi o
      prazo. Sem essa distinção o job ficaria `completed` com URLs que respondem 404 — a pior
      resposta possível para quem abriu o app para ensaiar. O agregado guarda o registro; só o
      áudio some.
- [x] **Ordem obrigatória: storage primeiro, banco depois.** Marcar `expired` antes de apagar
      deixaria objeto órfão no bucket se o processo morresse no meio — invisível, cobrado, e sem
      nada apontando para ele. Falha ao apagar não interrompe o lote, mas impede marcar o job.
- [x] `AiAudioUpload.musicLibraryId` espelha `AiCifraUpload.musicLibraryId` — é este elo que
      permite mostrar a cifra ao lado dos stems. Sem ele a separação é arquivo solto.
- [x] **A posse da música é checada no use-case**, comparando `song.musician_id` com o
      `:musician_id` do path: o guard prova quem é o usuário, nunca de quem é a música.
- [x] Música sem `source`/`source_id` de YouTube responde **422 acionável** — não se inventa busca
      por título+artista, que traria outra gravação (ao vivo, cover, remaster).

### Currículo verificado (F4)

- [x] `GET /musicians/:id/resume` — **derivado, nunca declarado**. O músico não escreve nada: é o
      que o separa da bio.
- [x] Cada número tem prova: `Booking.completed_at`, `checked_in_at`, `EventAttendee`, `Review`,
      `PerformedSong`. Shows de banda contam (bandas onde é membro aceito).
- [x] Público alcançado é contado **distinto por pessoa**, não soma de presenças — o mesmo fã em
      cinco shows é uma pessoa.
- [x] 🔴 **Nenhum valor de cachê sai daqui**, e não é filtragem de presenter: o campo não existe no
      output. A rota é lida pelo público.
- [ ] `distinct_songs_performed` começa em zero: shows anteriores a este subsistema não têm
      `PerformedSong`. Os demais itens são retroativos.

### Setlist inteligente (F5)

- [x] `GET /musicians/:id/setlist-suggestions?establishment_id=` — ranqueia por evidência **daquela
      casa**, não por popularidade geral.
- [x] Toda sugestão carrega `evidence` (origem + contagem): sugestão sem evidência exibível é
      palpite, e o músico precisa poder discordar do motivo.
- [x] `evidence_count: 0` significa "ainda não sabemos nada deste local" — a UI diz isso em vez de
      fingir insight.
- [x] Pesos em constante nomeada, legível em code review. Sem modelo, sem score opaco.

### Pendente

- [ ] Push para o fã (hoje polling de 20s — decisão consciente, ver §2 do doc do subsistema).
- [ ] Wrapped anual do fã (B2) — é a agregação do mesmo dado; decidido fazer o pós-show do músico
      primeiro.
- [ ] Sugestão por **faixa de horário** dentro do local — volume de dado por faixa ainda seria ruído.
- [ ] Encerramento automático de set esquecido aberto (hoje depende do músico ou do app restaurar).

---

## Funcionalidades Planejadas Ainda Não Implementadas

Além dos pontos marcados como `[ ]` e `[~]` acima, os seguintes blocos de funcionalidades do documento de visão **ainda não possuem implementação direta** no backend atual:

- Marketplace com Reels/Vídeos (upload, streaming, revenue sharing por views)
- Sistema de “Memórias Musicais” (álbum de momentos, timeline pessoal, analytics visuais)
- Integrações externas completas:
  - Pipeline próprio de cifras (`ai-cifra-module`) + folha de cifra (LRC + acordes) + MusicXML export
  - Verificação automática de compartilhamentos sociais via APIs
  - Integrações de analytics (GA4, Pixel, social listening)
- Segmentação avançada por instrumentos e proximidade com feed de Reels
- Matching inteligente para formação de bandas (ML, score de compatibilidade, jam virtual)
- Programas especiais de carreira, talent shows virtuais e parcerias avançadas de marketplace
- Gestão detalhada de planos pagos (músicos, estabelecimentos, marketplace) com billing recorrente

Esses itens estão descritos em [features.md](features.md) ([1]), e o código atual fornece boa parte da base de domínio (QR codes, pedidos, gorjetas, gamificação, rankings). Porém ainda serão necessários novos agregados, use-cases e integrações de infraestrutura para chegar à visão completa da plataforma.

---

## Superfície HTTP e container (SM-020) *(26/ago/2026)*

Código: `src/nest-modules/shared-module/security/http-security.policy.ts`, `main.ts`,
`docker-compose.prod.yml`, `docker/rabbitmq-delayed/Dockerfile`.

- [x] 🔴 **A allowlist de CORS vem do ambiente, e produção não tem default.**
  A lista era literal no `main.ts` e continha `http://localhost:3000/3001/8080` em
  **todos** os ambientes, com `credentials: true` — uma página servida do localhost
  da máquina de um usuário logado podia chamar a API de produção com as credenciais
  dele. Uma allowlist que sempre contém localhost não é allowlist.
  `CORS_ALLOWED_ORIGINS` é obrigatória em produção (o Joi recusa o boot) porque
  qualquer palpite nosso seria permissivo demais ou quebraria o front.

- [x] **Swagger desligado por padrão em produção** (`SWAGGER_ENABLED`).
  `/api/docs` publicava o contrato completo da API, com `persistAuthorization`
  guardando o token no `localStorage` de quem abrisse a página. O default inverte
  por ambiente porque o custo do engano é assimétrico: esquecer de ligar em dev
  custa uma variável, esquecer de desligar em produção publica o mapa.

- [x] **Helmet aplicado pela aplicação, não pelo proxy.** Delegar ao proxy é apostar
  numa configuração que vive fora do repositório, que ninguém revisa junto com o
  código e que some no primeiro staging sem proxy. A CSP é `default-src 'none'` —
  uma API JSON não carrega recurso nenhum — e o `'unsafe-inline'` que o Swagger UI
  exige está **amarrado ao interruptor dele**, em vez de valer permanentemente.

- [x] **A política mora em módulo testável, não no `bootstrap()`.** As três decisões
  (quem chama, se o contrato é público, o que o navegador executa) foram extraídas
  para `resolveHttpSecurityPolicy`, função pura com 13 testes. `bootstrap()` é o
  único ponto do sistema que nenhum teste alcança — péssimo endereço para essas
  regras.

- [x] **Workers de IA deixaram de rodar como root.** `ai-cifra-mir-worker` e
  `soundmeet-audio-separation` rodam como `worker` (uid 1001). Eles decodificam áudio
  de origem externa com FFmpeg e bibliotecas nativas — exatamente onde um arquivo
  malformado vira execução arbitrária. O `Dockerfile` do backend **já** era non-root.

- [x] 🔴 **O plugin do RabbitMQ passou a ter checksum.** `ADD <url>` não verifica
  nada: release substituído, conta comprometida ou proxy hostil entregavam um
  plugin adulterado que o broker carregava em silêncio — e um plugin do RabbitMQ vê
  toda mensagem do sistema. Agora o SHA-256 é conferido e o build **falha** se não
  bater.

- [x] **`docker-compose.prod.yml` novo, com o compose de desenvolvimento intacto.**
  Imagens por digest, `read_only`, `cap_drop: ALL`, `no-new-privileges`, nenhuma
  porta de banco publicada e nenhuma senha com default (`${VAR:?}` recusa subir).
  Endurecer o compose de dev tornaria o ambiente de trabalho hostil sem tornar a
  produção segura — produção não roda a partir dele.
  - ⚠️ `/tmp` do `app` é **volume, não tmpfs**: os uploads de áudio passam inteiros
    por `os.tmpdir()`, e um tmpfs colocaria centenas de MB na RAM do host.
  - ✅ **Validado em 26/ago/2026** por `scripts/smoke-test-prod.sh`: 18/18
    verificações passam (non-root nos quatro serviços, raiz somente leitura,
    `/tmp` do app gravável, `/api/docs` 404, cabeçalhos do Helmet, nenhuma porta
    de banco publicada). O script sobe a stack num projeto isolado e derruba no
    fim — não toca o compose de desenvolvimento.
  - 🔴 **A primeira execução encontrou cinco defeitos que só apareceriam no
    deploy**, e é por isso que o smoke test não é opcional:
    1. `envs/.env.production.example` **omitia doze variáveis obrigatórias** — o
       Joi recusava o boot e o container entrava em restart loop.
    2. `RESEND_API_KEY` **não estava no schema Joi**. O `MailService` faz
       `new Resend(apiKey)` no construtor e o SDK lança com chave indefinida:
       o app não subia, com a mensagem `Missing API key`, que não nomeia a
       variável nem indica que o problema é de configuração. Agora é obrigatória
       em produção e falha no validador, com mensagem acionável.
    3. O healthcheck do RabbitMQ era `rabbitmq-diagnostics ping`, que confirma o
       nó Erlang e **não** os listeners. O broker leva ~22s para completar o
       boot; o `ping` respondia OK em poucos segundos, o `depends_on:
       service_healthy` liberava o app na janela e ele morria em `ECONNREFUSED`
       no timeout de 5s do cliente AMQP — crash loop a cada deploy, sem nada de
       errado no broker. Hoje é `check_port_connectivity`.
       ⚠️ O compose de **desenvolvimento** tem o mesmo `ping` e o mesmo defeito
       latente; lá o `restart: unless-stopped` mascara.
    4. `REDIS_URL` não levava a senha que o próprio compose configurava via
       `requirepass` — o app subia, conectava e morria no primeiro comando com
       `NOAUTH Authentication required`.
    5. `container_name` fixo colidia com o compose de desenvolvimento e
       impediria staging e produção no mesmo host. Removido: o nome vem do
       projeto (`-p`).
  - Os workers de GPU **não** estão nesse compose: em produção vivem em host próprio
    (um por placa de 8GB). O endurecimento deles está nos Dockerfiles.
  - 🔴 **O Keycloak também não** — ele já tem compose próprio
    (`infra/keycloak/docker-compose.prod.yml`, SM-014), com decisões deliberadas e
    diferentes: digest **em variável** (a versão migra 22→26 na Fase 4c, e fixar 22
    congelaria a migração), `KC_PROXY_HEADERS` em vez do obsoleto `KC_PROXY`, porta
    não publicada e banco externo. Declarar o serviço nos dois lugares não daria
    erro — daria dois arquivos discordando sobre como subir o provedor de
    identidade, e o deploy seguiria o que alguém abrisse primeiro.

[1]: features.md
[2]: ../src/core/musician/domain/musician.aggregate.ts
[3]: ../src/core/musician/domain/band.aggregate.ts
[4]: ../src/core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case.ts
[5]: ../src/core/musician/infra/db/in-memory/musician-in-memory.repository.ts
[6]: ../src/core/establishment/domain/establishment.aggregate.ts
[7]: ../src/core/scheduling/domain/booking.aggregate.ts
[8]: ../src/core/scheduling/application/use-cases/propose-booking/propose-booking.use-case.ts
[9]: ../src/core/scheduling/application/use-cases/confirm-booking/confirm-booking.use-case.ts
[10]: ../src/core/scheduling/domain/availability.aggregate.ts
[11]: ../src/core/scheduling/infra/db/prisma/availability-prisma.repository.ts
[12]: ../prisma/schema.prisma
[13]: ../src/core/audience/domain/audience.aggregate.ts
[14]: ../src/core/gamification/domain/value-objects/user-level.vo.ts
[15]: ../src/core/audience/application/use-cases/make-music-request/make-music-request.use-case.ts
[16]: ../src/core/audience/application/use-cases/recommend-musicians/recommend-musicians.use-case.ts
[17]: ../src/core/request/domain/request.aggregate.ts
[18]: ../src/core/gamification/domain/user-points.aggregate.ts
[19]: ../src/core/payment/domain/tip.aggregate.ts
[20]: ../src/core/payment/domain/musician-wallet.aggregate.ts
[21]: ../src/core/payment/domain/transaction.aggregate.ts
[22]: ../src/core/payment/application/use-cases/withdraw-to-pix/withdraw-to-pix.use-case.ts
[23]: ../src/core/gamification/domain/value-objects/points-source.vo.ts
[24]: ../src/core/gamification/application/use-cases/calculate-points/calculate-points.use-case.ts
[25]: ../src/core/gamification/domain/user-badge.aggregate.ts
[26]: ../src/core/gamification/domain/value-objects/badge-type.vo.ts
[27]: ../src/core/gamification/application/use-cases/award-badge/award-badge.use-case.ts
[28]: ../src/core/gamification/domain/user-interaction.aggregate.ts
[29]: ../src/core/gamification/domain/value-objects/interaction-metadata.vo.ts
[30]: ../src/core/gamification/domain/ranking.aggregate.ts
[31]: ../src/core/gamification/domain/value-objects/ranking-type.vo.ts

---

## Indicação de talentos e compartilhamento social (28/set/2026)

### O que estava errado

As duas rotas existiam (`POST /audiences/:id/indications` e
`.../social-shares`) e **pareciam funcionar**. Não funcionavam:

1. 🔴 **A indicação era descartada.** Não havia tabela. O use-case incrementava
   `Audience.points` e emitia `MusicianIndicatedEvent` — e **nenhum handler o
   escutava**. Pior: os use-cases nem recebiam o `DomainEventMediator`, então o
   evento nem chegava a ser publicado. Quem indicou quem, para onde e por quê
   sumia. Era por isso que o "dashboard de indicações do estabelecimento" nunca
   pôde ser construído.
2. 🔴 **Dois sistemas de pontos, divergindo em silêncio.** As rotas mexiam em
   `Audience.points` (nível do fã); o ledger canônico `UserScore` +
   `UserPoints` — que o **leaderboard lê** — nunca via nada. E os valores
   divergiam: `AudiencePoints` dava `share_social: 50` / `indicate_musician: 3`,
   enquanto `gamification-points.ts` dava 50 ao share e **nem conhecia** a
   indicação.
3. 🔴 **O compartilhamento era fraude trivial.** 50 pontos — o mesmo que um
   pedido ACEITO — numa ação sem dedupe e sem nada que a corrobore.
   `imageShare.ts` **documenta no próprio código** que o SO não distingue
   "compartilhou" de "abriu o menu e cancelou". Vinte toques = os 1000 pontos de
   `isTopFan`, e o leaderboard é público.

### As decisões

**Valores unificados** nos dois sistemas: compartilhamento **10** (ordem de
`SCAN_QR`, ação leve e não verificável), indicação **15** (exige mais intenção:
escolher músico, local e motivo). Os **50 pontos ficam reservados à missão
7.11**, que exige prova do post — é o que o roadmap 7.3 já mandava tratar como
fonte única deste tema.

**Dedupe por conteúdo, no ledger.** `UserScore` já é a fonte de verdade dos
pontos; uma segunda tabela de "o que já foi pago" poderia divergir dele.
`existsByUserTypeAndReference(user_id, score_type, reference_id)` — **as três
colunas**, porque só `(user, tipo)` bloquearia o segundo compartilhamento de
qualquer conteúdo e só a referência bloquearia o crédito de outro usuário sobre
o mesmo card.

- Compartilhamento: referência `<content_type>:<content_id>`. O prefixo evita
  colisão entre ids de domínios diferentes (dois UUID podem coincidir por
  acidente de seed, e a colisão apareceria como crédito negado sem motivo).
- Indicação: referência `<musician_id>:<establishment_id>`.

⚠️ **Compartilhar/indicar de novo continua funcionando** — mandar o card para
outro grupo é uso normal. O que não acontece duas vezes é o **crédito**.

**`platform` virou opcional** no compartilhamento: o share sheet do SO não
informa o destino. Exigir o campo obrigaria o cliente a inventar um valor, e
dado inventado entra em relatório como se fosse verdade.

**O contrato do share mudou:** `request_id` deu lugar a `content_type` +
`content_id` (`tip_receipt` | `show_recap` | `qr_code` | `request`). A rota não
tinha nenhum cliente, então a troca não quebrou ninguém.

### A indicação como entidade

Domínio `src/core/indication/` + `indications-module` (1 controller).
Migration `20260908120000_add_indications`.

- **Unicidade `(audience_id, musician_id, establishment_id)` no BANCO.** Dois
  POSTs simultâneos furam qualquer checagem só na aplicação, e o mesmo fã
  indicando o mesmo artista para a mesma casa de novo é a mesma opinião,
  repetida. `RecordIndicationUseCase` é idempotente: repetir devolve a
  existente; numa corrida, o `ConflictError` do UNIQUE cai na releitura e
  **nenhum dos dois usuários vê erro**.
- **`status` (`new`/`seen`/`archived`) pertence a QUEM RECEBE.** O fã indica e
  sai de cena; não há método que ele possa chamar. `markAsSeen()` **não
  ressuscita** uma arquivada — senão ela voltaria à caixa sozinha.
- **Arquivar não apaga.** A indicação continua contando como sinal do público
  (e como ponto já creditado). Some da lista, não da história.
- 🔴 **`:indication_id`, nunca `:id`.** Um `:id` de sub-recurso colide com o
  fallback do ownership guard e dá 403 no dono legítimo — armadilha já paga em
  `personal-chord-sheet`. Há `@OwnershipParam({ param: "establishment_id" })`
  explícito e teste de regressão em `indications-module/__tests__/di-check.spec.ts`.
- 🔴 **`UpdateIndicationStatusUseCase` confere `establishment_id` contra a linha
  carregada, e responde 404 — não 403.** O guard prova quem é o usuário, nunca
  de quem é o sub-recurso; e "existe mas não é sua" já confirma a existência a
  quem não deveria saber.
- **Alvos polimórficos sem FK** (precedente de `Review`/`UserScore`), mas o
  `SearchParams.filter` tem **override obrigatório** — sem ele a caixa de um
  estabelecimento devolveria as indicações de todos. Há teste que falha se o
  override for removido.
- **O nome do fã NÃO sai** no presenter. A caixa existe para o dono reagir ao
  sinal do público, não para descobrir quem gosta de quem.

### Ordem no handler

`AudienceEventsHandlers` **persiste antes de creditar**, e as duas coisas falham
independentemente: a indicação é o dado de negócio, os pontos são acessórios.
Perder a indicação por causa da gamificação seria o pior resultado. Nenhuma
falha de pontos propaga para o usuário.

