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

- [~] Ativação/desativação e verificação de perfil  
       Código: musician.aggregate.ts ([2]).  
       Regras:
  - `activate`/`deactivate` mudam `is_active`. 🔴 **Nenhuma rota HTTP os chama** (out/2026):
    `is_active` saiu do `PATCH /musicians/:id`, porque ali o próprio músico reativava um perfil
    desligado por moderação. Desativar passa a ser ato administrativo e ainda não tem rota.
  - Músico desativado **não aparece na busca pública** (`ListMusiciansUseCase` força
    `is_active: true`), não recebe pedido, não é escaneável por QR e não entra em banda.
  - `verify` define `is_verified = true`, por `POST /musicians/:id/verify` (admin, responde 200).
    O agregado monta um `MusicianVerifiedEvent`, mas **ninguém o publica nem o escuta** — o mesmo
    vale para `MusicianCreatedEvent`. Não há rota para desfazer a verificação (`unverify` existe só
    no agregado).

**Gêneros, instrumentos e experiência**

- [x] Lista de gêneros e instrumentos  
       Código: musician.aggregate.ts ([2]) — `updateGenres` / `updateInstruments`.  
       Regra: precisam ser listas. **Lista vazia é aceita** (o validador não exige mínimo); o
       limite é de 50 itens de até 60 caracteres, aplicado no input de `PATCH /musicians/:id`.
       Não há validação contra uma taxonomia: o filtro da busca casa por igualdade exata.

- [x] Anos de experiência com regras de consistência  
       Código: musician.aggregate.ts ([2]).  
       Regra: experiência não pode ser negativa; há flags derivadas (ex.: músico experiente a partir de certo limiar).

- [x] 🔴 **Um campo, uma porta** *(out/2026)*  
       Gêneros, instrumentos e experiência são do `Musician` e entram **só** por
       `PATCH /musicians/:id` (`genres`, `instruments`, `experience_years`). `MusicianProfile` os
       duplicava sem ter coluna para eles, e `PATCH /musicians/:id/profile` os aceitava também: os
       dois primeiros regravavam o que a outra rota já gravava, e `experience` alterava só uma cópia
       em memória — a API respondia 200 com o valor novo e **não gravava nada** (o app mostrava
       "salvo" e o número antigo voltava). A cópia saiu do agregado, do input e do output.
       `PATCH .../profile` hoje aceita só faixa de preço, base e redes; mandar um dos três responde
       422. Regressão contra Postgres em `test/musician/musician-profile.e2e-spec.ts`.

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
  - Cada banda possui `band_id`, nome, membros (`musician_id`, role, status, joined_at).
  - Integrante entra por convite (`inviteMember` → `acceptInvite`/`declineInvite`); não há
    adição direta. `inviteMember` impede duplicidade de músico na mesma banda.
  - `removeMember` falha se o membro não existir.
  - `is_active: false` é banda dissolvida com histórico (`archive`) — ver "Rotas de banda".

- [x] Divisão automática de gorjetas entre membros da banda (split igualitário)  
       Código: confirm-tip-payment.use-case.ts ([4]).  
       Regras:
  - Se `Tip` tem `band_id`, o valor líquido é dividido igualmente entre os membros ativos com `Money.allocate(n)`: centavos inteiros, o resto distribuído de um em um, soma exata. R$30 entre 4 dá R$7,50 a cada um.
  - Cada membro recebe crédito em sua `MusicianWallet` e é criada uma `Transaction` individual com metadata (`parent_transaction_id`, `tip_id`, `is_split`).

- [ ] Percentuais customizáveis de split por membro  
       Não implementado: hoje o split é igualitário, sem configuração de percentuais personalizados como previsto em _Monetização Especializada_.

**Busca de músicos para contratação**

- [x] Busca pública de músicos — `GET /musicians` *(revisada em out/2026)*  
       Código: `search-musicians.dto.ts`, `musician.repository.ts`, `musician-prisma.repository.ts`,
       `list-musicians.use-case.ts`. Regressão por HTTP contra Postgres em
       `test/musician/musician-search.e2e-spec.ts`.
  - **O filtro público é uma allowlist** (`SearchMusiciansFilterDto`): `q`, `name`, `stage_name`,
    `genres`, `instruments`, `price_model`, `price_min`, `price_max`, `price_currency`,
    `is_verified`, `lat`, `lng`, `radius_km`. Chave fora da lista responde **422**. `ids`,
    `is_active` e `open_to_gigs` existem em `MusicianFilter`, mas são de uso dos use-cases.
  - 🔴 **Não existe filtro por e-mail.** Existia, com `contains`, numa rota anônima: dava para
    reconstruir o e-mail de qualquer artista letra a letra, embora o presenter o escondesse.
  - **`q` busca pelo nome que a tela mostra** (nome artístico OU de cadastro). `name` sozinho só
    olha o cadastro — era o que a grade do web mandava, e "Carlão" não achava "Carlão do Piano".
  - **Tudo que chega por query string é texto**, e o DTO converte. Antes disso `price_min`,
    `price_max`, `is_active` e `is_verified` eram descartados em silêncio (a busca respondia 200
    com a lista inteira) e `filter[genres]=MPB`, sem colchete, respondia 500.
  - Sempre forçados, depois do filtro do chamador: `open_to_gigs: true` (consentimento) e
    `is_active: true`.
  - Ordenação por `name`, `stage_name`, `created_at` e `rating`, **sempre com desempate por
    `id`** — sem ele o Postgres repete e pula itens entre páginas quando há empate. Sem `sort_dir`
    o default é **ascendente**.
  - A resposta é o **cartão de lista** (`MusicianCardPresenter`): sem QR, sem contato, sem
    endereço. Ver "Privacidade da localização" abaixo.

- [x] Identidade de vários músicos — `GET /musicians/identities?ids=a,b,c` *(out/2026)*  
       Código: `list-musician-identities.use-case.ts`. Até 50 ids por chamada; devolve nome
       exibido, foto, instrumentos, gêneros, nota e verificado. Existe para as listas que guardam
       só o `musician_id` (line-up, contratações, conversas) não fazerem um `GET /musicians/:id`
       por artista. **Não é descoberta** e por isso não passa pelo gate de `open_to_gigs`: resolve
       ids que o chamador já tem. Id inexistente não volta.

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
- [x] **Não expõe o tier.** A faixa devolve o cartão de lista — saber que é PRO e não ESSENTIAL
      não muda nada para a casa e é dado comercial do artista. Desde out/2026 isso vale de verdade:
      `plan_tier` saiu também de `GET /musicians/:id` para terceiros (antes um anônimo o lia ali) e
      hoje só o dono e o admin o recebem.
- [ ] **Sem rotação entre assinantes.** Com mais pagantes que vagas, os mesmos três aparecem
      sempre. Decisão de produto pendente para quando houver volume.

## Rotas do músico — o que existe e o que não existe *(08/out/2026)*

Resultado da auditoria de `musicians.controller.ts`. Cada linha foi cruzada com todo ponto de
chamada do web e do mobile.

- [x] 🔴 **Não existe `POST /musicians`.** O único nascimento de um `Musician` é o registro
      (`RegisterUseCase` e o cadastro social), que usa o `sub` do Keycloak como id. A rota criava o
      agregado com UUID aleatório e bastava o papel `musician`: perfil que ninguém loga, mas que
      aparecia na grade das casas e, por ocupar o e-mail, bloqueava o cadastro do dono verdadeiro
      daquele endereço. Mesmo defeito do `POST /audiences` (SM-021). Regressão em
      `musicians.controller.spec.ts`.
- [x] 🔴 **Não existe `DELETE /musicians/:id`.** Apagava a linha a pedido do próprio músico; a
      cascata levava carteira, pedidos, biblioteca e a linha da assinatura, enquanto o login no
      Keycloak, a cobrança no provedor e os arquivos no bucket continuavam. Excluir conta é fluxo
      de produto — ver [ainda-nao-implementado.md](ainda-nao-implementado.md).
- [x] **`PATCH /musicians/:id` é a rota da identidade:** `name`, `stage_name`, `bio`, `phone`,
      `cnpj`, `email` (pede a troca), `genres`, `instruments`, `experience_years`. Saíram `avatar`
      (URL livre, contornava o upload), `is_active`, `open_to_gigs` e `priceRanges` — nenhum
      cliente os mandava e cada um era uma segunda porta. Telefone repetido responde 422 dizendo o
      campo.
- [x] **`GET /musicians/:id` — dono com token expirado recebe 401.** A rota é pública com
      autenticação opcional; token recusado virava anônimo e a resposta era 200 com a versão
      pública. O app só renova a sessão ao receber 401, então o músico via o próprio perfil sem
      CNPJ, e salvar o formulário gravava `cnpj: null`. Hoje, se o `sub` do token recusado é o
      próprio `:id`, a resposta é 401. Esse `sub` não é verificado e por isso só serve para recusar
      mais — ver `readUnverifiedSub` em `auth.guard.ts`.
- [x] **Token de push:** `PATCH .../push-token` responde 204 e aceita os dois prefixos da Expo;
      `DELETE .../push-token` apaga, e o app chama ao sair da conta. Antes o token nunca era
      apagado e o aparelho seguia recebendo os avisos do músico que saiu.
- [x] **Uploads (foto, logo do QR, áudio):** formato decidido pelos bytes, sem `fileFilter` (o que
      havia em foto e logo virava 500); 5 envios por minuto; `avatar_key` e `qr_logo_key` guardam a
      chave do objeto e a troca apaga o arquivo anterior; objetos sobem com cache de um ano,
      imutável. Configuração do Multer num helper só (`temp-disk-upload.ts`).
- [x] **`updated_at` acompanha as mudanças do perfil.** O mapper grava a data explícita, então o
      `@updatedAt` do Prisma não atua nesta tabela; só três métodos a moviam e o sitemap publicava
      `lastModified` velho. Token de push e projeção de nota não contam como mudança.

## Privacidade da localização do músico *(08/out/2026)*

O `Location` do músico é o **endereço de casa** de uma pessoa (o app preenche por CEP).

- [x] 🔴 **Terceiros recebem só cidade e estado.** O presenter público copiava `profile` inteiro e
      `GET /musicians` — anônima — entregava rua, número, CEP e coordenada exata de cada artista.
      Hoje `PublicMusicianPresenter` e `MusicianCardPresenter` montam o perfil por allowlist; só o
      dono e o admin recebem o endereço.
- [x] 🔴 **A busca por raio é medida numa grade de ~1 km** (`musician-location-privacy.ts`).
      Esconder a coordenada no JSON não bastava: com a origem a 100 m de uma casa,
      `radius_km=0.09` não a devolvia e `0.11` devolvia — movendo a origem e repetindo, achava-se a
      porta. Toda distância da busca pública parte da coordenada **arredondada a 2 casas**, e a
      caixa de pré-filtro é alargada pela margem da grade. Arredondar a *distância* não fecharia o
      problema: o ponto em que "2 km" vira "3 km" é um círculo exato em volta da casa.
- [x] **`distance_km` vem do servidor**, em km inteiros, em cada item da lista quando a busca traz
      `filter[lat]` e `filter[lng]` — com ou sem raio. Base ou turnê vigente, o que estiver mais
      perto. O app deixou de calcular a distância do artista (precisava da coordenada dele).
- [x] O carrossel "Pra você" do fã (`GET /audiences/:id/recommendations/musicians`) devolve o mesmo
      cartão de lista — ele reaproveita `MusicianCollectionPresenter` e também entregava o endereço.
- [ ] As colunas `location_lat`/`location_lng` continuam exatas no banco (o dono edita o próprio
      endereço). A grade vale para o que SAI e para o que a busca responde.

## Rotas de banda — o que existe e como se comporta *(08/out/2026)*

Resultado da auditoria de `bands.controller.ts`: 11 rotas, cada uma cruzada com todo ponto de
chamada do web e do mobile. Hoje são 13.

**Quem pode alterar a banda**

- [x] 🔴 **Só o líder atual, lido do banco a cada chamada** (`assertBandLeader`, em
      `use-cases/common/band-actor.ts`). Vale para atualizar, pôr no radar, convidar, remover
      outro integrante, transferir e dissolver. Admin opera por qualquer banda.
- [x] 🔴 **O claim `band_ids` não autoriza escrita.** As rotas eram guardadas pelo
      `BandOwnershipGuard`, que conferia o claim — escrito só na criação. Depois de transferir a
      liderança, a nova líder levava 403 em tudo, o ex-líder continuava podendo editar e apagar, e
      ninguém confirmava booking pela banda. O guard foi removido.
- [x] **O claim acompanha o líder.** Na transferência: a nova líder recebe, o banco é gravado, o
      ex-líder perde (`IIdentityClaimsWriter.removeClaimValue`). O claim serve de ESCOPO de
      leitura — põe shows, contratos e conversas da banda nas listas do líder — e é exigido, junto
      com a liderança, para decidir um booking. ⚠️ A nova líder altera a banda na hora; os shows
      da banda aparecem para ela quando o token renovar (até 15 min).

**Ler**

- [x] 🔴 **`GET /bands` e `GET /bands/:id` têm duas visões.** Integrante aceito (ou admin) recebe
      a banda por dentro. Qualquer outro chamador recebe a pública (`PublicBandPresenter`,
      allowlist campo a campo): do endereço só cidade e estado; dos integrantes só os aceitos.
      Antes saíam rua, número, CEP, coordenada exata e os convites pendentes e recusados.
- [x] **Integrante com token expirado recebe 401** em `GET /bands/:id`, não a versão pública —
      senão o formulário de endereço abriria vazio e salvar apagaria rua e CEP.
- [x] 🔴 **`GET /bands/mine`** — as bandas que o músico integra e os convites que ainda não
      respondeu. O id vem do token. O app usava a busca pública com `filter[musician_id]`, que só
      devolve vínculo aceito: o convite pendente nunca aparecia para o convidado.
- [x] **`GET /bands/identities?ids=a,b,c`** — nome, foto, gêneros e instrumentos de até 50 bandas.
      O web deixou de fazer um `GET /bands/:id` por banda em line-up, contratações e mensagens.
- [x] **A busca só traz banda no radar E ativa.** O filtro é um DTO-allowlist
      (`SearchBandsFilterDto`): `name`, `genres`, `price_model`, `price_min`, `price_max`,
      `price_currency`, `lat`, `lng`, `radius_km`. Chave estranha responde 422. `price_min` e
      `price_max` eram descartados (query string é texto) e `filter[genres]=X` respondia 500.
- [x] **Busca por raio na grade de ~1 km**, a mesma do músico
      (`musician-location-privacy.ts`). Na coordenada exata, mover a origem achava o endereço.

**Escrever**

- [x] **`POST /bands`** aceita `name`, `description`, `genres`, `formed_in`, `priceRange`,
      `address`, `open_to_gigs`. Quem cria vira líder aceito. Saíram `members` (criava convite
      sem aceite e sem o gate de plano), `is_active`, `avatar` e `creator_musician_id` no corpo.
      Só o papel `musician` cria.
- [x] **`PATCH /bands/:id`** aceita `name`, `description`, `genres`, `formed_in`, `priceRange`,
      `address`. 🔴 `formed_in` era descartado pelo controller. Saíram `open_to_gigs` (tem rota
      própria), `is_active` e `avatar`. Nome vazio e valor inválido respondem 422; antes eram
      ignorados ou seguiam para o banco.
- [x] **O endereço é geocodificado** (`resolveLocation`, compartilhado com o perfil do músico).
      A banda não geocodificava e ficava fora de toda busca por raio. Quando o endereço muda, a
      coordenada reenviada pelo app é descartada; sem resposta do geocodificador, a banda fica sem
      coordenada em vez de ficar com a da cidade antiga.

**Convite, saída e liderança**

- [x] **Convite é sempre para integrante.** `POST /bands/:id/members` recebe `musician_id` e
      `instrument`; `role` saiu. A opção "Líder" do app respondia 422 sempre.
- [x] **Convidar é do plano PRO do líder, com teto de integrantes**
      (`PlanCheckService.assertBandCanAddMember`). O `max_band_members: 8` existia só no texto
      do app. Convite pendente ocupa vaga; recusado, não. Resposta 402.
- [x] **O convidado e o líder são avisados por push** (`BandMemberInvitedEvent`,
      `BandInviteAcceptedEvent`, `BandInviteDeclinedEvent` → `band-events.handler.ts`).
- [x] 🔴 **Aceitar, recusar e remover funcionam com a banda vinda do banco.** O agregado
      comparava integrantes com `ValueObject.equals`, que exige a mesma classe; o Prisma carrega
      `Uuid` e os use-cases chegam com `MusicianId`. As três rotas respondiam 422 em produção e
      os testes em memória não viam. Hoje a comparação é pelo id.
- [x] **Sair da banda:** `DELETE /bands/:id/members/:musician_id` com o próprio id. O líder não
      sai enquanto houver outros integrantes (transfere antes); sozinho, dissolve.
- [x] **`PATCH /bands/:id/leadership`** só aceita sucessor com convite aceito.

**Dissolver — `DELETE /bands/:id`**

- [x] 🔴 **Três desfechos**, resposta `200 { outcome }`:
  - compromisso em aberto (show futuro, conversa de contratação, cachê em custódia, set no ar)
    → **409**, dizendo o que falta encerrar;
  - histórico em qualquer tabela → **arquiva** (`is_active: false`, sai do radar, descarta os
    convites em aberto); o nome continua nos shows e contratos;
  - nada → **apaga** a linha e o claim do líder.
- [x] **Por que não um `DELETE` de linha:** `bookings.bandId` e `inquiries.bandId` são
      `ON DELETE SET NULL` sob a CHECK "músico OU banda". O banco recusa apagar banda com
      qualquer proposta; sem proposta, o `SET NULL` deixava line-up, contrato e set sem dono.
- [x] **Banda arquivada** não é alterada, não recebe convite, proposta nem conversa, e não
      volta ao radar. Continua resolvível por id.

**Faixa de preço**

- [x] 🔴 **Banda com preço gravado voltou a carregar.** As colunas são `Decimal`; o mapper
      passava o objeto cru ao `PriceRange`, que exige número. Uma banda com preço respondia 422
      em toda leitura, e a busca pública caía inteira se uma banda da página tivesse preço.

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
      🔴 Até 08/out/2026 o `PATCH` não gravava: o controller montava o input campo a campo e
      `formed_in` ficou de fora. A rota respondia 200 com o valor antigo.
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