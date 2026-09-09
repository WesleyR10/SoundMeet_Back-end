# 📱 QR Code — Spec (Perfil permanente + validação de scan)

## Princípio: dois níveis

1. **QR permanente (identidade/navegação)** — sem expiração.
   - Conteúdo: `https://soundmeet.com.br/musico/{musicianId}` ou `https://soundmeet.com.br/local/{establishmentId}`.
   - Gerado na criação do agregado (`generateQRCode`) e estável (pode ser impresso em mesa/cartão/palco).
   - Abrir perfil é **público** → replay não causa dano; não precisa de token/JWT.

2. **Validação no backend (autorização de ações)** — só quando o scan gera efeito (pontuar, resgatar benefício, registrar presença).
   - O app lê o QR permanente → chama o backend com `musician_id` + usuário autenticado → backend valida regras e registra.

> Colocar JWT com expiração **dentro** do QR impresso é um anti-padrão: o QR "morreria" e exigiria reimpressão.

---

## 🔴 Por que o conteúdo é uma URL https, e não `soundmeet://` *(27/ago/2026)*

Até 27/ago/2026 o QR gravava `soundmeet://musician/<uuid>`. Um esquema
customizado **não faz nada** na câmera nativa de quem não tem o app instalado —
e esse é exatamente o momento de aquisição nº 1 do produto: um fã novo, num bar,
apontando a câmera para o adesivo da mesa. O scan simplesmente falhava, em
silêncio, no único instante em que a intenção era máxima.

A URL https resolve os dois casos com o **mesmo código impresso**:

| Situação | O que acontece |
|---|---|
| App instalado, App Links verificados | O SO abre o app direto, sem caixa de escolha |
| App não instalado | Abre `/musico/<uuid>` (SSR, W5), que já permite pedir música e mandar gorjeta, e oferece a instalação |

### Rota canônica, nunca um atalho `/m/<uuid>`

🔴 Um atalho economizaria ~4 caracteres no QR (irrelevante para a densidade) ao
custo de um redirect — e **redirect quebra Universal Link no iOS**: o SO não
segue 3xx, desiste e entrega ao navegador. A página `/musico/<uuid>` já existe;
o QR aponta para ela.

### Compatibilidade: os dois formatos são aceitos, para sempre

`ScanQRUseCase.parseMusicianQRCode` e `shared/utils/qr-link.ts` (mobile) aceitam
o link https **e** o `soundmeet://` legado. QR já impresso não se atualiza:
recusar o formato antigo transformaria cada adesivo existente em lixo no dia do
deploy.

### 🔴 A allowlist de host não é detalhe de implementação

`https://evil.example/musico/<uuid>` casa no padrão de caminho. Sem comparar o
host, um adesivo colado por cima do original levaria o fã a um domínio de
terceiro que o app trataria como nosso. Regras:

- **Backend:** compara `URL.origin` (protocolo + host + porta de uma vez) contra
  um conjunto — `APP_URL` e a constante canônica. As duas porque a *geração* usa
  a constante e a *validação* usa a config: num ambiente com
  `APP_URL=http://localhost:3000`, aceitar só a configurada faria o scanner
  recusar os QRs que o próprio ambiente acabou de gerar.
- **Mobile:** parse **manual por regex**, nunca `new URL()`. Mesma decisão de
  `shared/utils/external-url.ts` (SM-025): o `URL` do React Native é uma
  imitação que diverge da WHATWG, e o Jest roda em Node, onde `URL` é o de
  verdade — um validador escrito sobre `URL` passaria em todos os testes e
  falharia no aparelho.
- Igualdade exata do host, sempre. `endsWith` aceitaria `notsoundmeet.com.br`;
  `includes` aceitaria `soundmeet.com.br.evil.com`.

Testes: `scan-qr.use-case.spec.ts` ("ScanQRUseCase — formato do QR") e
`soundmeet-mobile/src/shared/utils/__tests__/qr-link.test.ts`.

---

## ✅ Host canônico: `soundmeet.com.br` *(decidido em 07/set/2026)*

🔴 **O host anterior, `soundmeet.app`, É DE TERCEIRO.** Ele nunca foi comprado —
entrou no código e nos docs por suposição, e sobreviveu a duas revisões sem
ninguém checar a titularidade. O domínio efetivamente registrado é
`soundmeet.com.br` (Hostinger, 29/ago/2026).

O que a verificação do domínio real mostrou, e que vale registrar porque é o
tipo de erro que não gera exceção nenhuma:

```
https://soundmeet.app/.well-known/assetlinks.json      → 308 → www.soundmeet.app
https://www.soundmeet.app/.well-known/assetlinks.json  → 200, mas devolve text/html
```

1. **O apex redirecionava para `www`.** Nem o Android nem o iOS seguem redirect
   ao buscar `assetlinks.json`/AASA — a mesma armadilha que faz um atalho
   `/m/<uuid>` ser recusado, agora no nível do host.
2. **O que responde em `www.soundmeet.app` é OUTRO PRODUTO.** SPA Vite, em
   inglês, `theme-color: #DC2E73`, descrição *"Find musicians, join jams, and
   make music together"*. O `soundmeet-web` é Next.js, pt-BR, teal `#00E0B8`. O
   `assetlinks.json` só respondia 200 porque a SPA tem catch-all devolvendo o
   `index.html`.

**A consequência era pior que o `soundmeet://` anterior:** aquele ao menos
falhava sem enganar. Um QR impresso apontando para `soundmeet.app` levaria o fã
ao site de um estranho — exatamente a falha do adesivo colado por cima do QR
original, só que cometida por nós, em papel, sem como corrigir depois de
impresso.

Ajustados em 07/set/2026: `QR_DEFAULT_BASE_URL`, a allowlist do `ScanQRUseCase`,
`ALLOWED_HOSTS` em `soundmeet-mobile/src/shared/utils/qr-link.ts` e os
`intentFilters`/`associatedDomains` do `app.json`.

### 🔴 Dois defeitos que a troca de host revelou *(08/set/2026)*

Nenhum dos dois aparecia como erro — nem de compilação, nem de teste.

**1. `APP_URL` de produção apontava para a API, não para o web.**
`envs/.env.production.example` trazia `APP_URL=https://api.soundmeet.com.br`.
Mas `APP_URL` é a base do **link gravado no QR** (`buildMusicianQrLink` em
`musician.aggregate.ts`, e a allowlist de origem do `ScanQRUseCase`) — não a
origem da API. Com aquele valor, o primeiro QR impresso em produção apontaria
para `https://api.soundmeet.com.br/musico/<uuid>`, onde o Nest responde **404**:
o prefixo global é `api/v1`. Adesivo impresso não se corrige. Hoje é
`https://soundmeet.com.br`, com o motivo escrito ao lado da variável.

**2. O backfill não alcançava as linhas que ele mesmo havia migrado.**
`backfill-qr-links.ts` selecionava por `qr_code startsWith "soundmeet://"` — o
esquema legado. As linhas já convertidas para https com o host antigo ficavam
**fora do filtro**: guardariam `https://soundmeet.app/...`, host que o
`ScanQRUseCase` passou a recusar. Resultado: QR exibido no app e impossível de
escanear, sem erro em lugar nenhum. O critério passou a ser **"difere do link
canônico derivado do id"**, que cobre o esquema legado, a troca de host e
qualquer mudança futura de formato sem precisar prever qual foi. `null` também
conta como desatualizado — a coluna é nullable.

Aplicado no banco de desenvolvimento em 08/set: 8 músicos + 4 estabelecimentos,
`0` remanescentes no host antigo.

### ⚠️ Ainda falta antes de rebuildar

O apex de `soundmeet.com.br` está no **parking da Hostinger** (`A 2.57.91.91`,
servidor `hcdn`, apex e `www` respondendo 200 — sem redirect, verificado em
08/set/2026). Antes do rebuild nativo, três coisas:

1. **O `soundmeet-web` precisa RODAR em algum lugar.** Em 08/set ele não roda:
   sem `git remote`, sem `vercel.json`, sem `Dockerfile`. Não há alvo para o DNS
   apontar — este é o bloqueio real, e os outros dois dependem dele. Se o
   destino for a Hostinger, precisa ser plano **VPS ou Node.js/web apps**: a
   hospedagem compartilhada roda só PHP, e export estático não serve porque as
   páginas públicas são `ƒ (Dynamic)` de propósito (o fetch bloqueante existe
   para o `notFound()` dar 404 real).
   ⚠️ **Não pode ser um subdiretório** (`/web`): Android e iOS buscam
   `/.well-known/*` na **raiz** do host, caminho fixo, e não seguem 3xx. Quem
   responde em `/` tem que ser o Next.js.
2. `https://soundmeet.com.br/.well-known/assetlinks.json` respondendo **200 com
   `application/json`** — hoje 404, porque `ANDROID_SHA256_CERT_FINGERPRINTS`
   está preenchida só no `.env.local` de desenvolvimento;
3. `IOS_APP_TEAM_ID` preenchido, se for haver build iOS (sem ele o AASA responde
   404 de propósito — melhor que servir placeholder). Em 08/set **não há conta
   Apple nem build iOS** (0 builds no EAS), então o correto é seguir vazio: o
   Android funciona independente do iOS.

Os valores de produção do web estão em `soundmeet-web/.env.production.example`
(criado em 08/set; o repo só tinha `.env.example` e o `.env.local` de
desenvolvimento). ⚠️ `.env.local` **ganha** de `.env.production` na precedência
do Next — no host, exporte as variáveis no ambiente em vez de copiar arquivo.

🔴 **Rebuildar antes disso é pior que não rebuildar:** o `autoVerify` roda **no
momento da instalação**. Se o `assetlinks.json` não estiver correto ali, o
Android marca o domínio como não verificado **e guarda em cache** — o APK novo
abriria no navegador, e só reinstalando depois de arrumar.

Mapa DNS / API / auth: [ops/domain-soundmeet-com-br.md](ops/domain-soundmeet-com-br.md).

---

## Infraestrutura de App Links / Universal Links

Servida pelo `soundmeet-web` — que ainda **não** é quem responde em
`soundmeet.com.br` (o apex está no parking; ver a seção acima):

| Caminho público | Rota | Plataforma |
|---|---|---|
| `/.well-known/assetlinks.json` | `app/api/well-known/assetlinks` | Android |
| `/.well-known/apple-app-site-association` | `app/api/well-known/apple-app-site-association` | iOS |

- **Rewrite, nunca redirect** (`next.config.ts`): o iOS não segue 3xx ao buscar
  o AASA. O rewrite é interno ao servidor.
- **`content-type: application/json` forçado** no AASA: ele não tem extensão, e
  sem o header sai como `text/plain` e o iOS descarta sem avisar.
- 🔴 **Sem fingerprint/Team ID configurados, as rotas respondem 404** — de
  propósito. Um `assetlinks.json` com fingerprint errado é **pior** que ausente:
  o Android verifica, falha, e passa a tratar o domínio como não verificado, com
  cache. Ausente, ele apenas ainda não verificou.

**Insumos:**

- ✅ `ANDROID_SHA256_CERT_FINGERPRINTS` — **obtido em 27/ago/2026**, já em
  `soundmeet-web/.env.local`:
  `D1:CC:C0:E0:B8:3F:10:5B:8E:51:C7:88:88:0D:4F:36:7F:48:B8:3A:B7:11:CB:CC:B9:8D:9C:30:4A:FA:13:0E`

  Não precisou de build novo: extraído do APK do build EAS de 16/ago.
  ⚠️ `keytool -printcert -jarfile` **não serve** — só lê assinatura v1 (JAR), e
  o EAS assina só com v2/v3. Foi preciso ler o APK Signing Block à mão
  (`find EOCD → central directory → bloco → par 0x7109871A → signed data →
  certificates`). Confirmado como keystore do EAS pelo DN vazio e validade até
  2053, não chave de debug.

  🔴 **Ao publicar na Play Store com App Signing, o Google RE-ASSINA o app.** A
  partir daí vale o fingerprint do Play Console → Integridade do app. O campo
  aceita lista separada por vírgula — coloque os dois.

- ❌ `IOS_APP_TEAM_ID` — não existe ainda. Zero builds iOS no EAS e nenhuma
  conta de desenvolvedor Apple configurada (programa pago, US$99/ano). Sem ele o
  AASA responde 404 e Universal Links não funcionam no iOS. **O Android é
  independente disso** — metade da feature funciona sem.
- ❌ `APP_STORE_URL` / `PLAY_STORE_URL` — só existem depois de publicar. Sem eles
  a `InstallAppSheet` não renderiza (botão que leva a lugar nenhum é pior que a
  ausência do botão).

⚠️ O `app.json` do mobile mudou (`ios.associatedDomains`, `android.intentFilters`
com `autoVerify`) — isso é **configuração nativa**: exige rebuild, não sai por OTA.

---

## Estado atual (`ScanQRUseCase`)

- ✅ Gera o link https permanente nos agregados Musician/Establishment.
- ✅ Aceita link https (com allowlist de origem) **e** `soundmeet://` legado.
- ✅ Valida UUID e checa existência/atividade do músico antes de pontuar.
- ✅ Limite anti-abuso: **5 scans/dia por usuário, por músico**. Pontos por scan:
  **10** (máx. 50/dia por músico). Após o limite, o perfil continua abrindo e a
  interação é registrada com `points_earned = 0`.
- ⚠️ `soundmeet://establishment/<uuid>` e `/local/<uuid>` são **parseados** mas
  não têm fluxo de scan próprio — ver roadmap 7.15.

## Backfill

`npm run backfill:qr-links -- --dry-run` lista o que mudaria;
sem a flag, reescreve. Não reimprime adesivo nenhum — os antigos continuam
funcionando pelo parser de compatibilidade. Serve para que QR **novo** (exibido
no app, baixado, compartilhado) saia no formato que funciona na câmera.

## Nota arquitetural

O fluxo de scan faz `update(audience)` + `insert(userInteraction)` dentro de
`UnitOfWork`. A opção 3 do plano antigo (token curto + anti-replay com `jti` em
Redis) segue não implementada — só entra se a economia do app começar a atrair
automação.
