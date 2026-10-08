# Documentação do backend — índice

API do SoundMeet em **NestJS + DDD + Clean Architecture**, com **Prisma/PostgreSQL**.
Começando agora? Leia antes o [`CONTRIBUTING.md`](../CONTRIBUTING.md) da raiz do repositório.

Cada pasta tem um assunto e o nome dela diz qual é. Cada assunto mora em **um** lugar; quando outro
documento precisa dele, aponta para lá em vez de repetir.

---

## Comece por aqui

1. [arquitetura/padrao-ddd-e-estrutura-de-pastas.md](arquitetura/padrao-ddd-e-estrutura-de-pastas.md) — como o código é organizado
2. [fluxo-de-trabalho/git-branches-e-commits.md](fluxo-de-trabalho/git-branches-e-commits.md) — branch, commit e pull request
3. [regras-de-negocio/](regras-de-negocio/README.md) — o arquivo do domínio da sua tarefa
4. [autenticacao/](autenticacao/) — quando a tarefa envolver login, papéis, proteção de rota ou usuários de teste

## As pastas

| Pasta | O que tem dentro |
|---|---|
| [`arquitetura/`](arquitetura/) | Como o código é organizado (DDD, módulos, convenções) e a política HTTP da API inteira (CORS, Swagger, container) |
| [`fluxo-de-trabalho/`](fluxo-de-trabalho/) | Branches, Conventional Commits, pull request |
| [`regras-de-negocio/`](regras-de-negocio/README.md) | **O que a API já faz**, um arquivo por domínio, com `[x]` feito / `[~]` parcial / `[ ]` pendente |
| [`funcionalidades/`](funcionalidades/) | O desenho por dentro das funcionalidades grandes: por que a arquitetura é assim e o que foi descartado |
| [`autenticacao/`](autenticacao/) | Keycloak (realm, clients, papéis, claims), como proteger uma rota, os fluxos de login e cadastro e os usuários de teste |
| [`ia-musical/`](ia-musical/README.md) | O contrato entre o backend e o worker de IA (cifra, letra sincronizada, separação de áudio) |
| [`operacao/`](operacao/) | Rodar em produção: backup, restauração e o drill antes do primeiro deploy |

> **Regra x funcionalidade:** `regras-de-negocio/contrato.md` diz *o que* o contrato faz hoje;
> `funcionalidades/contrato-digital.md` explica *como e por quê* ele foi desenhado assim. Mexendo no
> assunto, comece pela regra e leia o desenho antes de mudar a arquitetura.

## Procurando…

| Assunto | Abra |
|---|---|
| Se algo já existe na API | [regras-de-negocio/](regras-de-negocio/README.md) → arquivo do domínio |
| Estrutura de pastas, agregado, repositório, mapper | [arquitetura/padrao-ddd-e-estrutura-de-pastas.md](arquitetura/padrao-ddd-e-estrutura-de-pastas.md) |
| CORS, Swagger, Helmet, compose de produção | [arquitetura/seguranca-http-e-container.md](arquitetura/seguranca-http-e-container.md) |
| Realm, clients, papéis e claims | [autenticacao/keycloak.md](autenticacao/keycloak.md) |
| Proteger uma rota (ownership, guards) | [autenticacao/autorizacao-e-ownership.md](autenticacao/autorizacao-e-ownership.md) |
| Login, cadastro, Google, AUTH-1/AUTH-3 | [autenticacao/login-e-cadastro.md](autenticacao/login-e-cadastro.md) |
| Logins de teste do seed (`Seed@123`) | [autenticacao/usuarios-de-teste.md](autenticacao/usuarios-de-teste.md) |
| Contrato de show | [regras-de-negocio/contrato.md](regras-de-negocio/contrato.md) · [funcionalidades/contrato-digital.md](funcionalidades/contrato-digital.md) |
| Set ao vivo, relatório, currículo | [regras-de-negocio/apresentacao-ao-vivo.md](regras-de-negocio/apresentacao-ao-vivo.md) · [funcionalidades/apresentacao-ao-vivo-set-e-relatorio.md](funcionalidades/apresentacao-ao-vivo-set-e-relatorio.md) |
| Pedido de música e destaque pago | [regras-de-negocio/pedidos-de-musica.md](regras-de-negocio/pedidos-de-musica.md) · [funcionalidades/reembolso-do-destaque-pago.md](funcionalidades/reembolso-do-destaque-pago.md) (tarefa aberta) |
| Gorjeta, carteira, saque, custódia | [regras-de-negocio/pagamentos-e-carteira.md](regras-de-negocio/pagamentos-e-carteira.md) |
| QR code e links que abrem o app | [funcionalidades/qr-code-e-links-do-app.md](funcionalidades/qr-code-e-links-do-app.md) |
| E-mails que o produto envia | [funcionalidades/emails-do-produto.md](funcionalidades/emails-do-produto.md) |
| Link do Spotify (qual versão da música) | [regras-de-negocio/ponte-spotify.md](regras-de-negocio/ponte-spotify.md) · [funcionalidades/casamento-de-faixa-no-spotify.md](funcionalidades/casamento-de-faixa-no-spotify.md) |
| Folha de cifra, letra sincronizada | [ia-musical/folha-de-cifra.md](ia-musical/folha-de-cifra.md) |
| Modo Ensaio (stems) | [ia-musical/modo-ensaio.md](ia-musical/modo-ensaio.md) |
| Backup e restauração | [operacao/backup-e-restauracao.md](operacao/backup-e-restauracao.md) |

## Onde colocar um documento novo

- **Regra de um domínio** (o que a API faz) → o arquivo do domínio em `regras-de-negocio/`.
- **Desenho de uma funcionalidade grande** (decisões, alternativas, armadilhas) → `funcionalidades/`, com nome que diga o assunto.
- **Algo de infraestrutura ou produção** → `operacao/`.
- Nome de arquivo em português, minúsculo, com hífen, dizendo o assunto (`reembolso-do-destaque-pago.md`, não `todo.md`).

## Documentos internos

Alguns docs citados no código e nesta pasta (roadmap, produto, planos e preços, pagamentos,
jurídico, auditorias, operação) são **internos** e moram em `Docs/_privado/`, que não faz parte do
repositório. Um link para `_privado/` quebrado é esperado. Se uma tarefa precisar de algo de lá, o
trecho necessário vem na própria tarefa do Jira.

## Domínios (`src/core`)

`musician` · `establishment` · `audience` · `request` · `gamification` · `payment` · `scheduling` · `events` · `music-library` · `synced-lyrics` · `ai-audio` · `ai-cifra` · `auth` · `campaign` · `chat` · `contract` · `follow` · `indication` · `performance` · `plans` · `repertoire` · `personal-chord-sheet` · `review` · `shared`

---

## Mudança de nomes (03/out/2026)

A pasta foi reorganizada sem apagar conteúdo. Se você achar um caminho antigo num comentário ou
num documento, o novo é este:

| Antes | Agora |
|---|---|
| `architecture.md` | `arquitetura/padrao-ddd-e-estrutura-de-pastas.md` |
| `business-rules.md` | `regras-de-negocio/` (um arquivo por domínio; a seção "Superfície HTTP" foi para `arquitetura/seguranca-http-e-container.md`) |
| `workflow/git-workflow.md` | `fluxo-de-trabalho/git-branches-e-commits.md` |
| `auth/keycloak.md` | `autenticacao/` — dividido em `keycloak.md`, `autorizacao-e-ownership.md`, `login-e-cadastro.md` e `usuarios-de-teste.md` |
| `contract/contract-digital.md` | `funcionalidades/contrato-digital.md` |
| `performance/live-performance.md` | `funcionalidades/apresentacao-ao-vivo-set-e-relatorio.md` |
| `qr-code.md` | `funcionalidades/qr-code-e-links-do-app.md` |
| `email.md` | `funcionalidades/emails-do-produto.md` |
| `payment/request-boost-refund-todo.md` | `funcionalidades/reembolso-do-destaque-pago.md` |
| `AI-musician/spotify-track-matching.md` | `funcionalidades/casamento-de-faixa-no-spotify.md` |
| `AI-musician/chord-sheet.md` | `ia-musical/folha-de-cifra.md` |
| `AI-musician/practice-mode.md` | `ia-musical/modo-ensaio.md` |
| `AI-musician/external-apis.md` | `ia-musical/apis-de-letras-e-metadados.md` |
| `ops/backup-restore.md` | `operacao/backup-e-restauracao.md` |
