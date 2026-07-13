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

| Feature | Status | Bloco Roadmap |
|---------|--------|---------------|
| Repertório/Setlist domain | Pendente | 4D.1–4D.4 |
| Play Mode (tela ao vivo) | Pendente | 4D.2 |
| Banner generation (templates) | Pendente | 4D.5 |
| Progress bar de saque (UX) | Pendente | 4D.7 |
| Billing anual | Pendente | 4D.8 |
| Enforcement analytics (4C.1) | Pendente | 4C.1 |
| ~~Enforcement QR custom (4C.4)~~ | Concluído jul/2026 — persistência, output e gate (402) corrigidos | 4C.4 |
| Enforcement split banda (4C.6) | Pendente | 4C.6 |
| Enforcement saque config (4C.2) | Pendente | 4C.2 |
