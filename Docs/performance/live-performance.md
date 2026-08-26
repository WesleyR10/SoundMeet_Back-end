# Apresentação ao vivo — arquitetura do subsistema `performance`

> **Fonte única** do domínio `src/core/performance/` e do módulo
> `src/nest-modules/performance-module/`.
>
> Cobre a primitiva de registro de execução (F0) e os três read models que ela
> sustenta: relatório pós-show (F6), currículo verificado (F4) e setlist
> inteligente (F5).

---

## 1. Por que existe

Até 21/ago/2026 o SoundMeet **não sabia o que o músico tocava**. Não é figura de
linguagem: `grep` por `now_playing` / `current_song` / `currently_playing` em
todo `src/` do backend não retornava nada, `Event` não tinha campo de música
atual, e o `PlayModeScreen` do mobile avançava de música com
`navigation.setParams` — nenhuma chamada de rede. O repertório é uma lista do
que o músico **sabe** tocar; ninguém registrava o que ele **tocou**.

Três consequências concretas, todas encontradas na mesma investigação:

1. **A ponte Spotify entregava menos do que prometia.** `SaveToSpotifyAction`
   renderiza num lugar só — a tela de sucesso de `SongRequestScreen` — com
   `title`/`artist` vindos dos campos que o próprio fã digitou. A feature era
   "salve o que você pediu", nunca "salve o que você está ouvindo".
2. **O relatório pós-show não podia existir.** `roadmap-web.md:722` promete
   *"18 músicas, 6 pedidos aceitos, R$ 210 em gorjetas"* e afirma que os dados
   estão 100% prontos. `requests` e `tips` estão; **"18 músicas" não** — não
   havia de onde tirar o número.
3. **O setlist inteligente não tinha lastro.** Cruzar local × horário × pedido ×
   gorjeta sobre apenas os pedidos aceitos cobre uma fração do show — justamente
   a fração enviesada para o que o público já conhecia o suficiente para pedir.

Uma primitiva resolve as três. É esta.

---

## 2. A decisão que mais moldou o desenho: o set aberto é o interruptor

O caminho óbvio seria o `PlayMode` registrar automaticamente cada música que o
músico abre. **Está errado, e o erro é sério:** o Play Mode é usado para
estudar em casa. Registro automático transformaria ensaio em histórico público,
publicaria a rotina de estudo de alguém, e envenenaria os três read models com
músicas repetidas 14 vezes numa tarde de quarta-feira.

Por isso o músico **abre o set explicitamente** (`POST /performances`) e só
então o Play Mode passa a transmitir. Sem set aberto, o Play Mode é exatamente
o que sempre foi: privado, silencioso, offline.

Consequência de desenho: `startSong` **exige** uma `Performance` no estado
`live`. Não existe "registrar música solta" — sem set, não há o que registrar.

A segunda decisão que caiu daí: **o fã lê por polling, não por socket.** Uma
música dura minutos; 20 segundos de defasagem é imperceptível no contexto e o
React Query já faz isso em todo o app. A alternativa exigiria uma room
`event:${id}` no `NotificationsGateway`, que hoje só entra em rooms derivadas de
*claims do JWT* (`user:`, `establishment:`) — uma room que o cliente pede para
entrar é uma superfície de autorização nova, para ganhar segundos que ninguém
percebe. Fica registrado como upgrade possível, não como dívida.

---

## 3. Estrutura

```
src/core/performance/
  domain/
    performance.aggregate.ts        # Performance (raiz) + PerformedSong (entidade embutida)
    performance.repository.ts       # IPerformanceRepository + SearchParams/Result/Filter
    performance.validator.ts
    performance-fake.builder.ts
    value-objects/
      performance-status.vo.ts
    events/
      song-started.event.ts
      performance-ended.event.ts
    __tests__/
  application/
    use-cases/
      common/performance-output.ts
      start-performance/  start-song/  end-performance/
      get-performance/  get-live-performance/  list-performances/
      get-performance-report/        # F6
      get-musician-resume/           # F4
      suggest-setlist/               # F5
  infra/db/
    in-memory/  prisma/
src/nest-modules/performance-module/
  performance.module.ts
  performance.controller.ts          # músico — escrita + leitura própria
  live-performance.controller.ts     # fã — só "tocando agora"
  performance.providers.ts
  performance.presenter.ts
  dto/  __tests__/  testing/
```

`PerformanceModule` é **nó-folha**: importa `MusiciansModule`, `EventModule`,
`SchedulingModule`, `RequestsModule` e `PaymentModule`, e ninguém importa ele de
volta. Mesmo motivo já documentado em `ReviewsModule` — o ciclo estático de
import quebra no carregamento (TDZ), antes de o NestJS resolver a DI.

---

## 4. O agregado `Performance`

```
Performance (AggregateRoot)
  performance_id   PerformanceId
  event_id         Uuid
  establishment_id Uuid
  musician_id      Uuid          # quem OPERA o set — é quem o guard autoriza
  band_id          Uuid | null   # em nome de quem se toca, quando é banda
  status           PerformanceStatus   # "live" | "ended"
  started_at       Date
  ended_at         Date | null
  songs            PerformedSong[]
```

```
PerformedSong (entidade embutida, mesmo padrão de RepertoireSong)
  performed_song_id   string
  music_library_id    string | null   # null quando a música não está na biblioteca
  request_id          string | null   # preenchido quando atende um pedido do público
  title               string          # SNAPSHOT
  artist              string          # SNAPSHOT
  position            number
  started_at          Date
  ended_at            Date | null
```

### `title`/`artist` são snapshot, não referência

Mesmo raciocínio do snapshot congelado do `Contract`: se o músico renomear a
música na biblioteca seis meses depois, o histórico do show não pode mudar
retroativamente. E há uma razão extra aqui — **é este par de strings que o fã
manda para a busca do Spotify**. Precisa ser exatamente o que foi anunciado no
palco, não o que a biblioteca diz hoje.

`music_library_id` continua guardado para poder ligar a execução ao repertório
(é o que o F5 cruza), mas é ponteiro, não fonte.

### `musician_id` é quem opera, não "o artista"

Um show de banda tem um celular rodando o app. Esse músico é o `musician_id`, e
é ele que o `MusicianOwnershipGuard` autoriza; `band_id` diz em nome de quem se
toca. Isso evita todo um caminho de resolução de líder no caminho quente do
palco — e continua correto, porque quem está mexendo no app *é* aquela pessoa.

O currículo (F4), esse sim, resolve as bandas do músico e conta os shows dela
(§7.2) — lá o custo da consulta é irrelevante e a resposta honesta importa.

---

## 5. Invariantes

| # | Invariante | Por quê |
|---|---|---|
| 1 | **Uma música tocando por vez.** `startSong()` fecha a anterior automaticamente (`ended_at = agora`). | Duas músicas "agora" é estado impossível: o fã veria duas respostas para "o que está tocando?". Fechar a anterior no mesmo método é o que torna a corrida impossível, em vez de pedir ao chamador que lembre. |
| 2 | **Set encerrado não recebe música.** `endPerformance()` fecha a última música e trava. | Sem isso, um app esquecido aberto continuaria registrando no show de ontem. |
| 3 | **`position` é atribuída pelo agregado**, nunca pelo chamador. | Mesmo motivo de `Repertoire.addSong`: posição vinda de fora chega duplicada ou com buraco no primeiro retry. |
| 4 | **Um set `live` por `(event_id, musician_id)`** — garantido por índice parcial único **no banco**. | Dois sets ao vivo dão "tocando agora" ambíguo. Checagem só na aplicação não sobrevive a dois `POST` simultâneos (mesmo raciocínio da unique de `Review` e do índice parcial de líder de banda). |
| 5 | **`request_id` não se repete dentro do set.** | Tocar o mesmo pedido duas vezes contaria dobrado no relatório e no ranking do F5. Música repetida sem pedido é permitida — bis existe. |
| 6 | **`ended_at` nunca é anterior a `started_at`.** | Duração negativa envenena silenciosamente toda soma de tempo de palco no currículo. |

⚠️ O índice parcial da invariante 4 (`performances_one_live_per_event_musician`)
**não é expressável em Prisma** e vive só no SQL da migration. Se algum
`migrate dev` gerar um `DROP INDEX` dele, **remova o DROP e mantenha o índice** —
exatamente o aviso já registrado em `band_members_one_accepted_leader`.

---

## 6. Rotas

Prefixo global `api/v1`.

### `performance.controller.ts` — músico (autenticado)

| Método | Rota | Papel |
|---|---|---|
| `POST` | `/performances` | Abre o set. `@Roles("musician")` + ownership por `musician_id` no corpo. |
| `POST` | `/performances/:performance_id/songs` | Começa uma música (fecha a anterior). |
| `PATCH` | `/performances/:performance_id/end` | Encerra o set. |
| `GET` | `/performances/:performance_id` | Lê o set. |
| `GET` | `/performances/:performance_id/report` | **F6** — relatório pós-show. |

### `live-performance.controller.ts` — fã (autenticado)

| Método | Rota | Papel |
|---|---|---|
| `GET` | `/performances/live` | **Tocando agora**, por `musician_id` + `event_id` (query). |

### Duas armadilhas de rota, já conhecidas neste repo

- **`@Get("live")` vem ANTES de `@Get(":performance_id")`.** Invertido, `live`
  casa como id, o `ParseUUIDPipe` responde 422 e a feature do fã simplesmente
  não existe. É a mesma ordem que `contract-module` documenta.
- **`:performance_id`, nunca `:id`.** O `MusicianOwnershipGuard` resolve o dono
  por `["musician_id","musicianId","id"]`; um `:id` de sub-recurso colide e dá
  403 no dono legítimo (armadilha registrada a partir de `personal-chord-sheet`).

E por isso mesmo, nas rotas de `:performance_id` **a posse não é resolvida pela
URL**: o use-case carrega a `Performance` e compara `performance.musician_id`
com o `currentUser.userId` do JWT. É o padrão que a auditoria de 21/ago apontou
como mais robusto em `ai-audio.controller.ts` — evita a classe de bug inteira em
vez de desviar dela.

---

## 7. Os três read models

Nenhum dos três é agregado. São **projeções calculadas na leitura**, seguindo o
precedente já documentado em `establishment-analytics.read-model.ts`: *"write
authority remains in the bounded contexts that produce the metrics"*. Não há
estado próprio para mutar, então criar agregado só adicionaria cerimônia e uma
segunda verdade para sair de sincronia.

### 7.1 F6 — Relatório pós-show (`get-performance-report`)

Um show, um relatório. Composto de:

- **Músicas tocadas** — do próprio set (contagem e lista, com duração).
- **Pedidos** — recebidos / aceitos / recusados / tocados, do `IRequestRepository`.
- **Gorjetas** — soma e contagem de `Tip` com `status = paid` naquele evento.
- **Público** — `EventAttendee` do evento.

Só é gerado para set **encerrado**. Relatório de show em andamento é um número
que muda enquanto se olha — e o músico o leria no palco, que é exatamente onde
ele não deveria estar olhando para métricas.

🔴 **A atribuição de gorjeta a uma música é heurística, e é rotulada como tal.**
O relatório informa a gorjeta do *show*; quando associa a uma música (janela de
tempo), o campo se chama `tips_during_song` e a documentação de API diz
explicitamente que é proximidade temporal, não causalidade declarada. Afirmar
"esta música rendeu R$ 40" seria inventar uma relação que o dado não sustenta.

#### O card compartilhável (B1) — o que ele mostra a MENOS que o relatório

Entregue em 22/ago/2026 (`ShowRecapCard` + `ShowRecapSection`, mobile). O relatório é
privado e serve para o músico entender o show; o card é público e serve para
provar que ele aconteceu. Três diferenças nascem daí, e nenhuma é estética:

- **Gorjeta é opt-in, desligada por padrão.** É a renda do músico. Um card que a
  publica por padrão transforma "compartilhar o show" em "divulgar quanto ganhei"
  — decisão que ninguém tomou conscientemente. Mesmo princípio do §7.2 (currículo
  sem cachê): o número existe, quem decide expor é o dono dele.
- **`tips_during_song` não entra, nem com o opt-in ligado.** Aqui a ressalva não
  cabe na imagem, e estimativa sem ressalva é afirmação.
- **Pedido recusado não aparece.** Dado de operação, não de vitrine.

O backend contribuiu com um campo só: `establishment_name` no output do
relatório (precedente de `get-musician-resume`, que já resolvia nome de casa via
`IEstablishmentRepository`). `null` quando a casa foi removida — a UI omite a
linha em vez de escrever placeholder.

### 7.2 F4 — Currículo verificado (`get-musician-resume`)

**A regra que define a feature: currículo é derivado, nunca declarado.** O
músico não escreve uma linha dele. É isso — e só isso — que o separa da bio, que
já existe e já aceita qualquer coisa.

Cada número tem uma prova rastreável:

| Item | Prova |
|---|---|
| Shows realizados | `Booking.status = completed` (próprios + das bandas onde é membro `accepted`) |
| Shows com presença registrada | `Booking.checked_in_at` — o check-in do artista |
| Locais distintos | `establishmentId` distintos desses bookings |
| Público alcançado | `EventAttendee` dos eventos ligados a esses bookings |
| Avaliações | `Review` com `target_type = musician` e `context_type = booking` |
| Repertório executado | músicas distintas em `PerformedSong` |
| Tempo de estrada | `completed_at` do booking mais antigo |

Duas decisões de privacidade, porque o currículo aparece **também no perfil
público** que o fã abre:

- 🔴 **Nenhum valor de cachê sai no currículo.** `Booking.fee` é dado comercial
  entre as partes; expor "média de R$ 380 por show" no perfil público destruiria
  a posição de negociação do músico com o próximo contratante, e ele nunca pediu
  isso.
- **Nome de estabelecimento sai; nome de fã não.** O local é vitrine (e é PJ, com
  perfil público próprio); o público alcançado sai só como número agregado.

Limite conhecido e assumido: shows anteriores a este subsistema não têm
`PerformedSong`, então "repertório executado" começa em zero e cresce. Os demais
itens são retroativos, porque `Booking`/`Review`/`EventAttendee` já existiam.

### 7.3 F5 — Setlist inteligente (`suggest-setlist`)

Dado um músico e um estabelecimento, ranqueia músicas por **evidência daquele
local**, não por popularidade geral:

1. Pedidas naquele local (peso maior para pedido aceito e tocado).
2. Tocadas naquele local em sets anteriores.
3. Presentes no repertório do músico mas **nunca tocadas ali** — o "esquenta o
   repertório" do `roadmap-web.md:723`, virado do avesso: o valor está no que
   falta, não no que já se repete.

Cada sugestão sai com `evidence` — de onde veio o sinal e quantas ocorrências.
**Sugestão sem evidência exibível não é sugestão, é palpite:** o músico precisa
poder discordar do motivo, e um número sem procedência ele não tem como avaliar.

Não há modelo, treino nem score opaco. É contagem com peso declarado, e os
pesos moram em constantes nomeadas no use-case — legíveis em code review, como
o catálogo de cláusulas do contrato.

---

## 8. O que isso destrava no Spotify

Com o set aberto, o fã que abre o perfil do músico durante o show vê **"Tocando
agora"** com `title`/`artist` vindos do `PerformedSong` — e o
`SaveToSpotifyAction`, que já existe e já funciona, recebe esse par em vez do
texto digitado. Quando o músico passa para a próxima, o polling troca o card e o
botão passa a valer para a nova música.

Nada muda no domínio `audience`: `find-spotify-track` e `save-track-to-spotify`
continuam iguais. O que faltava nunca foi o Spotify — era saber o que estava
tocando.

---

## 9. Armadilhas registradas (não repetir)

- **`ClassValidatorFields.validate` repassa `fields` como `groups`.** Todo
  decorator em `PerformanceRules` declara `{ groups: ["<nome do campo>"] }` e o
  default de `fields` no validator é exatamente esse conjunto. Sem isso, *todo*
  agregado nasce inválido com a mensagem enganosa "an unknown value was passed
  to the validate function".
- **`SearchParams.filter` precisa de override na subclasse.** `PerformanceFilter`
  é objeto; sem o `protected set filter` com whitelist o filtro é descartado, o
  repositório monta `where: {}` e a listagem devolve os sets **de todos os
  músicos**. Foi assim que `repertoire` vazou em jul/2026.
- **Ordem de rota:** `live` antes de `:performance_id` (§6).
- **`:performance_id`, nunca `:id`** (§6).
- **Índice parcial único fora do Prisma** (§5, invariante 4).
- **Nunca registrar sem set aberto** (§2) — é o que separa ensaio de show.

---

## 10. O que ainda não existe

- **Push para o fã.** Hoje é polling (§2). Um `event:${id}` room resolveria, com
  o custo de autorização descrito.
- **Duração real por música.** `ended_at` só é gravado quando a próxima começa
  ou quando o set encerra; se o músico esquecer de encerrar, a última música fica
  aberta. O relatório trata `ended_at = null` como duração desconhecida em vez de
  inventar um valor.
- **Wrapped do fã (B2).** Decidido em 21/ago/2026 fazer o pós-show do músico
  primeiro; o Wrapped é a agregação anual do mesmo dado e vem depois.
- **Setlist inteligente por horário do dia.** O `suggest-setlist` cruza local,
  não faixa de horário — o volume de dado por faixa ainda seria ruído.
