# Público (fã)

> Parte das [regras de negócio](../README.md) — o que a API já faz, por domínio.
> Marcações: `[x]` implementado · `[~]` parcial · `[ ]` pendente.

*Seção original: “Domínio Audience (Público)”.*


**Cadastro, perfil e preferências**

- [x] Perfil de público com preferências musicais e configurações de descoberta  
       Código: audience.aggregate.ts ([13]).  
       Regras:
  - Campos principais: `email`, `name`, `nickname`, `avatar`, `phone`.
  - Preferências: `favorite_genres`, `favorite_artists`, `favorite_instruments`, `preferred_languages`.
  - Configurações: `notification_settings`, `privacy_settings`, `discovery_settings`, `musicDiscoverySettings`.
  - Flags derivadas: `isProfileComplete`, `isNewUser`, etc.

- [x] Validação de dados via notification pattern  
       Código: audience.aggregate.ts ([13]).  
       Regra: `validate` utiliza `AudienceValidatorFactory`; erros geram `EntityValidationError` conforme padrão da camada de domínio.

- [x] 🔴 **O registro é o ÚNICO caminho de nascimento de um Audience** (SM-021, 26/ago/2026)  
       Código: `register.use-case.ts`; `audiences.controller.ts` (pela ausência).  
       Regras:
  - **`POST /audiences` não existe** — a rota era `@Public()` e foi removida junto
    com o `CreateAudienceUseCase`, o input e o DTO.
  - O motivo não é só a rota estar aberta: o use-case criava o agregado com **UUID
    aleatório**, enquanto o canônico faz `new AudienceId(externalId)` — o `sub` do
    Keycloak. O resultado era perfil órfão: gente que não loga, não é dona de
    e-mail nenhum e ocupa banco. Qualquer automação podia despejá-los à vontade.
  - **Restringir a `admin` não resolveria.** Uma capacidade que só sabe produzir
    agregado violando a invariante de identidade do sistema não fica melhor com
    autorização — fica mais discreta. Ver a nota de identidade: músico e público
    usam o `sub` como id; estabelecimento e banda têm UUID próprio.
  - Regressão em `audiences.controller.spec.ts`: uma varredura da metadata do Nest
    afirma que nenhuma rota do controller é `@Public()` e que não há `POST` na raiz
    do recurso — porque o risco real não é restaurarem o método com o mesmo nome, é
    alguém adicionar um `@Post()` novo sem saber por que ele não existia.

**Gamificação por Audience (pontos e níveis)**

- [x] Pontuação por ações do público (scan, pedidos, acertos, gorjetas, social, etc.)  
       Código: audience.aggregate.ts ([13]) em conjunto com VO `Points` e `AudiencePoints`.  
       Regras alinhadas com _Gamificação Avançada_ em _Features_:
  - Scan QR: +10 pts
  - Pedido musical: +25 pts
  - Pedido aceito/tocado: +50 pts
  - Gorjetas: 1 pt por real (via fluxo de tipagem)
  - Social share: +10 pts, **uma vez por conteúdo** (era 50 sem dedupe até 28/set/2026 — ver "Indicação de talentos e compartilhamento social")
  - Indicação de músico: +15 pts
  - Outras ações: presença em eventos, completar perfil, etc.
  - Tabela canônica do ledger (a que o leaderboard lê): `GAMIFICATION_POINTS` em `src/core/gamification/domain/value-objects/gamification-points.ts`. A de `AudiencePoints` (nível do fã) bate com ela em scan, pedido, gorjeta, share e indicação, mas ⚠️ **ainda diverge em presença em evento: 30 em `AudiencePoints`, 20 no ledger** — mesma classe de divergência unificada no Bloco 16 para share/indicação

- [x] Sistema de níveis com benefícios por faixa de pontos  
       Código: user-level.vo.ts ([14]).  
       Regras:
  - Níveis 1 a 5 (Novato, Fã, Apoiador, VIP, Lenda) com intervalos de pontos bem definidos.
  - Cada nível define benefícios (`benefits`) como prioridade em pedidos, descontos em gorjetas, acesso a eventos VIP.
  - `getLevelByPoints` determina o nível a partir do total de pontos.

- [~] Badges no agregado `Audience` (`audience.badges`, lista de strings) — **legado, não é o que o app mostra**  
       Código: audience.aggregate.ts ([13]).  
  - ⚠️ **Corrigido em 29/set/2026 — este item afirmava mais do que o código faz.** A única conquista gravada aqui é a string `"iniciante"`, no primeiro scan (`scanMusicianQRCode`). O "Sugestor no primeiro pedido" **nunca existiu** em `make-music-request.use-case.ts` (`new_badges: []` fixo).
  - `"iniciante"` nem está no vocabulário de `BadgeTypeEnum` (`iniciante_musical`). As conquistas que o fã VÊ são as `UserBadge` do domínio Gamification, hoje derivadas do ledger (ver "Progresso automático das conquistas" na seção Gamification). Duas listas de conquistas sobre o mesmo fã são o mesmo cheiro dos dois sistemas de pontos: unificar é fatia própria, ainda não pedida.

**Pedidos musicais e votação**

- [x] Criação de pedido musical pelo público a partir do perfil do músico  
       Código: audience.aggregate.ts ([13]) (`makeMusicRequest`) e make-music-request.use-case.ts ([15]).  
       Regras:
  - Verificação de permissão (`canMakeRequest`) baseada no nível/pontos.
  - Pontuação +25 pts (a conquista "Sugestor Criativo" avança pelo ledger — ver seção Gamification).
  - Emissão de evento de domínio `MusicRequestMadeEvent` com metadados (músico, música, artista, etc.).

- [x] Votação em músicas/pedidos  
       Código: audience.aggregate.ts ([13]) (`voteForSong`).  
       Regras:
  - Incremento de pontos por voto.
  - Emissão de evento `SongVotedEvent` com `request_id` e tipo de voto (`up`/`down`).
  - O intervalo de 2–3 minutos entre músicas e algoritmos de votação avançados ainda não estão encapsulados em um agregado próprio.

- [x] Limite anti-spam de pedidos por pessoa/evento  
  `DailyRequestLimitPolicy` (`src/core/request/domain/policies/can-make-request.policy.ts`): máximo de pedidos por pessoa, por dia, no mesmo evento — `MAX_REQUESTS_PER_USER_PER_EVENT` (default 10 no Joi, 5 no `.env.example`). Somado à anti-duplicação de `Request.isSimilarTo`.
  - 🔴 **O "dia" é o da CASA, e começa às 6h locais** (`REQUEST_LIMIT_DAY_START_HOUR`, default 6; 0 = meia-noite local). Era `setHours(0)` no fuso do processo — UTC no container —, e o limite zerava às 21h de Brasília (20h em Manaus), no meio do show. Com meia-noite local o show das 22h às 2h ainda viraria no meio; às 6h a virada acontece com a casa fechada.
  - **O fuso vem do endereço da casa** (`resolveVenueTimezone`, `src/core/shared/domain/brazil-timezone.ts`): a UF decide, exceto os 11 municípios do oeste do Amazonas no horário do Acre (UTC-5, Lei 12.876/2013) e Fernando de Noronha (UTC-2). Só sem estado brasileiro vale o fuso declarado no horário de funcionamento, e nunca `UTC` — o fallback é São Paulo. O endereço vence o declarado porque o painel pré-preenche São Paulo, e uma casa de Manaus que não trocou ficaria uma hora errada.
  - O mesmo fuso passou a valer para todo horário de show mostrado ou impresso: push de quem segue (`formatShowTime`), e-mail de contratação confirmada/cancelada, contrato (era `?? "UTC"`: show das 20h impresso às 23h quando a casa não tinha horário de funcionamento) e o "hoje" do lembrete diário de seguidores.

**Gorjetas e interação social pela Audience**

- [x] Registro de gorjetas enviadas pelo público para músicos/bandas  
       A lógica financeira está no domínio Payment (ver seção Payment). Em Audience, o envio de gorjeta gera pontos e interações gamificadas (`sendTip`, `addTipPoints`).

- [~] Wall de apoiadores e dashboard visual de gorjetas para o público  
  Estruturas de transações e wallets já existem (Payment), mas não há ainda projeções dedicadas para um “Wall de Apoiadores” do ponto de vista do público.

**Descoberta de músicos e indicação para estabelecimentos**

- [x] Recomendação de músicos com base nas preferências do público  
       Código: recommend-musicians.use-case.ts ([16]).  
       Regra: usa `favorite_instruments` e `favorite_genres` do Audience para filtrar músicos ativos via `MusicianRepository.search`.

- [x] **Sistema de indicação de talentos para estabelecimentos (28/set/2026)** — ciclo fechado: domínio `src/core/indication/` (agregado + 3 repositórios), `IndicateMusicianSheet` no perfil público do músico (mobile), caixa de entrada no dashboard do estabelecimento (web) e pontos no ledger da gamificação. Ver seção dedicada abaixo.

[13]: ../../src/core/audience/domain/audience.aggregate.ts
[14]: ../../src/core/gamification/domain/value-objects/user-level.vo.ts
[15]: ../../src/core/audience/application/use-cases/make-music-request/make-music-request.use-case.ts
[16]: ../../src/core/audience/application/use-cases/recommend-musicians/recommend-musicians.use-case.ts