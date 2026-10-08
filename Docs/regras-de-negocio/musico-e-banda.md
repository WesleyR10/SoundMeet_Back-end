# Músico e banda

> Parte das [regras de negócio](../README.md) — o que a API já faz, por domínio.
> Marcações: `[x]` implementado · `[~]` parcial · `[ ]` pendente.

*Seção original: “Domínio Musician (Músico/Banda)”.*


**Perfil, QR Code e dados básicos**

- [x] Perfil de músico/banda com dados básicos (nome, stage_name, bio, contatos)  
       Código: musician.aggregate.ts ([2]).  
       Regra: criação exige dados obrigatórios (nome, email), usando VO como `Email` e `Phone`.

- [x] QR Code permanente vinculado ao perfil do músico (não por apresentação)  
       Código: musician.aggregate.ts ([2]) (`generateQRCode`).  
       Regra: QR grava a URL universal `https://soundmeet.com.br/musico/{id}` (`buildMusicianQrLink`, `qr-code-link.ts`) e é gerado na criação. Com o app, abre por App Link; sem o app, abre a página web. O scan continua aceitando o legado `soundmeet://musician/{id}` (QR impresso não se atualiza). Ver `Docs/funcionalidades/qr-code-e-links-do-app.md`.

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
  - 🔴 **`addRating` no agregado é código morto.** O caminho real é o ledger `Review` (ver "Domínio Review"): `SubmitReviewUseCase` grava a avaliação e recalcula a projeção com `syncRatingProjection(average, total)`, que é o que o perfil exibe.
  - Projeção fora da faixa (média < 0 ou > 5, total < 0) é rejeitada via notification.
  - Flags como `isHighlyRated` usam limite mínimo de notas e quantidade.

- [~] Analytics detalhados (engajamento, comparação entre eventos, demografia musical)  
  Já existem: `GET /musicians/:id/analytics` (projeção `MusicianAnalytics`, gate `realtime_analytics` — 402 no FREE), `GET /musicians/:id/analytics/nights` (noites do período com comparação ao anterior), o relatório pós-show (`GET /performances/:performance_id/report`) e o currículo verificado (`GET /musicians/:id/resume`). Ver "Domínio Performance".  
  Falta a **demografia musical** do público prevista em _Features_.

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
  - Se `Tip` tem `band_id`, o valor líquido é dividido igualmente entre os membros ativos com `Money.allocate(n)`: centavos inteiros, o resto distribuído de um em um, soma exata. R$30 entre 4 dá R$7,50 a cada um.
  - Cada membro recebe crédito em sua `MusicianWallet` e é criada uma `Transaction` individual com metadata (`parent_transaction_id`, `tip_id`, `is_split`).

- [ ] Percentuais customizáveis de split por membro  
       Não implementado: hoje o split é igualitário, sem configuração de percentuais personalizados como previsto em _Monetização Especializada_.

**Busca de músicos para contratação**

- [x] Filtros por nome, e-mail, gêneros, instrumentos e status ativo  
       Código: musician-in-memory.repository.ts ([5]).  
       Regra: `MusicianFilter` suporta `name`, `ids`, `stage_name`, `email`, `genres`, `instruments`, faixa de preço (`price_model`, `price_min`, `price_max`, `price_currency`), `is_active`, `is_verified`, `open_to_gigs` e raio geográfico (`lat`, `lng`, `radius_km`). Ordenação por `name`, `stage_name`, `created_at` e `rating` — sem `sort_dir` o default é **ascendente**.

- [x] Dashboard de contratação com histórico de performances e engajamento  
       Código: get-hiring-dashboard.use-case.ts ([5]).  
       Regra: `GetHiringDashboardUseCase` consolida histórico de eventos/performance/engajamento por músico para o estabelecimento; exposto em `GET establishments/:id/hiring-dashboard`, protegido por `EstablishmentOwnershipGuard`.

## Destaque pago na busca de artistas *(18/set/2026)*

Faixa "Em destaque" acima da grade de `/dashboard/artistas`, com até 3 assinantes de plano pago.

- [x] `GET /musicians/featured` (`@Public()`, `ListFeaturedMusiciansUseCase`). Sem filtro, sem
      ordenação, sem paginação — teto em `FEATURED_MUSICIANS_MAX = 3`.
- [x] 🔴 **É uma FAIXA, não um critério de ordenação, e a diferença é de honestidade.** O rodapé do
      cartaz da tela ESCREVE a ordem em vigor ("ORDEM: MELHOR AVALIADOS"); um assinante com 3,6 à
      frente de um FREE com 4,8 faria a tela afirmar uma hierarquia que ela não aplicou. A faixa
      separada e **rotulada como paga** mantém as duas coisas verdadeiras.
- [x] 🔴 **Não havia promessa a cumprir.** `plan-features.config.ts` não tem feature de prioridade
      de busca em nenhum dos três tiers; o único "Aparece primeiro nas buscas" do repo está em
      `monetizacao.md` §Formação de Bandas, seção **futura** e de outro marketplace. Isto é decisão
      de produto nova — não há chave nova em `plan-features.config.ts` porque o destaque não é
      gate de capacidade, é colocação.
- [x] 🔴 **Pagar não substitui consentir.** Os ids vêm de assinaturas vigentes, mas a leitura passa
      por `MusicianSearchParams.createPublic` — assinante PRO sem `open_to_gigs` **não** aparece.
- [x] 🔴 **FREE excluído explicitamente** em `findActivePaidMusicianIds`. `plan_tier` é String sem
      constraint: a invariante "tier gratuito não gera linha" vive numa convenção do seed, e uma
      linha órfã compraria destaque de graça.
- [x] `active` **e** `trial` contam como vigentes; `cancelled` e `expired` não.
- [x] **Não expõe o tier.** O output é o presenter público — saber que é PRO e não ESSENTIAL não
      muda nada para a casa e é dado comercial do artista.
- [ ] **Sem rotação entre assinantes.** Com mais pagantes que vagas, os mesmos três aparecem
      sempre. Decisão de produto pendente para quando houver volume.

## Tempo de estrada da banda — `formed_in` *(18/set/2026)*

- [x] Coluna `bands.formed_in` (`Int?`), migration aditiva sem backfill. `changeFormedIn()` no
      agregado, aceita `null` para apagar.
- [x] 🔴 **Não era falha de UI: `model Band` não tinha o campo.** O perfil do músico solo mostrava
      "N anos de estrada" (`experience_years`) e o da banda não mostrava nada porque não havia dado.
- [x] **ANO, não data.** Ninguém sabe o dia em que a banda se formou, e um `DATE` obrigaria a UI a
      inventar "01/01" — precisão falsa num campo que o estabelecimento lê como credencial.
- [x] 🔴 **Nunca derivado de `bands.created_at`** — aquilo é "cadastrada na SoundMeet desde", que é
      outro fato. Compor um do outro é fabricar informação.
- [x] **Unidade diferente do músico de propósito:** anos gravados envelhecem sozinhos no banco; o
      ano é estável e o tempo se deriva dele na leitura.
- [x] Validação: inteiro entre 1900 e o **ano corrente, recalculado a cada chamada**
      (`formation-year.ts`). 🔴 `@Max(new Date().getFullYear())` congelaria o teto no load do
      módulo e recusaria o ano corrente na virada do ano, uma vez por ano, sem teste quebrando.
- [x] Entra em `POST /bands` (opcional) e `PATCH /bands/:id`. Editável pelo **líder**, no app
      (`BandLeaderSettingsSection` → "Tempo de estrada").
- [x] `PATCH` distingue `null` (apagar) de ausente (`!== undefined`) — quem digitou o ano errado
      precisa de caminho de volta ao "não informado".

## Áudio de apresentação — preview na contratação *(16/set/2026)*

Trecho de **5 a 40 segundos** que o músico envia pelo app e o estabelecimento ouve **com clique**
(nunca autoplay) no cartão da grade `/dashboard/artistas` e no perfil do artista.

- [x] `POST /musicians/:id/presentation-audio` (multipart) e `DELETE` do mesmo caminho
      Código: `musicians.controller.ts`, `upload-musician-presentation-audio.use-case.ts`,
      `delete-musician-presentation-audio.use-case.ts`.
      `@Roles("musician","admin")` + `MusicianOwnershipGuard` + `@Throttle(5/min)`. O DELETE aceita
      admin para takedown de conteúdo.
- [x] **Sem gate de plano — todos os tiers.** Uma grade em que metade dos artistas não tem preview
      piora a tela para o estabelecimento, que é quem paga. Gate futuro é quantidade, não existência.
- [x] Formatos: **MP3, M4A, AAC e WAV**, decididos pelos **bytes** (`assertFileSignature`), nunca
      pelo `Content-Type` do cliente.
      ⚠️ **Ogg e FLAC ficam FORA de propósito:** Safari não toca Ogg Vorbis e não há ffmpeg no
      processo Node para transcodificar — aceitar seria prometer um preview que parte dos
      estabelecimentos não ouve, sem erro em lugar nenhum.
      ⚠️ `file-type@21` devolve **`audio/x-m4a`** para o `.m4a` de iPhone, não `audio/mp4`; os dois
      estão na allowlist.
- [x] Duração medida no servidor por `music-metadata` (`read-audio-duration.ts`) — não existe ffmpeg
      no runtime Node, e todo `duration_seconds` do resto do sistema vem de worker externo, de forma
      assíncrona. Arredonda antes de comparar: um trecho exportado como "40s" costuma vir com 40,04.
- [x] Teto de 10 MB (`MUSICIAN_PRESENTATION_AUDIO_MAX_SIZE`). Acima disso o Multer aborta e o
      `GlobalExceptionFilter` devolve **413** com mensagem legível — antes deste ramo virava 500 com
      alerta no Sentry, e o músico não descobria que bastava mandar um arquivo menor.
- [x] Mensagens de recusa em **PT-BR e com o número** ("o áudio tem 1min12 e o limite é 40
      segundos") — elas chegam literais ao músico pelo `extractApiMessage` do app, sem outra fonte.
- [x] Quatro colunas em `musicians`, e a segunda é a que costuma faltar:
      `presentation_audio_url`, **`presentation_audio_key`**, `presentation_audio_duration_seconds`,
      `presentation_audio_uploaded_at`. Agrupadas no VO `PresentationAudio`.
      🔴 **Sem a chave do objeto, trocar o áudio deixaria o arquivo anterior órfão e pago para
      sempre** — é o defeito que `Musician.avatar` tem e que o par `cover`/`cover_key` do
      estabelecimento resolveu.
- [x] Ordem na troca: grava o objeto novo (chave uuid nova, porque o CDN cacheia por caminho) →
      atualiza o banco → **só então** apaga o antigo, com erro engolido.
- [x] 🔴 **`getPublicUrl() === null` falha alto** (`ExternalServiceError`), divergindo do avatar: o
      fallback `?? objectKey` gravaria a chave crua no campo de URL, e num `<audio src="musicians/…">`
      o browser resolve como caminho relativo à página, leva 404 e o player fica mudo.
- [x] O campo sai em **`MusicianPresenter` e `PublicMusicianPresenter`** (não é PII) — é o presenter
      público que a busca do estabelecimento usa. A `object_key` **não** sai no output.
- [ ] Banda não tem áudio de apresentação: o upload é do agregado `Musician` e não existe
      `POST /bands/:id/presentation-audio`.
- [x] Storage: o mesmo `ESTABLISHMENT_STORAGE_PROVIDER` do resto da mídia do músico — **Cloudflare
      R2 neste projeto, inclusive em dev**; MinIO é fallback do compose. O seed grava sob o prefixo
      `seed/` e o `--reset` varre só ele, para não apagar o que foi enviado pelo app.

[2]: ../../src/core/musician/domain/musician.aggregate.ts
[3]: ../../src/core/musician/domain/band.aggregate.ts
[4]: ../../src/core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case.ts
[5]: ../../src/core/musician/infra/db/in-memory/musician-in-memory.repository.ts