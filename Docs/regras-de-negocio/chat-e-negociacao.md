# Chat e negociação

> Parte das [regras de negócio](../README.md) — o que a API já faz, por domínio.
> Marcações: `[x]` implementado · `[~]` parcial · `[ ]` pendente.

Conversa entre estabelecimento e artista. A agenda, a proposta e o booking em si estão em
[agenda-e-contratacao.md](agenda-e-contratacao.md).

## Chat — as duas portas da negociação (17/set/2026)

Uma `Conversation` nasce de **exatamente uma** de duas origens, e as duas abrem canal:

| Porta | Evento | Coluna | O que é |
|---|---|---|---|
| "Conversar sobre uma data" | `InquiryCreatedEvent` | `conversations.inquiry_id` | Uma **pergunta**: tem assunto, não tem data de show. Quem aceita/recusa é o artista (`@Roles("musician","admin")`) |
| "Propor um show" | `BookingProposedEvent` | `conversations.booking_id` | Uma **oferta**: tem data, horário e cachê, não tem assunto. Quem confirma é a contraparte |

🔴 **Até aqui só a inquiry abria conversa, e a razão nunca foi de produto: era o
schema.** `conversations.inquiry_id` era `NOT NULL` com FK para `inquiries`,
então uma conversa literalmente não conseguia existir sem uma inquiry. A
consequência é que `POST /scheduling/bookings/propose` mandava data e cachê e deixava o
artista **sem onde responder "pode ser 22h?"** — só aceitar o número ou recusar
seco. A UI do estabelecimento chegava a **avisar** "não abre conversa"; aviso
sobre o comportamento do próprio produto costuma ser cheiro de defeito.

Migration `20260917120000_conversation_belongs_to_negotiation`, aditiva em três
passos (soltar o `NOT NULL`, adicionar a coluna nullable, criar a CHECK).

Cinco coisas para não redescobrir:

- 🔴 **A invariante "exatamente uma porta" é dita em DOIS lugares, e os dois são
  necessários.** No agregado (`validateNegotiationOrigin`) para o erro sair como
  `EntityValidationError` com campo nomeado, e no banco
  (`conversations_exactly_one_negotiation`) como última linha. Sem o primeiro, a
  violação chega como erro de constraint do Postgres — em inglês, sem campo,
  achatada num 500 pelo `GlobalExceptionFilter`.
  ⚠️ A CHECK **não aparece no `schema.prisma`** (o Prisma não a modela). Se um
  `migrate dev` gerar `DROP CONSTRAINT` dela, **remova o DROP** — mesmo aviso de
  `performances_one_live_per_event_musician`.
- 🔴 **Booking vindo de CONVERSÃO não abre segunda conversa.**
  `ConvertInquiryToBookingUseCase` também chama `Booking.create`, logo emite o
  mesmo `BookingProposedEvent` — e a inquiry de origem já tem canal desde o
  `InquiryCreatedEvent`. Sem a guarda, a negociação ficaria partida em dois fios,
  o histórico num e a proposta convertida no outro, **sem nada ligando os dois e
  sem erro em lugar nenhum**. Quem carrega o sinal é `from_inquiry_id` no evento.
  ⚠️ Ele **não é coluna do agregado** de propósito: o vínculo persistido é
  `Inquiry.bookingId`, e duplicá-lo criaria duas verdades sobre o mesmo fato.
- **`OpenConversationUseCase` é idempotente pelas DUAS chaves.** As colunas são
  `@unique` e os handlers de evento podem reentrar (retry, replay de outbox);
  sem a leitura antes do `insert`, a segunda execução levaria violação de
  constraint e o `catch` do handler só a registraria no log.
- **`chat` continua sem conhecer `scheduling` como módulo** — o acoplamento é
  pelo evento de domínio importado como tipo, igual ao que já valia para a
  inquiry. O `ChatModule` não importa o `SchedulingModule`.
- **Os clientes escolhem o contexto pela coluna preenchida.** No `soundmeet-web`,
  `NegotiationContext` é união discriminada por `kind` e há um cartão para cada
  porta — um tipo só com tudo opcional deixaria a tela decidir por
  `campo != null`, e bastaria um campo novo para ela mostrar a coisa errada.
  O seed cria **uma conversa de cada origem**, senão o ramo de booking ficaria
  intestável pelo app.

## Chat — a proposta feita dentro da conversa (18/set/2026)

Os dois conversam, chegam a um acordo, e o estabelecimento manda **ali mesmo** a proposta com data,
horário e cachê; o artista aceita ou recusa pelo app, no cartão fixado no topo da conversa.

🔴 **O que havia antes:** a conversa só servia para combinar. Numa conversa aberta por "propor um
show", ajustar o horário exigiria um booking NOVO — e um booking novo emite `BookingProposedEvent`,
que abre uma SEGUNDA conversa. E, do lado do músico, **o app não tinha tela nenhuma de booking**: nem
as propostas de "Propor um show" podiam ser aceitas, apesar de o painel afirmar "quem aceita é o
artista, pelo aplicativo".

- [x] **`POST /scheduling/bookings/:id/revise`** (`ReviseBookingProposalUseCase`,
      `Booking.reviseProposal`) — nova proposta sobre a **mesma** negociação. Reescreve início, fim,
      cachê e observações; `proposed_by` passa a ser quem revisou (derivado do JWT); prazo novo de
      **48h**; campos de cancelamento limpos. Emite `BookingProposalRevisedEvent` — **nunca**
      `BookingProposedEvent`, que abriria outra conversa.
  - Vale para `pending` (ajuste), `expired` (renovação) e `cancelled` **com `confirmed_at` nulo**
    (nova oferta depois de uma recusa). 🔴 Booking que **já foi confirmado** nunca é revisto — tem
    contrato emitido e, com escrow, cachê em custódia. É `confirmed_at`, não o `status`, que separa
    "recusada" de "show desfeito": os dois terminam em `cancelled`.
  - Oferta para o passado é recusada no domínio (`start_at` precisa ser futuro).
  - Checa agenda (disponibilidade, show confirmado no intervalo, teto por dia no fuso da agenda)
    **antes** de a proposta chegar ao artista. O `confirm` continua revalidando — esta checagem é para
    a proposta não nascer impossível.
  - Qualquer lado da negociação pode revisar (`assertNegotiationParticipant`), como na proposta
    original. `proposed_by` no corpo é descartado pelo whitelist e sobrescrito pelo controller.
- [x] **Conversão de inquiry aceita `open` além de `accepted`.** A regra antiga exigia o "aceitar
      conversa" do artista antes de qualquer oferta, e travava o fluxo do chat: o artista respondia
      por mensagem e nunca tocava no botão, e a conversão levava 422. O consentimento não é pulado —
      muda de lugar: o booking nasce `pending` e só vira show quando o artista confirma. Recusada ou
      vencida continua não convertendo.
- [x] **A conversão passou a registrar `proposed_by`** (derivado do JWT, `deriveActorSide` agora em
      `negotiation-actor-side.ts`, compartilhado pelos dois controllers). Antes nascia nulo, e o app
      não tinha como saber que a vez era do artista.
- [x] **Proposta de show avisa o artista** (`NotificationsSchedulingEventsHandler`): socket
      `booking.updated` com status `proposed`/`revised` + push. 🔴 Até aqui só a inquiry tinha push —
      "Propor um show" dependia de o artista abrir o app por acaso. Sem e-mail (etapa de negociação;
      o comprovante é o e-mail da confirmação). Revisão feita pelo próprio artista não o notifica.
      ⚠️ Booking de banda não gera push (o token é do músico, não da banda).
- **O painel web decide convert × revise no BFF**, relendo conversa, inquiry e booking do backend —
  o cliente manda só os termos, nunca um `booking_id`. O texto da proposta entra na conversa como
  mensagem do estabelecimento (best-effort: se falhar, a proposta continua feita).

Essas funcionalidades estão descritas em detalhes em _Features_, mas ainda não possuem fluxos completos (ex.: controllers, realtime, chat). A base de reservas e disponibilidade está concentrada no domínio _Scheduling_.
