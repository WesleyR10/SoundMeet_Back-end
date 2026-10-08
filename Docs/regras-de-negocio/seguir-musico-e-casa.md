# Seguir músico e casa

> Parte das [regras de negócio](../README.md) — o que a API já faz, por domínio.
> Marcações: `[x]` implementado · `[~]` parcial · `[ ]` pendente.

*Seção original: “Seguir músico e casa — avisos no celular (Bloco 19.B, 02/out/2026)”.*


Domínio `src/core/follow/` + `src/nest-modules/follows-module/`; disparo em
`notifications-module` (`FollowNotificationsHandler`, `FollowRemindersJob`).

## O que existia antes

Nada. `visao-do-produto.md` citava "artistas seguidos" só como critério de badge, o
comentário do `BackstageFooter` falava em "seguir" sem botão, e o público **não
tinha push token** — com o app fechado, ninguém era avisado de nada.

## Regras

- [x] **Quem pode ser seguido:** músico **ativo e `open_to_gigs === true`** (a
  mesma regra da busca do fã — quem criou conta só para estudar não aparece na
  busca e também não pode ser seguido por id) e casa ativa. Alvo oculto responde
  404, como inexistente. Banda fica fora da v1 (sem página pública no app).
- [x] **Um vínculo por (fã, tipo, alvo)**, garantido por unique no banco; seguir
  de novo é idempotente (devolve o existente, inclusive na corrida).
- [x] **A lista de seguidores não é exposta.** `GET /follows/summary` devolve só
  a contagem e o estado do botão de quem pergunta.
- [x] **Posse do vínculo dentro do use-case** (`:audience_id` + `:follow_id`,
  nunca `:id`): `follow_id` de outro fã responde 404.
- [x] **Sino por vínculo** (`notifications_enabled`): desliga o push de um alvo
  sem deixar de segui-lo.

## Avisos

| aviso | gatilho | quem recebe |
|---|---|---|
| show anunciado | `EventCreatedEvent` (público, futuro) | seguidores da casa |
| artista confirmado | `EventPerformerConfirmedEvent` (novo — inclusão já confirmada ou `pending → confirmed`) | seguidores do músico |
| começou agora | `PerformanceStartedEvent` (novo — set aberto) | seguidores do músico + da casa |
| lembrete do dia | `FollowRemindersJob`, 10h de Brasília, shows públicos que ainda começam hoje | seguidores dos músicos confirmados + da casa |
| show cancelado | `EventCancelledEvent` | **só quem soube do show por aqui** (ledger) |

- 🔴 **Os eventos de domínio de `Event` nunca eram publicados.** `EventCreatedEvent`
  e `EventCancelledEvent` existiam e nenhum use-case chamava o mediator. Hoje
  `CreateEvent`, `CancelEvent`, `AddEventPerformer`, `UpdateEventMusicianStatus`
  e `StartPerformance` publicam (mediator opcional, como no resto do projeto).
- 🔴 **Evento privado nunca notifica**, e músico que fechou `open_to_gigs` não é
  anunciado — mesma regra de seguir.
- **Dedupe no ledger `notification_deliveries`** (unique `audience, kind,
  event`): quem segue o músico E a casa recebe um push só, e um handler que
  reentra não reenvia. `INSERT … ON CONFLICT DO NOTHING RETURNING` reserva antes
  de enviar — perder um push numa queda é aceitável; duplicar, não.
- **O envio roda solto** (`dispatch`): o mediator usa `emitAsync`, que espera os
  handlers, e avisar milhares de seguidores dentro do `POST` de criar evento
  seguraria a resposta do estabelecimento. Falha vira log.
- Envio em lotes de 500 por cursor (`audience_id`), `chunkPushNotifications` do
  Expo. Passo de escala (não implementado): fila RabbitMQ `follow_notifications`.

## Push do público

- [x] `PATCH /audiences/:id/push-token` — token fora do agregado `Audience`
  (porta `IAudiencePushTokenStore`, mesmo precedente de `email_verified_at`), para
  nunca sair por `AudienceOutput`.
- [x] No app, a permissão é pedida **no primeiro "Seguir"** (contexto claro),
  nunca no boot; na abertura só renova o token de quem já permitiu.

## Fora do escopo

Pontos por seguir (o "Discoverer" de `visao-do-produto.md` viraria farm de
seguir/desfazer), banda seguível, aviso ao músico de novo seguidor,
`MusicianAnalytics.newFollowers`, filtro de proximidade no "começou agora"
(o produto não guarda a posição do fã).
