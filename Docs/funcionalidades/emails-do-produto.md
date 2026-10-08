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

Três variáveis de ambiente são obrigatórias: a chave de API do Resend, o endereço remetente (`noreply@soundmeet.com.br`) e a URL base da API para montar os links nos templates. O domínio `soundmeet.com.br` foi comprado na Hostinger em 29/ago/2026 (apex no parking). SPF, DKIM e DMARC no painel do Resend **ainda não** estão verificados — sem isso, produção cai em spam. Registros: [_privado/operacao/dominio-soundmeet-com-br.md](../_privado/operacao/dominio-soundmeet-com-br.md).

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

**Troca de e-mail:** quem confirma o endereço novo é o backend (link, §5); só
depois do clique o `VerifyEmailService` atualiza o usuário no Keycloak
(`KeycloakAdminGateway.updateUserEmail`: `email`, `username` — o realm usa
e-mail como username — e `emailVerified: true`). O Keycloak não envia nada.

## 3. Campos de suporte no banco

Adicionados nos models `Musician`, `Establishment` e `Audience` para suportar o fluxo de troca de email com confirmação:

| Campo | Tipo | Finalidade |
|---|---|---|
| `email_verified_at` | `DateTime?` | Quando o email foi verificado |
| `email_pending` | `String?` | Novo email aguardando confirmação |
| `email_token_hash` | `String?` | SHA-256 do token de confirmação (o token em claro só existe no link) |
| `email_token` | `String?` | Legado: token em claro, de antes do SM-016. Gravado `null` hoje |
| `email_token_expires_at` | `DateTime?` | TTL de 24h a partir da solicitação |

Esses campos são **infra-only** — não pertencem ao agregado de domínio. Escrevem neles o `MailEventHandler` (pedido de troca) e o `VerifyEmailService` (emissão e confirmação), via Prisma direto.

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

1. `PATCH /musicians/:id` (ou `/audiences/:id`, `/establishments/:id`) com o novo e-mail
2. O use case checa se mudou (o painel reenvia o e-mail inalterado a cada save — só e-mail **diferente** pede troca) e se já existe no mesmo tipo de perfil (422)
3. `entity.requestEmailChange(novo)` emite `*EmailChangedEvent` — e **não muda o e-mail**. O perfil continua com o endereço atual, já confirmado
4. `MailEventHandler` grava `email_pending`, o **hash** do token e a validade (+24h)
5. `MailService.sendEmailChange` envia o link de confirmação para o **novo** endereço
6. O clique confirma (`POST /auth/verify-email`, mesma rota do cadastro)
7. **Músico e público:** o `VerifyEmailService` troca primeiro o e-mail de **login** no Keycloak (o id do agregado é o `sub`), depois o banco. **Estabelecimento:** o e-mail é contato do espaço (o painel diz isso no campo) e o login do dono não muda
8. `email` recebe o endereço novo, `email_verified_at` é atualizado e os campos de token são limpos

### 🔴 Por que o e-mail só muda no clique

Até 03/out/2026 o PATCH gravava o endereço novo **na hora** e o clique só repetia a gravação. Três defeitos:

- **O login nunca mudava.** O Keycloak seguia no e-mail antigo, e o "Esqueci a senha" ia para o endereço antigo — para sempre.
- **O saque usava confirmação herdada.** `email_verified_at` era do endereço antigo e continuava liberando o saque PIX com um e-mail que ninguém provou ter.
- **O painel mandava um link a cada save.** O estabelecimento chamava `changeEmail` sempre que o campo vinha no corpo — e o formulário de identidade sempre o manda.

### Por que Keycloak antes do banco

O Keycloak é quem pode **recusar**: outra conta já usa o endereço — inclusive de
outro tipo, porque músico e público são usuários distintos no mesmo realm, e a
checagem do PATCH só olha a própria tabela.

| Resultado | Resposta | Estado |
|---|---|---|
| Endereço usado por outra conta (409 do Keycloak, ou `P2002` no banco) | 409 | Pedido descartado (`email_pending` e token limpos); e-mail atual intacto. Se o Keycloak já tinha trocado, é revertido |
| Keycloak fora do ar | 503 | Nada muda; o **mesmo link** funciona quando ele voltar |
| Usuário inexistente no Keycloak | 200 | Banco atualizado, aviso no log |

⚠️ O `PUT` no Keycloak manda a **representação inteira** do usuário (GET → PUT),
não parcial: a partir do Keycloak 24 (produção roda 26) um PUT sem `attributes`
pode descartar atributos fora do perfil de usuário — e `establishment_ids` /
`band_ids` são o que autoriza o dono. Verificado contra o Keycloak 22 local em
03/out/2026: login pelo novo e-mail aceito, pelo antigo recusado, atributos
preservados, conflito detectado.

---

## 6. Mapa de emails do produto

> **Princípio:** email é para *registros* e *ações de segurança*. Eventos transacionais rápidos ficam como push notification.

| Trigger | Canal | Destinatário | Template | Status |
|---|---|---|---|---|
| Cadastro de conta | Email | Músico / Estabelecimento / Público | `email-verification.tsx` | ✅ Template pronto |
| Troca de email solicitada | Email | Novo email do usuário | `email-change.tsx` | ✅ Enviado (`mail-event.handler.ts`) |
| Booking confirmado | Email | Músico + Estabelecimento | `booking-confirmed.tsx` | ✅ Enviado (`scheduling-events.handler.ts`) |
| Booking cancelado | Email | Músico + Estabelecimento | `booking-cancelled.tsx` | ✅ Enviado (`scheduling-events.handler.ts`) |
| Código de assinatura do contrato | Email | Parte que assina | `MailService.sendContractSignatureChallenge` | ✅ Enviado |
| Contrato emitido / assinado pelas duas partes (PDF anexo) | Email | As duas partes | `MailService.sendContractDocument` | ✅ Enviado (`contract-delivery.handler.ts`) |
| Chave PIX de saque alterada | Email | Músico | `MailService.sendPixKeyChanged` | ✅ Enviado (`mail-event.handler.ts`) |
| Redefinição de senha | Email | Todos | Keycloak (`execute-actions-email`) | ✅ Enviado pelo Keycloak |
| Boas-vindas | Email | Todos | `welcome.tsx` | ✅ Enviado na **primeira confirmação** de e-mail (`VerifyEmailService.verify`) e ao concluir o cadastro pelo Google (`SocialSignupUseCase`). Botão só para o estabelecimento (painel); quem usa o app recebe "abra o app" |
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
| `mail.service.ts` | Métodos de envio: `sendEmailVerification`, `sendEmailChange`, `sendBookingConfirmed`, `sendBookingCancelled`, `sendContractSignatureChallenge`, `sendContractDocument`, `sendPixKeyChanged`, `sendWelcome` (este sem chamador) |
| `mail-event.handler.ts` | Listeners `@OnEvent` para `PixKeyChangedEvent`, `MusicianEmailChangedEvent`, `EstablishmentEmailChangedEvent`, `AudienceEmailChangedEvent` |
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
| ✅ | Templates e métodos de serviço para verificação, troca, booking, contrato e troca de chave PIX |
| ✅ | **Troca de e-mail sincronizada com o Keycloak** (músico e público), só depois do clique — §5 |
| ✅ | **Boas-vindas** na primeira confirmação e no cadastro pelo Google. Não sai no cadastro por senha: o endereço ainda não foi provado, e boas-vindas para e-mail digitado errado ou de robô queima a reputação do domínio de envio |
| ⏳ | Avisar o e-mail **antigo** quando uma troca é pedida (como já se faz na troca de chave PIX). Com a troca sincronizada, quem roubar a sessão e confirmar um endereço próprio passa a controlar o "Esqueci a senha" |
| ⏳ | Trocar o e-mail de **login** do dono do estabelecimento — hoje não há tela para isso (o campo do painel é contato) |
| ✅ | **Booking confirmado/cancelado → e-mail para músico E estabelecimento** — `NotificationsSchedulingEventsHandler` (Bloco 9.5, 07/ago/2026). Os templates existiam desde sempre sem chamador; `BookingEventsHandlers` só logava. Best-effort: falha de e-mail não desfaz o booking, e falha num destinatário não impede o outro. |
| ✅ | **Inquiry criada/aceita/recusada → tempo real** (socket + push), deliberadamente **sem** e-mail: é negociação, não comprovante. O estabelecimento recebe na room `establishment:<id>`, nova no mesmo bloco. |
| ⏳ | Emails de saque PIX (`WithdrawalRequestedEvent`) |
| ⏳ | Emails para músico e estabelecimento verificados por admin |
| ⏳ | Template e método `weekly-musician-report.tsx` (Bloco 7) |
