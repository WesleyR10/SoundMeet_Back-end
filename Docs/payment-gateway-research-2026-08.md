# Pesquisa de gateways PIX — qual usar em cada vértice

**Data:** 19/ago/2026 (2ª rodada, com o critério de **conta de teste self-service**)
**Pedido por:** decisão de produto, antes de escrever o F1.0 (subconta por músico)
**Estado:** decisão fechada — Mercado Pago na gorjeta, Asaas no cachê/assinatura/saque.
**Não reabrir Iugu nem Woovi.**
**Complementa:** [payment-gateway-decisions.md](payment-gateway-decisions.md), que decidiu a
arquitetura (subconta + split) mas fixou os gateways antes destes números existirem.

---

## Por que esta pesquisa existe

Quando o Asaas foi escolhido, a taxa PIX era **R$0,99 fixos** — em cima de uma gorjeta de R$20 isso
era 5%, e fechava a conta. **Hoje a taxa é R$1,99** (R$0,99 virou só a promoção de 3 meses para
conta nova). O dobro, num vértice cujo ticket é R$5–60, não é ajuste de margem: é a diferença entre
o produto ter margem e não ter.

A Iugu, que seria o gateway da gorjeta, **não liberou a conta**. Daí o critério novo e inegociável
desta rodada: **precisa dar para criar conta e testar sozinho**, sem passar por aprovação comercial.

---

## 1. 🔴 O achado que decide — e não é preço

**Nem toda "subconta" é uma conta.** Esta é a diferença que separa os candidatos, e ela é
regulatória, não comercial:

| Provedor | O que a "subconta" É, de fato |
|---|---|
| **Asaas** | **Conta real** na instituição de pagamento, aberta com o CPF/CNPJ do músico, com KYC próprio e `apiKey` própria. O dinheiro é **dele**, juridicamente |
| **Woovi/OpenPix** | 🔴 **Saldo virtual dentro da conta da plataforma.** A doc é literal: *"o valor do split não será debitado da conta de origem pois transações de split para sub contas são **transações virtuais**, somente será debitado da conta de origem o valor integral do saldo da sub conta **no momento do saque**"*. Só exige uma chave PIX — **sem KYC do beneficiário** |
| **Mercado Pago** | **Conta própria do músico** no MP, vinculada por OAuth. O dinheiro é dele |

**Por que isso decide:** a cláusula `papel_da_plataforma.com_custodia` — já escrita, testada e
assinável — **afirma** que o valor custodiado não integra o patrimônio da SoundMeet. Com a subconta
virtual da Woovi, o dinheiro fica na nossa conta até o saque. Isso é exatamente o **caminho (i)
(ledger interno)** recusado em `payment-gateway-decisions.md`: custódia de recursos de terceiros
(atividade regulada) **e** uma cláusula assinada que passaria a ser declaração falsa.

> A Woovi é ótima e barata. Só não é um lugar onde o dinheiro do músico possa **esperar**.

---

## 2. Comparativo

| Provedor | PIX recebido | Subconta real? | Escrow formal | Assinatura cartão | PIX out | Conta self-service |
|---|---|---|---|---|---|---|
| **Asaas** | ❌ **R$1,99 fixo** | ✅ | ✅ **único do mercado** | ✅ | ✅ | ✅ |
| **Mercado Pago** | ✅ **0,99%, sem piso** | ✅ (OAuth) | ❌ | ✅ | ✅ | ✅ |
| **Woovi/OpenPix** | ✅ 0,8% (mín R$0,50 · máx R$5) | 🔴 **não — saldo virtual** | ❌ | ❌ **só PIX** | ✅ (grátis ≥ R$500) | ✅ |
| **Pagar.me / Stone** | negociada | ✅ recebedores | ❌ | ✅ | ✅ | ❌ **exige proposta comercial** |
| **Efí (Gerencianet)** | 1,19% | ❌ não cria por API | ❌ | ✅ | ✅ | ⚠️ split limitado a **20 contas** |
| **Stripe** | 1,19% | ✅ Connect | ❌ | ✅ | ✅ | ❌ **PIX é invite-only no BR** (exige 60 dias de processamento prévio) |
| **AbacatePay** | ❌ R$0,80 fixo | ❌ split **em desenvolvimento** | ❌ | ✅ (3,5% + R$0,60) | ? | ✅ |
| ~~Iugu~~ | 0,99% | ✅ | ❌ | ✅ | ✅ | ❌ **conta não liberada** |

**Três eliminações imediatas:** Efí (split teto de 20 contas — inviável para marketplace),
Stripe (PIX invite-only mata o "criar conta e testar"), Pagar.me (taxa só por proposta comercial).
AbacatePay tem a melhor DX da lista, mas split ainda não existe.

### O que a gorjeta custa em cada um (plano FREE, taxa da plataforma 9%)

| Gorjeta | Asaas R$1,99 | Woovi (mín R$0,50) | Mercado Pago 0,99% |
|---|---|---|---|
| R$ 5 | **− R$ 1,54** | − R$ 0,05 | **+ R$ 0,40** |
| R$ 10 | **− R$ 1,09** | + R$ 0,40 | + R$ 0,80 |
| R$ 20 | **− R$ 0,19** | + R$ 1,30 | + R$ 1,60 |
| R$ 50 | + R$ 2,51 | + R$ 4,00 | + R$ 4,00 |
| R$ 100 | + R$ 7,01 | + R$ 8,20 | + R$ 8,01 |

**Ponto de equilíbrio:** Asaas **R$22 (FREE) / R$40 (PRO)** · Woovi **R$5,56 / R$10** ·
Mercado Pago **qualquer valor** (é percentual puro, sem piso).

### E no cachê (R$200–5.000), onde a conta se inverte

| Cachê | Asaas R$1,99 | % | Mercado Pago 0,99% | Woovi (teto R$5) |
|---|---|---|---|---|
| R$ 200 | R$ 1,99 | 1,00% | R$ 1,98 | R$ 1,60 |
| R$ 1.500 | R$ 1,99 | 0,13% | R$ 14,85 | R$ 5,00 |
| R$ 5.000 | R$ 1,99 | **0,04%** | R$ 49,50 | R$ 5,00 |

**A taxa fixa que destrói a gorjeta é a melhor coisa possível para o cachê.** Num show de R$5.000 o
Asaas custa R$1,99 e o Mercado Pago R$49,50 — 25× mais.

---

## 3. Recomendação

**Não existe um provedor que cubra bem os quatro vértices, e o motivo é estrutural:** a gorjeta
precisa de taxa **percentual** sobre ticket minúsculo, e o cachê precisa de um **produto de custódia
regulado** que só uma IP completa oferece. Nenhum provedor otimiza os dois.

| Vértice | Provedor | Por quê |
|---|---|---|
| **Gorjeta** | **Mercado Pago** (✅ decidido 19/ago) | 0,99% **sem piso**, dinheiro na hora — viável até em gorjeta de R$5, que é o ticket de impulso. O dinheiro cai na conta do próprio músico: postura regulatória correta. **Sem rotear por valor** — ver abaixo |
| **Cachê + escrow** | **Asaas** | R$1,99 fixos são 0,04–1% do ticket, **e é o único com Conta Escrow formal por API**. Já integrado |
| **Assinatura** | **Asaas** | Já funciona (`AsaasSubscriptionGateway`) |
| **Saque PIX** | **Asaas** | Já funciona (`AsaasGatewayAdapter`) |

**Isso é exatamente o "rotear por vértice" que `PaymentService` já foi desenhado para fazer**, e as
portas do F1.3a (`IPixGateway`, `IBookingEscrowGateway`, `ISubaccountGateway`) tornam a adição do
Mercado Pago um adapter novo — nenhuma mudança de domínio.

### ❓ "E rotear a gorjeta por VALOR — MP no ticket baixo, Asaas no alto?"

Pergunta certa, e a conta é fechada: **o cruzamento é R$201,01** (0,99% × 201,01 = R$1,99). Só
acima disso o Asaas fica mais barato numa gorjeta.

| Gorjeta | MP 0,99% | Asaas R$1,99 | Economia do Asaas |
|---|---|---|---|
| R$ 100 | R$ 0,99 | R$ 1,99 | — (MP ganha) |
| R$ 201 | R$ 1,99 | R$ 1,99 | empate |
| R$ 300 | R$ 2,97 | R$ 1,99 | R$ 0,98 |
| R$ 500 | R$ 4,95 | R$ 1,99 | R$ 2,96 |

**Recomendação: não rotear por valor.** O ticket de gorjeta é R$5–100; acima de R$201 é evento raro,
e a economia é de centavos. O que se paga por ela é caro e permanente:

- **Onboarding dobrado.** O músico teria de vincular o MP **e** ter subconta Asaas antes da primeira
  gorjeta — dois KYC no exato momento da monetização, que é onde a conversão morre.
- **Dois saldos em dois lugares.** A "Carteira SoundMeet" passaria a agregar MP + Asaas, e o saque
  teria dois caminhos. É a parte mais sensível do produto ganhando um estado a mais.
- **Dois webhooks, duas reconciliações, dois modos de falha** — para economizar menos de R$1 numa
  gorjeta que quase não acontece.

**O Asaas continua necessário, mas por menos coisas:** cachê + escrow (único com Conta Escrow
formal, e é o que a cláusula assinada exige) e assinatura (já funciona). Não por causa da gorjeta.

### 🔑 O que isso simplifica: onboarding em DOIS tempos

Com a gorjeta no MP, a subconta Asaas deixa de ser pré-requisito para monetizar:

| Momento | O que o músico faz | Para quê |
|---|---|---|
| **Dia 1** | Conecta a conta Mercado Pago (OAuth, um toque) | Já recebe gorjeta |
| **1º show contratado** | Abre a subconta Asaas (KYC completo) | Cachê em custódia |

Isso também **contorna o período de avaliação do Asaas** (10 subcontas / R$2.000 nos 60 dias
iniciais): ele passa a limitar só quem tem show contratado, não quem quer receber gorjeta.

### ⚠️ A consequência que muda o produto, e precisa ser dita

Com split no MP, a gorjeta cai **direto na conta do músico**, na hora. Isso é a postura regulatória
correta — a plataforma nunca detém recurso dele — mas significa que **não existe "saque de gorjeta"
pela SoundMeet**: ele saca no próprio Mercado Pago.

A `WalletScreen` do app precisa mudar de **saldo** para **extrato** na parte de gorjetas ("R$X
recebidos este mês, direto na sua conta MP"). O saldo sacável pela plataforma passa a ser só o do
**cachê liberado** da custódia Asaas. Não é perda de feature — é parar de anunciar um saldo que
juridicamente nunca foi nosso para segurar.

### O custo do Mercado Pago, dito com honestidade

O músico precisa **ter (ou criar) uma conta Mercado Pago** e autorizar a SoundMeet uma vez, por
OAuth. Não é subconta white-label como no Asaas.

- **A favor:** a maioria dos músicos brasileiros já tem MP; o dinheiro é dele desde o primeiro
  segundo; e o KYC é problema do MP, não nosso.
- **Contra:** um passo a mais no onboarding, no momento exato da monetização.
- **O prazo de 180 dias do token NÃO é fricção recorrente:** com `scope=offline_access` +
  `refresh_token`, a renovação é feita pelo servidor **sem interação do usuário**. Só precisa de um
  job que renove antes de vencer — se deixar vencer, aí sim o músico refaz a autorização.

### Se você quiser MESMO um só provedor

**Fique no Asaas e suba a gorjeta mínima para R$25.** É defensável, mas muda o produto: gorjeta de
bar é impulso de R$5–20, e R$25 desloca o comportamento para "presente", não "aplauso". A conta
fecha; o volume, provavelmente, não.

---

## 4. Restrições operacionais do Asaas (valem em qualquer cenário)

Levantadas da documentação oficial, e **nenhuma estava registrada** antes:

- 🔴 **Conta Escrow custa R$99,90/mês na conta principal + R$9,90 por subconta habilitada.**
  **Mitigação obrigatória:** habilitar só para o músico com booking ativo, e desabilitar depois —
  ⚠️ a doc avisa que desabilitar **libera imediatamente tudo que está sob garantia**, então a ordem
  importa. (O agregado `MusicianWallet` já recusa desabilitar com saldo retido.)
- 🔴 **`apiKey` da subconta só existe na criação e não pode ser recuperada.** Já implementado
  cifrado em repouso (infra de SM-016).
- 🔴 **Período de avaliação de 60 dias:** máximo **10 subcontas** e **R$2.000 em cobranças por
  subconta**. Isso define o tamanho do piloto.
- **Conta PF não cria subconta** — a SoundMeet precisa estar como PJ.
- `daysToExpire` faz a liberação automática na expiração, casando com o D+2/D+5 já implementado. O
  `EscrowReleaseJob` cobre a liberação **antecipada** e a contestação.

---

## 5. O que fica pendente de você

- [ ] **Escolher:** dois provedores (recomendado) · só Asaas com gorjeta mínima de R$25
- [ ] Se dois: criar conta Mercado Pago e pegar as credenciais de teste (imediato, self-service)
- [ ] Confirmar o piso da gorjeta — hoje o domínio aceita **R$1**, e não existe piso em `send-tip`
- [ ] Confirmar que a conta Asaas é PJ e que o KYC do escrow saiu

---

## Fontes

- [Preços e taxas Asaas](https://www.asaas.com/precos-e-taxas) · [Pix Asaas](https://blog.asaas.com/pix-asaas/)
- [Asaas — Conta Escrow](https://docs.asaas.com/docs/introducao-conta-escrow) · [Habilitar para subcontas](https://docs.asaas.com/docs/habilitando-a-conta-escrow-para-as-subcontas) · [Criação de subcontas](https://docs.asaas.com/docs/criacao-de-subcontas)
- [Woovi — taxa cobrada](https://developers.openpix.com.br/en/docs/pix-machine/what-is-the-fee-charged-by-woovi) · [Planos e preços](https://woovi.com/planos-e-precos/) · 🔴 [Split para subconta é transação VIRTUAL](https://developers.woovi.com/en/docs/charge/how-to-create-charge-with-split-to-subbaccount-using-api)
- [Mercado Pago — custo de receber via Pix](https://www.mercadopago.com.br/blog/quanto-custa-receber-pagamentos-via-pix-e-codigo-qr) · [Split/marketplace](https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/how-tos/integrate-marketplace.md) · [Renovar Access Token (OAuth)](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/additional-content/security/oauth/renewal)
- [Efí — split Pix (máx. 20 contas)](https://dev.efipay.com.br/en/docs/api-pix/split-de-pagamento-pix/) · [Subcontas não são criadas por API](https://comunidade.sejaefi.com.br/discussao/split-pix-criacao-subcontas-59)
- [Stripe — Pix (convidados, no BR)](https://stripe.com/br/payment-method/pix) · [Connect pricing](https://stripe.com/connect/pricing)
- [AbacatePay — marketplaces (split em desenvolvimento)](https://www.abacatepay.com/para/marketplaces) · [Assinaturas](https://www.abacatepay.com/assinaturas)
- [Pagar.me — preços (sob proposta)](https://pagar.me/precos)
