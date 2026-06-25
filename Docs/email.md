# Email — Estratégia, Infraestrutura e Fluxos

## 1. Provedores

### Transacional (ativo) — Resend
Usado para todos os emails gerados por ações do produto: verificação de conta, gorjeta
PIX recebida, booking confirmado, etc.

| Atributo | Valor |
|---|---|
| SDK | `resend` v6+ |
| Templates | `@react-email/components` |
| Free tier | 3.000 emails/mês |
| SMTP relay | `smtp.resend.com:465` (SSL) — usado pelo Keycloak |
| Docs | https://resend.com/docs |

**Configuração mínima (`.env`):**
```env
RESEND_API_KEY=re_xxxxxxxxxxxx      # mesma chave usada como senha SMTP pelo Keycloak
MAIL_FROM=noreply@soundmeet.com.br  # domínio verificado no Resend
MAIL_BASE_URL=https://api.soundmeet.com.br
```

> **Resend SMTP relay:** o usuário SMTP é sempre `resend` e a senha é o próprio `RESEND_API_KEY`.
> No realm JSON, `${env.RESEND_API_KEY}` é substituído automaticamente pelo Keycloak no `--import-realm`.

**Verificação de domínio no Resend:**
1. Acesse resend.com → Domains → Add Domain
2. Adicione `soundmeet.com.br`
3. Configure os registros DNS (SPF, DKIM, DMARC) no seu provedor

---

### Marketing (futuro) — Brevo
Para newsletters, promoções e automações de marketing quando o free tier do Resend
(3.000/mês) não for mais suficiente.

| Atributo | Valor |
|---|---|
| Free tier | 300 emails/dia (9.000/mês) |
| Diferenciais | Automações de marketing, LGPD-friendly (servidores EU), A/B test |
| Estratégia | Usar em conjunto com Resend: Resend para transacional, Brevo para campanhas |
| Docs | https://developers.brevo.com |

**Quando migrar para Brevo (marketing):**
- Volume de cadastros superar 3.000 novos usuários/mês (welcome emails)
- Início de campanhas de reengajamento ou newsletters

---

## 2. Integração com Keycloak

O Keycloak envia o email de **verificação inicial** (na criação de conta) via SMTP
do Resend. Isso dispensa código NestJS para essa etapa.

**Configuração no realm (`infra/keycloak/realm-soundmeet.json`):**
```json
{
  "verifyEmail": true,
  "smtpServer": {
    "host": "smtp.resend.com",
    "port": "465",
    "ssl": "true",
    "user": "resend",
    "password": "${env.RESEND_API_KEY}",
    "from": "${env.MAIL_FROM}",
    "fromDisplayName": "SoundMeet"
  },
  "requiredActions": [
    { "alias": "VERIFY_EMAIL", "defaultAction": true, "enabled": true }
  ]
}
```

**Fluxo de criação de conta:**
```
Backend → Keycloak Admin API (criar usuário)
Keycloak → envia email de verificação via SMTP Resend
Usuário → clica no link do Keycloak
Keycloak → marca email_verified=true no JWT
Backend → próximo login terá claim email_verified: true
```

**Troca de email (Keycloak Admin API):**
```
PUT /admin/realms/soundmeet/users/{id}   → atualiza email no Keycloak
POST /admin/realms/soundmeet/users/{id}/execute-actions-email
  body: ["VERIFY_EMAIL"]                  → Keycloak envia email para o novo endereço
```

---

## 3. Campos Prisma adicionados

Adicionados nos models `Musician`, `Establishment` e `Audience` para suportar o
fluxo de troca de email com confirmação:

```prisma
email_verified_at      DateTime?   // quando o email foi verificado
email_pending          String?     // novo email aguardando confirmação
email_token            String?     // token UUID gerado para confirmação
email_token_expires_at DateTime?   // TTL de 24h a partir da solicitação
```

> **Esses campos são infra-only.** Não pertencem ao agregado de domínio — são
> gerenciados exclusivamente pelo `VerifyEmailUseCase` via Prisma direto.

---

## 4. Fluxo: Verificação de email no cadastro

```
1. Backend cria conta via use case (Musician/Establishment/Audience)
2. Evento de domínio *CreatedEvent emitido
3. MailEventHandler captura o evento
4. MailService.sendEmailVerification(email, { name, verificationUrl })
   → verificationUrl = GET /api/v1/auth/verify-email?token=<uuid>
5. Backend salva: email_token + email_token_expires_at (+24h)
6. Usuário clica no link
7. VerifyEmailUseCase valida token, atualiza email_verified_at, limpa token
```

> **Nota:** O Keycloak já envia um email de verificação próprio (via SMTP).
> O email do backend (etapa 4) é complementar e salva o dado no banco da
> aplicação. Para evitar duplicidade, considere ativar apenas um dos dois
> fluxos ou suprimir o email do Keycloak para essa etapa.

---

## 5. Fluxo: Troca de email com revalidação

```
1. PATCH /musicians/:id com { email: "novo@email.com" }
2. UpdateMusicianUseCase:
   a. Noop se email === email_atual
   b. findByEmail(novo) → 422 se já existe no mesmo tipo de perfil
   c. entity.changeEmail(novo) → emite EmailChangedEvent
3. MailEventHandler captura EmailChangedEvent
4. Backend salva: email_pending=novo, email_token=uuid, email_token_expires_at=+24h
5. MailService.sendEmailChange(novo_email, { name, newEmail, confirmationUrl })
6. Usuário clica no link de confirmação
7. VerifyEmailUseCase:
   a. Valida token e TTL
   b. Atualiza email = email_pending, email_verified_at = now()
   c. Limpa email_pending, email_token, email_token_expires_at
   d. Chama Keycloak Admin API → PUT user.email + executeActionsEmail(["VERIFY_EMAIL"])
```

---

## 6. Mapa de emails do produto

> **Princípio:** email é para *registros* e *ações de segurança*. Eventos
> transacionais rápidos (gorjeta, pedido musical) ficam como push notification.

| Trigger | Canal | Destinatário | Template | Prioridade |
|---|---|---|---|---|
| Cadastro de conta | Email | Músico / Estabelecimento / Público | `email-verification.tsx` | 🔴 Crítico |
| Troca de email solicitada | Email | Novo email do usuário | `email-change.tsx` | 🔴 Crítico |
| Booking confirmado | Email | Músico + Estabelecimento | `booking-confirmed.tsx` | 🔴 Crítico |
| Booking cancelado | Email | Músico + Estabelecimento | `booking-cancelled.tsx` | 🔴 Crítico |
| Saque PIX solicitado / aprovado | Email | Músico | (a criar) | 🔴 Crítico |
| Relatório semanal de receita | Email | Músico | (a criar) | 🔴 Crítico |
| Perfil completo / boas-vindas | Email | Todos | `welcome.tsx` | 🟡 Médio |
| Músico verificado por admin | Email | Músico | (a criar) | 🟡 Médio |
| Estabelecimento verificado por admin | Email | Estabelecimento | (a criar) | 🟡 Médio |
| Gorjeta PIX recebida | Push | Músico | — | push only |
| Pedido musical aceito/recusado | Push | Público / Músico | — | push only |
| Newsletter / promoção | Email (Brevo) | Todos | via Brevo (futuro) | 🟢 Futuro |

### Por que gorjeta e pedido musical são push, não email

- **Gorjeta**: um músico pode receber dezenas por show. Email individual = spam.
  O músico recebe push imediato (satisfação na hora) + relatório semanal com
  total ganho, breakdown por show e média por gorjeta.
- **Pedido musical**: ação contextual in-app, o usuário já está no celular.
  Push é suficiente; email seria ruído.
- **Booking**: mantido como email porque serve de *comprovante* — o músico
  precisa do registro com data, horário e cachê meses depois. Push some, email fica.

### Relatório semanal do músico (email)

Consolidado toda segunda-feira, cobre a semana anterior:

| Seção | Conteúdo |
|---|---|
| Receita | Gorjetas + shows + saques |
| Gorjetas | Total recebido, nº de gorjetas, média por gorjeta |
| Shows | Eventos realizados, horas tocadas |
| Engajamento | Pedidos musicais, QR codes escaneados, novos seguidores |
| Destaque | Maior gorjeta da semana, música mais pedida |

Template: `weekly-musician-report.tsx` (a criar no Bloco 7)

---

## 7. Módulo NestJS

**Localização:** `src/nest-modules/mail-module/`

```
mail-module/
  mail.module.ts         # @Global() — exporta MailService para toda a app
  mail.service.ts        # sendEmailVerification, sendEmailChange, sendBooking*, etc.
  mail-event.handler.ts  # @OnEvent handlers: *EmailChangedEvent
  templates/
    email-verification.tsx
    email-change.tsx
    booking-confirmed.tsx
    booking-cancelled.tsx
    welcome.tsx
    weekly-musician-report.tsx  # (a criar — Bloco 7)
```

> `pix-tip-received.tsx` foi criado mas não é usado por email — gorjeta é push only.
> O método `MailService.sendPixTipReceived()` pode ser removido em refactoring futuro.

**Uso em outros módulos:**
```typescript
// Injetado via @Global() — não precisa importar MailModule
constructor(private readonly mailService: MailService) {}

await this.mailService.sendPixTipReceived(musician.email.value, {
  musicianName: musician.displayName,
  senderName: senderName,
  amount: "R$ 10,00",
  message: tipMessage,
  eventName: eventName,
});
```

---

## 8. Pendências de implementação

- [x] `VerifyEmailService` + endpoint `GET /api/v1/auth/verify-email?token=X`
- [x] `MailEventHandler` com listeners para `*EmailChangedEvent`
- [x] Domain event `EmailChangedEvent` para Musician, Establishment e Audience
- [ ] Integração Keycloak Admin API para troca de email (chamar `executeActionsEmail` no novo email)
- [ ] `MailEventHandler` para `*CreatedEvent` → welcome email (necessita wiring de `DomainEventMediator` nos create use cases)
- [ ] Emails de saque PIX (`WithdrawalRequestedEvent`)
- [ ] Emails de músico/estabelecimento verificados por admin
- [ ] Templates de email para pedido musical aceito/recusado
