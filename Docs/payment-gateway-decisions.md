# Decisões de Arquitetura de Pagamentos — SoundMeet

**Sessão:** 2026-06-22 (gateway da gorjeta redecidido em 19/ago/2026; Iugu removida em 21/ago/2026)  
**Blocos relacionados:** Roadmap 1.6 e 1.7  
**Status:** Decisões core finalizadas. Gorjeta = Mercado Pago. Cachê/assinatura/saque = Asaas.

---

> 🔴 **LEIA ANTES: [payment-gateway-research-2026-08.md](payment-gateway-research-2026-08.md)**
> (19/ago/2026). **Não usar Iugu nem Woovi/OpenPix.** A Iugu não liberou a conta. A Woovi foi
> descartada por motivo regulatório (subconta = saldo virtual na conta da plataforma). Trocar a
> gorjeta pelo Asaas **também não é inócuo**: a taxa PIX dele é **R$1,99 FIXOS**, e num ticket de
> R$5–60 o ponto de equilíbrio vai para **R$22 (FREE) / R$40 (PRO)**. O Mercado Pago cobra **0,99%
> sem piso**, a cobrança nasce na conta do músico (OAuth + `marketplace_fee`), e a plataforma nunca
> detém o recurso. Roteamento é **por vértice, nunca por valor**.

## ⚖️ Por que o dinheiro NUNCA passa pela conta da SoundMeet

Vale explicitar, porque é a pergunta que sempre volta: *"não dá para receber na nossa conta e
repassar automático?"*

**Não, e o problema não é o tempo de retenção — é a titularidade no caminho.** Receber recurso de
terceiro e depois transferir, ainda que em segundos, é a descrição da atividade de **subadquirente /
facilitador de pagamento**, que torna a plataforma participante de arranjo de pagamento sujeita ao
BACEN (Circular 3.815/2016).

E há o risco concreto, não só o formal: pelo art. 12 da Lei 12.865/2013, recursos em conta de
pagamento **não se confundem com o patrimônio da instituição** e não respondem por obrigações dela.
Se o dinheiro do músico transitasse pela nossa conta, ele ficaria exposto a penhora numa ação contra
a SoundMeet, a bloqueio judicial e à nossa eventual falência.

Por isso os dois vértices usam a mesma estrutura, com provedores diferentes:

| Vértice | Onde o dinheiro cai | Como cobramos |
|---|---|---|
| **Gorjeta** | Conta Mercado Pago **do músico** (cobrança criada com o token dele) | `application_fee` no split |
| **Cachê** | **Subconta Asaas do músico**, bloqueada em custódia | comissão retida na liberação |

Em nenhum dos dois há repasse — há **divisão na liquidação**. É também o que as cláusulas
`papel_da_plataforma.com_custodia` e `custodia_liberacao`, já assináveis, **afirmam**: um extrato
mostrando o dinheiro passando por nós tornaria falso um contrato assinado.

🔴 **Pendente de confirmação jurídica** — as perguntas estão em
[contract/legal-checklist.md](contract/legal-checklist.md) §10, nas seções "Antes do escrow" e
"Antes da gorjeta em produção".

---

## Premissa fundamental ✅

PIX **não vai direto** ao músico. O modelo é **marketplace com subconta** (estilo Shopee / Mercado Livre):

```
Público paga QR → Gateway recebe → Split automático imediato
  ├── X% → subconta do músico (saldo "Carteira SoundMeet")
  └── Y% → conta SoundMeet (comissão, descontada no split — zero transação extra)

Músico acumula saldo no app. Solicita saque quando quiser → PIX out para conta bancária.
```

Cada músico tem uma **subconta digital white-labeled** no gateway. Ele interage apenas com a UI SoundMeet. A subconta é criada via API no cadastro do músico.

Este modelo resolve:
- Cobrança da taxa da plataforma: descontada no split (sem transação separada)
- Split de gorjeta (MVP: vai para o dono da banda — ele distribui manualmente)
- Saldo acumulado sem PIX out a cada gorjeta recebida
- Conformidade BACEN: fundos ficam na IP autorizada, não na conta SoundMeet

---

## Os 4 Vértices de Pagamento ✅

| Vértice | Quem paga | Para quem | Ticket | Método | Requisito crítico |
|---------|-----------|-----------|--------|--------|-------------------|
| **Gorjeta** | Público | Músico via plataforma | R$ 5–100 | PIX | Taxa mínima, split no recebimento |
| **Cachê de show** | Estabelecimento | Músico via plataforma | R$ 200–5.000 | PIX ou Cartão (até 5x) | Escrow até validação pós-show |
| **Assinatura** | Músico / Estabelecimento | Plataforma | R$ 39–599/mês | Cartão (default) / PIX manual | Recorrência, retry, dunning |
| **Saque** | Subconta músico | Conta bancária músico | Variável | PIX (sempre) | Instantâneo, R$2 de taxa visível |

---

## Arquitetura de Gateways ✅

### Padrão: Interface + Adapters por vértice

```
IPixGateway (interface de domínio)
  ├── MercadoPagoPixGateway   → gorjetas (0,99% sem piso, conta do músico via OAuth)
  └── PixGatewayMock          → fallback de desenvolvimento

IBookingEscrowGateway / ISubaccountGateway / IPixWithdrawGateway
  └── Asaas*Adapter           → cachê + escrow + assinaturas + saques
```

`PaymentService` roteia por tipo de transação:
- `tip_payment`            → `MercadoPagoPixGateway`
- `booking_payment`        → `AsaasGatewayAdapter`
- `subscription_payment`   → `AsaasGatewayAdapter`
- `musician_withdrawal`    → `AsaasGatewayAdapter` (PIX out da subconta)

Não há adapter Iugu nem OpenPix no código, e não vai haver: a Iugu não liberou a conta; a Woovi/
OpenPix foi descartada porque a "subconta" é saldo virtual na conta da plataforma (caminho
regulatório recusado). Não reabrir.

---

## Decisões por Vértice

### Gorjetas ✅ *(gateway redecidido em 19/ago/2026)*

- **Gateway: Mercado Pago** — 0,99% **sem piso**, dinheiro na hora. O Asaas **não serve aqui**: a
  taxa que era R$0,99 fixos quando ele foi escolhido virou **R$1,99**, e taxa fixa sobre ticket de
  R$5–60 dá prejuízo abaixo de R$22 (plano FREE)
- **A cobrança é criada na conta DO MÚSICO** (OAuth, `POST /v1/orders`) e a comissão sai por
  `marketplace_fee` — a plataforma nunca detém recurso de terceiro, mesma postura da subconta Asaas
- ⚠️ **Não rotear por VALOR.** O cruzamento MP × Asaas é R$201; o ticket é R$5–100, e acima disso a
  economia é de centavos — contra onboarding dobrado e dois saldos em dois lugares
- 🔴 **A Woovi/OpenPix foi descartada apesar de ser a mais barata:** a "subconta" dela é **saldo
  virtual dentro da conta da plataforma** (a doc é literal: *"transações de split para sub contas são
  transações virtuais"*), sem KYC do beneficiário. É o caminho (i) recusado abaixo, e tornaria falsa
  a cláusula `papel_da_plataforma.com_custodia`
- **Consequência de produto:** gorjeta não tem "saque pela plataforma" — o músico saca no próprio MP,
  e a carteira do app vira **extrato** nessa parte. O saldo sacável pela SoundMeet passa a ser só o
  cachê liberado da custódia
- **Método:** PIX QR Code gerado pela plataforma (não chave pessoal do músico)
- **Split:** no recebimento — comissão (3-8% conforme plano) já separada automaticamente
- **Banda:** gorjeta vai para o dono da banda no MVP — ele distribui manualmente
- **Saldo:** acumula na subconta (músico saca quando quiser)

### Cachê de Show ✅

**Pagamento do estabelecimento:**
- PIX: integral, imediato, entra direto em escrow
- Cartão de crédito: até **5 parcelas** — gateway adianta o bruto, escrow retém
- PIX parcelado: **não existe** — parcela é sempre cartão
- **Prazo para pagar:** até **48h antes do show** — não pagar = booking cancelado automaticamente
- **Split no escrow:** 90% músico / 10% SoundMeet (descontado já na entrada)

**Política de cancelamento:**
| Quem cancela | Quando | Consequência |
|---|---|---|
| Músico | >72h antes | Reembolso 100% ao estabelecimento |
| Músico | <72h antes | 50% ao estabelecimento, 50% SoundMeet (penalidade) |
| Estabelecimento | >72h antes | Reembolso 100% ao músico |
| Estabelecimento | <72h antes | Músico retém kill fee (% a definir — sugestão: 30%) |

**Holdback (escrow → liberação):**
- Músico verificado (plano pago): **D+2 após o show**
- Músico não verificado: **D+5 após o show**
- Janela de disputa: **24h após o show**
- Sem disputa em 24h → liberação automática via API do gateway

**Validação para liberar — modelo híbrido:**
1. Músico faz **check-in no app** (confirma presença)
2. **24h** sem disputa aberta pelo estabelecimento
3. → SoundMeet chama endpoint de liberação do Asaas
4. Disputa aberta dentro de 24h → **freeze + mediação manual**

**Gateway:** Asaas (único BR com conta escrow formal via API)

**No contrato** *(alinhado em 15/ago/2026)*: este fluxo está redigido nas cláusulas
`cache_pagamento.com_custodia` e `custodia_liberacao` — pagamento integral antecipado, custódia em
instituição de pagamento, liberação condicionada ao registro da apresentação e ao decurso do prazo
de contestação, com **liberação automática** se o estabelecimento não se manifestar. A redação
anterior descrevia um **sinal parcial**, que nunca foi o modelo acordado aqui.

⚠️ **Os números desta seção não entram no texto das cláusulas** — nem o percentual da comissão, nem
D+2/D+5, nem as 48h, nem as 24h. As cláusulas remetem ao que foi "informado às partes e vigente na
data de emissão deste instrumento". É o que permite reajustar taxa e prazo sem abrir `show-v2`, e a
âncora de data é o que impede a mudança alcançar um show já assinado. Mudar qualquer número aqui,
portanto, **não** exige tocar no catálogo de cláusulas — mas exige que a UI de fato informe o valor
ao músico antes do aceite, porque é essa informação que a cláusula pressupõe.

### Assinaturas ✅

- **Default:** Cartão de crédito recorrente (débito automático mensal)
- **Alternativa:** PIX manual on-demand (plataforma gera QR a cada vencimento, usuário paga, acesso renovado 30 dias)
- **PIX Automático:** NÃO usar — custo de R$2,50–3,50/transação inviável para planos de R$39,90
- **Inadimplência cartão:** retry automático → falha → notifica "tente novamente ou pague via PIX"
- **Inadimplência PIX:** sem pagamento → corte imediato de benefícios premium
- **Gateway:** Asaas

### Saque do Músico ✅

- **Método:** PIX (sempre) — instantâneo 24/7, mais barato que TED
- **TED descartado:** R$5,00 e horário bancário — pior em custo e experiência
- **Taxa apresentada no app:** **R$ 2,00 de taxa de saque** (cobre o custo de PIX out do gateway = R$1,99 Asaas)
- **Modelo:** músico acumula saldo → solicita saque → vê "Taxa: R$2,00" → confirma → PIX enviado
- **Benefício do saldo acumulado:** plataforma só paga PIX out quando músico saca (não a cada gorjeta recebida)

---

## Proteção contra Chargeback ✅

### Tipos de chargeback e como proteger

| Tipo | Descrição | Proteção |
|------|-----------|---------|
| **Fraude real** | Cartão clonado/roubado | KYC B2B + improvável com CNPJ estabelecido |
| **"Não reconheço"** | CFO vê fatura e não sabe o que é | Contrato + statement descriptor + evidências |
| **Serviço não entregue** | Show não aconteceu | Check-in músico + scan estabelecimento |

### Camadas de proteção implementadas

1. **Contrato digital no booking** ✅ *(Bloco 10, ago/2026)* — emitido automaticamente no `BookingConfirmedEvent`, com dados completos (data, horário, duração, valor, músico/banda, local e Ficha Técnica como anexo). Assinatura das duas partes com **conta autenticada + aceite explícito + IP + timestamp + user-agent + hash SHA-256** do conteúdo congelado, e página pública de verificação por código. PDF disponível por rota autorizada. ⚠️ O **envio por e-mail com o PDF anexo ainda não existe** — ver camada 4. Detalhe em [contract/contract-digital.md](contract/contract-digital.md).

2. **Statement descriptor configurado no gateway** — fatura do estabelecimento mostra `"SoundMeet - [Nome Músico] DD/MM"` em vez de código genérico. Elimina 80% dos "não reconheço" antes de virar disputa.

3. **Check-in do músico + scan do estabelecimento** — prova documental de execução do serviço (já planejado no domínio).

4. **E-mail com o contrato e o hash** ✅ *(15/ago/2026)* — enviado às duas partes na emissão e quando a segunda assinatura fecha o contrato, com o **PDF anexo** e o resumo SHA-256 no corpo. Trail documental independente: fica na caixa de cada parte, fora do nosso storage e do nosso banco. Reenvio manual em `POST /contracts/:id/document/send`. ⚠️ O e-mail de confirmação **de pagamento** segue pendente — depende do escrow.

5. **Reserva de chargeback** — reter parte da comissão (10%) por 45 dias como buffer. Para shows >R$500, avaliar "Seguro de Transação" Asaas (2% sobre valor).

### Processo de defesa em disputa

Se chargeback aberto → gateway notifica → **20 dias para enviar evidências**:
- Contrato digital assinado
- Check-in músico + scan estabelecimento  
- E-mail de confirmação
- Statement descriptor como identificação

Com essas evidências, vitória na disputa é praticamente garantida para o cenário "não reconheço" em contexto B2B.

---

## Riscos Residuais (monitorar)

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Custo escrow Asaas em escala | ✅ **confirmado na documentação (19/ago/2026):** R$99,90/mês na conta principal **+ R$9,90 por subconta habilitada** → R$10k/mês com 1k músicos | Habilitar escrow só para músicos com booking ativo e desabilitar depois — ⚠️ desabilitar **libera todos os valores ainda sob garantia**, então a ordem importa. Negociar enterprise antes de 300 músicos |
| Reforma tributária 2027 | LC 214/2025: split fiscal IBS/CBS obrigatório | Confirmar suporte com Asaas/Mercado Pago no contrato |
| Fraude real (cartão roubado) | Raro em B2B, mas possível | KYC estabelecimento obrigatório; limite de valor sem verificação extra |

---

## 🟡 DECIDIDO, AGUARDANDO CONFIRMAÇÃO JURÍDICA — onde o dinheiro do cachê fica custodiado

> **Bloqueia o deploy do escrow (F1.3a). Não deixe ser decidida por omissão no dia do deploy.**
> Registrada em 15/ago/2026 durante o Bloco 10 (contrato digital), a pedido explícito do usuário:
> *"aplique a porta, porém documente para saber que antes do deploy tenho que tomar essa decisão"*.
>
> **Encaminhada em 15/ago/2026:** a decisão de produto é o **caminho (ii)** — subconta em
> instituição de pagamento, *"pois perante a lei é a forma correta"*. O texto do contrato já foi
> reescrito para ele e **afirma** que o valor custodiado não integra o patrimônio da plataforma.
> Isso torna a escolha vinculante: ligar `uses_escrow: true` pelo caminho (i) transformaria uma
> cláusula assinada em declaração falsa. Falta a confirmação jurídica e o KYC do Asaas.
>
> **Reforço registrado em 15/ago/2026:** a cláusula `papel_da_plataforma.com_custodia` passou a
> dizer que a **remuneração da plataforma só é devida na liberação** — show não realizado, nenhuma
> comissão devida. Somado ao fato de o valor não transitar pelo patrimônio da SoundMeet, é o
> argumento mais forte contra a tese de responsabilidade solidária ("a plataforma lucrou com o
> negócio"): ela só ganha se o serviço foi efetivamente prestado.

O domínio (`BookingEscrow` + `held_balance`) é **idêntico nos dois caminhos** — só o adapter muda.
O que **não** pode acontecer é o adapter ser escolhido por conveniência técnica na véspera.

> ✅ **Atualização (19/ago/2026):** o domínio saiu. `BookingEscrow` (agregado + 3 camadas de
> repositório), `MusicianWallet.held_balance`, `Booking.checkIn()`/`dispute()`,
> `IBookingEscrowGateway`/`ISubaccountGateway`, `AsaasEscrowAdapter`/`AsaasSubaccountAdapter`,
> `ReleaseBookingEscrowUseCase`, `ProcessDueEscrowReleasesUseCase` e `EscrowReleaseJob` existem e
> estão testados. `uses_escrow` no contrato vem de `ESCROW_ENABLED` + `ESCROW_CUSTODIAN_LEGAL_NAME`,
> e **nenhum corpo de cláusula mudou** — os 38 snapshots seguem intactos, como previsto.
> Falta a fatia HTTP (check-in, contestação, criação de subconta), os webhooks e o `int-spec`.
>
> ⚠️ **Correção de registro (15/ago/2026), preservada:** uma versão anterior desta seção afirmava
> que "a fatia do contrato modelou `IBookingEscrowGateway` com um fake". **Isso nunca existiu** — o
> que havia até 19/ago era só a redação do contrato, pronta e testada, esperando o domínio.

| Caminho | O que é | A favor | Contra |
|---|---|---|---|
| **(i) Ledger interno** | `held_balance` na `MusicianWallet`, dinheiro parado na conta Asaas da SoundMeet, saque pelo `AsaasGatewayAdapter` que já existe | Funciona **hoje**, sem depender do F1.0 nem de aprovação de terceiro | 🔴 É **custódia de recursos de terceiros** — atividade regulada. Risco jurídico real, não técnico |
| **(ii) Subconta Asaas por músico** | F1.0: subconta + split, dinheiro na instituição de pagamento e não na conta da plataforma | Postura regulatória correta; a plataforma nunca detém recurso alheio | Depende de enquadramento e KYC aprovados pelo Asaas — trava por tempo que não depende de você |

**Estado do F1.0 (verificado no código em 15/ago/2026):** não implementado. Grep em `src/` e
`prisma/` devolve zero ocorrências de `asaas_wallet_id` ou `subaccount`; o único wallet id existente
é o `ASAAS_WALLET_ID` da plataforma (`config.schema.ts:168`). Ele era declarado pré-requisito do
F1.3 e não é — o contrato foi entregue sem ele.

**Encaminhamento sugerido:** levar a pergunta junto com a revisão jurídica do contrato — está na
§10 de [contract/legal-checklist.md](contract/legal-checklist.md), na seção "Antes do escrow". A
resposta muda qual adapter implementar, não o domínio.

---

## Próximos Passos — Blocos 1.6 e 1.7

### Pré-implementação (decisões operacionais)
- [x] Gateway da gorjeta: **Mercado Pago** (ago/2026). Não reabrir Iugu nem Woovi — ver
      [payment-gateway-research-2026-08.md](payment-gateway-research-2026-08.md)
- [ ] 🔴 **Confirmar que a conta Asaas é PJ** — conta pessoa física **não cria subconta**, e sem
      subconta não há F1.0 nem escrow
- [ ] 🔴 **Dimensionar o piloto pelo período de avaliação do Asaas:** 60 dias com no máximo
      **10 subcontas** e **R$2.000 em cobranças por subconta**
- [ ] Abrir conta Asaas sandbox — validar `POST /v3/accounts/{id}/escrow` e liberação via API
- [ ] Definir kill fee do estabelecimento (sugestão: 30% do cachê)
- [ ] Definir KYC mínimo: o que o músico precisa fornecer para habilitar subconta (CPF + banco)

### Implementação
- [x] ~~`MercadoPagoPixGateway` — gorjetas~~ — ✅ 19/ago/2026 (OAuth + webhook); 21/ago/2026 passou
      a criar a cobrança na **Orders API** (`POST /v1/orders` + `marketplace_fee`). A Orders API
      recusa credencial `TEST-` da app (`invalid_credentials`); sandbox usa test *user* com
      `APP_USR-` (OAuth). Payments API aceita `TEST-` — não é motivo para trocar o gateway.
      App canônica: SoundMeetPIX (`7348187308113120`). Ver [ops/domain-soundmeet-com-br.md](ops/domain-soundmeet-com-br.md).
- [x] ~~`AsaasGatewayAdapter` — cachê (escrow)~~ — ✅ 19/ago/2026: `AsaasEscrowAdapter` +
      `AsaasSubaccountAdapter`, atrás de portas próprias. Assinatura e saque já existiam
- [~] Webhook de confirmação PIX + idempotência (Bloco 1.7) — gorjeta no MP já tem
      `MercadoPagoWebhookController`. No Asaas faltam os handlers de escrow
      (`PAYMENT_RECEIVED` / liberação)
- [x] ~~`EscrowReleaseJob`~~ — ✅ 19/ago/2026, horário. Confere check-in **e** ausência de
      contestação, com o prazo por plano (`escrow_release_days`: D+2 pago / D+5 FREE) contado do
      **fim do show**. Uma custódia problemática não derruba a varredura das outras
- [ ] Statement descriptor configurado em todos os gateways
- [x] ~~Contrato digital gerado no booking (PDF com IP + timestamp do aceite)~~ — ✅ Bloco 10 (ago/2026), com hash de integridade e verificação pública além do previsto aqui
