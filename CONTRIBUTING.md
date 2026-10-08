# Contribuindo com o SoundMeet — Backend

Bem-vindo. Este guia leva você do clone ao primeiro pull request. Meta: ambiente rodando em menos de
1 hora. Se travar em algum passo por mais de 20 minutos, pergunte no canal da equipe — travar
sozinho não ajuda ninguém.

Antes do primeiro acesso você assinou o termo de colaboração. Ele vale para tudo o que está aqui:
código, documentos e o que você aprender sobre o produto são confidenciais.

---

## 1. O que você precisa

- Node.js 20 ou 22 e npm
- Docker + Docker Compose
- Git configurado com o e-mail da sua conta do GitHub

## 2. Subir o ambiente

```bash
cp envs/.env.example envs/.env          # valores de desenvolvimento; nunca use credencial real
npm ci
docker compose up -d postgres postgres-keycloak redis rabbitmq keycloak minio
npm run keycloak:sync:local             # cria realm, clients e roles no Keycloak local
npm run prisma:generate
npx prisma migrate deploy
npm run seed -- --reset                 # usuários de teste, eventos, pedidos, contratos  (Backend)
npm run start:dev                       # API em http://localhost:3000          (Mobile)
npm run rabbitmq:consumers:dev          # opcional, outro terminal: consumidores de eventos/filas
```

A API lê `envs/.env` (e `.env.local`, se existir), com os serviços em `localhost`.

Confira:
- Health: `http://localhost:3000/api/v1/health`
- Swagger: `http://localhost:3000/api/docs`
- Login de teste: qualquer usuário do seed, senha `Seed@123` (lista em `Docs/autenticacao/usuarios-de-teste.md`)

> ⚠️ **Não use `npm run docker:up`.** Ele sobe todos os serviços do compose, inclusive os do worker
> de IA, que é um serviço à parte e não está neste repositório — o build falha. Suba só os serviços
> listados acima.

## 3. Antes de codar

Leia nesta ordem (uns 40 minutos):

1. [`CLAUDE.md`](CLAUDE.md) — regras de ouro, convenções e armadilhas técnicas. Vale para humanos
   também.
2. [`Docs/arquitetura/padrao-ddd-e-estrutura-de-pastas.md`](Docs/arquitetura/padrao-ddd-e-estrutura-de-pastas.md) — o padrão DDD do projeto.
3. Um módulo de referência inteiro: `src/core/musician/` + `src/nest-modules/musicians-module/`.
4. [`Docs/regras-de-negocio/`](Docs/regras-de-negocio/README.md) — abra o arquivo do domínio da sua tarefa.

## 4. Fluxo de trabalho

1. Pegue uma tarefa da sprint no Jira e mova para *Em andamento*.
2. Crie a branch a partir de `develop`:
   ```bash
   git checkout develop && git pull
   git checkout -b feature/SM-123-descricao-curta     # ou bugfix/SM-123-...  (Nome da branch estará no Jira)
   ```
3. Commits em [Conventional Commits](Docs/fluxo-de-trabalho/git-branches-e-commits.md):
   `feat(payment): valida chave PIX no saque`.
4. Abra o PR para `develop` assim que estiver pronto (ou como *draft* para pedir ajuda cedo).
5. O PR só entra com **CI verde** e **aprovação do fundador**. Ninguém faz push direto em `develop`
   ou `master`.

Ninguém além do fundador leva código para `master` nem faz deploy.

## 5. Definição de pronto

- [ ] Resolve o que a tarefa pede — e só isso (diff mínimo, sem refatoração fora do escopo)
- [ ] Segue o padrão dos módulos de referência
- [ ] Testes do que mudou; use case novo tem teste de domínio
- [ ] `npm run lint`, `npm run typecheck` e `npm test` passam localmente
- [ ] Se mexeu no seed: `npm run typecheck:seed`
- [ ] Se mexeu no schema: migration nova (nunca editar migration existente)
- [ ] Se mudou regra de negócio: o arquivo do domínio em `Docs/regras-de-negocio/` atualizado
- [ ] Descrição do PR explica o porquê e como testar

## 6. Regras de segurança

- Nunca commite `.env`, chave, token ou dado real. O `.gitignore` protege `envs/*`, mas a
  responsabilidade é sua.
- Você trabalha **só** com o ambiente local e usuários de teste. Não tente acessar produção.
- Assistente de IA pode ser usado; não cole nele segredo nem dado real.
- Achou uma falha de segurança? Avise o fundador em privado, não em canal aberto nem em issue.

## 7. Para quem é de DevOps

A infraestrutura mora neste repositório hoje: `docker-compose.yml` (dev),
`docker-compose.prod.yml` (produção), `Dockerfile`, `infra/keycloak/`, `.github/workflows/` e
`scripts/`. Leia antes:

- [`Docs/operacao/backup-e-restauracao.md`](Docs/operacao/backup-e-restauracao.md) — o que precisa estar cumprido antes do
  primeiro deploy, e o drill (`npm run drill:verify`).
- `scripts/smoke-test-prod.sh` — sobe a stack de produção num projeto isolado e valida.

Todo trabalho de infraestrutura é validado em **staging**. Segredos e servidor de produção ficam
com o fundador, que aplica o que for aprovado.

## 8. Dúvidas

Pergunte cedo. Uma pergunta de 2 minutos economiza um PR refeito.
