# Email — Estratégia, Infraestrutura e Fluxos

## 1. Provedores

### Transacional (ativo) — Resend

Usado para todos os emails gerados por ações do produto: verificação de conta, troca de email, booking confirmado/cancelado, boas-vindas, etc.

| Atributo | Valor |
|---|---|
| SDK | `resend` v6+ |
| Templates | `@react-email/components` (TSX) |
| Free tier | 3.000 emails/mês |
| SMTP relay | `smtp.resend.com:465` (SSL) — usado pelo Keycloak |

Três variáveis de ambiente são obrigatórias: a chave de API do Resend, o endereço remetente (`noreply@soundmeet.com.br`) e a URL base da API para montar os links nos templates. O domínio deve ser verificado no painel do Resend com registros DNS SPF, DKIM e DMARC antes do uso em produção.

---

### Marketing (futuro) — Brevo

Reservado para newsletters, promoções e automações de marketing quando o volume superar o free tier do Resend.

| Atributo | Valor |
|---|---|
| Free tier | 300 emails/dia (≈ 9.000/mês) |
| Diferenciais | Automações, LGPD-friendly (servidores EU), A/B test |
| Estratégia | Paralelo ao Resend: Resend para transacional, Brevo para campanhas |

**Gatilho de migração:** volume de novos usuários superar 3.000/mês (welcome emails) ou início de campanhas de reengajamento.

---

## 2. Integração com Keycloak

O Keycloak envia o email de **verificação inicial** na criação de conta via SMTP do Resend, usando a mesma chave de API como senha SMTP. Isso dispensa código NestJS para essa etapa específica — o Keycloak substitui variáveis de ambiente no realm JSON durante o `--import-realm`.

**Fluxo de criação de conta:**

1. Backend cria o usuário via Keycloak Admin API
2. Keycloak dispara email de verificação pelo SMTP do Resend
3. Usuário clica no link do Keycloak
4. Keycloak marca `email_verified = true` no token
5. Próximo login do usuário já carrega a claim `email_verified: true`

**Troca de email via Keycloak Admin API:**

Para atualizar o email no Keycloak, o backend usa dois endpoints sequenciais: primeiro atualiza o campo `email` do usuário via `PUT` e depois dispara o fluxo `VERIFY_EMAIL` via `execute-actions-email`, fazendo o Keycloak enviar um link de verificação para o novo endereço.

> **Decisão de arquitetura:** o Keycloak e o backend têm fluxos paralelos de verificação. O fluxo do backend persiste o estado no banco da aplicação (`email_verified_at`), enquanto o Keycloak mantém seu próprio controle. Para evitar duplicidade de emails, ativar apenas um dos dois fluxos ou suprimir o email do Keycloak para o passo inicial.

---

## 3. Campos de suporte no banco

Adicionados nos models `Musician`, `Establishment` e `Audience` para suportar o fluxo de troca de email com confirmação:

| Campo | Tipo | Finalidade |
|---|---|---|
| `email_verified_at` | `DateTime?` | Quando o email foi verificado |
| `email_pending` | `String?` | Novo email aguardando confirmação |
| `email_token` | `String?` | Token UUID gerado para confirmação |
| `email_token_expires_at` | `DateTime?` | TTL de 24h a partir da solicitação |

Esses campos são **infra-only** — não pertencem ao agregado de domínio e são gerenciados exclusivamente pelo `VerifyEmailUseCase` via Prisma direto.

---

## 4. Fluxo: Verificação de email no cadastro

1. Backend cria conta via use case (Musician / Establishment / Audience)
2. Evento de domínio `*CreatedEvent` emitido
3. `MailEventHandler` captura o evento
4. `MailService.sendEmailVerification` envia link com token UUID para o email do usuário
5. Backend persiste `email_token` + `email_token_expires_at` (+24h)
6. Usuário clica no link (`GET /api/v1/auth/verify-email?token=<uuid>`)
7. `VerifyEmailUseCase` valida o token, atualiza `email_verified_at` e limpa os campos de token

> **Nota:** o Keycloak envia um email de verificação próprio no mesmo momento. O email do backend é complementar e garante o registro no banco da aplicação. Avaliar qual suprimir quando o realm estiver em produção.

---

## 5. Fluxo: Troca de email com revalidação

1. `PATCH /musicians/:id` com o novo email
2. `UpdateMusicianUseCase` verifica se o email mudou; se não mudou, é noop; se já existe para outro perfil do mesmo tipo, retorna 422
3. `entity.changeEmail(novo)` emite `EmailChangedEvent`
4. Backend persiste `email_pending`, `email_token` e `email_token_expires_at` (+24h)
5. `MailService.sendEmailChange` envia link de confirmação para o **novo** endereço
6. Usuário clica no link de confirmação
7. `VerifyEmailUseCase` valida token e TTL, move `email_pending` → `email`, atualiza `email_verified_at`, limpa os campos de token
8. Backend chama Keycloak Admin API para sincronizar o novo email e disparar novo `VERIFY_EMAIL`

---

## 6. Mapa de emails do produto

> **Princípio:** email é para *registros* e *ações de segurança*. Eventos transacionais rápidos ficam como push notification.

| Trigger | Canal | Destinatário | Template | Status |
|---|---|---|---|---|
| Cadastro de conta | Email | Músico / Estabelecimento / Público | `email-verification.tsx` | ✅ Template pronto |
| Troca de email solicitada | Email | Novo email do usuário | `email-change.tsx` | ✅ Template pronto |
| Booking confirmado | Email | Músico + Estabelecimento | `booking-confirmed.tsx` | ✅ Template pronto |
| Booking cancelado | Email | Músico + Estabelecimento | `booking-cancelled.tsx` | ✅ Template pronto |
| Boas-vindas / perfil completo | Email | Todos | `welcome.tsx` | ✅ Template pronto |
| Saque PIX solicitado/aprovado | Email | Músico | *(a criar)* | ⏳ Pendente |
| Relatório semanal de receita | Email | Músico | `weekly-musician-report.tsx` *(a criar)* | ⏳ Bloco 7 |
| Músico verificado por admin | Email | Músico | *(a criar)* | ⏳ Pendente |
| Estabelecimento verificado por admin | Email | Estabelecimento | *(a criar)* | ⏳ Pendente |
| Gorjeta PIX recebida | Push | Músico | — | push only |
| Pedido musical aceito/recusado | Push | Público / Músico | — | push only |
| Newsletter / promoção | Email (Brevo) | Todos | via Brevo | 🔮 Futuro |

### Por que gorjeta e pedido musical são push, não email

- **Gorjeta:** um músico pode receber dezenas por show. Email individual equivale a spam. O músico recebe push imediato para satisfação na hora e um relatório semanal consolidado com total, breakdown por show e média por gorjeta.
- **Pedido musical:** ação contextual in-app com usuário já no celular. Push é suficiente; email seria ruído.
- **Booking:** mantido como email porque serve de *comprovante* — o músico precisa do registro com data, horário e cachê meses depois. Push some, email persiste.

### Relatório semanal do músico

Enviado toda segunda-feira cobrindo a semana anterior:

| Seção | Conteúdo |
|---|---|
| Receita | Gorjetas + shows + saques |
| Gorjetas | Total, quantidade e média por gorjeta |
| Shows | Eventos realizados e horas tocadas |
| Engajamento | Pedidos musicais, QR codes escaneados, novos seguidores |
| Destaque | Maior gorjeta da semana e música mais pedida |

Template `weekly-musician-report.tsx` planejado para o Bloco 7.

---

## 7. Módulo NestJS

**Localização:** `src/nest-modules/mail-module/`

| Arquivo | Responsabilidade |
|---|---|
| `mail.module.ts` | Módulo `@Global()` — exporta `MailService` para toda a app sem necessidade de importar explicitamente |
| `mail.service.ts` | Métodos de envio: `sendEmailVerification`, `sendEmailChange`, `sendBookingConfirmed`, `sendBookingCancelled`, `sendWelcome` |
| `mail-event.handler.ts` | Listeners `@OnEvent` para `MusicianEmailChangedEvent`, `EstablishmentEmailChangedEvent`, `AudienceEmailChangedEvent` |
| `templates/` | Componentes TSX com `@react-email/components` |

O `MailModule` é global — qualquer outro módulo NestJS pode injetar `MailService` sem declarar importação adicional.

---

## 8. Pendências de implementação

| Status | Item |
|---|---|
| ✅ | `VerifyEmailService` + endpoint `GET /api/v1/auth/verify-email?token=X` |
| ✅ | `MailEventHandler` com listeners para `*EmailChangedEvent` (Musician, Establishment, Audience) |
| ✅ | Domain events `EmailChangedEvent` para os três perfis |
| ✅ | Templates e métodos de serviço para verificação, troca, booking e boas-vindas |
| ⏳ | Integração Keycloak Admin API para troca de email (chamar `execute-actions-email` no novo endereço) |
| ⏳ | `MailEventHandler` para `*CreatedEvent` → envio do welcome email (requer wiring do `DomainEventMediator` nos create use-cases) |
| ⏳ | Emails de saque PIX (`WithdrawalRequestedEvent`) |
| ⏳ | Emails para músico e estabelecimento verificados por admin |
| ⏳ | Template e método `weekly-musician-report.tsx` (Bloco 7) |
