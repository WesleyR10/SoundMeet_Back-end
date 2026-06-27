# Roadmap Frontend — SoundMeet

Tarefas de interface (web e mobile) extraídas do roadmap principal em jun/2026.  
Contexto de produto, regras de negócio e planos: ver [roadmap.md](roadmap.md), [business-rules.md](business-rules.md), [features.md](features.md).

> **Próxima tarefa = primeiro item `[ ]` da lista abaixo.**

---

## Bloco 4D — Novas funcionalidades premium

### 4D.2 — Play Mode no Repertório (ESSENTIAL + PRO)

> Tela ao vivo usada durante o show, consumindo os endpoints de repertório + cifra já prontos.

- [ ] **4D.2a** Tela fullscreen: cifra + letra da música atual; botões próxima/anterior com 1 clique
- [ ] **4D.2b** Badge "customizada" em músicas com `custom_notes` editados pelo músico
- [ ] **4D.2c** Auto-scroll configurável

**Pré-requisito backend:** 4D.1 ✅ (repertório completo — 14 endpoints, cifra via ai-cifra)

---

### 4D.7 — Progress bar de saque no dashboard (todos os planos)

> Componente de home do músico mostrando distância até o saque mínimo e prazo estimado.

- [ ] **4D.7a** Barra de progresso "Você está a R$X de poder sacar" na home do músico
- [ ] **4D.7b** Prazo estimado baseado no ritmo atual de gorjetas

**Pré-requisito backend:** `GET /musicians/:id/wallet` ✅ (Bloco 1); configuração de saque por plano ✅ (4C.2 — FREE R$110/5d · ESSENTIAL R$70/3d · PRO R$50/1d)

---

## Bloco 7 — Produto avançado

### 7.6 — Afinador cromático (frontend + mobile)

> Backend: adicionar `tuner_noise_filter` em `MusicianPlanFeatures` e `plan-features.config.ts` (7.6a — pendente no roadmap backend).

- [ ] **7.6b** Afinador básico via WebAudio API + algoritmo YIN/autocorrelação (todos os planos)
- [ ] **7.6c** Modo filtro de ruído + gate `assertMusicianFeature(id, "tuner_noise_filter")` (ESSENTIAL + PRO)
- [ ] **7.6d** Mobile: plugin de áudio nativo para latência mínima

**Posicionamento:** "já no app, sem trocar de contexto" — entry point do ritual pré-show

---

### 7.7 — Cardápio PDF do Estabelecimento (viewer inline)

> Upload/delete/S3 prontos no backend (7.7a–7.7e ✅); falta a visualização no frontend.

- [ ] Viewer inline no perfil público do estabelecimento (PDF.js web / WebView mobile)
- [ ] Aviso "Atualizado há X dias" quando `menu_pdf_updated_at` > 30 dias

**Pré-requisito backend:** 7.7a–7.7e ✅ (campo `menu_pdf_url` no presenter)

---

### 7.8 — Badge "Aberto agora"

> Campo `is_open_now: boolean` já calculado e presente em todos os outputs de establishment (7.8a/7.8b ✅).

- [ ] **7.8c** Badge "Aberto agora" na listagem e no perfil do estabelecimento
- [ ] **7.8d** Formulário de edição de horários no dashboard do estabelecimento (preencher campo `operating_hours` que já existe no backend)

**Pré-requisito backend:** 7.8a/7.8b ✅ (`is_open_now` via `OperatingHours.isOpenAt()` com timezone correto)
