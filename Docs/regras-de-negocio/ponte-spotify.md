# Ponte Spotify

> Parte das [regras de negócio](../README.md) — o que a API já faz, por domínio.
> Marcações: `[x]` implementado · `[~]` parcial · `[ ]` pendente.

*Seção original: “Ponte Spotify (fã salva o que ouviu) *(21/ago/2026)*”.*


> Documentado retroativamente em 22/ago/2026. Vive em `src/core/audience/` (agregado satélite
> `AudienceSpotifyLink`), não em domínio próprio — mesmo lugar e mesmo motivo de
> `MusicianWallet` guardar os tokens do Mercado Pago fora de `Musician`.

## Vínculo da conta

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

## Buscar e salvar são DOIS atos

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

## Casamento da faixa — qual VERSÃO da música *(22/ago/2026)*

> Arquitetura completa em
> [funcionalidades/casamento-de-faixa-no-spotify.md](../funcionalidades/casamento-de-faixa-no-spotify.md).

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

## O botão abre o Spotify — e o motivo é a quota *(22/ago/2026)*

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

## Onde aparece

- [x] Conectar: `SpotifyLinkCard` no perfil do fã. **Nunca no meio do show** — virar CTA de
      integração na hora do pedido transformaria a tela em funil.
- [x] Salvar: tela de sucesso do pedido de música **e** (desde 22/ago) o `NowPlayingCard` do perfil
      público, com o par vindo do palco. Ver a seção de Performance abaixo.
- [ ] **Só o FÃ tem vínculo.** O músico não conecta Spotify — a feature é "salve o que você ouviu",
      não catálogo do artista.
