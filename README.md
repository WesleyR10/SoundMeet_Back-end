# SoundMeet — Backend

API do SoundMeet, a plataforma que conecta **músicos, público e estabelecimentos** em shows ao vivo:
pedido de música ao palco, gorjeta por PIX, contratação de show com contrato digital, agenda e
gamificação. Este repositório é a API; o app (`soundmeet-mobile`) e o painel web (`soundmeet-web`)
são repositórios separados que consomem esta API.

**Vai contribuir?** Comece pelo [`CONTRIBUTING.md`](CONTRIBUTING.md): ambiente, fluxo de Git e
definição de pronto.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | NestJS 11 + TypeScript (Express 5), Node 20 |
| Arquitetura | DDD + Clean Architecture (domínio em `src/core/`, adaptadores NestJS em `src/nest-modules/`) |
| Banco | PostgreSQL + Prisma 7 |
| Autenticação | Keycloak (JWT validado por JWKS) |
| Mensageria | RabbitMQ |
| Cache | Redis |
| Arquivos | S3 / Cloudflare R2 (MinIO no desenvolvimento local) |
| Tempo real | Socket.io |
| Documentação da API | Swagger (OpenAPI) |
| Qualidade | Jest, ESLint, Prettier |

## Rodando localmente

O passo a passo completo está no [`CONTRIBUTING.md`](CONTRIBUTING.md). Em resumo:

```bash
cp envs/.env.example envs/.env
npm ci
docker compose up -d postgres postgres-keycloak redis rabbitmq keycloak minio
npm run keycloak:sync:local
npm run prisma:generate
npx prisma migrate deploy
npm run seed -- --reset
npm run start:dev
```

| Endereço | O que é |
|---|---|
| `http://localhost:3000/api/v1` | API (prefixo global `api/v1` em todas as rotas) |
| `http://localhost:3000/api/docs` | Swagger — a lista de rotas sempre atualizada |
| `http://localhost:3000/api/v1/health` | Health check |
| `http://localhost:8080` | Keycloak |
| `http://localhost:15672` | Painel do RabbitMQ |
| `http://localhost:9001` | Console do MinIO |
| `http://localhost:8083` | Adminer (navegar no banco) |

Login de teste: os usuários do seed, todos com senha `Seed@123` —
[`Docs/autenticacao/usuarios-de-teste.md`](Docs/autenticacao/usuarios-de-teste.md).

> ⚠️ Não use `npm run docker:up` para o dia a dia: ele sobe também os serviços do worker de IA, que é
> um projeto à parte e não está neste repositório.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run start:dev` | API com recarga automática |
| `npm run rabbitmq:consumers:dev` | Consumidores das filas (outro terminal) |
| `npm test` | Testes unitários e de integração (`*.spec.ts`, `*.int-spec.ts`) |
| `npm run test:e2e` | Testes de ponta a ponta contra Postgres real (`test/**/*.e2e-spec.ts`) |
| `npm run lint` · `npm run typecheck` | Lint e checagem de tipos |
| `npm run typecheck:seed` | Checagem de tipos do seed (fica fora do `tsconfig` principal) |
| `npm run prisma:generate` | Gera o client do Prisma depois de mudar o schema |
| `npm run prisma:migrate` | Cria uma migration nova em desenvolvimento |
| `npm run seed -- --reset` | Recria os dados e os usuários de teste |
| `npm run keycloak:sync:local` | Aplica realm, clients e papéis no Keycloak local |
| `npm run drill:verify` | Verifica um banco restaurado (drill de backup) |

## Estrutura

```
src/
  core/<domínio>/         regras de negócio: domain/ (agregados, VOs, eventos),
                          application/ (use cases) e infra/ (Prisma e in-memory)
  nest-modules/<domínio>-module/
                          controllers, DTOs, presenters e injeção de dependência
prisma/                   schema, migrations e seed
test/                     testes de ponta a ponta (Postgres real)
infra/keycloak/           realm e compose de produção do Keycloak
scripts/                  sync do Keycloak, smoke test de produção, drill de restauração
envs/                     arquivos .env (só os .example vão para o repositório)
Docs/                     documentação — comece pelo Docs/README.md
```

Os módulos de referência — copie o padrão deles — são `src/core/musician/` +
`src/nest-modules/musicians-module/` e `src/core/establishment/` + `establishments-module/`.

## Documentação

O índice está em [`Docs/README.md`](Docs/README.md). Os mais usados:

| Documento | Para quê |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Regras de ouro, convenções e armadilhas técnicas (vale para humanos e para agentes de IA) |
| [`Docs/arquitetura/`](Docs/arquitetura/) | Como o código é organizado e a política HTTP da API |
| [`Docs/regras-de-negocio/`](Docs/regras-de-negocio/README.md) | O que a API já faz, um arquivo por domínio |
| [`Docs/funcionalidades/`](Docs/funcionalidades/) | O desenho por dentro das funcionalidades grandes (contrato, apresentação ao vivo, QR, e-mails) |
| [`Docs/autenticacao/`](Docs/autenticacao/) | Keycloak, proteção de rotas, login e usuários de teste |
| [`Docs/fluxo-de-trabalho/`](Docs/fluxo-de-trabalho/) | Branches, commits e pull requests |

## Observabilidade local (opcional)

O compose tem um profile `ops` com ferramentas de observação dos containers:

```bash
docker compose --profile ops up -d cadvisor dozzle uptime-kuma
```

| Endereço | Ferramenta |
|---|---|
| `http://localhost:8082` | cAdvisor — métricas dos containers |
| `http://localhost:9999` | Dozzle — logs dos containers |
| `http://localhost:3002` | Uptime Kuma — monitor de disponibilidade |

Os logs de todos os serviços giram por tamanho (10 MB × 5 arquivos), configurado em `x-logging` no
`docker-compose.yml`.

## WSL2

No WSL2 o `localhost` do Windows nem sempre é o do Linux. Se `http://localhost:3000` não abrir no
navegador do Windows, use o IP do WSL (`wsl hostname -I`) ou ative `localhostForwarding=true` em
`%UserProfile%\.wslconfig` e rode `wsl --shutdown`.

## Licença e confidencialidade

Código proprietário. Acesso restrito a quem assinou o termo de colaboração — não redistribua.
