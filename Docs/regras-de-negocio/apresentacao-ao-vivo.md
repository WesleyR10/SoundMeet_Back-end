# Apresentação ao vivo

> Parte das [regras de negócio](../README.md) — o que a API já faz, por domínio.
> Marcações: `[x]` implementado · `[~]` parcial · `[ ]` pendente.

*Seção original: “Domínio Performance (Apresentação ao Vivo) *(22/ago/2026)*”.*


Arquitetura completa em [funcionalidades/apresentacao-ao-vivo-set-e-relatorio.md](../funcionalidades/apresentacao-ao-vivo-set-e-relatorio.md).
A primitiva que faltava para o sistema saber o que o músico **tocou**, e não só o que ele sabe
tocar — três read models dependem dela.

## O set ao vivo

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
      🔴 **No app, esse caminho ficou sem chamador até 26/set/2026**: o Play Mode registrava só
      `music_library_id` e nenhuma tela mandava `request_id`, então **nenhum pedido virava
      "tocado"** pelo app — `requests_played` do relatório saía sempre 0 e o fã nunca via o pedido
      dele tocando. Hoje a fila do Palco manda o `request_id` (inclusive ao abrir a cifra, com
      `await` antes de navegar, porque o Play Mode também registra ao montar).

## Setlist da noite *(26/set/2026)*

- [x] O set pode apontar para uma **setlist programada** — um repertório do músico
      (`performances.repertoireId`, nulável). Escolhida ao subir ao palco (`POST /performances`
      com `repertoire_id`) ou trocada com o set no ar (`PATCH /performances/:id/setlist`, `null`
      = improviso). Set encerrado não troca: reescreveria o "tocou X de Y" de um show que já foi.
- [x] 🔴 **A posse do repertório é checada no servidor** (`PerformanceSetlistService`). O id vem
      do corpo; sem a checagem, o palco LERIA o repertório de outra pessoa. Alheio responde
      **404, igual a inexistente**. Repertório compartilhado comigo por convite NÃO conta como meu.
- [x] É **ponteiro, não snapshot** — setlist é plano, e plano muda até a última música. O que
      prova o show continua sendo `songs`. `onDelete: SetNull`: apagar o repertório não apaga o show.
- [x] O relatório ganhou `setlist: { planned_count, played_count }` — músicas **distintas** da
      setlist que foram tocadas (bis não infla, avulsa não entra). `null` sem setlist, nunca "0 de 0".
- [x] `GET /performances/:id` (só o dono) traz `attendees_count` com o set no ar — **só o número**,
      nenhum nome de fã, pela mesma regra do currículo. `null` nas demais saídas = "não se aplica".

## Tocando agora (público)

- [x] `GET /performances/live?musician_id=&event_id=` devolve **uma música**, nunca o set inteiro:
      o repertório é o diferencial que o músico monta.
- [x] Sem set aberto responde `is_live: false`, **não 404** — intervalo é estado legítimo.
- [x] Consumido pelo `NowPlayingCard` no perfil público do músico (mobile), com "Salvar no meu
      Spotify" recebendo o par vindo do palco. Leitura por polling de 20s, não socket.

## Cartaz da Home do fã — palcos acesos e próximos *(28/set/2026)*

- [x] `GET /events/live-now` e `GET /events/up-next` (`ListStagesUseCase`, `performance-module`):
      evento + casa + line-up **confirmado** + a música do momento de cada ato, numa chamada.
      Consumidos pela Home do fã (`widgets/fan-home`, mobile).
- [x] "Ao vivo" é o **relógio** (`início ≤ agora < fim`), não só o status: show já terminado e
      ainda `active` não aparece. Busca com 12h de folga para trás (show que atravessa a meia-noite).
- [x] Próximos: começam depois de agora e em até 7 dias, em ordem de horário.
- [x] Nada de cachê, set inteiro, dedicatória, escalação `pending`/`cancelled` nem evento privado.
- [x] `lat`+`lng` dão distância e ordem sem cortar; `radius_km` junto passa a filtrar. Ordem ao
      vivo: alcançável (≤ 50 km ou sem distância) → set aberto → mais perto → mais cheio.
- [x] Autenticada (todos os papéis) — não `@Public()`, para não virar feed raspável.

## Relatório pós-show (F6)

- [x] `GET /performances/:performance_id/report` — músicas, pedidos, gorjetas, público.
- [x] Só para set **encerrado**: relatório de show em andamento é número que muda enquanto se olha.
- [x] Só gorjeta `completed` entra, e só a destinada **àquele** artista (evento tem mais de um).
- [x] Gorjeta por música é **heurística de horário**, rotulada como tal no próprio payload
      (`tips_attribution_note`) — não se afirma causalidade que o dado não sustenta.
- [x] `establishment_name` sai no output para o card compartilhável; `null` quando a casa foi
      removida — a UI omite a linha, nunca escreve "Local desconhecido".

## Card compartilhável do pós-show (B1) — 22/ago/2026

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

## Modo Ensaio — separação de stems (S3) — 22/ago/2026

Domínio `src/core/ai-audio/` (já existia) + `PracticeSeparationController` +
`PracticeModeScreen` no mobile. Ver `Docs/ia-musical/modo-ensaio.md`.

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

## Currículo verificado (F4)

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

## Setlist inteligente (F5)

- [x] `GET /musicians/:id/setlist-suggestions?establishment_id=` — ranqueia por evidência **daquela
      casa**, não por popularidade geral.
- [x] Toda sugestão carrega `evidence` (origem + contagem): sugestão sem evidência exibível é
      palpite, e o músico precisa poder discordar do motivo.
- [x] `evidence_count: 0` significa "ainda não sabemos nada deste local" — a UI diz isso em vez de
      fingir insight.
- [x] Pesos em constante nomeada, legível em code review. Sem modelo, sem score opaco.

## Pendente

- [ ] Push para o fã (hoje polling de 20s — decisão consciente, ver §2 do doc do subsistema).
- [ ] Wrapped anual do fã (B2) — é a agregação do mesmo dado; decidido fazer o pós-show do músico
      primeiro.
- [ ] Sugestão por **faixa de horário** dentro do local — volume de dado por faixa ainda seria ruído.
- [ ] Encerramento automático de set esquecido aberto (hoje depende do músico ou do app restaurar).

---

## Noites do período — o master do Analytics do app *(30/set/2026)*

- [x] `GET /musicians/:id/analytics/nights?days=7|30|90` (`GetMusicianNightsUseCase`, rota no
      `MusicianPerformanceController`). Até aqui o Analytics do músico era **all-time**, sem série
      nenhuma — a tabela `musician_analytics` existe e nada a escreve.
- [x] **Uma noite = um EVENTO com set aberto.** Fechar e reabrir o set no mesmo show gera dois
      `Performance`; contar duas noites dobraria pedidos, gorjetas e público, que são do evento.
- [x] **Mesmas regras do relatório pós-show, em lote**: pedidos = evento + músico; gorjeta só
      `completed`, do evento, para o músico **ou** a banda do set; público = presenças do evento.
      A noite no Analytics e o relatório daquela noite nunca discordam. Quatro consultas em lote
      (`findByMusicianAndEvents`, `findCompletedByEvents`, `countByEvents` — `groupBy` —, e o piso
      `started_from` em `findEndedByMusician`), não quatro por show.
- [x] **Período anterior encostado**, do mesmo tamanho (30 × 24h antes dos últimos 30 × 24h), só com o
      resumo. A noite cai no período pelo início do primeiro set. O servidor não conhece o fuso do
      músico e não finge: o app agrupa e rotula no fuso do aparelho (virada às 6h).
- [x] Resumo com `attendance` (soma noite a noite) **e** `audience_reached` (pessoas DISTINTAS) —
      nunca apresentar um como o outro. Dinheiro somado em centavos inteiros.
- [x] **Mesmo gate do all-time** (`realtime_analytics`, 9.7a): FREE recebe 402, cobrado antes das
      consultas; músico inexistente continua 404.
- [x] Nenhum cachê no output — o master fala do que o público fez.
- [x] **Seed:** `musico3@seed-soundmeet.com` (Carlos Teclas, PRO) tem ~6 meses de turnê — ~55
      noites gravadas pelos agregados (`prisma/seed-night-series.ts`, determinístico e relativo a
      hoje), com o último mês mais cheio que o anterior. Plateia sintética de 48 pessoas sem login
      (`plateiaNN@…`, sem `UserPoints`: fora do ranking). O João continua FREE (402 — o lado do gate).
- [x] **`total_tips_amount` do all-time é GORJETA** (corrigido em 30/set/2026). Era
      `wallet.total_earned`, que cresce também com o CACHÊ liberado da custódia e com o ganho externo
      do Mercado Pago. Hoje é `ITipRepository.sumCompletedByMusician` — soma no banco das gorjetas
      `completed` dadas diretamente ao músico. Gorjeta é gorjeta, cachê é cachê; regressão em
      `get-musician-analytics.use-case.spec.ts` com carteira de R$ 1.500 que não pode entrar.
