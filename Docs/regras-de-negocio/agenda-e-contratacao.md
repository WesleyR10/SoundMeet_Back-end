# Agenda e contratação

> Parte das [regras de negócio](../README.md) — o que a API já faz, por domínio.
> Marcações: `[x]` implementado · `[~]` parcial · `[ ]` pendente.

*Seção original: “Domínio Scheduling (Agenda, Reservas e Disponibilidade)”.*


**Booking (Reserva)**

- [x] Booking representa uma reserva negociada com janela de tempo e status  
       Código: booking.aggregate.ts ([7]).  
       Regras:
  - Reserva tem `start_at` e `end_at`, com `buffer_minutes` (janela efetiva usada para conflitos é a janela com buffer).
  - Ciclo de vida inclui `pending`, `confirmed`, `cancelled`, `expired`, `completed` (com timestamps por transição quando aplicável).
  - Confirmação é permitida somente quando `status = pending`.

- [x] **Proposta exige data E cachê** *(decisão de produto de 25/set/2026)*  
       Código: `Booking.assertProposalTerms` (booking.aggregate.ts); DTOs de propor, converter inquiry
       e revisar (`@IsPositive()` em `fee`).  
       Regras:
  - "Para iniciar conversa não precisa; para enviar proposta é obrigatório data e valor." Conversar
    sem valor é a **inquiry**. Até aqui `fee: null` ("a combinar") passava, e o artista recebia uma
    proposta sem ter o que aceitar.
  - Vale para as **três portas** que produzem proposta: propor, converter inquiry e revisar. A regra
    mora no agregado, e não num use-case, para uma quarta porta herdá-la sem saber que existe; o DTO
    repete a exigência só para o 422 nomear o campo.
  - Cachê precisa ser **maior que zero** — zero é "show de graça", não "a combinar".
  - 🔴 **Não vale no construtor:** booking antigo sem cachê continua carregável (recusar ali daria
    `LoadEntityError` em toda proposta "a combinar" já gravada). A tela segue exibindo "A combinar"
    para esses; revisá-los exige informar o valor.
  - Web: os três formulários (`ProposeBookingForm`, `ConvertInquiryForm`, `ProposalComposer` do
    chat) marcam o campo como obrigatório, e o BFF reaplica o mesmo schema no servidor.

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

- [x] Revisar proposta (contraproposta) — `POST /scheduling/bookings/:id/revise` *(18/set/2026)*  
       Código: revise-booking-proposal.use-case.ts.  
       Regras: ver "Chat — a proposta feita dentro da conversa" em Establishment. Só booking nunca
       confirmado; reabre `expired` e `cancelled` pré-confirmação; não cria booking nem conversa.

**Leitura de agenda (Bloco 9.2 — 07/ago/2026)**

- [x] Listar reservas e propostas do usuário autenticado — `GET /scheduling/bookings`,
      `GET /scheduling/bookings/:id`, `GET /scheduling/inquiries`.
      Código: `list-bookings.use-case.ts`, `get-booking.use-case.ts`, `list-inquiries.use-case.ts`.
      Regras:
  - Antes disto o domínio só tinha propose/confirm/cancel e create/accept/reject: **o estabelecimento propunha uma reserva e nunca mais a via**. As únicas leituras eram `free-busy`/`month-slots`, agregadas e sem status/cachê.
  - **O escopo vem do token, nunca da query.** `participant_ids` recebe todas as identidades (`sub` + claims `establishment_ids`/`band_ids`) e casa em **OR** contra `establishment_id`/`musician_id`/`band_id` — um id só não dá conta, porque o lado pelo qual a pessoa participa depende do papel. Filtros de query apenas **refinam** dentro do escopo (AND); pedir o `establishment_id` de outro devolve zero.
  - **Fail-closed:** ator identificado mas sem nenhuma identidade utilizável recebe 403. Lista vazia de identidades **nunca** vira "sem filtro" — isso devolveria a agenda de todos os usuários.
  - **Ver ≠ decidir.** `GetBooking` usa `assertNegotiationViewer`: quem tem o claim `band_ids` da banda lê o show marcado, sem que a liderança seja conferida. Liderança segue exigida para confirmar/cancelar (`assertNegotiationParticipant`). ⚠️ Na prática só o LÍDER tem o claim (escrito na criação da banda e movido na transferência de liderança); integrante comum não vê a agenda da banda — ver [ainda-nao-implementado.md](ainda-nao-implementado.md).
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

- [x] Limite de shows por dia configurável  
  `max_shows_per_day` na disponibilidade é aplicado em `ConfirmBookingUseCase`: confirmar além do limite do dia é recusado. ⚠️ A grade pública (`free-busy`/`month-slots`) **não** desconta o limite — um dia pode aparecer livre e a confirmação recusar.

**Google Calendar (sync one-way de bookings — jul/2026)**

- [x] Músico (ou líder de banda) conecta a própria conta Google e bookings confirmados viram eventos na agenda pessoal dele; cancelamentos removem o evento  
       Código: domínio `src/core/google-calendar/`, módulo `src/nest-modules/google-calendar-module/`.  
       Regras:
  - Sync é **one-way** (SoundMeet → Google). Nunca lê a agenda do Google de volta.
  - Conexão é sempre por `musician_id` (1:1, tabela `google_calendar_integrations`). Em booking de banda, sincroniza **apenas a agenda do líder** (`role === "leader"` em `Band.members`); banda sem líder é no-op. O registro `google_calendar_synced_events` guarda em qual agenda o evento foi criado — cancelamento usa esse registro, nunca re-resolve o líder (troca de liderança não aponta pra agenda errada).
  - Tokens OAuth persistidos **cifrados** (AES-256-GCM, chave `TOKEN_ENCRYPTION_KEY` de 32 bytes via env; IV único por operação). Nunca em texto claro, nunca logados, nunca expostos em presenter/`toJSON()`.
  - Client OAuth **separado** do login social (`GOOGLE_CALENDAR_CLIENT_ID/SECRET` ≠ `GOOGLE_KEYCLOAK_CLIENT_ID/SECRET` — o IdP do Keycloak tem `storeToken:false` e é inutilizável para Calendar). Escopo mínimo: `calendar.events` + `openid email`.
  - Callback OAuth é rota fixa `GET /google-calendar/oauth/callback` (`@Public()` — redirect de navegador sem Bearer): a autenticidade vem do `state` assinado (HMAC-SHA256 + nonce + expiração de 10min), validado antes de qualquer troca de `code`.
  - 🔴 **O callback REDIRECIONA para o app, não devolve página** (24/set/2026). Até aqui ele respondia um HTML "volte ao aplicativo" — escrito quando a feature não tinha cliente nenhum. Quem abre o consentimento é a Chrome Custom Tab do app (`openAuthSessionAsync`), e ela **só fecha sozinha quando o navegador chega no `returnUrl`**: com a página, o músico terminava o fluxo e ficava olhando uma aba que ele mesmo tinha de fechar, e o app não sabia se deu certo — só que a aba sumiu. Hoje todos os caminhos terminam em `response.redirect(GOOGLE_CALENDAR_APP_RETURN_URL?status=sucesso|cancelado|erro)`, mesmo desenho de `mercadopago-callback.controller.ts`. Env opcional, com queda para `soundmeet://agenda/google`.
    - **`cancelado` é status próprio, separado de `erro`**: quem desistiu foi o usuário, nada quebrou, e o app diz isso com outras palavras.
    - 🔴 **O e-mail da conta NÃO viaja no redirect** — é PII e ficaria no histórico do navegador e em qualquer log de proxy pelo caminho. Quem o entrega é `GET .../status`, autenticado. De quebra, sem HTML na resposta não sobrou superfície de XSS aqui (o teste de escape que existia deixou de ter o que testar; no lugar dele há um que **falha se o e-mail aparecer na URL**).
    - O motivo da recusa vai para o LOG, nunca para a query: `state` inválido é forja ou link velho, e detalhar a causa na URL ensina o atacante o que ajustar.
  - Sync é assíncrono via RabbitMQ (`GOOGLE_CALENDAR_SYNC_TRANSPORT`, default `noop` = feature inerte): handler `@OnEvent` cross-module só enfileira, o consumer chama a API do Google. Idempotência em 3 camadas: `messageId` na fila, status em `google_calendar_synced_events` e id determinístico do evento no Google (UUID do booking sem hífens; 409 = já criado = sucesso). Corrida confirm/cancel entre filas tem compensação: re-check do status pós-create remove evento órfão.
  - `GoogleCalendarAuthError` (token revogado) é **não-retriável** (listado no `RabbitmqConsumeErrorFilter`) e desativa a integração — o músico reconecta pelo app. Indisponibilidade do Google é retriável (backoff da fila). Músico sem conta conectada é estado normal → no-op silencioso, nunca erro.
  - Disconnect (`DELETE /musicians/:id/google-calendar`) revoga o token no Google best-effort e **sempre** zera os tokens locais (indisponibilidade do Google não bloqueia o disconnect). **Eventos já criados na agenda do músico não são apagados** — são dele; o que para é a sincronização daí em diante.

- [x] **UI mobile — o músico consegue conectar (24/set/2026)**
       Código: `soundmeet-mobile/src/features/scheduling/` (`domain/google-calendar.{types,rules}.ts`, `infrastructure/google-calendar.api.ts`, `application/useGoogleCalendar.ts`, `ui/components/GoogleCalendarCard.tsx`), montado na `AgendaScreen`.
       Regras:
  - 🔴 **O backend estava pronto desde jul/2026 e não tinha chamador em cliente nenhum** — `connect`/`status`/`DELETE` eram inalcançáveis, então a feature inteira (OAuth, cifra em repouso, sync por fila, 93 testes) não podia ser ligada por ninguém. Não faltava backend; faltava a porta.
  - Card na **Agenda**, não no menu de perfil: é onde o modelo mental está. Web não entra — `soundmeet-web` é exclusivo do persona estabelecimento, e conectar agenda é ação do músico (mesma razão que mantém o vínculo do Mercado Pago fora do web).
  - **O estado desconectado NÃO é alerta.** O `MercadoPagoLinkCard` grita em âmbar porque sem vínculo o músico *não recebe gorjeta* — ali a falha é do produto. Aqui não há nada quebrado: a agenda do app funciona sozinha e o Google é conveniência. Pintar de amarelo ensinaria a ignorar o amarelo que importa.
  - **Enquanto o status não chega, o card não afirma nada.** Renderizar "Conectar" por padrão faria quem já conectou ver convite para reconectar a cada abertura — e reconexão dispara `prompt=consent` no Google à toa.
  - **Desconectar pede confirmação**, porque o efeito é silencioso: nada some da tela, e o músico só descobriria meses depois que os shows pararam de aparecer.
  - O card declara que show de banda entra **só na agenda do líder** — é a regra do backend, e escondê-la faria o membro achar que a integração dele falhou.

[7]: ../../src/core/scheduling/domain/booking.aggregate.ts
[8]: ../../src/core/scheduling/application/use-cases/propose-booking/propose-booking.use-case.ts
[9]: ../../src/core/scheduling/application/use-cases/confirm-booking/confirm-booking.use-case.ts
[10]: ../../src/core/scheduling/domain/availability.aggregate.ts
[11]: ../../src/core/scheduling/infra/db/prisma/availability-prisma.repository.ts
[12]: ../../prisma/schema.prisma