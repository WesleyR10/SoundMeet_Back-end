# Planos para Estabelecimentos — VALORES FINAIS (jun/2026)

> Debate concluído. Valores implementados em `src/core/plans/domain/plan-features.config.ts`.  
> Estratégia de lançamento: preços de captação, revisão ao atingir 1.000 assinantes.

---

## Visão geral dos tiers

| | **Free** | **Growth** | **Pro** |
|---|---|---|---|
| **Preço mensal** | R$ 0 | **R$ 34,90/mês** | **R$ 74,90/mês** |
| **Preço anual** | — | **R$ 300/ano** (~R$ 25/mês) | **R$ 670/ano** (~R$ 55,83/mês) |
| **Desconto anual** | — | −28% | −26% |

---

## Decisão de design — busca e chat ilimitados em todos os planos

> **Motivo:** a conexão músico ↔ estabelecimento é o core value do SoundMeet. Limitar a busca no plano free seria contraditório com o produto. Estabelecimentos que encontram músicos e criam eventos ficam motivados a subir de tier pelos **dados** (analytics, relatórios) e pelas **ferramentas de divulgação** (campanhas, banners), não pela possibilidade de buscar.

---

## Features por tier

| Feature | **Free** | **Growth** | **Pro** |
|---------|---------|-----------|---------|
| **QR codes ativos** | 1 | 3 | Ilimitados |
| **Busca de músicos** | Ilimitada | Ilimitada | Ilimitada |
| **Chat com músicos** | Ilimitado | Ilimitado | Ilimitado |
| Dashboard básico | ✅ | ✅ | ✅ |
| Calendário de eventos | 1 ativo | Completo | Completo |
| **Horário de funcionamento** | ✅ | ✅ | ✅ |
| **Cardápio (PDF upload)** | ✅ | ✅ | ✅ |
| Analytics de audiência | Básico | Avançado | Completo + export |
| **Campanhas promocionais** | ❌ | ✅ | ✅ |
| **Banner generation** | ❌ | 3/mês | 15/mês |
| Relatórios personalizados | ❌ | ❌ | ✅ |
| **Multi-estabelecimento (até 3)** | ❌ | ❌ | ✅ |
| Suporte | Community | E-mail prioritário | Dedicado |

---

## Diferenciadores detalhados por tier

### Free
O estabelecimento pode:
- Ter 1 QR code ativo para o espaço
- Buscar e conversar com músicos sem limite
- Agendar 1 evento ativo por vez
- Ver dados básicos do dashboard (scans do QR, gorjetas geradas no espaço)

**Incentivo para upgrade:** quer ver quem veio por causa da música? Quer mandar campanha para quem visitou? Quer gerar banners de divulgação do show? → Growth.

### Growth (R$ 34,90/mês)
Tudo do Free mais:
- 3 QR codes (multi-sala, multi-palco, área VIP)
- Calendário completo de eventos com histórico
- Analytics avançados: quem escaneou, quando, volume de gorjetas por show
- **Campanhas promocionais**: notificar audiência sobre próximos shows
- 3 banners/mês gerados automaticamente com foto, nome do músico, data e QR

**Incentivo para upgrade:** precisa de relatórios personalizados? Tem mais de 3 espaços? → Pro.

### Pro (R$ 74,90/mês)
Tudo do Growth mais:
- QR codes ilimitados
- Relatórios personalizados exportáveis (CSV/PDF)
- Analytics completos com comparativos e tendências
- 15 banners/mês
- **Multi-estabelecimento**: até 3 unidades sob a mesma conta (dashboard unificado)
- Suporte dedicado

> Redes com mais de 3 unidades → contato direto para pricing customizado.

---

## Banner generation — feature detalhada

Templates prontos gerados server-side (PNG) com:
- Foto/logo do estabelecimento
- Nome e foto do músico convidado
- Data e horário do evento
- QR code do estabelecimento
- Identidade visual SoundMeet

**Implementação prevista:** Bloco 4D.5 (templates primeiro; AI generativa em versão futura).

---

## Mapeamento no código

```typescript
// src/core/plans/domain/plan-tier.enum.ts
export enum EstablishmentPlanTier {
  FREE = "free",
  GROWTH = "growth",
  PRO = "pro",
}
```

Valores centralizados em:
```
src/core/plans/domain/plan-features.config.ts → ESTABLISHMENT_PLAN_FEATURES
```

---

## Features pendentes de implementação

> **Revisado em 06/ago/2026.** Tabela congelada em jun/2026 — quatro linhas listadas como
> *Pendente* já estavam concluídas. Reverificar contra o código antes de reintroduzir qualquer item.

| Feature | Status | Bloco Roadmap |
|---------|--------|---------------|
| Campanhas promocionais | ✅ Concluído — domínio + `CampaignModule` + controller + tabela `campaigns` | 4C.10 |
| Enforcement campanhas | ✅ Concluído — `assertEstablishmentFeature(..., "promotional_campaigns")` | 4C.10 |
| Multi-estabelecimento | ✅ Concluído — gate em `CreateEstablishmentUseCase`, hard-limit 3 unidades, PRO only | 4C.7 |
| Billing anual | ✅ Concluído — `BillingCycle` + `ESTABLISHMENT_PLAN_PRICING` + `AsaasSubscriptionGateway` | 4D.8 |
| Cardápio PDF (upload + R2) | ✅ Concluído — `POST/DELETE /establishments/:id/menu-pdf`, magic-byte check, 5MB | 7.7 |
| **Horário de funcionamento — UX** | ⏳ Pendente — domínio 100% pronto; falta o formulário do dono. **Sem UI em nenhuma plataforma**, então `operating_hours` é `null` na prática e o badge "Aberto agora" nunca acende | W1 |
| **Banner generation (templates)** | ⏳ Pendente | 4D.5 |
| **`advanced_analytics`** | ✅ **Concluído (16/ago/2026)** — `assertEstablishmentFeature` em `ListEstablishmentAnalyticsUseCase`; FREE recebe **402** e o dashboard mostra `AnalyticsPlanGateNotice` com caminho de upgrade. Export CSV/PDF segue fora de escopo | 9.7 |
| **`max_qr_codes` (1 / 3 / ∞)** | ✅ **Removido do catálogo (16/ago/2026)** — decisão: não vender o que o domínio não faz. `Establishment.qr_code` é campo único e `generateQRCode()` sobrescreve; múltiplos QR volta como **feature** (agregado próprio com rótulo por ambiente), nunca como gate | 9.7 |
| **`api_access`** | 🔜 **"Em breve" declarado (16/ago/2026)** — segue no catálogo, agora listada em `coming_soon` do `GET /plans`, e a UI renderiza badge "Em breve" em vez de ✓/✗. Gatear a flag é **erro de compilação** (`Exclude<>` na união de `assertEstablishmentFeature`) enquanto não existir API key de verdade | — |
| **Calendário: "1 evento ativo" no Free** | ⏸️ **Decidido não aplicar (16/ago/2026)** — os eventos de estabelecimentos FREE são o inventário que alimenta a `/agenda` pública (W5). Limitar agora reduz o conteúdo do funil de aquisição justamente enquanto ele precisa encher. A promessa sai da tabela de preços; revisitar quando houver oferta sobrando | — |
| **🔴 Cadastro de estabelecimento** | ⏳ **Bloqueador** — não existe caminho para criar a primeira conta | 9.1 |
| **🔴 Listagem de bookings/inquiries** | ⏳ **Bloqueador** — o estabelecimento não vê as próprias contratações | 9.2 |
| **Dashboard web (UI de tudo acima)** | ⏳ `soundmeet-web` não existe | [roadmap-web.md](../roadmap-web.md) |

> **Nota técnica:** `OperatingHours` já está completamente implementado no domínio, Prisma mapper e presenter. O campo `operating_hours` já é retornado no `GET /establishments/:id`, e o campo calculado `is_open_now` já sai em todos os outputs (7.8a/7.8b). O que falta é exclusivamente a camada de UX — **e ela não existe em plataforma nenhuma hoje**, porque o estabelecimento é web-only e o web ainda não foi criado. É a fatia **W1** do [roadmap-web.md](../roadmap-web.md), e a de maior relação valor/esforço do v1: backend 100% pronto, falta só o formulário.
