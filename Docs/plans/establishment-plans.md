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

| Feature | Status | Bloco Roadmap |
|---------|--------|---------------|
| Banner generation (templates) | Pendente | 4D.5 |
| Campanhas promocionais | Pendente | 7.1+ |
| Multi-estabelecimento (Keycloak) | Pendente | 4C.7 |
| Enforcement campanhas (4C.7) | Pendente | 4C.7 |
| Billing anual | Pendente | 4D.8 |
| **Cardápio PDF** (`menu_pdf_url` + upload S3) | Pendente | 7.7 |
| **Horário de funcionamento — UX** | Domínio pronto ✅; falta formulário no dashboard + badge "Aberto agora" | Quick win |

> **Nota técnica:** `OperatingHours` já está completamente implementado no domínio, Prisma mapper e presenter. O campo `operating_hours` já é retornado no `GET /establishments/:id`. O que falta é exclusivamente a camada de UX (frontend) para o estabelecimento preencher os horários e para o público ver o badge "Aberto agora".
