# Indicação de talentos e compartilhamento

> Parte das [regras de negócio](../README.md) — o que a API já faz, por domínio.
> Marcações: `[x]` implementado · `[~]` parcial · `[ ]` pendente.

*Seção original: “Indicação de talentos e compartilhamento social (28/set/2026)”.*


## O que estava errado

As duas rotas existiam (`POST /audiences/:id/indications` e
`.../social-shares`) e **pareciam funcionar**. Não funcionavam:

1. 🔴 **A indicação era descartada.** Não havia tabela. O use-case incrementava
   `Audience.points` e emitia `MusicianIndicatedEvent` — e **nenhum handler o
   escutava**. Pior: os use-cases nem recebiam o `DomainEventMediator`, então o
   evento nem chegava a ser publicado. Quem indicou quem, para onde e por quê
   sumia. Era por isso que o "dashboard de indicações do estabelecimento" nunca
   pôde ser construído.
2. 🔴 **Dois sistemas de pontos, divergindo em silêncio.** As rotas mexiam em
   `Audience.points` (nível do fã); o ledger canônico `UserScore` +
   `UserPoints` — que o **leaderboard lê** — nunca via nada. E os valores
   divergiam: `AudiencePoints` dava `share_social: 50` / `indicate_musician: 3`,
   enquanto `gamification-points.ts` dava 50 ao share e **nem conhecia** a
   indicação.
3. 🔴 **O compartilhamento era fraude trivial.** 50 pontos — o mesmo que um
   pedido ACEITO — numa ação sem dedupe e sem nada que a corrobore.
   `imageShare.ts` **documenta no próprio código** que o SO não distingue
   "compartilhou" de "abriu o menu e cancelou". Vinte toques = os 1000 pontos de
   `isTopFan`, e o leaderboard é público.

## As decisões

**Valores unificados** nos dois sistemas: compartilhamento **10** (ordem de
`SCAN_QR`, ação leve e não verificável), indicação **15** (exige mais intenção:
escolher músico, local e motivo). Os **50 pontos ficam reservados à missão
7.11**, que exige prova do post — é o que o roadmap 7.3 já mandava tratar como
fonte única deste tema.

**Dedupe por conteúdo, no ledger.** `UserScore` já é a fonte de verdade dos
pontos; uma segunda tabela de "o que já foi pago" poderia divergir dele.
`existsByUserTypeAndReference(user_id, score_type, reference_id)` — **as três
colunas**, porque só `(user, tipo)` bloquearia o segundo compartilhamento de
qualquer conteúdo e só a referência bloquearia o crédito de outro usuário sobre
o mesmo card.

- Compartilhamento: referência `<content_type>:<content_id>`. O prefixo evita
  colisão entre ids de domínios diferentes (dois UUID podem coincidir por
  acidente de seed, e a colisão apareceria como crédito negado sem motivo).
- Indicação: referência `<musician_id>:<establishment_id>`.

⚠️ **Compartilhar/indicar de novo continua funcionando** — mandar o card para
outro grupo é uso normal. O que não acontece duas vezes é o **crédito**.

**`platform` virou opcional** no compartilhamento: o share sheet do SO não
informa o destino. Exigir o campo obrigaria o cliente a inventar um valor, e
dado inventado entra em relatório como se fosse verdade.

**O contrato do share mudou:** `request_id` deu lugar a `content_type` +
`content_id` (`tip_receipt` | `show_recap` | `qr_code` | `request`). A rota não
tinha nenhum cliente, então a troca não quebrou ninguém.

## A indicação como entidade

Domínio `src/core/indication/` + `indications-module` (1 controller).
Migration `20260908120000_add_indications`.

- **Unicidade `(audience_id, musician_id, establishment_id)` no BANCO.** Dois
  POSTs simultâneos furam qualquer checagem só na aplicação, e o mesmo fã
  indicando o mesmo artista para a mesma casa de novo é a mesma opinião,
  repetida. `RecordIndicationUseCase` é idempotente: repetir devolve a
  existente; numa corrida, o `ConflictError` do UNIQUE cai na releitura e
  **nenhum dos dois usuários vê erro**.
- **`status` (`new`/`seen`/`archived`) pertence a QUEM RECEBE.** O fã indica e
  sai de cena; não há método que ele possa chamar. `markAsSeen()` **não
  ressuscita** uma arquivada — senão ela voltaria à caixa sozinha.
- **Arquivar não apaga.** A indicação continua contando como sinal do público
  (e como ponto já creditado). Some da lista, não da história.
- 🔴 **`:indication_id`, nunca `:id`.** Um `:id` de sub-recurso colide com o
  fallback do ownership guard e dá 403 no dono legítimo — armadilha já paga em
  `personal-chord-sheet`. Há `@OwnershipParam({ param: "establishment_id" })`
  explícito e teste de regressão em `indications-module/__tests__/di-check.spec.ts`.
- 🔴 **`UpdateIndicationStatusUseCase` confere `establishment_id` contra a linha
  carregada, e responde 404 — não 403.** O guard prova quem é o usuário, nunca
  de quem é o sub-recurso; e "existe mas não é sua" já confirma a existência a
  quem não deveria saber.
- **Alvos polimórficos sem FK** (precedente de `Review`/`UserScore`), mas o
  `SearchParams.filter` tem **override obrigatório** — sem ele a caixa de um
  estabelecimento devolveria as indicações de todos. Há teste que falha se o
  override for removido.
- **O nome do fã NÃO sai** no presenter. A caixa existe para o dono reagir ao
  sinal do público, não para descobrir quem gosta de quem.

## Ordem no handler

`AudienceEventsHandlers` **persiste antes de creditar**, e as duas coisas falham
independentemente: a indicação é o dado de negócio, os pontos são acessórios.
Perder a indicação por causa da gamificação seria o pior resultado. Nenhuma
falha de pontos propaga para o usuário.
