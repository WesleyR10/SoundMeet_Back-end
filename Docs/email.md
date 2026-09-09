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

Três variáveis de ambiente são obrigatórias: a chave de API do Resend, o endereço remetente (`noreply@soundmeet.com.br`) e a URL base da API para montar os links nos templates. O domínio `soundmeet.com.br` foi comprado na Hostinger em 29/ago/2026 (apex no parking). SPF, DKIM e DMARC no painel do Resend **ainda não** estão verificados — sem isso, produção cai em spam. Registros: [ops/domain-soundmeet-com-br.md](ops/domain-soundmeet-com-br.md).

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

## 2. Integração com Keycloak — o que REALMENTE acontece

> 🔴 **Corrigido em 28/set/2026.** Esta seção descrevia um fluxo que **nunca
> rodou**. O texto anterior afirmava que o Keycloak enviava o e-mail de
> verificação inicial via SMTP do Resend e que havia risco de duplicidade.
> Nada disso acontecia.

O realm tem `verifyEmail`, mas `KeycloakAdminGateway.createUser` cria **todo**
usuário com `emailVerified: true` e `requiredActions: []`. Como
`registrationAllowed: false`, o backend é o único caminho de nascimento de
conta — logo o Keycloak **nunca enviou verificação e nunca bloqueou login**.
A flag do realm era inerte, e o "e-mail duplicado" não existia.

**Decisão (28/set/2026): quem verifica é o backend.**

Ligar o Keycloak **quebraria o cadastro**: `RegisterUseCase` faz auto-login logo
após criar a conta, e com a required action `VERIFY_EMAIL` pendente o grant de
senha falha com *"Account is not fully set up"* — derrubando o cadastro do app
**e** o `/cadastro` do web. Foi para evitar isso que o `emailVerified: true`
está lá. Some-se: o template seria o do Keycloak (o tema só customiza
`login.ftl`), e o fluxo do backend cobre os três perfis com o nosso design.

Em consequência:

- `verifyEmail` passou a `false` no `realm-soundmeet.json` — flag que mente é
  pior que ausente.
- 🔴 **`verifyEmail` precisou entrar no `pickDefined` de `keycloak-sync.mjs`.**
  Mesma armadilha que o `loginTheme` já custou: sem a linha, o valor do
  realm.json é **ignorado** pelo sync e continua valendo o do `--import-realm`.
  O sintoma seria mudar o arquivo, rodar o sync com sucesso, e nada mudar.

**Troca de e-mail via Keycloak Admin API** (inalterado): o backend atualiza o
campo `email` via `PUT` e dispara o fluxo `VERIFY_EMAIL` por
`execute-actions-email` para o novo endereço.

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

1. Backend cria a conta (`RegisterUseCase` / `RegisterEstablishmentUseCase`)
2. `VerifyEmailService.issueVerificationToken` grava o **hash** do token
   (SHA-256, TTL de 24h) e envia o link
3. O link aponta para a **página do web**: `${APP_URL}/verificar-email?token=…`
4. A página faz `GET /auth/verify-email/status?token=` — que apenas **consulta**
5. O clique do usuário dispara `POST /auth/verify-email`, que confirma
6. `email_verified_at` é preenchido e os campos de token são limpos

### 🔴 Por que a leitura e a confirmação são rotas separadas

Gmail, Outlook Safe Links e antivírus corporativo fazem **GET de prefetch** em
todo link que chega por e-mail. Com a confirmação num GET — como era até
28/set/2026 — o scanner **consome o token de uso único antes do usuário
clicar**, e o link legítimo passa a responder "inválido". A falha é
intermitente, depende do provedor de e-mail do usuário, e não reproduz no
ambiente de quem desenvolve.

Por isso: **GET consulta, POST confirma.** O `GET /auth/verify-email` antigo
continua existindo (e-mails já enviados não se atualizam), mas hoje só
**redireciona** para a página — não confirma mais nada.

### Reenvio

`POST /auth/resend-verification` (throttle 3/min). Sem ele, token perdido ou
expirado era beco sem saída.

🔴 **A resposta é idêntica para e-mail existente e inexistente.** A rota é
`@Public()` e anônima; responder diferente a transformaria num verificador de
quem tem cadastro no SoundMeet.

### Onde o e-mail confirmado passou a valer

**Saque PIX.** `WithdrawToPixUseCase` recusa com `EmailNotVerifiedError`
(403 + `code: EMAIL_NOT_VERIFIED`) enquanto o e-mail não for confirmado. É a
única ação do produto que tira dinheiro do sistema em definitivo, e um e-mail
não confirmado é um canal de recuperação de conta que ninguém provou existir.

🔴 A checagem fica na **validação de entrada**, antes de `reserve()` — nunca
dentro da transação. As três barreiras de concorrência (lock `FOR UPDATE`,
saldo, chave de idempotência) e a ordem reserva → provedor são invariantes
provadas contra Postgres real; o gate é pré-condição de negócio, não parte da
mecânica de dinheiro. Há teste que falha se alguém o mover para depois.

Antes disso, `email_verified_at` era escrito num lugar e **lido em nenhum** —
backend, mobile e web inteiros.

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
| ✅ | `VerifyEmailService` + `GET /auth/verify-email/status` (consulta) + `POST /auth/verify-email` (confirma) + `POST /auth/resend-verification` (reenvio). O GET antigo virou redirect para a página do web. |
| ✅ | Página `/verificar-email` no `soundmeet-web` (`(public)`, `noindex`, fora do sitemap) |
| ✅ | Gate de **saque PIX** por e-mail confirmado (403 + `code: EMAIL_NOT_VERIFIED`), com CTA de reenvio na `WithdrawSheet` do app |
| ✅ | `MailEventHandler` com listeners para `*EmailChangedEvent` (Musician, Establishment, Audience) |
| ✅ | Domain events `EmailChangedEvent` para os três perfis |
| ✅ | Templates e métodos de serviço para verificação, troca, booking e boas-vindas |
| ⏳ | Integração Keycloak Admin API para troca de email (chamar `execute-actions-email` no novo endereço) |
| ⏳ | `MailEventHandler` para `*CreatedEvent` → envio do welcome email (requer wiring do `DomainEventMediator` nos create use-cases) |
| ✅ | **Booking confirmado/cancelado → e-mail para músico E estabelecimento** — `NotificationsSchedulingEventsHandler` (Bloco 9.5, 07/ago/2026). Os templates existiam desde sempre sem chamador; `BookingEventsHandlers` só logava. Best-effort: falha de e-mail não desfaz o booking, e falha num destinatário não impede o outro. |
| ✅ | **Inquiry criada/aceita/recusada → tempo real** (socket + push), deliberadamente **sem** e-mail: é negociação, não comprovante. O estabelecimento recebe na room `establishment:<id>`, nova no mesmo bloco. |
| ⏳ | Emails de saque PIX (`WithdrawalRequestedEvent`) |
| ⏳ | Emails para músico e estabelecimento verificados por admin |
| ⏳ | Template e método `weekly-musician-report.tsx` (Bloco 7) |
