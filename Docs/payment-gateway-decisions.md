# Decisões de Arquitetura de Pagamentos — SoundMeet

**Sessão:** 2026-06-22  
**Blocos relacionados:** Roadmap 1.6 e 1.7  
**Status:** Decisões core finalizadas — próximo passo: implementação dos adapters

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
IPixGateway (interface de domínio — já existe)
  ├── IuguGatewayAdapter      → gorjetas (MVP)
  ├── AsaasGatewayAdapter     → cachê + escrow + assinaturas + saques
  └── [futuro] OpenPixAdapter → otimização gorjetas >R$62,50 quando houver volume
```

`PaymentService` roteia por tipo de transação:
- `tip_payment`            → `IuguGatewayAdapter`
- `booking_payment`        → `AsaasGatewayAdapter`
- `subscription_payment`   → `AsaasGatewayAdapter`
- `musician_withdrawal`    → `AsaasGatewayAdapter` (PIX out da subconta)

### Crossover de custo Iugu vs OpenPix (referência futura)

| Gorjeta | Iugu (0,99%) | OpenPix (0,80%, mín R$0,50) | Melhor |
|---------|-------------|------------------------------|--------|
| R$ 5 | R$ 0,05 | R$ 0,50 | **Iugu** |
| R$ 20 | R$ 0,20 | R$ 0,50 | **Iugu** |
| R$ 51 | R$ 0,50 | R$ 0,50 | Empate |
| R$ 62,50 | R$ 0,62 | R$ 0,50 | **OpenPix** |
| R$ 100 | R$ 0,99 | R$ 0,80 | **OpenPix** |

**Crossover real: R$ 62,50.** Para MVP, Iugu cobre a maioria das gorjetas (R$ 5–60). OpenPix entra como otimização futura via adapter adicional sem refatoração de domínio.

---

## Decisões por Vértice

### Gorjetas ✅

- **Gateway:** Iugu (0,99%, sem mínimo fixo)
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

1. **Contrato digital no booking** — aceite com IP + timestamp + dados completos (data, horário, valor, músico, local). Gerado como PDF e enviado ao estabelecimento.

2. **Statement descriptor configurado no gateway** — fatura do estabelecimento mostra `"SoundMeet - [Nome Músico] DD/MM"` em vez de código genérico. Elimina 80% dos "não reconheço" antes de virar disputa.

3. **Check-in do músico + scan do estabelecimento** — prova documental de execução do serviço (já planejado no domínio).

4. **E-mail de confirmação** enviado ao e-mail corporativo do estabelecimento após pagamento — trail documental independente.

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
| Custo escrow Asaas em escala | R$9,90/músico/mês com escrow → R$10k/mês com 1k músicos | Habilitar escrow só para músicos com cachê ativo; negociar enterprise antes de 300 músicos |
| Crossover gorjeta OpenPix | Iugu levemente mais caro para gorjetas >R$62,50 | `OpenPixAdapter` já previsto na interface; adicionar quando justificar o volume |
| Reforma tributária 2027 | LC 214/2025: split fiscal IBS/CBS obrigatório | Confirmar suporte com Asaas/Iugu no contrato |
| Fraude real (cartão roubado) | Raro em B2B, mas possível | KYC estabelecimento obrigatório; limite de valor sem verificação extra |

---

## Próximos Passos — Blocos 1.6 e 1.7

### Pré-implementação (decisões operacionais)
- [ ] Abrir conta Iugu sandbox — validar multisplit e subconta
- [ ] Abrir conta Asaas sandbox — validar `POST /v3/accounts/{id}/escrow` e liberação via API
- [ ] Definir kill fee do estabelecimento (sugestão: 30% do cachê)
- [ ] Definir KYC mínimo: o que o músico precisa fornecer para habilitar subconta (CPF + banco)

### Implementação
- [ ] `IuguGatewayAdapter` — gorjetas (PIX QR + split + webhook `payment_received`)
- [ ] `AsaasGatewayAdapter` — cachê (escrow), assinaturas (recorrência cartão + PIX sob demanda), saque (PIX out)
- [ ] Webhook de confirmação PIX + idempotência (Bloco 1.7)
- [ ] `EscrowReleaseJob` — scheduler D+2/D+5 que verifica check-in + ausência de disputa e chama API de liberação
- [ ] Statement descriptor configurado em todos os gateways
- [ ] Contrato digital gerado no booking (PDF com IP + timestamp do aceite)
