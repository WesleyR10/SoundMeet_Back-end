# Regras de Negócio – SoundMeet (Mapa Atual x Visão Alvo)

Este documento resume as principais regras de negócio da plataforma SoundMeet, cruzando:

- o que foi especificado em [features.md](features.md) ([1])
- com o que já está implementado no código

Marcações:

- `[x]` Implementado (com índice de código)
- `[~]` Parcialmente implementado (há estrutura, mas falta completar)
- `[ ]` Ainda não implementado

Índice de código:

- use o identificador `[N]` para abrir o arquivo correspondente

---

## Domínio Auth (Registro e Identidade)

- [x] Registro de novos usuários via `POST /api/v1/auth/register` (`src/core/auth/application/use-cases/register/register.use-case.ts`) — única porta de entrada, já que `registrationAllowed: false` no realm Keycloak.
  **Invariante crítica — NUNCA quebrar:** o ID do aggregate criado (`musician_id` ou `audience_id`) é sempre **igual ao `sub`** do usuário no Keycloak. O sistema de ownership (`MusicianOwnershipGuard`/`AudienceOwnershipGuard`, Bloco 4B) compara `currentUser.userId` (== `sub` do JWT) diretamente contra o ID do recurso na URL — se um fluxo de criação de conta usar um ID diferente do `sub`, o ownership dessa conta quebra silenciosamente (o dono nunca consegue editar o próprio recurso). Qualquer novo fluxo de criação de `Musician`/`Audience` vinculado a uma conta Keycloak deve respeitar essa invariante.
  Detalhes de arquitetura em [auth/keycloak.md](auth/keycloak.md).
- [x] Login por email/senha via `POST /api/v1/auth/login` (`src/core/auth/application/use-cases/login/login.use-case.ts`) — resolve `role`/`profile_id` consultando os repositórios locais por email, nunca decodificando o JWT no backend.
- [x] Login social + cadastro pendente via `POST /api/v1/auth/social-signup` (`src/core/auth/application/use-cases/social-signup/social-signup.use-case.ts`) — cobre usuário autenticado via provedor externo (Google) no Keycloak mas ainda sem role/aggregate local. **A invariante `musician_id`/`audience_id` == `sub` também vale neste caminho** — o aggregate é criado usando o `userId` do token (`@CurrentUser()`), nunca um ID novo. Compensação em caso de falha remove só a role atribuída (`removeRealmRole`), nunca deleta o usuário Keycloak (a conta não foi criada por nós).

---

## Domínio Musician (Músico/Banda)

**Perfil, QR Code e dados básicos**

- [x] Perfil de músico/banda com dados básicos (nome, stage_name, bio, contatos)  
       Código: musician.aggregate.ts ([2]).  
       Regra: criação exige dados obrigatórios (nome, email), usando VO como `Email` e `Phone`.

- [x] QR Code permanente vinculado ao perfil do músico (não por apresentação)  
       Código: musician.aggregate.ts ([2]) (`generateQRCode`).  
       Regra: QR usa esquema `soundmeet://musician/{id}` + URL pública `https://soundmeet.app/musician/{id}` e é gerado na criação.

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
  - `addRating` recebe valor e autor; atualiza média ponderada e `total_ratings`.
  - Ratings fora da faixa permitida são rejeitados via notification + `EntityValidationError`.
  - Flags como `isHighlyRated` usam limite mínimo de notas e quantidade.

- [~] Analytics detalhados (engajamento, comparação entre eventos, demografia musical)  
  Parcialmente suportado pelos campos e métodos de rating do Musician e pelas entidades de Request e Gamification (pontos, interações).  
  Ainda **não existem** agregados/relatórios dedicados a analytics de músico conforme detalhado em _Features_.

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
  - Se `Tip` tem `band_id`, o valor líquido é dividido igualmente entre os membros ativos.
  - Resto da divisão fica com o primeiro membro (tratado como líder).
  - Cada membro recebe crédito em sua `MusicianWallet` e é criada uma `Transaction` individual com metadata (`parent_transaction_id`, `tip_id`, `is_split`).

- [ ] Percentuais customizáveis de split por membro  
       Não implementado: hoje o split é igualitário, sem configuração de percentuais personalizados como previsto em _Monetização Especializada_.

**Busca de músicos para contratação**

- [x] Filtros por nome, e-mail, gêneros, instrumentos e status ativo  
       Código: musician-in-memory.repository.ts ([5]).  
       Regra: `applyFilter` suporta filtros por `name`, `stage_name`, `email`, `genres`, `instruments`, `is_active`, e ordenação por `name` e `created_at`.

- [~] Dashboard de contratação com histórico de performances e engajamento  
  A filtragem por perfil de músico já existe; porém não há ainda um agregado ou use-case dedicado a “Dashboard de contratação” com histórico consolidado de eventos, performance e engajamento para estabelecimentos.

---

## Domínio Establishment (Estabelecimentos)

**Cadastro, QR Code e tipos de estabelecimento**

- [x] Cadastro de estabelecimento com endereço e tipo (bar, restaurante, etc.)  
       Código: establishment.aggregate.ts ([6]).  
       Regras:
  - `create` exige `name`, `email`, `address` e `establishment_type`.
  - `Address` é VO com campos obrigatórios (`street`, `number`, `city`, `state`, `zipCode`).
  - `CNPJ` opcional, validado via VO específico (`CNPJ`).

- [x] QR Code permanente do estabelecimento  
       Código: establishment.aggregate.ts ([6]) (`generateQRCode`).  
       Regra: QR segue o padrão `soundmeet://establishment/{id}` com URL pública `https://soundmeet.app/establishment/{id}`.

- [x] Validação de CNPJ com tratamento de erro de domínio  
       Código: establishment.aggregate.ts ([6]).  
       Regra: `changeCnpj` captura `InvalidCNPJError`, adiciona erro de notificação em `cnpj` e evita lançamento de exceção genérica.

**Avaliações e reputação do estabelecimento**

- [x] Sistema de rating com média ponderada e contagem de avaliações  
       Código: establishment.aggregate.ts ([6]).  
       Regras:
  - `addRating` cria novo `Rating` e recalcula média para 1 casa decimal.
  - Evento `EstablishmentRatedEvent` é disparado com `ratedBy` e `comment` (opcional).
  - Flags derivadas:
    - `isHighlyRated`: rating bom e `total_ratings >= 10`.
    - `isPopular`: `total_ratings >= 50`.
    - `isBar`/`isRestaurant`/`isClub` conforme `establishment_type`.

- [x] Verificação de estabelecimento  
       Código: establishment.aggregate.ts ([6]).  
       Regra: `verify` define `is_verified = true` e dispara `EstablishmentVerifiedEvent`.

**Funcionalidades avançadas para estabelecimentos (planejadas)**

- [ ] Dashboard de contratação com histórico de performances e engajamento
- [ ] Sistema de avaliações/reviews entre estabelecimentos e músicos
- [ ] Agenda compartilhada em tempo real com disponibilidade de músicos e bandas
- [ ] Sistema de comunicação (chat seguro, histórico de conversas)
- [ ] Gestão de indicações com priorização por relevância
- [ ] Gestão completa de eventos (confirmação, lembretes, pagamentos automatizados)
- [ ] Módulo de marketing (integração social, geração de artes, campanhas, cupons)

Essas funcionalidades estão descritas em detalhes em _Features_, mas ainda não possuem fluxos completos (ex.: controllers, realtime, chat). A base de reservas e disponibilidade está concentrada no domínio _Scheduling_.

---

## Domínio Scheduling (Agenda, Reservas e Disponibilidade)

**Booking (Reserva)**

- [x] Booking representa uma reserva negociada com janela de tempo e status  
       Código: booking.aggregate.ts ([7]).  
       Regras:
  - Reserva tem `start_at` e `end_at`, com `buffer_minutes` (janela efetiva usada para conflitos é a janela com buffer).
  - Ciclo de vida inclui `pending`, `confirmed`, `cancelled`, `expired`, `completed` (com timestamps por transição quando aplicável).
  - Confirmação é permitida somente quando `status = pending`.

**Use cases de agendamento**

- [x] Propor reserva (pending) para músico ou banda com validação de disponibilidade e conflitos confirmados  
       Código: propose-booking.use-case.ts ([8]).  
       Regras:
  - Para músico: valida `Availability` do músico (se existir) e impede conflito com bookings confirmados.
  - Para banda: valida `Availability` da banda (se existir) e impede conflito com bookings confirmados da própria banda.
  - A proposta de reserva da banda não depende da disponibilidade dos membros.

- [x] Confirmar reserva (pending → confirmed) com validações e bloqueio operacional de membros  
       Código: confirm-booking.use-case.ts ([9]).  
       Regras:
  - A confirmação valida disponibilidade do alvo (músico ou banda) e conflitos confirmados do próprio alvo.
  - Em reservas de banda, após confirmar, o sistema tenta bloquear a agenda dos membros no intervalo com buffer, criando `unavailabilities` para cada membro. Esse bloqueio é operacional e não impede a confirmação caso algum membro já esteja indisponível.

**Availability (Agenda/Disponibilidade)**

- [x] Disponibilidade pode ser de músico ou de banda (exclusivo)  
       Código: availability.aggregate.ts ([10]).  
       Regras:
  - `musician_id` e `band_id` são mutuamente exclusivos (um ou outro).
  - `timezone` influencia a avaliação de regras semanais.
  - `weekly_rules` e `unavailabilities` são usados para decidir `isAvailable(start, end)`.

- [x] Persistência de agenda para músico e banda, incluindo regras semanais  
       Código: availability-prisma.repository.ts ([11]) e schema.prisma ([12]).  
       Regras:
  - Músico: `musician_calendar_settings`, `musician_availability_rules`, `musician_unavailability`.
  - Banda: `band_calendar_settings`, `band_availability_rules`, `band_unavailability`.

- [~] Limite de shows por dia configurável  
  O campo existe (`max_shows_per_day`), mas ainda não há regra consolidada aplicando esse limite no cálculo de disponibilidade.

---

## Domínio Audience (Público)

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

**Gamificação por Audience (pontos e níveis)**

- [x] Pontuação por ações do público (scan, pedidos, acertos, gorjetas, social, etc.)  
       Código: audience.aggregate.ts ([13]) em conjunto com VO `Points` e `AudiencePoints`.  
       Regras alinhadas com _Gamificação Avançada_ em _Features_:
  - Scan QR: +10 pts
  - Pedido musical: +25 pts
  - Pedido aceito/tocado: +50 pts
  - Gorjetas: 1 pt por real (via fluxo de tipagem)
  - Social share: +50 pts
  - Outras ações: indicação, presença em eventos, completar perfil, etc.

- [x] Sistema de níveis com benefícios por faixa de pontos  
       Código: user-level.vo.ts ([14]).  
       Regras:
  - Níveis 1 a 5 (Novato, Fã, Apoiador, VIP, Lenda) com intervalos de pontos bem definidos.
  - Cada nível define benefícios (`benefits`) como prioridade em pedidos, descontos em gorjetas, acesso a eventos VIP.
  - `getLevelByPoints` determina o nível a partir do total de pontos.

- [x] Badges básicos por milestones de interação  
       Código: audience.aggregate.ts ([13]).  
       Exemplo:
  - Badge “Iniciante Musical” no primeiro scan.
  - Badge “Sugestor” concedido no primeiro pedido via make-music-request.use-case.ts ([15]).  
    Outras badges avançadas (Mecenas, Discoverer, Socializer, Super Fã, etc.) estão estruturadas no domínio de Gamification, mas ainda não totalmente integradas ao fluxo de Audience.

**Pedidos musicais e votação**

- [x] Criação de pedido musical pelo público a partir do perfil do músico  
       Código: audience.aggregate.ts ([13]) (`makeMusicRequest`) e make-music-request.use-case.ts ([15]).  
       Regras:
  - Verificação de permissão (`canMakeRequest`) baseada no nível/pontos.
  - Pontuação +25 pts e possível badge “Sugestor”.
  - Emissão de evento de domínio `MusicRequestMadeEvent` com metadados (músico, música, artista, etc.).

- [x] Votação em músicas/pedidos  
       Código: audience.aggregate.ts ([13]) (`voteForSong`).  
       Regras:
  - Incremento de pontos por voto.
  - Emissão de evento `SongVotedEvent` com `request_id` e tipo de voto (`up`/`down`).
  - O intervalo de 2–3 minutos entre músicas e algoritmos de votação avançados ainda não estão encapsulados em um agregado próprio.

- [~] Limite anti-spam de pedidos por pessoa/evento  
  Parcialmente suportado via lógica de `Request.isSimilarTo` (anti-duplicação por usuário/música) e validações no agregado de `Request`.  
  Ainda não existe uma regra global consolidada de “máximo de pedidos por evento por usuário”.

**Gorjetas e interação social pela Audience**

- [x] Registro de gorjetas enviadas pelo público para músicos/bandas  
       A lógica financeira está no domínio Payment (ver seção Payment). Em Audience, o envio de gorjeta gera pontos e interações gamificadas (`sendTip`, `addTipPoints`).

- [~] Wall de apoiadores e dashboard visual de gorjetas para o público  
  Estruturas de transações e wallets já existem (Payment), mas não há ainda projeções dedicadas para um “Wall de Apoiadores” do ponto de vista do público.

**Descoberta de músicos e indicação para estabelecimentos**

- [x] Recomendação de músicos com base nas preferências do público  
       Código: recommend-musicians.use-case.ts ([16]).  
       Regra: usa `favorite_instruments` e `favorite_genres` do Audience para filtrar músicos ativos via `MusicianRepository.search`.

- [~] Sistema de indicação de talentos para estabelecimentos  
  A ideia está refletida nas entidades de Audience, Musician e nas preferências, mas ainda **não há** um fluxo fechado (use-case + agregados específicos) que implemente o botão “Indicar para Estabelecimento”, o dashboard de indicações e as recompensas associadas.

---

## Domínio Request (Pedidos Musicais)

**Criação e ciclo de vida do pedido**

- [x] Pedido musical ligado a público, músico, música e artista  
       Código: request.aggregate.ts ([17]).  
       Regras:
  - Campos principais: `audience_id`, `musician_id`, `song_title`, `artist`, mensagem opcional, flags e metadados.
  - `status` inicial é `pending`.
  - Datas: `created_at`, `responded_at`.

- [x] Aceitar e rejeitar pedidos com validações de estado  
       Código: request.aggregate.ts ([17]) (`accept`, `reject`).  
       Regras:
  - Só pedidos `pending` podem ser aceitos ou rejeitados; caso contrário, é lançada exceção.
  - Ao aceitar: `status = accepted`, `responded_at` preenchido, `rejection_reason = null`.
  - Ao rejeitar: `status = rejected`, `responded_at` preenchido, `rejection_reason` opcional.
  - Eventos `RequestAcceptedEvent` e `RequestRejectedEvent` são disparados com dados completos (audiência, músico, música, motivo).

- [x] Edição de pedido restrita a status pendente  
       Código: request.aggregate.ts ([17]).  
       Regras:
  - Métodos como `changeSongTitle`, `changeArtist`, `changeMessage` só funcionam para `status.pending`.
  - Se o status não é pendente, é adicionada uma notificação de erro em vez de lançar exceção, seguindo o padrão de validação.

**Prioridade, anti-spam e insights**

- [x] Cálculo de prioridade e idade do pedido  
       Código: request.aggregate.ts ([17]).  
       Regras:
  - `ageInMinutes`, `isRecent`, `isOld`.
  - `isUrgent`: pedidos pendentes com idade acima de um certo limiar.
  - `priority`: classificação (alta/média/baixa) combinando idade, status e flags de prioridade.

- [x] Anti-spam por similaridade de pedidos  
       Código: request.aggregate.ts ([17]) (`isSimilarTo`).  
       Regra: pedidos são considerados similares quando possuem mesmo `audience_id`, `musician_id`, `song_title` e `artist`, permitindo filtros na camada de aplicação para evitar spam de duplicatas.

- [~] Limite explícito de pedidos por pessoa/evento  
  Ainda não há uma contagem consolidada “X pedidos por usuário por evento”. O que existe é a detecção de duplicidade via `isSimilarTo` e lógica de priorização por idade/estado.

**Gamificação integrada ao pedido**

- [x] Pontos por pedido criado e pedido aceito  
       Implementado via integração entre `Request`, `UserPoints`/`AudiencePoints` e `PointsSource` em:
  - request.aggregate.ts ([17]) (métodos que calculam valor em pontos).
  - user-points.aggregate.ts ([18]) (`makeMusicRequest`, `acceptedMusicRequest`).  
    Regras:
  - Pedido criado: +25 pts.
  - Pedido aceito/tocado: +50 pts adicionais.

---

## Domínio Payment (Gorjetas, Transações e Carteiras)

**Gorjetas (Tip)**

- [x] Agregado Tip com vínculo a público, músico e banda  
       Código: tip.aggregate.ts ([19]).  
       Regras:
  - Campos: `tip_id`, `user_id` (opcional), `musician_id`, `band_id`, `amount`, `message`, `is_anonymous`, `show_in_wall`, `status`, `payment_method`, `pix_key`.
  - `create` valida valores (amount > 0, pelo menos um destinatário).
  - Estados: `pending`, `completed`, `failed`.
  - `complete` e `fail` aplicam eventos de domínio e congelam certos campos.

- [x] QR code PIX único permanente associado ao perfil do músico  
       A base está nos QR codes de Musician/Establishment e na entidade `Tip` com `pix_key`. O fluxo completo de geração/gestão de PIX está modelado, mas ainda não há integração real com provedores externos de PIX.

- [x] Mensagem personalizada com a gorjeta  
       Código: tip.aggregate.ts ([19]).  
       Regra: mensagem opcional é persistida juntamente com a gorjeta.

- [~] Wall público de apoiadores  
  O dado necessário existe (`show_in_wall`, `is_anonymous` em `Tip`), porém não existe ainda agregado ou endpoint dedicado para construir e expor o “Wall de apoiadores”.

**Carteiras e transações**

- [x] Carteira financeira para músicos (MusicianWallet)  
       Código: musician-wallet.aggregate.ts ([20]).  
       Regras:
  - Cada músico possui uma `MusicianWallet` com `balance` (`Money` VO), `pix_key` e histórico de timestamps.
  - `receiveFunds` e `withdrawFunds` validam saldo e valores positivos.
  - `updatePixKey` atualiza a chave de saque.

- [x] Registro de transações financeiras (Transaction)  
       Código: transaction.aggregate.ts ([21]).  
       Regras:
  - Tipos: `TIP`, `WITHDRAWAL`, etc.
  - Cálculo de `net_amount` = `amount - fee`.
  - Estados de processamento e timestamps.
  - Métodos para concluir/cancelar transações com validação.

- [x] Confirmação de pagamento de gorjeta (PIX) e distribuição  
       Código: confirm-tip-payment.use-case.ts ([4]).  
       Regras:
  - Localiza `Tip` por ID, cria `Transaction` com informações de pagamento real (valor, taxa, método, metadata).
  - Marca a gorjeta como `completed`.
  - Credita valor líquido na carteira do músico ou divide entre membros da banda.
  - Gera transações secundárias para cada membro da banda em caso de split.

- [x] Saque do músico para PIX com validação de saldo  
       Código: withdraw-to-pix.use-case.ts ([22]).  
       Regras:
  - Atualiza `pix_key` da wallet (se necessário).
  - Verifica saldo suficiente em `MusicianWallet`.
  - Deduz o valor, cria `Transaction` de tipo `WITHDRAWAL` e retorna saldo atualizado.

**Monetização e planos**

- [ ] Planos de assinatura para músicos e estabelecimentos (valores, limites, taxas diferenciadas)  
       Ainda não há agregados específicos de plano, cobrança recorrente ou lógica de pricing implementados, apesar de descritos na seção “Resumo de Monetização” em _Features_.

---

## Domínio Gamification (Pontos, Badges, Rankings)

**Pontos globais de usuário (UserPoints)**

- [x] Acúmulo de pontos por tipo de ação  
       Código: user-points.aggregate.ts ([18]) e points-source.vo.ts ([23]).  
       Regras:
  - `scanQr` → +10 pts
  - `makeMusicRequest` → +25 pts
  - `acceptedMusicRequest` → +50 pts
  - `sendTip` → 1 pt por real doado
  - `shareOnSocial` → +50 pts
  - Métodos genéricos `addPoints`/`subtractPoints` com validação.

- [x] Cálculo de nível, progressão e detecção de level up  
       Código: user-points.aggregate.ts ([18]) e user-level.vo.ts ([14]).  
       Regras:
  - `UserLevel.getLevelByPoints` define o nível.
  - `needsLevelUp` detecta se o total de pontos já ultrapassou o nível atual.
  - `getProgressToNextLevel` retorna % de progresso até o próximo nível.
  - Flags: `isTopFan` (>= 1000 pts), `isActiveSupporter` (tip + compartilhamento).

- [x] Use-case central para cálculo de pontos  
       Código: calculate-points.use-case.ts ([24]).  
       Regra: recebe `user_id` + `source` e aplica o método correspondente em `UserPoints`, criando o registro se não existir.

**Badges de usuário (UserBadge)**

- [x] Sistema genérico de badges com progresso e desbloqueio  
       Código: user-badge.aggregate.ts ([25]) e badge-type.vo.ts ([26]).  
       Regras:
  - Cada badge possui `BadgeType` com pontos requeridos, descrição e regras de desbloqueio.
  - `addProgress`/`unlock` atualizam estado e timestamps.
  - `canUnlock` e `getProgressPercentage` facilitam a aplicação de negócios.

- [x] Use-cases para concessão e manipulação de badges  
       Código: award-badge.use-case.ts ([27]) e demais use-cases em `application/use-cases`.  
       Regras: cada use-case recebe DTO validado com `class-validator` e orquestra criação/atualização em repositórios.

**Interações e ranking**

- [x] Registro tipado de interações de usuário (UserInteraction)  
       Código: user-interaction.aggregate.ts ([28]) e interaction-metadata.vo.ts ([29]).  
       Regra: grava o tipo de interação (scan, pedido, tip, share, etc.), target, metadata e pontos associados.

- [x] Rankings por tipo e período  
       Código: ranking.aggregate.ts ([30]) e ranking-type.vo.ts ([31]).  
       Regras:
  - `RankingTypeEnum` suporta diferentes rankings (ex.: Top Fãs, Top Apoiadores, etc.).
  - `RankingPeriodEnum` define periodicidade (diário, semanal, mensal, anual, all-time).
  - Validações garantem que `period_end > period_start` e `position >= 1`.
  - Flags: `isCurrentPeriod`, `isTopPosition`, `getPositionMedal`.

- [~] Algoritmo completo de ranking mensal (Top Fãs, Top Sugestões, Top Discoverers, etc.)  
  Estrutura de `Ranking` e `UserPoints` já está pronta, com use-cases para cálculo e leaderboard; contudo, a lógica fina de cada tipo de ranking (combinações específicas de métricas) ainda pode ser expandida para refletir todos os cenários descritos em _Features_.

---

## Funcionalidades Planejadas Ainda Não Implementadas

Além dos pontos marcados como `[ ]` e `[~]` acima, os seguintes blocos de funcionalidades do documento de visão **ainda não possuem implementação direta** no backend atual:

- Marketplace com Reels/Vídeos (upload, streaming, revenue sharing por views)
- Sistema de “Memórias Musicais” (álbum de momentos, timeline pessoal, analytics visuais)
- Integrações externas completas:
  - Pipeline próprio de cifras (`ai-cifra-module`) + folha de cifra (LRC + acordes) + MusicXML export
  - Verificação automática de compartilhamentos sociais via APIs
  - Integrações de analytics (GA4, Pixel, social listening)
- Segmentação avançada por instrumentos e proximidade com feed de Reels
- Matching inteligente para formação de bandas (ML, score de compatibilidade, jam virtual)
- Programas especiais de carreira, talent shows virtuais e parcerias avançadas de marketplace
- Gestão detalhada de planos pagos (músicos, estabelecimentos, marketplace) com billing recorrente

Esses itens estão descritos em [features.md](features.md) ([1]), e o código atual fornece boa parte da base de domínio (QR codes, pedidos, gorjetas, gamificação, rankings). Porém ainda serão necessários novos agregados, use-cases e integrações de infraestrutura para chegar à visão completa da plataforma.

[1]: features.md
[2]: ../src/core/musician/domain/musician.aggregate.ts
[3]: ../src/core/musician/domain/band.aggregate.ts
[4]: ../src/core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case.ts
[5]: ../src/core/musician/infra/db/in-memory/musician-in-memory.repository.ts
[6]: ../src/core/establishment/domain/establishment.aggregate.ts
[7]: ../src/core/scheduling/domain/booking.aggregate.ts
[8]: ../src/core/scheduling/application/use-cases/propose-booking/propose-booking.use-case.ts
[9]: ../src/core/scheduling/application/use-cases/confirm-booking/confirm-booking.use-case.ts
[10]: ../src/core/scheduling/domain/availability.aggregate.ts
[11]: ../src/core/scheduling/infra/db/prisma/availability-prisma.repository.ts
[12]: ../prisma/schema.prisma
[13]: ../src/core/audience/domain/audience.aggregate.ts
[14]: ../src/core/gamification/domain/value-objects/user-level.vo.ts
[15]: ../src/core/audience/application/use-cases/make-music-request/make-music-request.use-case.ts
[16]: ../src/core/audience/application/use-cases/recommend-musicians/recommend-musicians.use-case.ts
[17]: ../src/core/request/domain/request.aggregate.ts
[18]: ../src/core/gamification/domain/user-points.aggregate.ts
[19]: ../src/core/payment/domain/tip.aggregate.ts
[20]: ../src/core/payment/domain/musician-wallet.aggregate.ts
[21]: ../src/core/payment/domain/transaction.aggregate.ts
[22]: ../src/core/payment/application/use-cases/withdraw-to-pix/withdraw-to-pix.use-case.ts
[23]: ../src/core/gamification/domain/value-objects/points-source.vo.ts
[24]: ../src/core/gamification/application/use-cases/calculate-points/calculate-points.use-case.ts
[25]: ../src/core/gamification/domain/user-badge.aggregate.ts
[26]: ../src/core/gamification/domain/value-objects/badge-type.vo.ts
[27]: ../src/core/gamification/application/use-cases/award-badge/award-badge.use-case.ts
[28]: ../src/core/gamification/domain/user-interaction.aggregate.ts
[29]: ../src/core/gamification/domain/value-objects/interaction-metadata.vo.ts
[30]: ../src/core/gamification/domain/ranking.aggregate.ts
[31]: ../src/core/gamification/domain/value-objects/ranking-type.vo.ts

