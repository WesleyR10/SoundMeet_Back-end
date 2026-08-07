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
       Regra: QR usa esquema `soundmeet://musician/{id}` + URL pública `https://soundmeet.app/musician/{id}` e é gerado na criação.

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
       Regra: QR segue o padrão `soundmeet://establishment/{id}` com URL pública `https://soundmeet.app/establishment/{id}`.

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
- [ ] Gestão de indicações com priorização por relevância — `IndicateMusicianUseCase` existe do lado do público (audiência ganha pontos), mas falta notificação/dashboard do lado do estabelecimento
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

- [~] Sistema de indicação de talentos para estabelecimentos  
  A ideia está refletida nas entidades de Audience, Musician e nas preferências, mas ainda **não há** um fluxo fechado (use-case + agregados específicos) que implemente o botão “Indicar para Estabelecimento”, o dashboard de indicações e as recompensas associadas.

---

## Domínio Request (Pedidos Musicais)

**Criação e ciclo de vida do pedido**

- [x] Pedido musical ligado a público, músico, música e artista  
       Código: request.aggregate.ts ([17]).  
       Regras:
  - Campos principais: `audience_id`, `musician_id`, `song_title`, `artist`, mensagem opcional, flags e metadados.
  - `status` inicial é `pending`.
  - Datas: `created_at`, `responded_at`.

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

**Monetização e planos**

- [x] Planos de assinatura para músicos e estabelecimentos (valores, limites, taxas diferenciadas) **(corrigido 06/ago/2026 — o texto anterior dizia que "ainda não há agregados de plano, cobrança recorrente ou lógica de pricing", o que estava desatualizado desde jun/2026)**  
       Código: `src/core/plans/` completo — aggregate `Subscription` (com `BillingCycle` mensal/anual e `expires_at` auto-computado), `PlanCheckService`, `plan-features.config.ts` (`MUSICIAN_PLAN_FEATURES`/`ESTABLISHMENT_PLAN_FEATURES` + tabelas de pricing), validator, repositórios in-memory + Prisma, e 5 use-cases (`list-plans`, `get-active-subscription`, `create-subscription-checkout`, `activate-subscription-from-payment`, `cancel-subscription`).  
       Regras:
  - Cobrança recorrente real via `AsaasSubscriptionGateway` (`POST /v3/subscriptions`). `billingType: UNDEFINED` faz o Asaas gerar uma **fatura hospedada** (`invoiceUrl`) em que o pagador escolhe PIX/cartão/boleto — a plataforma **nunca** coleta dados de cartão.
  - Exposto em `src/nest-modules/plans-module/plans.controller.ts`: `GET /plans` (`@Public()`), `GET/POST/DELETE /musicians/:id/subscription[/checkout]` e `GET/POST/DELETE /establishments/:id/subscription[/checkout]`, todos com o ownership guard correspondente.
  - Taxas diferenciadas de gorjeta (9%/7%/5%) e config de saque por tier já aplicadas em `WithdrawToPixUseCase`.
  - ⚠️ **Enforcement é grant-at-action:** o gate é cobrado no momento da ação, nunca revalidado na leitura. Quem faz downgrade mantém o que já concedeu (link compartilhado, convite). Detalhado em [plans/musician-plans.md](plans/musician-plans.md#️-enforcement-de-gates-ação-vs-leitura-ler-antes-de-mexer-em-qualquer-gate-de-plano).

- [~] Gorjeta com gateway PIX real — **é o único vértice de pagamento ainda mockado.** `send-tip` usa `PixGatewayMock`, aguardando chaves da Iugu. Saque (`AsaasGatewayAdapter`) e assinatura (`AsaasSubscriptionGateway`) já são reais. Ver [payment-gateway-decisions.md](payment-gateway-decisions.md).

---

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

