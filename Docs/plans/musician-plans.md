# Planos para Músicos — VALORES FINAIS (jun/2026)

> Debate concluído. Valores implementados em `src/core/plans/domain/plan-features.config.ts`.  
> Estratégia de lançamento: preços de captação, revisão ao atingir 1.000 assinantes.

---

## Visão geral dos tiers

| | **Free** | **Essencial** | **Pro** |
|---|---|---|---|
| **Preço mensal** | R$ 0 | **R$ 34,90/mês** | **R$ 74,90/mês** |
| **Preço anual** | — | **R$ 300/ano** (~R$ 25/mês) | **R$ 670/ano** (~R$ 55,83/mês) |
| **Desconto anual** | — | −28% | −26% |

---

## Gorjetas e saques

| | **Free** | **Essencial** | **Pro** |
|---|---|---|---|
| Gorjetas recebidas | Ilimitadas | Ilimitadas | Ilimitadas |
| **Taxa plataforma (gorjeta)** | **9%** | **7%** | **5%** |
| *(gateway incluso na taxa)* | *~1% gateway* | *~1% gateway* | *~1% gateway* |
| **Saque mínimo** | **R$ 110** | **R$ 70** | **R$ 50** |
| **Prazo do saque** | 5 dias úteis | 3 dias úteis | até 24h (1 dia útil) |

> **UX obrigatório (Bloco 4D.7):** o dashboard do músico Free deve exibir uma progress bar gamificada — "Você está a R$ X de poder sacar" — para transformar o limite em meta, não em frustração.

---

## Features por tier

| Feature | **Free** | **Essencial** | **Pro** |
|---------|---------|--------------|---------|
| Pedidos musicais recebidos | Ilimitados | Ilimitados | Ilimitados |
| Cifras (acesso + edição) | ✅ | ✅ | ✅ |
| **Repertórios (setlists)** | 1 (até 20 músicas) | 3 (até 80 músicas/cada) | Ilimitados |
| Compartilhar repertório | ❌ | Link read-only | Colaborativo (convite) |
| Tempo estimado de show | ✅ | ✅ | ✅ |
| **Afinador cromático** | ✅ | ✅ | ✅ |
| **Afinador com filtro de ruído** | ❌ | ✅ | ✅ |
| Analytics de audiência | Básico | Avançado | Completo + export |
| **Banner generation** | ❌ | 3/mês | 15/mês |
| Prioridade no algoritmo | ❌ | ❌ | ✅ |
| QR code customizado | ❌ | ❌ | ✅ |
| Split automático de banda | ❌ | ❌ | ✅ (até 8 membros) |
| Suporte | Community | E-mail prioritário | Dedicado |

---

## Repertório — feature detalhada

O repertório é a **setlist digital ao vivo**. Disponível para todos os planos, diferenciada por quantidade:

- Lista de cifras ordenadas pelo músico para o show
- **Play Mode**: exibe cifra + letra em fullscreen; botão 1 clique para próxima/anterior
- Músicas editadas aparecem com badge "customizada"
- Estimativa de duração do show baseada na quantidade de músicas (média 3,5 min/faixa)
- **Free**: 1 repertório, 20 músicas — suficiente para um show de ~1h10min
- **Essencial**: 3 repertórios, 80 músicas — cobre diferentes contextos (bar, casamento, evento corporativo)
- **Pro**: ilimitado — bandas, músicos com múltiplos projetos

**Compartilhamento**:
- Essencial → link read-only temporário (convidado/parceiro visualiza cifras, não edita)
- Pro → convite nominal a músico cadastrado (colaboração total)

---

## Diferencial vs. concorrentes

| App | Free | Pago | Observação |
|-----|------|------|------------|
| Cifra Club | Cifras grátis | ~R$ 20/mês (sem anúncios) | Sem repertório ao vivo, sem gorjetas |
| OnSong | 30 músicas | ~R$ 20–30/mês | Sem integração QR/pedidos/gorjetas |
| BandHelper | Não | ~R$ 25–35/usuário/mês | Sem gorjetas, sem estabelecimentos |
| **SoundMeet** | Cifra + gorjeta + repertório | **R$ 34,90/mês** | Ecossistema completo: cifra + show + gorjeta + QR |

---

## Mapeamento no código

```typescript
// src/core/plans/domain/plan-tier.enum.ts
export enum MusicianPlanTier {
  FREE = "free",
  ESSENTIAL = "essential",
  PRO = "pro",
}
```

Valores centralizados em:
```
src/core/plans/domain/plan-features.config.ts → MUSICIAN_PLAN_FEATURES
```

---

## Features pendentes de implementação

| Feature | Status | Bloco Roadmap |
|---------|--------|---------------|
| Repertório/Setlist domain | Pendente | 4D.1–4D.4 |
| Play Mode (tela ao vivo) | Pendente | 4D.2 |
| Banner generation (templates) | Pendente | 4D.5 |
| Progress bar de saque (UX) | Pendente | 4D.7 |
| Billing anual | Pendente | 4D.8 |
| Enforcement analytics (4C.1) | Pendente | 4C.1 |
| Enforcement QR custom (4C.4) | Pendente | 4C.4 |
| Enforcement split banda (4C.6) | Pendente | 4C.6 |
| Enforcement saque config (4C.2) | Pendente | 4C.2 |
