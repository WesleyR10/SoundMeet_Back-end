# Auditoria do catálogo Tier S/A/B — 21/ago/2026

## Por que este doc existe

Uma sessão anterior propôs um catálogo de 12 features candidatas ("Tier S/A/B"), derivado dos
quatro ativos do SoundMeet (motor MIR proprietário, presença física verificada via QR,
trilho financeiro Asaas real, grafo de três lados). O plano estratégico em si foi rejeitado —
o pedido real era auditar o que desse catálogo **já existe no código**, com que qualidade
arquitetural e de segurança, e o que falta.

Metodologia: 6 agentes de exploração — 3 de levantamento factual (docs canônicos, código
backend, código mobile/web) e 3 de auditoria profunda de qualidade/arquitetura/segurança nos
módulos que têm implementação real, cruzando contra as armadilhas já documentadas neste próprio
`CLAUDE.md` (`SearchParams.filter` sem override, `ClassValidatorFields` com `groups` errado,
colisão de `:id` no ownership guard, fabricação de documento, exclusividade de variante de
cláusula).

**Resultado geral: 9 dos 12 itens do catálogo não têm nenhum código — são só ideia de roadmap.**
Os 3 que têm implementação real (Contrato, Escrow, Ficha Técnica do Palco) foram auditados a
fundo. Achado extra: a seção "Gaps reais conhecidos" deste `CLAUDE.md` tinha uma afirmação
desatualizada sobre rating/review — corrigida na mesma sessão desta auditoria (ver §5).

---

## 1. Tabela consolidada

| # | Feature do catálogo | Backend | UI (mobile/web) | Veredito |
|---|---|---|---|---|
| S2 | Contrato digital + assinatura | ✅ Completo, alta qualidade | ✅ Mobile + Web completos | **Pronto** — falta só revisão jurídica (gate já conhecido) |
| S2 | Escrow / custódia do cachê (F1.3a) | ⚠️ Domínio/job sólidos, **fluxo de criação inexistente** | ❌ Nenhuma | **Incompleto — ver §3.2 e §6** |
| A3 | Ficha Técnica do Palco (backline) | ✅ Completo (`StageTechSpec` VO) | ✅ Web (form) + exibição pública + mobile (leitura) | **Pronto** |
| — | Rating/Review pós-show | ✅ HTTP completo (`reviews-module`) | ⚠️ Só web (estabelecimento→músico); mobile não tem tela de enviar | **Backend pronto, UI mobile faltando** |
| A2 | Disponibilidade (Availability) | ✅ Completo e seguro | ✅ Mobile (editar) + Web (ver agenda de 1 artista) | Primitiva pronta; **"Radar de Data Vazia" (busca por data vazia) não existe** |
| S3 | ai-audio (separação de stems) — "Modo Ensaio" | ✅ Completo e seguro | ❌ Nenhuma referência em mobile/web | **Backend pronto, zero UI** |
| S1 | Roteiro Musical / ECAD automático | ❌ Não existe (só cláusula jurídica que atribui a obrigação ao estabelecimento) | ❌ | **Não iniciado** |
| A1 | Clube do Artista (assinatura fã→músico) | ❌ Não existe (só gamificação com badges "Apoiador"/"Super Fã", sem dinheiro) | ❌ | **Não iniciado** — rotulado "futuro" em `monetization.md` |
| A4 | Currículo Verificado do Músico | ❌ Não existe como feature (blocos soltos existem: booking `COMPLETED` + `EventAttendee` + review) | ❌ | **Não iniciado** |
| A5 | Setlist Inteligente por local | ❌ Não existe (repertório é CRUD pessoal, sem cruzamento local×pedido×gorjeta) | ❌ | **Não iniciado** |
| B1/B2 | Pós-show automático / Wrapped | ❌ Não existe | ❌ | **Não iniciado** — só ideias em `roadmap-web.md` §7 |
| B3 | Ponte Spotify/YouTube | ⚠️ YouTube real (yt-dlp/Piped no pipeline de IA); Spotify é só campo de link + 2 env vars mortas | ⚠️ Só campo de link social nas duas UIs | **Não é integração — é aparência de integração** |
| B4 | Split de gorjeta com convidado | ❌ Não existe (só split fixo e igualitário entre membros já cadastrados da banda) | ❌ | **Não iniciado** |

---

## 2. Detalhe por item não iniciado (citações)

**S1 — Roteiro Musical/ECAD.** Único uso do termo é a cláusula contratual que atribui a
obrigação de recolhimento ao estabelecimento:
> `Docs/contract/legal-checklist.md:143,149-151`: *"Direitos autorais / ECAD [...] A obrigação
> de recolhimento pela execução pública em local de frequência coletiva é de quem promove o
> evento — o estabelecimento."*
Não existe nenhum gerador de roteiro musical a partir de repertório tocado/pedidos aceitos.

**A1 — Clube do Artista.** Rotulado explicitamente como futuro, sem domínio:
> `Docs/monetization.md:183-186`: *"### Apoio Mensal (Modelo Patreon — futuro) [...] Taxa da
> plataforma: 8% sobre apoios mensais."*
Os termos "Apoiador"/"Super Fã" existem só como **badges de gamificação por volume de gorjeta**
(`src/core/gamification/domain/value-objects/badge-type.vo.ts`, `user-level.vo.ts`) — não uma
relação de assinatura recorrente fã→músico.

**A2 (parte "radar") — Radar de Data Vazia.** Os blocos de dados já existem, a feature de
marketplace reverso não:
> `Docs/roadmap-web.md:735`: *"Radar de sexta vazia — '22/08 sem música marcada' + músicos livres
> naquela data | free-busy + searchByProximity prontos | Baixo · feature matadora de dashboard"*
Confirmado no código: a busca de artistas do web (`ArtistSearchFilters.tsx`, rota
`/dashboard/artistas`) filtra por nome/gênero/instrumento/preço/raio — **sem filtro por
data/disponibilidade**. Não há tela de "buscar músico disponível numa data vazia".

**A4 — Currículo Verificado.** Não mencionado em nenhum doc como feature de produto. O que
existe é um selo pago genérico, diferente do pedido:
> `Docs/monetization.md:207`: *"Verificação de Perfil: R$ 49,90 — Selo de confiança"*
Os blocos de construção existem soltos (booking `COMPLETED`, `EventAttendee`, `Review`), mas
nenhum doc ou código reúne isso num "currículo".

**A5 — Setlist Inteligente por local.** Não existe cruzamento local×horário×pedido×gorjeta.
`src/core/repertoire/` é só CRUD pessoal (`add-song`, `reorder-songs`, `share-repertoire` etc.);
`src/core/music-library/` é CRUD básico. Grep por `suggest`/`analytics`/`setlist` só retorna o
nome literal "Setlist Principal" usado como fixture de teste, não uma feature de sugestão.

**B1/B2 — Pós-show automático / Wrapped.** Só ideias de catálogo:
> `Docs/roadmap-web.md:722`: *"Relatório automático pós-show — '18 músicas, 6 pedidos aceitos,
> R$ 210 em gorjetas' + card compartilhável | 100% dos dados (requests, tips, repertoire) | Baixo"*
> `Docs/roadmap-web.md:749`: *"'Meu ano em shows' (Wrapped) [...] UserInteraction já grava tudo |
> Médio · altíssima viralidade"*
No código, o componente mais próximo (`ContractShowSummary.tsx`, mobile) é só um cabeçalho
estático dentro da tela de contrato — não é recap nem tem função de compartilhar.

**B3 — Ponte Spotify/YouTube.** YouTube tem integração técnica real (download de áudio via
`yt-dlp`/Piped para o worker de IA, em `src/core/ai-cifra/infra/audio-sources/`). Spotify não:
`SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` estão declarados em `config.schema.ts` mas **nenhum
outro arquivo os consome** — são env vars mortas. `social-links.vo.ts` só valida um link de
perfil (mesmo tratamento dado a qualquer rede social), sem chamar API nenhuma.

**B4 — Split com convidado.** Só existe split fixo, igualitário, entre membros já aceitos da
banda — em `confirm-tip-payment.use-case.ts` (~linhas 125–190), com o próprio comentário do
código admitindo a limitação: *"For simplicity, splitting equally for now. Future: Implement
customizable percentages as per requirements."* `Tip.aggregate.ts` só aceita `musician_id` OU
`band_id` como destinatário — nunca uma lista arbitrária de recebedores para um show específico.
No mobile, `BandTipSplitCard.tsx` é só um card informativo da regra fixa, com comentário próprio:
*"Um extrato dedicado por banda fica pra v2 (exigiria endpoint novo no backend)"*.

---

## 3. Módulos com implementação real — auditoria de qualidade

### 3.1 Contrato digital (`src/core/contract` + `src/nest-modules/contract-module`)

7 de 8 pontos auditados **conformes sem ressalva**:

1. **`ClassValidatorFields`** — usa o padrão correto do projeto: cada decorator em
   `ContractRules` declara `{ groups: [<próprio nome do campo>] }`, e o default de `fields` em
   `contract.validator.ts:72-84` é exatamente o conjunto de nomes de campo — a intersecção bate
   para todos, validação roda normalmente. Não é a armadilha genérica (que só ocorreria se os
   decorators não declarassem `groups`).
2. **`SearchParams.filter`** — override completo em `contract.repository.ts:52-81`, com
   whitelist (`booking_id`, `establishment_id`, `musician_id`, `band_id`, `status`) e tratamento
   especial de `participant_ids` (array vazio **preservado** como "zero resultados", testado em
   `contract-search-params.spec.ts:83-90`). `ListContractsUseCase` exige `participant_ids`
   não-vazio antes de prosseguir sem admin (fail-closed, 403).
3. **Exclusividade de variante** — as 38 variantes das 23 cláusulas têm condições de
   `applicability` genuinamente disjuntas (ex.: `tributos` particiona
   `contracted_is_company: true/false` × `contractor_is_company`). **Ressalva de teste:**
   `selectVariant` usa `.find()` e não há teste que provaria "nunca há 2 variantes aplicáveis
   simultaneamente" — hoje não há overlap (conferido manualmente nas 38), mas é uma lacuna de
   regressão futura.
4. **`IContractStorage`** — não tem `getPublicUrl` (`contract-storage.interface.ts:23-44`),
   confirmado também na implementação S3. Download é sempre via
   `GET /contracts/:contract_id/document`, autorizado.
5. **Fabricação de documento** — `issue-contract.use-case.ts` (`collectMissingQualification`,
   linhas 378-439) nunca deriva CPF/CNPJ/representante; retorna
   `{ issued: false, missing: [...] }`. Único placeholder é o endereço do contratado, rotulado
   honestamente como "Não informado" — não é fabricação de dado real.
6. **Ordem de rotas** — `@Get()` → `@Get(":contract_id")` → `@Get(":contract_id/document")` →
   `@Post(...)` → `@Post("issue")` → `@Post(":contract_id/annul")`; sem colisão possível
   (contagem de segmentos difere). `contract-verification.controller.ts` é controller
   **separado**, sem `@UseGuards`, com `@Public()` só na rota de verificação — não há vazamento
   de guard em nenhuma direção.
7. **DTOs** — todos são classes com `class-validator`, `OmitType` sobre inputs do core já
   decorados, `ValidationPipe` global com `whitelist: true`.

**Ponto de atenção (não é bug, é decisão de produto a confirmar):** `annul-contract` é
autorizado só por `@Roles("admin")`, sem checar se o admin pertence à mesma parte do contrato —
qualquer admin pode anular qualquer contrato, sem escopo por organização. Diferente do modelo de
`sign`/`issue`, que usam `assertNegotiationParticipant`/`assertNegotiationViewer` restritos às
partes. Vale confirmar se é essa a intenção (ação de moderação/suporte) ou se deveria ter escopo.

### 3.2 Escrow / custódia do cachê (`BookingEscrow`, F1.3a)

As invariantes de negócio documentadas neste `CLAUDE.md` **estão corretas no código que existe**:

- `held_balance` separado de `balance` — `musician-wallet.aggregate.ts`; `withdrawFunds()` só lê
  `balance`, `holdFunds()`/`releaseHeldFunds()` são os únicos métodos que tocam `held_balance`.
- Comissão só em `release()` — `booking-escrow.aggregate.ts:190-220`, dispara
  `BookingEscrowReleasedEvent` com `platform_fee`. **Nota:** esse evento não tem nenhum handler
  registrado hoje (grepado em todo `src`) — não há bug, mas também não há nenhum consumidor real
  ainda; um futuro handler de contabilidade precisa assinar exatamente esse evento.
- Divisão em centavos inteiros — `split-amount.ts` opera em centavos (`Math.round`), a igualdade
  `platform_fee + net_amount === amount` é garantida algebricamente (subtração de inteiros, não
  dois arredondamentos independentes). **Ressalva:** não há um assert/invariante em runtime
  dentro do agregado que reverifique essa igualdade após reconstituição via Prisma — a garantia é
  100% algorítmica, não defensiva.
- `asaas_api_key` nunca em `toJSON()` — confirmado, com comentário explícito no código.
- Desabilitar com saldo retido é recusado — `disableEscrow()` confirmado. **Nem
  `enableEscrow()` nem `disableEscrow()` têm use-case/rota HTTP hoje** — lógica pronta, não
  exposta.
- `uses_escrow` fail-safe via `ESCROW_ENABLED` + `ESCROW_CUSTODIAN_LEGAL_NAME` — confirmado em
  duas camadas (Joi obrigatório condicional + `escrowEnabled()` no use-case de emissão).

**Achado crítico — completude, não segurança:** o fluxo de **criação** da custódia (provedor
confirma cobrança → `BookingEscrow.markHeld()` → `MusicianWallet.holdFunds()`) **não existe em
nenhum use-case ou controller**. `BookingEscrow.create()`, `.markHeld()` e
`MusicianWallet.holdFunds()` só são chamados por fake builders e testes — nenhuma chamada em
produção. `AsaasWebhookController` trata `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED` só para gorjeta e
assinatura, sem nenhum branch para eventos de custódia. **Hoje é literalmente impossível colocar
dinheiro em custódia via este código** — a invariante "`held_balance` é espelho, nunca fonte"
nunca é exercitada em produção porque `held_balance` nunca é incrementado por nenhum fluxo real.

**Fragilidade arquitetural:** a checagem de "check-in + ausência de contestação" antes de liberar
vive em `ProcessDueEscrowReleasesUseCase.blockingReason()` (o orquestrador do cron job), **não**
em `ReleaseBookingEscrowUseCase.execute()` nem no agregado. O use-case de liberação, isolado, só
confirma o status (`HELD`/`DISPUTED`) e chama o gateway — se uma futura rota administrativa
injetar `ReleaseBookingEscrowUseCase` diretamente (em vez de passar pelo sweep), ela libera
**sem checar check-in nem disputa**. Ver §6 para o plano de fechar isso junto com a criação.

**Segurança das rotas HTTP existentes em `payment-module`** — todas conformes: `POST /tips` usa
`audience_id` do JWT (nunca do body); rotas de wallet (`GET`, `PATCH pix-key`, `POST withdraw`,
`POST/DELETE mercadopago`) usam `@Roles` + `MusicianOwnershipGuard`; webhooks Asaas/MercadoPago
são `@Public()` mas autenticados por token/HMAC com `timingSafeEqual`, fail-closed se não
configurado. **Nenhuma rota expõe operações de escrow sem guard** — porque nenhuma dessas
operações tem rota HTTP hoje. A superfície de ataque é zero porque a feature está incompleta, não
porque foi endurecida deliberadamente.

### 3.3 ai-audio, review, availability, stage-tech-spec

Nenhuma ocorrência nova dos dois bugs históricos do projeto:

- **Filtro-objeto sem override** — `ai-audio-separation-job.repository.ts:37-55`,
  `ai-audio-upload.repository.ts:33-46`, `review.repository.ts:45-71` (com cuidado extra:
  `has_comment: false` tratado via `typeof === "boolean"`, não truthy) e
  `availability.repository.ts:30-47` já nascem com o override correto de `protected set filter`,
  com whitelist. Nenhum caller de ai-audio usa `.search()` ainda (latente, mas correto).
- **Colisão de `:id` no ownership guard** — `ai-audio.controller.ts` (`uploads/:id/separations`,
  `separations/:id`) nem usa `MusicianOwnershipGuard`: a autorização é feita manualmente dentro
  dos use-cases, comparando `job.musician_id`/`upload.musician_id` (carregado do banco) com
  `currentUser.userId` do JWT — um padrão mais robusto ainda que evita a classe de bug por
  completo. `availability.controller.ts` nomeia o sub-recurso `:block_id` (não `:id`), sem
  colisão possível.
- **Rota interna do worker** (`POST ai-audio/internal/separations/:id/progress`) — protegida por
  `InternalTokenGuard` + token de env obrigatório em produção (Joi `required()` condicional),
  fail-closed se não configurado. Não é uma rota pública desprotegida.
- **`ReviewEligibilityService`** — exige booking `COMPLETED` + prova de presença real
  (`EventAttendee` via QR, para audience) ou vínculo real ao evento (para músico/estabelecimento)
  — não é "booking existe" simplista.
- **Autoria de review** — `author_id`/`author_type` resolvidos só do JWT
  (`review-author.resolver.ts`); `SubmitReviewDto` nem declara campo `author_id`/`reviewer_id`.
  A exceção (`author_establishment_id`) é validada contra `user.establishmentIds` do token antes
  de aceitar.
- **Stage-tech-spec** — `PATCH establishments/:id/profile` (única rota que popula
  `stageTechSpec`) está atrás de `@Roles("establishment","admin")` +
  `EstablishmentOwnershipGuard`. Exposição pública (`GET establishments/:id`) só carrega campos
  técnicos (tomadas, canais, monitores, backline, dimensões, notas) — sem PII.

---

## 4. Interpretação — o que isso muda na priorização

O plano estratégico anterior tratava os 12 itens como igualmente "a construir". Esta auditoria
mostra dois grupos bem diferentes:

- **Grupo "terminar o que já foi começado"** (Contrato, Escrow, ai-audio UI, Review UI mobile,
  Radar de Data Vazia): o esforço de domínio já foi pago — o gap é orquestração/webhook (escrow)
  ou só UI (ai-audio, review mobile, radar). Custo de completar é baixo relativo ao valor, porque
  a parte difícil (domínio, segurança, invariantes) já está feita e já foi auditada aqui.
- **Grupo "começar do zero"** (ECAD, Clube do Artista, Currículo Verificado, Setlist Inteligente,
  Pós-show/Wrapped, Spotify de verdade, split com convidado): exige domínio novo, decisão de
  produto e, em alguns casos (ECAD, Clube do Artista), risco jurídico/regulatório que precisa de
  validação externa antes de codar.

Isso sugere que "terminar o escrow" tem retorno mais imediato que qualquer item do segundo grupo
— é literalmente a única peça que falta para a receita de custódia (Tier S2) funcionar de
verdade, e o domínio já foi auditado como correto.

---

## 5. Correção aplicada neste `CLAUDE.md`

A seção "Gaps reais conhecidos" afirmava: *"🔴 Rating sem rota HTTP:
`musician.addRating()`/`establishment.addRating()` existem nos agregados, mas nenhum controller
expõe"*. Isso estava **desatualizado**. Achado real:

- `addRating()` existe nos agregados mas é código morto — só chamado em testes unitários. Grep em
  todo `src/` não encontra nenhum use-case chamando `addRating`.
- O trabalho real é feito por um agregado `Review` separado (`src/core/review/`), com
  `SubmitReviewUseCase` chamando `target.syncRatingProjection(average, total)` — método diferente,
  ativo, existente em ambos os agregados.
- Exposto via HTTP desde 07/ago/2026: `src/nest-modules/reviews-module/` com
  `POST/GET musicians/:id/ratings` e `POST/GET establishments/:id/ratings`, documentado em
  `Docs/roadmap-web.md` (Bloco 9.3) e `Docs/business-rules.md`.
- **O gap real é de UI, não de backend:** o web já tem tela de o estabelecimento avaliar o
  músico pós-show (`ReviewMusicianForm.tsx`, W3.7); **o mobile não tem nenhuma tela do músico
  avaliar o estabelecimento** — o app só exibe ratings já calculados (read-only).

A linha correspondente na seção "Gaps reais conhecidos" foi reescrita para refletir isso.

---

## 6. Próximo passo recomendado — fechar o gap do escrow (F1.3a)

Esboço de plano (não implementação — decisão de escopo ainda pendente do usuário):

1. **Novo use-case `CreateBookingEscrowUseCase`**, disparado a partir do `BookingConfirmedEvent`
   (mesmo evento que já dispara a emissão de contrato) — calcula o split via `splitAmount` já
   existente, chama `IBookingEscrowGateway.createEscrowCharge()`, persiste `BookingEscrow` num
   estado inicial (aguardando confirmação de pagamento), sem tocar `held_balance` ainda.
2. **Novo branch no `AsaasWebhookController`** para o evento de confirmação de pagamento da
   cobrança em custódia — reconhecer quando o pagamento é de uma `BookingEscrow` (por referência
   externa/id) e então chamar `escrow.markHeld()` + `wallet.holdFunds()`, na ordem
   provedor→custódia→carteira já correta no fluxo de release.
3. **Fechar a fragilidade arquitetural do §3.2**: mover a checagem de check-in + ausência de
   contestação para dentro do próprio `ReleaseBookingEscrowUseCase` (ou do agregado), não só no
   orquestrador do cron job.
4. **Decisão de escopo pendente:** incluir uma rota HTTP somente-leitura de status de custódia
   nesta fatia, e decidir se `enableEscrow`/`disableEscrow` (hoje sem nenhuma rota) entram junto
   ou ficam para depois — é decisão de produto (opt-in/opt-out por músico), não só técnica.

Isso vira uma tarefa de implementação separada quando o escopo acima for confirmado.
