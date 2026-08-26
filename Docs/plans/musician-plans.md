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

## Cachê de show em custódia (F1.3a)

| | **Free** | **Essencial** | **Pro** |
|---|---|---|---|
| **Taxa plataforma (cachê)** | **10%** | **10%** | **10%** |
| **Liberação após o show** | D+5 | D+2 | D+2 |

Duas taxas distintas de propósito: gorjeta e cachê liquidam em gateways diferentes (Mercado Pago
vs Asaas) e em tickets de ordem de grandeza diferente (R$5–60 vs R$200–5.000). Hoje a do cachê é
plana, mas `booking_fee_percentage` está em `plan-features.config.ts` como qualquer outra —
diferenciá-la por tier é editar um número.

> **A liberação não é gate, é prazo.** O FREE recebe; recebe depois. Reter dinheiro alheio como
> alavanca de upgrade não é uma opção quando o valor está em custódia — a diferença é vender uma
> vantagem, não criar um refém.

🔴 **Reajustar a taxa não alcança show já contratado.** A comissão é congelada em
`BookingEscrow.create`, e a cláusula do contrato remete ao percentual "vigente na data de emissão
deste instrumento" — a âncora que impede a mudança de virar cláusula potestativa. Em troca, a UI
**tem** que informar o número ao músico antes do aceite, porque é o que a cláusula pressupõe.

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

## ⚠️ Enforcement de gates: ação vs. leitura (ler antes de mexer em qualquer gate de plano)

**Todo gate de plano neste projeto (`PlanCheckService.assertMusicianFeature`/`assertMusicianCanCreateRepertoire`/`assertMusicianCanAddSongToRepertoire`/etc.) é checado só NO MOMENTO DA AÇÃO que o gate protege — nunca revalidado depois, em leituras subsequentes.**

Exemplo concreto (é o caso real que motivou documentar isto, jul/2026 — descoberto durante o Bloco 7 mobile):
1. Músico está no plano PRO, ativa compartilhamento público do repertório (`repertoire_sharing`) e convida um colaborador nominal (`repertoire_nominal_invite`). Os dois gates são checados **nesse instante**, no `ShareRepertoireUseCase`/`InviteMusicianUseCase`.
2. Semanas depois, o músico faz downgrade pra FREE (ou o pagamento falha e a assinatura expira).
3. **O link público continua ativo e o convidado continua com acesso total** — nada os desativa automaticamente. `Repertoire.is_shared`/`share_token`/`invitees` são estado persistido no aggregate, não recalculados contra o plano atual a cada leitura. `GetSharedRepertoireUseCase.isShareTokenValid()` só olha expiração (7 dias) e a flag `is_shared`, nunca o plano do dono. `CheckRepertoireSongAccessUseCase`/`CheckSharedSongAccessUseCase` (Play Mode do convidado / cifra do link público) idem — só checam dono-ou-convidado / token-válido, nunca plano.

**Isso é intencional e consistente em todo o projeto** — nenhum outro gate (banner generation, QR customizado, split de banda) revalida no momento da leitura, todos seguem o mesmo modelo "grant-at-action". Não é uma falha do Repertoire especificamente, é a arquitetura de enforcement do `PlanCheckService` como um todo.

**Se algum dia isso precisar mudar** (ex.: negócio decidir que downgrade deve revogar acesso já concedido), as opções são:
- Um job periódico que varre repertórios com `is_shared=true`/`invitees` não-vazio e revalida o plano do dono, desativando o que não for mais elegível.
- Checar o plano do dono também nas rotas de LEITURA (`GetSharedRepertoireUseCase`, `CheckRepertoireSongAccessUseCase`, `CheckSharedSongAccessUseCase`) — mais caro (uma consulta a mais por leitura) e muda a semântica de "leitura pura" desses use-cases.

Nenhuma das duas está implementada — por ora, é status quo conhecido, não bug.

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

> **Revisado em 06/ago/2026.** Esta tabela estava congelada em jun/2026 e listava como *Pendente*
> sete itens que já haviam sido concluídos nos Blocos 4C/4D — inclusive Repertório e Play Mode,
> que estão em produção no app desde jul/2026. Reverificar contra o código antes de reintroduzir
> qualquer linha aqui.

| Feature | Status | Bloco Roadmap |
|---------|--------|---------------|
| Repertório/Setlist domain | ✅ Concluído — `src/core/repertoire/` + 14 endpoints | 4D.1 |
| Play Mode (tela ao vivo) | ✅ Concluído — `PlayModeScreen` no mobile (Bloco 7) | 4D.2 |
| ⚠️ Enforcement analytics | **Soft gate, não bloqueia.** `GetMusicianAnalyticsUseCase` chama `getMusicianFeatures()` e só **reporta** `realtime_available` no output — **não existe `assert` algum**, e o músico FREE recebe exatamente os mesmos dados (pedidos aceitos/rejeitados, total de gorjetas, top músicas). Decidir: é o desenho pretendido (diferencial = stream realtime, que também não existe ainda) ou falta o gate? | 4C.1 |
| Enforcement saque config | ✅ Concluído — `getMusicianWithdrawalConfig()` em `WithdrawToPixUseCase` | 4C.2 |
| Enforcement QR custom | ✅ Concluído jul/2026 — persistência, output e gate (402) corrigidos | 4C.4 |
| Enforcement split banda | ✅ Concluído — gate em `AddBandMemberUseCase` (role `leader`) | 4C.6 |
| Billing anual | ✅ Concluído — `BillingCycle` no aggregate + pricing config + gateway Asaas | 4D.8 |
| Progress bar de saque (UX) | ✅ Concluído — `WithdrawProgressBar` no mobile (Bloco 5.5) | 4D.7 |
| **Banner generation (templates)** | ⏳ Pendente — o **gate já existe** (`assertMusicianCanGenerateBanner` em `plan-check.service.ts`), falta a feature que o chamaria | 4D.5 |
| `realtime_analytics` | ✅ **Virou gate real (16/ago/2026)** — `assertMusicianFeature` em `GetMusicianAnalyticsUseCase`; FREE recebe **402** e a `AnalyticsScreen` do app mostra o caminho de upgrade em vez de "tentar novamente". Era **soft gate**: o use-case só reportava a flag e entregava ao FREE os mesmos números do PRO | 9.7 |
| 🔜 `api_access` | **"Em breve" declarado (16/ago/2026)** — segue no catálogo, listada em `coming_soon` do `GET /plans`; a UI mostra badge "Em breve". Gatear é **erro de compilação** (`Exclude<>` na união de `assertMusicianFeature`) enquanto não houver API key de verdade | — |
| 🔜 `white_label` | **"Em breve" declarado (16/ago/2026)** — idem | — |

> **Auditoria de gates (06/ago/2026; revisada em 21/ago/2026).** Dos **20** campos de
> `MusicianPlanFeatures`, **15 são realmente aplicados** (repertórios, músicas por repertório, QR
> custom, membros de banda, split automático, compartilhamento e convite de repertório, cifras
> pessoais, comunidade, taxa de gorjeta, mínimo e prazo de saque, e — desde 21/ago/2026 — **taxa do
> cachê** e **prazo de liberação da custódia**, ambos lidos por `CreateBookingEscrowUseCase` e
> `ProcessDueEscrowReleasesUseCase`). `banner_generation_per_month` tem gate pronto sem feature. `music_library_access`
> é `true` em todos os tiers por decisão de produto. `tuner_noise_filter` é aplicado no cliente
> (mobile), por desenho. Os problemas reais são os 3 marcados com ⚠️ acima.
> **O lado do estabelecimento está bem pior** — ver [establishment-plans.md](establishment-plans.md).
