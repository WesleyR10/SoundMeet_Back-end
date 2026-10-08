# Pagamentos, gorjetas e carteira

> Parte das [regras de negócio](../README.md) — o que a API já faz, por domínio.
> Marcações: `[x]` implementado · `[~]` parcial · `[ ]` pendente.

*Seção original: “Domínio Payment (Gorjetas, Transações e Carteiras)”.*


**Gorjetas (Tip)**

- [x] Agregado Tip com vínculo a público, músico e banda  
       Código: tip.aggregate.ts ([19]).  
       Regras:
  - Campos: `tip_id`, `audience_id`, `musician_id`, `band_id`, `amount`, `message`, `is_anonymous`, `show_in_wall`, `status`, `payment_method`, `pix_key`.
  - ⚠️ **Correção (07/ago/2026):** o texto anterior dizia `user_id` **(opcional)**. **É `audience_id` e é obrigatório** — `Tip.audience_id: Uuid` no agregado e `audienceId String` **NOT NULL** com FK `onDelete: Restrict` no Prisma. A premissa errada quase virou uma tarefa de "gorjeta anônima" no Bloco 9.6.
  - **Anonimato é propriedade de EXIBIÇÃO, não ausência de registro.** `is_anonymous` esconde o nome do fã no wall e na notificação; a identidade continua gravada. É o modelo correto para dinheiro: gorjeta sem identidade não pode ser estornada, contestada nem ter recibo, e a FK existe justamente para proteger a integridade financeira.
  - `create` valida valores (amount > 0, pelo menos um destinatário).
  - Estados: `pending`, `completed`, `failed`, `refunded` (este último ainda sem uso — ver o reembolso do destaque pago).
  - `complete` e `fail` aplicam eventos de domínio e congelam certos campos.

- [x] QR code PIX único permanente associado ao perfil do músico  
       O QR do perfil leva à página do músico; a cobrança PIX de cada gorjeta é gerada pelo **Mercado Pago** (`MercadoPagoPixGateway`, Orders API), criada **na conta do músico** via OAuth, com a comissão em `marketplace_fee`. Sem `MERCADOPAGO_API_URL` cai no `PixGatewayMock`; músico sem conta vinculada recebe erro acionável (`MercadoPagoAccountNotLinkedError`).

- [x] **O payload da cobrança PIX é persistido** (`tips.pixQrCode`/`pixCopyPaste`,
      27/ago/2026). Antes ele só existia na resposta HTTP da criação: quem
      fechasse a tela perdia o QR para sempre e a gorjeta ficava `pending` sem
      caminho de volta. No fluxo de destaque isso deixaria de ser inconveniente
      e viraria impossibilidade — o fã pode fechar a tela antes de pagar e
      precisa recuperar o QR depois. **Não** entra no regime de cifragem do `pix_key`: aquela é a
      chave de RECEBIMENTO do músico (dado permanente dele); isto é um código de
      cobrança de uso único que o pagador precisa enxergar para pagar.

- [x] **`GET /tips/:id` — o fã relê a própria gorjeta** (27/ago/2026). O PIX é
      assíncrono e, sem esta rota, o app mostrava o QR e nunca ficava sabendo do
      resultado. Só o dono lê (`ForbiddenException` caso contrário): o guard de
      rota prova quem é o usuário, não de quem é a gorjeta. Presenter próprio
      (`AudienceTipPresenter`), distinto do `TipPresenter` que serve a carteira
      do músico — nenhum dos dois expõe `pix_key`.

- [x] **`tip.confirmed` também vai para o FÃ.** Até aqui o `TipCompletedEvent` só
      notificava o músico; quem pagou não recebia nada. ⚠️ Num pedido com
      destaque este evento e `request.boost.paid` chegam os dois — o app
      deduplica por `tip_id`, e o payload mais rico ENRIQUECE o que já está na
      tela em vez de ser descartado (a ordem entre os dois handlers não é
      garantida).

- [x] Mensagem personalizada com a gorjeta  
       Código: tip.aggregate.ts ([19]).  
       Regra: mensagem opcional é persistida juntamente com a gorjeta.

- [~] Wall público de apoiadores  
  O dado necessário existe (`show_in_wall`, `is_anonymous` em `Tip`), porém não existe ainda agregado ou endpoint dedicado para construir e expor o “Wall de apoiadores”.

**Carteiras e transações**

- [x] Carteira financeira para músicos (MusicianWallet)  
       Código: musician-wallet.aggregate.ts ([20]).  
       Regras:
  - Cada músico possui uma `MusicianWallet` com `balance` (sacável), `held_balance` (cachê em custódia — espelho, fora do `balance`), `total_earned`, `total_withdrawn`, `pix_key` e o vínculo cifrado do Mercado Pago.
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
  - Gorjeta liquidada **na conta Mercado Pago do músico** (`settlement: "beneficiary"`) só cresce `total_earned` (`recordExternalEarning`) — o dinheiro já está com ele, e somar a `balance` ofereceria um saque que não existe. Só gorjeta liquidada na plataforma (`"platform"`, caminho do mock) credita `balance`. Gorjeta de banda é dividida entre os membros.
  - Gera transações secundárias para cada membro da banda em caso de split.

- [x] Saque do músico para PIX com validação de saldo  
       Código: withdraw-to-pix.use-case.ts ([22]).  
       Regras:
  - 🔴 **Usa só a chave PIX já cadastrada na carteira** — o corpo da requisição não traz chave (achado A1 da revisão de segurança de 28/ago/2026: aceitar a chave do corpo deixava quem roubasse a sessão sacar para a própria conta). Troca de chave tem carência de 24h (`PIX_KEY_CHANGE_COOLDOWN_HOURS`) e aviso por push/e-mail; há teto diário por plano e limite de 5 saques em 24h.
  - Exige e-mail confirmado (`EmailNotVerifiedError` → 403 `EMAIL_NOT_VERIFIED`), checado **antes** da reserva.
  - Verifica saldo suficiente em `MusicianWallet`.
  - Deduz o valor, cria `Transaction` de tipo `WITHDRAWAL` e retorna saldo atualizado.

- [x] 🔴 **Saque é RESERVA → PROVEDOR, nunca o contrário** (SM-023, 26/ago/2026)  
       Código: `withdraw-to-pix.use-case.ts`, `refund-failed-withdraw.use-case.ts`.  
       Regras:
  - **A ordem é o oposto da custódia.** Em `ReleaseBookingEscrowUseCase` o provedor
    vem primeiro (o dinheiro já está lá, nosso registro é espelho). No saque a
    transferência **cria** o fato e quem autoriza é o saldo que só nós conhecemos:
    o débito é persistido **antes** da chamada. Chamar o provedor antes de
    persistir deixava a janela inteira da chamada HTTP com o saldo antigo visível
    — dois saques simultâneos de R$110 sobre R$200 emitiam **duas transferências
    reais** e gravavam **um só débito**.
  - ✅ **As três barreiras foram verificadas contra Postgres real** em
    `test/payment/withdraw-concurrency.e2e-spec.ts` (26/ago/2026). Os testes
    unitários **não conseguem** prová-las: lá o `UnitOfWorkFakeInMemory` não abre
    transação e o repositório in-memory devolve a mesma instância do agregado —
    o que faz a segunda leitura enxergar o débito da primeira é a referência
    compartilhada, não o lock.
    🔴 Verificado por remoção deliberada do `FOR UPDATE`: sem ele, cinco saques
    concorrentes com saldo para dois são **todos aceitos**, cinco transferências
    reais são emitidas e o saldo cai só duas vezes (R$550 saindo, R$220
    debitados). ⚠️ O caso de **dois** concorrentes é flaky sem o lock (às vezes o
    escalonamento do Node os põe em fila e o teste passa com o código quebrado);
    quem dá a garantia determinística é o de cinco — não remova um achando que o
    outro cobre.
  - **Três barreiras, nenhuma substitui a outra:** o lock da carteira
    (`findByMusicianIdForUpdate`, `SELECT ... FOR UPDATE`) serializa execuções
    concorrentes; o saldo barra o segundo saque quando não há fundo para os dois;
    e a chave de idempotência do cliente (header `Idempotency-Key`, coluna
    `transactions.idempotencyKey` UNIQUE) cobre o duplo clique — o caso em que os
    dois pedidos são um só e o saldo sobra para ambos.
  - **O `insert` do lançamento vem ANTES do `update` da carteira.** As duas
    escritas estão na mesma transação, mas depender do rollback para não debitar
    é depender de uma garantia que some se alguém injetar um repositório sem
    UnitOfWork. Nesta ordem a colisão do UNIQUE aborta antes de tocar o saldo.
  - **Reenvio com a mesma chave e valor diferente é recusado** (`ConflictError`),
    e o re-despacho usa a chave PIX que a **reserva** registrou, não a do corpo
    atual: o dinheiro vai para onde o saque original mandou.
  - 🔴 **Recusa e silêncio do provedor não são a mesma coisa.** Só
    `PixWithdrawRejectedError` (400/401/403/422 — o provedor recusou
    conclusivamente) estorna. Timeout, 5xx e erro de rede **não** estornam: a
    transferência pode ter sido processada com a resposta perdida no caminho, e
    devolver o saldo aí reabriria o duplo pagamento pela porta dos fundos. O
    desempate é `findTransferByExternalReference` sobre a referência que nós
    mesmos geramos (`external_reference = transaction_id`); sem resposta, a
    transação fica `pending` para o webhook resolver.

- [x] 🔴 **`TRANSFER_FAILED` devolve o dinheiro à carteira** (SM-023, 26/ago/2026)  
       Código: `refund-failed-withdraw.use-case.ts`, `asaas-webhook.controller.ts`.  
       Regras:
  - Até 26/ago/2026 o webhook marcava a transação `failed` e **deixava o saldo
    debitado**: o provedor recusava, o dinheiro não chegava na conta do músico e
    também não voltava para a dele aqui — sumia, sem erro em lugar nenhum.
  - `refundWithdrawal` desfaz `withdrawFunds` por inteiro: devolve `balance` **e**
    reverte `total_withdrawn`, que é o número que o músico confere contra o
    próprio banco.
  - Idempotência dupla: `processOnce` barra a reentrega do evento; o `pending`
    conferido **sob o lock da carteira** barra a colisão com o caminho de recusa
    do próprio saque. Transação já `completed` nunca é estornada — seria devolver
    saldo sacável de dinheiro que já está com o músico.

- [x] 🔴 **Aritmética monetária em CENTAVOS INTEIROS — no `Money` VO** (26/ago/2026)  
       Código: `shared/domain/value-objects/money.vo.ts`.  
       Regras:
  - `add`, `subtract`, `multiply` e `divide` operam em centavos. **A imprecisão
    de ponto flutuante não degradava o valor: ela LANÇAVA**, porque o construtor
    recusa mais de duas casas decimais. `0.1 + 0.2` e `150.30 - 110` derrubavam a
    operação inteira com `InvalidMoneyError`, e são valores comuns — saldo com
    centavos é o normal de quem soma gorjetas.
  - O defeito ficou latente porque **o `Money` não tinha um único teste**. Agora
    tem 29.
  - 🔴 **`allocate(n)` é novo, e é a operação que `divide` não sabe fazer.**
    Reparte um valor em N quotas cuja soma é exatamente o original, distribuindo
    o resto de um centavo por vez. `divide` serve para "valor por unidade"
    (cachê por hora); repartir dinheiro entre pessoas com ele perde centavos.
  - Dois call sites estavam quebrados e foram corrigidos junto:
    - **`Transaction.create`** calculava `net_amount` como `amount - fee` em
      float cru. Um cachê de R$1.111,10 com 10% de comissão dava
      `999.9899999999999` e a transação nascia inválida — a confirmação do
      pagamento falhava com o dinheiro já aprovado no gateway.
    - 🔴 **O split de gorjeta entre membros de banda** usava
      `Math.floor(net / n)` sobre REAIS, tratando centavos como resto
      descartável. R$30,00 entre 4 dava **R$9 ao líder e R$7 a cada um dos
      outros** — o justo é R$7,50, e como a soma fechava em R$30 nada denunciava
      o desvio. R$18,20 entre 3 produzia `6.199999999999999` e derrubava a
      confirmação inteira. Hoje usa `allocate`.

- [x] **`MusicianWallet` expressa intenção, não mecânica** (26/ago/2026)  
       Código: `musician-wallet.aggregate.ts`.  
       Regras:
  - `Money.add`/`subtract` operam em ponto flutuante e o `Money` recusa mais de
    duas casas decimais — a imprecisão não degrada o valor, ela **lança**.
    `150.30 - 110` dá `40.30000000000001` e derrubava o saque inteiro com
    `InvalidMoneyError`. Saldo com centavos é o caso **normal** (gorjetas e cachês
    somados), não a exceção.
  - Vale para `receiveFunds`, `withdrawFunds`, `refundWithdrawal`,
    `recordExternalEarning`, `holdFunds`, `releaseHeldFunds` e `refundHeldFunds`.
    Todos voltaram a usar `balance.add(money)` / `subtract` depois que o `Money`
    foi corrigido — a mecânica de centavos mora no VO, não espalhada pelo
    agregado.
  - ✅ **Corrigido na raiz em 26/ago/2026** — ver "Aritmética monetária" abaixo.
    `Money.add`/`subtract` passaram a operar em centavos, e o agregado voltou a
    expressar intenção (`balance.add(money)`) em vez de mecânica de centavos.

**Monetização e planos**

- [x] Planos de assinatura para músicos e estabelecimentos (valores, limites, taxas diferenciadas)  
       Código: `src/core/plans/` completo — aggregate `Subscription` (com `BillingCycle` mensal/anual e `expires_at` auto-computado), `PlanCheckService`, `plan-features.config.ts` (`MUSICIAN_PLAN_FEATURES`/`ESTABLISHMENT_PLAN_FEATURES` + tabelas de pricing), validator, repositórios in-memory + Prisma, e 5 use-cases (`list-plans`, `get-active-subscription`, `create-subscription-checkout`, `activate-subscription-from-payment`, `cancel-subscription`).  
       Regras:
  - Cobrança recorrente real via `AsaasSubscriptionGateway` (`POST /v3/subscriptions`). `billingType: UNDEFINED` faz o Asaas gerar uma **fatura hospedada** (`invoiceUrl`) em que o pagador escolhe PIX/cartão/boleto — a plataforma **nunca** coleta dados de cartão.
  - Exposto em `src/nest-modules/plans-module/plans.controller.ts`: `GET /plans` (`@Public()`), `GET/POST/DELETE /musicians/:id/subscription[/checkout]` e `GET/POST/DELETE /establishments/:id/subscription[/checkout]`, todos com o ownership guard correspondente.
  - Taxas diferenciadas de gorjeta (9%/7%/5%) e config de saque por tier já aplicadas em `WithdrawToPixUseCase`.
  - ⚠️ **Enforcement é grant-at-action:** o gate é cobrado no momento da ação, nunca revalidado na leitura. Quem faz downgrade mantém o que já concedeu (link compartilhado, convite). Detalhado em [_privado/produto/planos-do-musico.md](../_privado/produto/planos-do-musico.md#️-enforcement-de-gates-ação-vs-leitura-ler-antes-de-mexer-em-qualquer-gate-de-plano).

- [x] Gorjeta com gateway PIX real — **Mercado Pago** (`MercadoPagoPixGateway`, Orders API). Sem `MERCADOPAGO_API_URL` o fallback é o `PixGatewayMock` (dev). Saque (`AsaasGatewayAdapter`) e assinatura (`AsaasSubscriptionGateway`) continuam no Asaas. Ver [decisoes-de-gateway.md](../_privado/pagamentos/decisoes-de-gateway.md).

---

## Gorjeta — Mercado Pago *(19/ago/2026)*
- [x] 🔴 **A gorjeta cai DIRETO na conta do músico.** A cobrança é criada na conta dele (OAuth, `POST /v1/orders`) e a comissão sai por `marketplace_fee` — a plataforma nunca detém esse dinheiro. Consequência: **gorjeta não tem saque pela SoundMeet**; ele saca no próprio Mercado Pago, e a carteira do app mostra a gorjeta como **extrato**.
- [x] **Sem conta vinculada o músico não recebe gorjeta** — não há para onde o valor ir. Por isso a UI trata o estado desconectado como aviso, não como sugestão.
- [x] 🔴 **`marketplace_fee` = percentual do plano MENOS a taxa do gateway.** No marketplace do MP a taxa dele sai do bruto **antes** da nossa comissão; pedir os 9% cheios debitaria 9,99% do músico num plano que anuncia 9%. A tabela de preços promete "(1% gateway incluso)" e o código cumpre: em R$20, `marketplace_fee` = R$1,60 e o total retido é R$1,80.
- [x] 🔴 **Gorjeta liquidada na conta do músico NÃO credita saldo sacável.** `ConfirmTipPaymentUseCase` exige `settlement: "beneficiary" | "platform"` (obrigatório, sem default); `"beneficiary"` chama `MusicianWallet.recordExternalEarning()`, que cresce `total_earned` **sem tocar `balance`**. Creditar `balance` criaria saldo sacável de dinheiro que a plataforma nunca recebeu — e o saque sai do caixa dela.
- [x] **Gorjeta de banda liquida na conta do LÍDER** (`SendTipUseCase.resolveBeneficiary`): banda não tem conta no provedor, o vínculo OAuth é sempre de uma pessoa. A **divisão** entre os integrantes continua na confirmação, sobre o registro — não no provedor.
- [x] **Comissão calculada em centavos** (`splitAmountInCents`) — 9% de R$333,33 em ponto flutuante dá 29,999700000000004, e o provedor recusaria (ou aceitaria com um centavo errado).
- [x] **Gorjeta de banda liquida na conta do LÍDER.** Banda não tem conta no provedor; `beneficiary_musician_id` vai nulo quando só há `band_id`. Mesma decisão de `buildContracted` no contrato.
- [x] **O `state` do OAuth é assinado (HMAC) e tem `purpose` próprio.** O callback chega pelo navegador sem Bearer token — sem a assinatura, qualquer um vincularia a própria conta de pagamento ao músico de outra pessoa; sem o `purpose`, um `state` do fluxo de agenda serviria aqui.
- [x] **O webhook lê o valor da API, nunca do corpo** (`x-signature` validada, fail-closed sem segredo, idempotente pelo `ProcessedEvent`). Confiar no corpo deixaria qualquer POST confirmar uma gorjeta de R$1.000.
- [x] **Token renovado com 15 dias de folga** sobre os 180. Deixar vencer custa reautorização manual — que o músico descobriria quando uma gorjeta falhasse, no palco.

## Custódia do cachê (escrow — F1.3a) *(19/ago/2026)*
- [x] 🔴 **O valor custodiado NÃO transita pelo patrimônio da plataforma.** Fica bloqueado na subconta do músico na instituição de pagamento; `MusicianWallet.held_balance` é **espelho**, não fonte. É o que a cláusula `papel_da_plataforma.com_custodia` afirma — o caminho do "saldo lógico numa conta nossa" foi recusado porque transformaria cláusula assinada em declaração falsa, além de ser custódia de recursos de terceiros (atividade regulada).
- [x] **Custódia não é saldo.** `held_balance` fica **fora** de `balance`: dinheiro retido não é sacável, e somá-lo faria o app oferecer um saque que o gateway recusaria.
- [x] **A comissão só é devida NA LIBERAÇÃO.** `platform_fee` é congelada na criação da custódia, mas só vira receita em `released`. Show não realizado, nenhuma comissão — é o argumento mais forte contra a tese de responsabilidade solidária, e a cláusula o afirma.
- [x] **`total_earned` só cresce na liberação** — é o momento em que o serviço foi prestado. Creditar na retenção anunciaria um ganho estornável.
- [x] **Estorno nunca passa pelo saldo:** o dinheiro nunca foi do músico, então `refundHeldFunds` só reduz o retido. Transitar por `balance` deixaria rastro de um ganho que não existiu.
- [x] **Liberar exige DUAS condições:** check-in registrado **e** ausência de contestação na janela. Só por prazo entregaria o cachê de um show que ninguém confirmou; com contestação aberta seria decidir a disputa por omissão (a mediação é humana de propósito).
- [x] **O prazo conta do FIM DO SHOW**, não da retenção — o pagamento é antecipado, e contar da retenção liberaria antes de o show acontecer para quem pagou cedo. **D+2 no plano pago, D+5 no FREE** (`escrow_release_days`). É prazo, não gate: ninguém é bloqueado.
- [x] **Divisão em centavos inteiros** (`splitAmount`), garantindo `platform_fee + net_amount === amount` exatamente. Centavo perdido em arredondamento é centavo que ninguém recebe.
- [x] **Ordem obrigatória na liberação:** provedor → custódia → carteira. Marcar antes de o provedor confirmar anunciaria um saldo que o gateway recusa a sacar.
- [x] **Idempotente ponta a ponta:** `bookingId` é `@unique`, `markHeld` com a mesma referência é no-op, `release` repetido é no-op. Job e webhook podem chegar os dois — pagar duas vezes o mesmo show não é uma opção.
- [x] 🔴 **A `apiKey` da subconta é cifrada em repouso** (infra de SM-016) e **nunca sai em `toJSON`**. Ela move dinheiro dentro da subconta, e o provedor só a entrega uma vez, na criação — perder é ter de recriar a subconta.
- [x] **Desabilitar a Conta Escrow LIBERA tudo que está sob garantia**, então o agregado recusa desabilitar com saldo retido: seria trocar R$9,90/mês por um pagamento antecipado de shows que talvez não tenham acontecido.

### Fatia HTTP e webhooks *(21/ago/2026)*

> Documentado retroativamente em 22/ago/2026 — o código foi entregue em 21/ago sem passar por
> aqui, e a seção anterior ainda dizia "faltam as rotas HTTP e os webhooks".

- [x] **A criação é disparada por evento, não por rota.** `CreateBookingEscrowUseCase` roda no
      `BookingConfirmedEvent` — o mesmo que emite o contrato. Não existe "criar custódia" por HTTP:
      custódia sem show confirmado não tem o que garantir.
- [x] **Ordem de criação: persistir `pending` → cobrar no provedor → gravar a referência.** O
      `externalReference` da cobrança é o próprio `escrow_id`, então o registro precisa existir
      antes da cobrança — senão o webhook do pagamento chega antes daquilo que ele referencia.
      Falhar no meio deixa uma custódia `pending` sem cobrança: reexecutável e inofensiva, porque
      ninguém foi cobrado. O inverso deixaria dinheiro bloqueado sem registro local para liberar.
- [x] 🔴 **`findChargeByReference` antes de criar.** Entre o provedor aceitar a cobrança e nós
      gravarmos o `external_id` existe uma janela; sem essa consulta, uma reexecução emitiria um
      **segundo PIX** para o mesmo show.
- [x] **`GET /musicians/:id/wallet/escrow`** é a **única** rota da feature — extrato somente-leitura,
      com `MusicianOwnershipGuard`. A referência da cobrança no provedor não é exposta.
- [x] 🔴 **Não existe rota para reter, liberar ou estornar.** Quem retém é o webhook (o único que
      sabe que o dinheiro entrou); quem libera é o job (depois de conferir check-in e prazo). Expor
      liberação por HTTP transformaria as salvaguardas do `ReleaseBookingEscrowUseCase` em
      formalidade — bastaria chamar a rota.
- [x] **Branch de escrow no `AsaasWebhookController`**, identificado pelo prefixo `escrow:` no
      `externalReference` e avaliado **antes** do caminho de gorjeta (que trata qualquer referência
      restante como UUID de tip).
- [x] 🔴 **O valor vem do NOSSO registro, nunca do corpo do webhook.** `MarkBookingEscrowHeldUseCase`
      retém o `net_amount` congelado na criação; `payment.value` não é lido. Confiar no corpo
      deixaria um POST forjado inflar o `held_balance` de qualquer músico.
- [x] **Custódia e carteira mudam dentro de `UnitOfWork`** (`markHeld` e `release`). Sem transação,
      uma falha entre os dois updates deixava `held_balance` errado **permanentemente** — a
      reexecução retornava cedo por idempotência e nunca corrigia.
- [x] **Guarda de estado antes de chamar o provedor**, e custódia em mediação não sai pela liberação
      automática. `expires_at: null` (garantia inativa) vira log de erro, não silêncio.
- [x] **`booking_fee_percentage` mora em `plan-features.config.ts`**, ao lado de
      `tip_fee_percentage` — 10% nos três tiers hoje, variável por tier sem tocar código de domínio.

## Check-in da apresentação *(19/ago/2026)*
- [x] **Vale por si como prova de execução do serviço** (camada 3 contra chargeback), com ou sem escrow.
- [x] **A hora é do SERVIDOR**, nunca do corpo — este registro existe para provar *quando* algo aconteceu.
- [x] Só em booking **confirmado**, e **não antes do início do show** (declarar fato futuro não prova nada). Depois do fim é aceito: o músico registra ao descer do palco.
- [x] **O estabelecimento também pode registrar** — é a contraparte confirmando, prova ainda mais forte a favor do artista. O campo `checked_in_by` guarda qual lado declarou.
- [x] Idempotente: o primeiro registro é o que vale. Sobrescrever permitiria "ajustar" o horário do fato depois.
- [x] **A contestação NÃO exige check-in prévio** — "o artista não apareceu" é justamente a contestação em que ele não existe.
- [x] 🔴 **Só o CONTRATANTE contesta** (`POST /scheduling/bookings/:id/dispute`, `@Roles("establishment","admin")`). Contestar é dizer "o serviço não foi entregue como combinado" — deixar o artista fazer isso seria deixá-lo travar o próprio pagamento. A checagem **não** é `assertNegotiationParticipant` (que aceita qualquer lado) e é fail-closed sobre lista de identidades vazia.
- [x] **`POST /scheduling/bookings/:id/check-in` aceita as duas partes**, e `checked_in_by` registra qual lado declarou (`band` quando o show é de banda, exigindo o líder).
- [x] **`scheduling` não conhece `payment`.** Marcar o booking já basta para bloquear a liberação automática (`ProcessDueEscrowReleasesUseCase` confere `booking.isDisputed`); congelar o agregado `BookingEscrow` é ato da mediação.

[4]: ../../src/core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case.ts
[19]: ../../src/core/payment/domain/tip.aggregate.ts
[20]: ../../src/core/payment/domain/musician-wallet.aggregate.ts
[21]: ../../src/core/payment/domain/transaction.aggregate.ts
[22]: ../../src/core/payment/application/use-cases/withdraw-to-pix/withdraw-to-pix.use-case.ts