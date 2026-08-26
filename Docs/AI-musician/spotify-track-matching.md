# Casamento de faixa no Spotify — como escolhemos a versão certa

> **Fonte única** de como uma música da biblioteca vira um link do Spotify.
> Complementa [chord-sheet.md](chord-sheet.md) (folha de cifra) e a seção
> "Ponte Spotify" de [../business-rules.md](../business-rules.md) (vínculo do fã).

---

## 1. O problema

A mesma música existe muitas vezes no Spotify: estúdio, ao vivo, acústico,
remaster, participação, tributo, karaokê e homônimo de outro artista competem
pelo mesmo par título+artista. Pegar o primeiro resultado da busca acerta na
maioria e erra numa minoria — e é uma minoria que a pessoa só percebe depois.

Isso importa em dois pontos do produto: o fã que quer levar para casa a música
que acabou de ouvir ao vivo, e (no futuro) a playlist do show.

---

## 2. O sinal que resolve: duração

O pipeline MIR analisa o **áudio exato** que o músico escolheu. Quando a análise
termina, `complete-ai-cifra-analysis-job` grava `MusicLibrary.duration_seconds`
— a duração daquela gravação, não de uma qualquer.

Versões diferentes têm durações diferentes. É o disambiguador mais forte que
temos, e a maioria dos apps não tem.

**Não é teoria.** O `synced-lyrics` levou exatamente esse bug em jul/2026:
`pickBestLyrics` escolhia LRC sem pontuar duração e casava *"radio edit vs. ao
vivo estendido"* sem penalidade nenhuma, quebrando os anchors acorde↔letra rio
abaixo ([chord-sheet.md §244](chord-sheet.md)). A correção foi uma escada de
buckets, reusada aqui sem alteração:

```
≤2s → 1.0    ≤6s → 0.8    ≤12s → 0.6    senão → 0.3
```

### O que NÃO dá para usar

🔴 **Tom e andamento**, embora o nosso MIR os conheça. Os endpoints
`/audio-features` e `/audio-analysis` do Spotify foram descontinuados em
27/nov/2024 e respondem **403** para apps novos. Não há com o que comparar.

🔴 **ISRC**, que seria o casamento perfeito (`q=isrc:BR...`). Nosso pipeline é
ancorado em `youtube_video_id` e não temos ISRC em lugar nenhum. O caminho
YouTube → MusicBrainz → ISRC existe, mas a cobertura de repertório brasileiro
no MusicBrainz é fraca — trocaria um problema conhecido por uma dependência que
falha em silêncio.

---

## 3. A fórmula

`SpotifyTrackMatcher.pickBest` (`src/core/music-library/application/services/`):

```
score = 0.34·título + 0.26·artista + 0.40·duração
        − 0.12 se só um dos lados tem marca de versão
```

### Por que a duração pesa mais aqui que no LRCLIB

No LRCLIB a fórmula é `0.55·título + 0.35·artista + 0.10·duração`, porque o
acervo é comunitário e os textos vêm sujos — título e artista precisavam
carregar o peso. O Spotify devolve metadados limpos e canônicos: título e
artista quase sempre casam, **inclusive entre versões diferentes da mesma
música**. Ali eles param de discriminar, e a duração passa a ser o que decide.

### Artista é eliminatório, não ponderado

🔴 Candidato cujo artista não casa com **nenhum** nome devolvido é descartado
antes do score. Só com peso, título 1.0 + duração 1.0 somam 0.74 e passariam do
piso mesmo com artista zerado — o cover de uma banda tributo com a mesma duração
venceria a gravação original. A busca já usa o qualificador `artist:`, então
artista que não casa é sinal de que o Spotify alargou a consulta, não de grafia
diferente. Há teste de regressão.

O artista casa contra **qualquer nome da lista** que o Spotify devolve
("Marília Mendonça, Maiara & Maraisa"): comparar com a string inteira reprovaria
toda participação.

### Marca de versão

`ao vivo`, `live`, `acustic`, `remix`, `remaster`, `cover`, `karaok`,
`instrumental`, `playback`, `versao`, `edit`, `mix`. Quando um lado anuncia e o
outro não, `−0.12`. É o que separa "Evidências" de "Evidências (Ao Vivo)" quando
o comparador textual acha os dois quase idênticos.

⚠️ Os marcadores são escritos **já normalizados** (sem acento), porque são
comparados contra a saída de `normalize()` — "acústico" na lista nunca casaria.

### Dois pisos, porque o custo do erro é diferente

| Constante | Valor | Para quê |
|---|---|---|
| `MIN_ACCEPTABLE_SCORE` | 0.62 | Grava o casamento. Abaixo disto, **nenhum link** é melhor que o link errado. |
| `AUTO_SAVE_SCORE` | 0.90 | Escreveria na biblioteca do fã sem ele confirmar. |

A assimetria é o ponto: abrir a faixa errada no Spotify é um toque desperdiçado
que a pessoa vê na hora; **salvar** a faixa errada é escrever na conta dela algo
que ela só descobre depois.

---

## 4. Quando roda

**Na materialização da análise** — logo depois do update que grava
`duration_seconds`, e antes do alinhamento da letra:

```
worker MIR devolve → update MusicLibrary (duração!) → resolve Spotify → alinha LRC
```

A ordem não é estética: invertida, o matcher rodaria sem o único sinal que
separa versões e cairia no score neutro de duração.

**Não roda sob demanda no palco.** Resolver quando o fã pede cobraria latência
no pior momento e multiplicaria a chamada ao Spotify pelo número de pessoas na
casa — que compartilham o mesmo rate limit de aplicação.

### Best-effort, sempre

Spotify fora do ar não pode derrubar a materialização de uma cifra que levou
minutos de GPU. O link é conveniência; a cifra é o produto.

### Negative cache

`spotify_checked_at` preenchido com `spotify_track_id` nulo significa
"procuramos e não achamos" — vale **30 dias**. Sem isso, música fora do catálogo
(autoral, regional, cover inexistente em streaming) seria reconsultada para
sempre. Mesma política do LRCLIB.

Falha de **rede** não grava `checked_at`: "provedor indisponível" não é "não
existe", e o job tenta de novo.

### Backfill

`BackfillSpotifyTracksJob`, de hora em hora, 25 músicas por vez, sequencial e
com 250ms entre chamadas. Lote pequeno de propósito: o rate limit é o mesmo que
atende o caminho quente, e varrer acervo antigo em rajada faria a música
recém-cadastrada esperar.

---

## 5. O snapshot no histórico

`PerformedSong.spotifyTrackId` copia o id no instante da execução — snapshot
pelo mesmo motivo de `title`/`artist` (renomear na biblioteca não reescreve o
histórico) **e por um segundo**: a leitura do fã é polling de 20s, então
resolver por join a cada consulta multiplicaria a carga pelo número de pessoas
na casa, para um dado que não muda durante a música.

Música tocada a partir de um **pedido** ou de texto livre não recebe id: não
passou pelo pipeline, não tem duração analisada, e adivinhar só com texto é
exatamente o erro que a duração existe para evitar.

---

## 6. Por que o botão abre o Spotify em vez de salvar

Não é escolha de UX — é o teto da API.

| Regra do Spotify | Valor (ago/2026) |
|---|---|
| Usuários num app em Development Mode | **5** |
| Dono do app | precisa de **Premium ativo** |
| Extended Quota | só **organizações**, desde 15/mai/2025 |
| MAU exigido para Extended Quota | **250.000** |

`PUT /v1/me/tracks` exige OAuth do fã, logo atende 5 pessoas. O **deep link**
`https://open.spotify.com/track/{id}` não usa API nenhuma: funciona para todo
mundo, abre a faixa certa no app onde o fã já está logado, e ele salva com um
toque. De quebra, a reprodução conta como stream para o artista — argumento a
favor na hora de pedir a quota.

🔴 **A resolução da faixa NÃO passa por esse teto.** `SpotifyCatalogAdapter` usa
**Client Credentials** (token de aplicação, sem usuário), então o trabalho de
descobrir a versão certa vale para todos hoje. Por isso ele é uma porta separada
de `ISpotifyLibraryGateway`, que fala em nome do fã.

Consequência: quando a Extended Quota vier, **o `spotify_track_id` já estará lá**
e só o botão final muda.

⚠️ **Sem prévia de 30s.** `preview_url` foi descontinuado em 27/nov/2024 para
apps novos — o nosso é. A confirmação do fã é visual (capa e álbum), nunca
auditiva. Não reintroduzir o campo: ele vem sempre `null`.

---

## 7. O que ainda não existe

- **Confirmação do músico.** Ele é a única pessoa que sabe qual versão toca. A
  tela de correção (`spotify_match_score` já é persistido para sustentá-la)
  ficou para depois, por decisão de 22/ago/2026.
- **Playlist do show** — vale mais que faixa solta, mas exige
  `playlist-modify-public` e portanto a quota.
- **Salvar in-app para todos** — ver §6.
