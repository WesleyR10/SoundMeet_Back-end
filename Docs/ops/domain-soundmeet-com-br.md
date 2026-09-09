# Domínio `soundmeet.com.br` e integrações externas

**Registrado:** 29/ago/2026 na Hostinger.  
**Estado DNS em 08/set/2026 (reverificado):** apex **e** `www` resolvem para
`A 2.57.91.91` (parking da Hostinger, servidor `hcdn`), ambos **HTTP 200, sem
redirect**. Não é NXDOMAIN, e — ao contrário do `soundmeet.app` — **não há 308
para `www`**, então o apex já está apto a servir `/.well-known/*` assim que
alguma aplicação responder ali.

Este arquivo é o mapa do que o domínio precisa receber: API, auth, web, e-mail, Mercado Pago, Google **e o QR / App Links**.

> 🔴 **Corrigido em 07/set/2026.** A versão anterior deste doc dizia que o QR
> deveria continuar em `soundmeet.app`. Estava errado, e a premissa era mais
> grave que o detalhe: **`soundmeet.app` é de terceiro** — nunca foi comprado.
> O `www` dele serve outro produto (SPA Vite, em inglês, `theme-color #DC2E73`).
> Manter o QR ali significaria imprimir, em papel, um endereço que leva o fã ao
> site de um estranho.

---

## O que existe hoje (dois hosts, papéis diferentes)

| Host | Papel | Estado em 29/ago |
|---|---|---|
| `soundmeet.com.br` | Produção futura: API, web do estabelecimento, auth, e-mail | Comprado. Apex no parking Hostinger (`2.57.91.91`). Nada publicado |
| ~~`soundmeet.app`~~ | ~~QR impresso + App Links~~ | 🔴 **DE TERCEIRO, removido em 07/set/2026.** Resolve, **308 → `www`**, e o `www` serve outro produto. Ver [qr-code.md](../qr-code.md) |

`.env.production.example` já previa este recorte:

| Serviço | Host |
|---|---|
| API NestJS | `https://api.soundmeet.com.br` |
| Web (estabelecimento) | `https://app.soundmeet.com.br` |
| Apex / marketing | `https://soundmeet.com.br` |
| Keycloak | `https://auth.soundmeet.com.br` |
| E-mail | `noreply@soundmeet.com.br` |
| Google Calendar callback | `https://api.soundmeet.com.br/api/v1/google-calendar/callback` |
| Mercado Pago OAuth callback | `https://api.soundmeet.com.br/api/v1/musicians/mercadopago/callback` |
| **QR / App Links** | **`https://soundmeet.com.br/musico/<uuid>`** |

🔴 **O QR usa o APEX, não um subdomínio, e não pode redirecionar.** Nem o Android
nem o iOS seguem 3xx ao buscar `assetlinks.json`/AASA — então
`soundmeet.com.br` (sem `www`) precisa responder **200 direto**, servido pelo
`soundmeet-web`. Se o apex virar `www` por redirect, o App Link quebra em
silêncio.

⚠️ Trocar o host do QR exige **rebuild nativo** (`app.json`) — OTA não basta — e
um `assetlinks.json` errado no momento da instalação fica **em cache** no
Android: o APK abriria no navegador até alguém reinstalar.

---

## MCPs disponíveis neste ambiente (29/ago/2026)

| Serviço | MCP | O que dá para fazer daqui |
|---|---|---|
| Mercado Pago | `project-0-SoundMeet-mercadopago-mcp-server` | Apps, credenciais, webhook sandbox, docs, test users |
| Cloudflare | só **docs** autenticado; bindings/builds/observability pedem login | Consultar documentação. **Não** cria túnel nomeado nem zona DNS |
| Hostinger | **não conectado.** Existe MCP oficial (`hostinger-api-mcp`, npm), ausente do `.mcp.json` e do catálogo do Composio (verificado em 08/set) | Ligar exige token de API: hPanel → *Contas* → *Informações do desenvolvedor* → *API tokens*, com escopo de DNS + VPS. Sem ele, hPanel na mão |
| Keycloak | **não existe** | JSON versionado + `npm run keycloak:sync:local` |
| Google Cloud (OAuth Calendar) | **não existe** | Console do Google, passo a passo abaixo |

A sessão anterior afirmou que `soundmeet.com.br` era NXDOMAIN e que o caminho era apontar nameserver para a Cloudflare. O primeiro ponto **já não é verdade**. O segundo é uma opção, não um requisito — ver § túnel.

---

## DNS na Hostinger (o que você cadastra)

Registrar permanece na Hostinger. **Não mude nameserver** só para o webhook de sandbox: um quick tunnel já entrega HTTPS, e mover a zona agora bagunça e-mail (Resend) e o parking sem ganho de produto.

Quando for publicar de verdade, os registros abaixo. TTL 300 s na primeira vez.

| Tipo | Nome | Valor | Quando |
|---|---|---|---|
| `A` / `CNAME` | `@` | 🔴 o host onde o `soundmeet-web` rodar — **decisão aberta, ver abaixo** | bloqueia o QR e os App Links |
| `CNAME` | `www` | `soundmeet.com.br` ou o mesmo alvo do apex | junto com o apex |
| `CNAME` | `api` | origem da API (túnel nomeado **ou** VPS) | primeiro deploy / sandbox estável |
| `CNAME` | `app` | origem do `soundmeet-web` | W0–W4 em produção |
| `CNAME` | `auth` | origem do Keycloak | compose de produção do Keycloak |
| `TXT` | `@` | SPF do Resend | antes de e-mail transacional |
| `TXT` | `resend._domainkey` (ou o nome que o Resend mostrar) | DKIM | idem |
| `TXT` | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@soundmeet.com.br` | idem |

Passo a passo no hPanel: **Domínios → soundmeet.com.br → DNS / Zona DNS → Adicionar registro**. Não use o construtor de site da Hostinger no apex se a intenção é o Next.js nosso — os dois vão brigar pelo mesmo `A`.

### 🔴 Onde o `soundmeet-web` vai rodar — decisão ABERTA (08/set/2026)

É o bloqueio do apex, e por tabela do QR e dos App Links. Em 08/set o
`soundmeet-web` **não roda em lugar nenhum**: sem `git remote`, sem
`vercel.json`/`.vercel`, sem `Dockerfile`, sem `fly.toml` — só commits locais no
branch `develop`. Não há alvo para o registro `A`/`CNAME` do apex.

Três restrições que estreitam a escolha:

1. **Tem que responder na RAIZ do apex.** Android e iOS buscam `/.well-known/*`
   em caminho fixo e **não seguem 3xx**. Subdiretório (`/web`) não serve, e
   redirect de apex para `www` também não — foi exatamente o que inviabilizou o
   `soundmeet.app`.
2. **Tem que rodar Node.** As páginas públicas são `ƒ (Dynamic)` de propósito
   (o fetch bloqueante existe para o `notFound()` dar 404 real), então `next
   export` + FTP não é opção. Na Hostinger isso significa plano **VPS** ou o
   produto **Node.js / web apps** — a hospedagem compartilhada roda só PHP.
3. **O apex e a API são hosts diferentes.** `APP_URL` (base do QR) é
   `https://soundmeet.com.br`; `API_BASE_URL` é `https://api.soundmeet.com.br`.
   Confundir os dois imprime QR que responde 404 — ver
   [qr-code.md](../qr-code.md), § "Dois defeitos que a troca de host revelou".

⚠️ Uma parte do valor não espera pela API: `/.well-known/assetlinks.json` é rota
estática, sem dependência do Nest. Publicar o web já permite ao Android
verificar o domínio, mesmo antes de `api.soundmeet.com.br` existir — o que
importa porque o `autoVerify` roda na instalação do APK.

### E-mail (Resend)

O código já usa `MAIL_FROM=noreply@soundmeet.com.br`. Sem SPF/DKIM verificados no painel do Resend, produção cai em spam ou o Resend recusa o remetente. Os valores exatos saem do Resend (Domains → Add), não inventar.

---

## Túnel Cloudflare — o que manter, o que não criar

Há **dois** quick tunnels apontando para `localhost:3000` (sessão de 29/ago):

| Hostname | Situação |
|---|---|
| `https://default-andreas-patterns-suspension.trycloudflare.com` | o que está no `.env` e no webhook sandbox da SoundMeetPIX. `POST /api/v1/webhooks/mercadopago` chega no Nest (403 sem assinatura — esperado) |
| `https://populations-visited-initially-bullet.trycloudflare.com` | sobra da mesma sessão. Não cadastrar no MP |

Não precisa de um terceiro túnel. Precisa de **um** hostname estável, porque o Mercado Pago exige correspondência **exata** da Redirect URI e o quick tunnel morre com o processo.

**Túnel nomeado** (`api.soundmeet.com.br` → `localhost:3000`) exige:

1. Conta Cloudflare com o domínio **na zona** (nameserver Hostinger → Cloudflare **ou** domínio adicionado e nameserver trocado).
2. `cloudflared tunnel login` → `tunnel create soundmeet-api-dev` → CNAME `api` → `<uuid>.cfargotunnel.com`.
3. Recadastrar **uma vez** no MP e no Google a URL `https://api.soundmeet.com.br/api/v1/...`.

Um CNAME na Hostinger apontando para `*.cfargotunnel.com` **sem** a zona na mesma conta Cloudflare **não** leva tráfego — a doc da Cloudflare é explícita nisso. Por isso “só criar CNAME na Hostinger” não substitui nameserver/zona.

Enquanto o túnel nomeado não existir: cada sessão de teste do OAuth recadastra a Redirect URI no painel (não há MCP para isso). O webhook sandbox, esse sim, atualiza via `save_webhook`.

---

## Mercado Pago — duas apps, uma canônica

| App | ID | Papel |
|---|---|---|
| **SoundMeetPIX** | `7348187308113120` | **Canônica.** Homologada, webhook da screenshot, credenciais de produção ativas |
| SoundMeet | `2780871563698928` | Leftover. Produção **inativa**. O vendedor de teste `3629491815` nasceu **nesta** app (`client_id` no `/users/me`) |

Misturar `client_id` de uma com `webhook_secret` da outra é o que a sessão anterior fez — todo HMAC cai em `signature_mismatch`.

### O que cada variável faz

| Variável | O código usa? | Valor local correto |
|---|---|---|
| `MERCADOPAGO_API_URL` | Sim — sem ela a gorjeta cai no mock | `https://api.mercadopago.com` |
| `MERCADOPAGO_CLIENT_ID` | Sim — URL de autorização + `/oauth/token` | `7348187308113120` |
| `MERCADOPAGO_CLIENT_SECRET` | Sim — troca do `code` e refresh | secret de **produção** da PIX (o MP não emite secret de teste) |
| `MERCADOPAGO_REDIRECT_URI` | Sim — tem que ser idêntica ao painel | HTTPS do túnel `.../musicians/mercadopago/callback` |
| `MERCADOPAGO_WEBHOOK_SECRET` | Sim — HMAC `x-signature`, fail-closed | secret da **SoundMeetPIX**, aba Webhooks |
| `MERCADOPAGO_FEE_PERCENTAGE` | Sim — descontada da nossa comissão | `0.99` |
| `MERCADOPAGO_APP_RETURN_URL` | Sim — deep link depois do OAuth | `soundmeet://carteira/mercadopago` |
| `MERCADOPAGO_PLATFORM_ACCESS_TOKEN` | **Não** | TEST- da PIX, só referência. Cobrança usa o token **do músico** |
| `MERCADOPAGO_PUBLIC_KEY` | **Não** | TEST- da PIX. Gorjeta é PIX; cartão de assinatura é Asaas |

`POST /v1/orders` (o gateway real) **recusa** credencial `TEST-`:

> *Test credentials are not supported, use test users with production credentials to sandbox environment*

Provado em 29/ago: o mesmo `POST /v1/orders` com o `APP_USR-` do vendedor de teste devolveu **201** + QR PIX sandbox. A Payments API (`POST /v1/payments`) aceita `TEST-` (parou num 400 de e-mail, não em 401). **Não trocar o gateway para Payments API** — o código está na API certa; o token de plataforma `TEST-` é que não cria order.

### Webhooks vs IPN

| Canal | Configurar? | Por quê |
|---|---|---|
| **Webhooks** (Notificações → Webhooks) | Sim. Tópicos `payment` + `order` | HMAC com secret. O controller só processa `type=payment`; `order` responde 200 e ignora (o MP não reenvia para sempre) |
| **IPN** | **Não** | A própria doc do MP: IPN será descontinuada e **não valida origem com a chave secreta**. Configurar os dois duplica entrega. IPN ainda configura a URL para **todas** as apps da conta |

Redirect URI **não** fica em IPN. Fica em **Configurações da aplicação → URLs de redirecionamento**. Não há MCP para editar isso numa app já criada.

Valor a cadastrar hoje (túnel vivo):

```
https://default-andreas-patterns-suspension.trycloudflare.com/api/v1/musicians/mercadopago/callback
```

`https://www.soundmeet.com.br/...` no painel de teste do MP responde 400 porque não há app publicada lá — esperado.

### Rotação

O access token de **produção** `APP_USR-7348187…` passou por chat. Painel → Credenciais de produção → Mais opções → Renovar (há ~12 h de sobreposição). Não volta para o `.env` local.

---

## Keycloak

Não há MCP. O realm versionado é `infra/keycloak/realm-soundmeet.json`. Em 29/ago foram **acrescentados** (não substituídos) os origins de `soundmeet.com.br` nos clients `soundmeet-web` e `soundmeet-admin`. Em 07/set os de `soundmeet.app` **saíram** — o domínio é de terceiro e nunca foi nosso.

⚠️ **Rodar `keycloak:sync` sem rebuildar o backend quebra o cadastro.** Aconteceu
em 07/set/2026: o sync aplicou `directAccessGrantsEnabled: false` no client
`soundmeet-mobile` (AUTH-1), mas a imagem Docker em execução era de **29/ago** —
código anterior ao AUTH-1, que ainda fazia o auto-login do registro por aquele
client. Resultado: `POST /auth/register` criava a conta e falhava no login
seguinte (`Keycloak request failed: 400` → 503 no web), com a mensagem *"Conta
criada com sucesso, mas não foi possível autenticar automaticamente"*. O sync e
o `docker compose build app` andam juntos.

Aplicar no Keycloak local:

```bash
cd soundmeet-backend && npm run keycloak:sync:local
```

Google como IdP do realm (`GOOGLE_KEYCLOAK_CLIENT_ID` / `SECRET`) é outro OAuth, distinto do Calendar. Redirect do Keycloak: `{KEYCLOAK_URL}/realms/soundmeet/broker/google/endpoint`.

---

## Google Calendar (console Cloud)

Não há MCP. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → o client OAuth da agenda:

| Ambiente | Redirect URI |
|---|---|
| Local | o que já está em `GOOGLE_CALENDAR_REDIRECT_URI` no `.env` |
| Produção | `https://api.soundmeet.com.br/api/v1/google-calendar/callback` |

O `state` do Calendar e o do Mercado Pago compartilham `OAuthStateService` com `purpose` distinto — um `state` de agenda não vincula conta que recebe dinheiro.

---

## Cartões de teste (públicos, doc do MP)

Para Checkout Transparente / cartão. A gorjeta SoundMeet é **PIX**; estes cartões servem se alguém exercitar cartão no sandbox, não o caminho da gorjeta.

| Bandeira | Número | CVV | Validade |
|---|---|---|---|
| Mastercard | 5480 8328 0103 3311 | 123 | 11/30 |
| Visa | 4235 6477 2802 5682 | 123 | 11/30 |
| American Express | 3753 651535 56885 | 1234 | 11/30 |
| Elo Débito | 5067 7667 8388 8311 | 123 | 11/30 |

O **status** do pagamento vai no **nome do titular**: `APRO`, `OTHE`, `CONT`, `CALL`, `FUND`, `SECU`, `EXPI`, `FORM`. CPF de teste: `12345678909`.

Fonte canônica no código: `src/nest-modules/payment-module/testing/mercadopago-sandbox.fixture.ts`.
