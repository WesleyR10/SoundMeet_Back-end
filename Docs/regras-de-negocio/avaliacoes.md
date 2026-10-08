# Avaliações

> Parte das [regras de negócio](../README.md) — o que a API já faz, por domínio.
> Marcações: `[x]` implementado · `[~]` parcial · `[ ]` pendente.

*Seção original: “Domínio Review (Avaliações)”.*


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
- [x] **Quebra por tipo de autor** *(18/set/2026)* — `GET /musicians/:id/ratings/summary`,
      `@Public()`, `GetRatingBreakdownUseCase`. Devolve `overall` mais uma fatia por
      `author_type` (`audience`, `establishment`, `musician`).
      🔴 **Existe porque a nota exibida NUNCA foi "de outros estabelecimentos".**
      `aggregateForTarget` agrega o ledger inteiro **sem filtrar autor**, então o número do cartão
      de `/dashboard/artistas` sempre foi público + casas + músicos numa média só — e a tela do
      estabelecimento levava a lê-lo como avaliação de pares. Era afirmação falsa por omissão.
      ⚠️ **`overall` NÃO é a média das parciais** (os pesos diferem) — o output entrega os dois
      lados para que nenhum cliente recomponha. Há teste que fixa a divergência.
      ⚠️ **Cada fatia vem com o seu `total`**, e isso é obrigatório para a UI ser honesta: "5,0 do
      público" com uma avaliação e com trinta são afirmações de força muito diferente.
      ⚠️ **Tipo sem avaliação vem `null`, nunca `{average: 0, total: 0}`** — zero lê como "avaliado
      mal", e a diferença entre isso e "não avaliado" é o ponto inteiro da quebra. O cliente filtra
      por `total`, jamais por `average`: uma nota 1 com total 1 é a avaliação que mais importa.
      ⚠️ Autor desconhecido (a coluna é String, não enum) é **descartado** da quebra, nunca somado a
      um bucket conhecido — por isso `overall` vem da agregação própria, e não da soma das fatias.
      Consumido pelo painel "Reputação" de `/dashboard/artistas/musicos/[id]` no web.
- [ ] Moderação/denúncia de avaliação — não implementado.
- [ ] `EstablishmentRatedEvent` segue sem ouvinte (evento morto, anterior a este bloco).
- [ ] **Sem equivalente para estabelecimento.** `GET /establishments/:id/ratings/summary` não
      existe — não por simetria esquecida, mas porque ninguém pediu: quem lê a nota do local é o
      músico no mobile, e lá a procedência ainda não virou pergunta.

## Onde a avaliação aparece em cada cliente

| Quem avalia → quem | Backend | Tela |
|---|---|---|
| Estabelecimento → músico | `POST /musicians/:id/ratings` | ✅ Web: formulário na contratação (`/dashboard/contratacoes/[bookingId]`, `ReviewMusicianForm`) |
| Músico → estabelecimento | `POST /establishments/:id/ratings` | ✅ Mobile: na tela do contrato (`ContractReviewAction`), ver abaixo |
| Fã → músico ou estabelecimento | as duas rotas aceitam `audience` | ❌ **Nenhuma tela de envio** em cliente nenhum |

Leitura: web nas páginas públicas `/musico/[id]` e `/local/[id]` e no painel "Reputação" do artista;
mobile no perfil do músico (`ReputationDesk`, a quebra por tipo de autor). As telas do fã que
**exibem** avaliações (`fan-artist`, `fan-venue`) estavam em construção e não commitadas em
02/out/2026.

- [ ] Tela para o fã avaliar músico e casa depois do show — o backend já aceita e já checa o vínculo
      (`ReviewEligibilityService`).

## UI do músico avaliando o estabelecimento *(21/ago/2026)*

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
