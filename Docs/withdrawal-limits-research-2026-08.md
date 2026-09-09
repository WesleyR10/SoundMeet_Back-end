# Pesquisa — limites de saque (teto diário e velocity)

**Data:** 28/ago/2026
**Motivo:** definir o teto de saque do SoundMeet (A1 da `audits/security-review-2026-08-28.md`).
**Decisão:** teto diário por tier (FREE R$2.000, ESSENTIAL/PRO R$5.000) + velocity de 5 saques/24h.

---

## O que o mercado pratica

### Banco Central (regras do PIX, 2026)
- **Diurno (6h–20h):** sem teto fixo do BCB — cada instituição define pelo perfil do cliente.
- **Noturno (20h–6h):** padrão **R$1.000/transação** para P2P.
- 🔑 **Dispositivo nunca cadastrado: R$200/operação e R$1.000/dia.** É o modelo que inspira a
  carência de chave recém-trocada — "destino/origem novo = limite estrito temporário".
- A partir de 1º/out/2026: limites personalizáveis, início do noturno entre 22h–6h, limites por
  contato.

Fontes: [em.com.br](https://www.em.com.br/trends/2026/01/7331131-limite-do-pix-qual-valor-diario-e-noturno-e-como-ajustar-no-app.html),
[InfinitePay](https://www.infinitepay.io/blog/limite-de-pix).

### Provedores (o SoundMeet paga o saque via Asaas)
- **Asaas:** PF **R$5.000/dia**, PJ **R$20.000/dia**. 30 saques/mês grátis, depois R$2/saque.
  ([central Asaas](https://central.ajuda.asaas.com/hc/pt-br/articles/32059648625051))
- **Mercado Pago:** PF até **R$50.000/dia** diurno.
  ([blog MP](https://www.mercadopago.com.br/blog/limite-transferencia-diario-conta-mercado-pago))

### Antifraude de marketplace / payout
Defesa em camadas (transação / conta / **payout**), *velocity checks* no saque, e controles
reforçados na **troca de dados de destino** — exatamente o vetor da carência.
Fontes: [SEON](https://seon.io/resources/marketplace-payment-fraud/),
[Chargebacks911](https://chargebacks911.com/velocity-checks/).

---

## Por que estes valores para o SoundMeet

O SoundMeet saca **cachê de show custodiado** via Asaas (a gorjeta nem passa pela plataforma —
liquida direto na conta MP do músico). Consequências:

1. **Não faz sentido permitir mais que o Asaas executa.** O provedor de saída já barra em
   **R$5.000/dia (PF)**; um teto da plataforma acima disso seria fictício. Por isso ESSENTIAL/PRO =
   R$5.000.
2. **FREE mais conservador (R$2.000):** conta nova, menos histórico — a assimetria de risco justifica.
3. **Teto DIÁRIO, não por saque:** um teto por saque travaria o cachê alto único (show de R$1.500
   tem de sair de uma vez). O teto por janela de 24h contém a drenagem sem esse efeito colateral.
4. **Velocity (5 saques/24h):** contorna a drenagem por muitos saques pequenos que o teto de valor
   deixaria passar. Alinhado ao *velocity check* padrão de marketplace.

| Tier | Teto diário | Velocity |
|------|-------------|----------|
| FREE | R$2.000 | 5/24h |
| ESSENTIAL | R$5.000 | 5/24h |
| PRO | R$5.000 (PJ/MEI destrava mais no provedor) | 5/24h |

Configurável em `plan-features.config.ts` (`max_withdrawal_per_day_brl`, `max_withdrawals_per_day`).
Ambos `null` desligam a checagem.

## Implementação (resumo)
- Janela **deslizante de 24h**, avaliada **dentro da transação com o lock da carteira** (senão dois
  saques concorrentes furam o teto juntos). Conta `PENDING`+`COMPLETED` (um saque em curso já reserva
  a cota; `FAILED`/`REFUNDED` não contam).
- 🔴 Os campos são **omitidos do catálogo público `GET /plans`** — revelar o teto exato ajuda a
  calibrar a drenagem logo abaixo do limite.

## Aberto (futuro)
- **Step-up** (biometria/senha) na troca de chave e no 1º saque para destino novo — quando a UI de
  saque entrar.
- Teto **por conta PJ/MEI** acima de R$5.000 depende do tipo de conta no Asaas.
