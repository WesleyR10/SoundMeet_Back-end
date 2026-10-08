# ─────────────────────────────────────────────────────────────────────────────
# Estágios: base (deps + Prisma Client) → prod-deps (só o que roda) → build
# (compila) → production (imagem final). `development` fica disponível.
#
# 🔴 A ORDEM DOS COPY É O CACHE. Cada camada só é refeita quando o que foi
# copiado para ela muda. Até 29/set/2026 a pasta `prisma/` inteira era copiada
# ANTES do `npm ci`: editar o seed ou criar uma migration reinstalava as ~1.350
# dependências do zero (3–8 min), sem nenhuma dependência ter mudado.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base

# Toolchain para compilar dependências nativas. Fica só nos estágios de
# construção — a imagem final parte de um `node:20-alpine` limpo.
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# 1) Dependências: esta camada só muda quando o lockfile muda.
#    O cache mount guarda os tarballs do npm ENTRE builds (fora da imagem): quando
#    o lockfile muda, só o que é novo é baixado.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --no-audit --no-fund

# 2) Prisma Client: só o SCHEMA entra aqui. Seed e migrations não mudam o client
#    gerado — copiá-los invalidaria esta camada à toa. (A pasta inteira chega no
#    estágio de build pelo `COPY . .` e vai para a imagem final de lá.)
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma.config.ts ./

# Variáveis necessárias para leitura do schema durante a geração
ENV DATABASE_URL=postgresql://soundmeet:soundmeet123@postgres:5432/soundmeet

# `prisma:prepare` = `prisma generate` + o link `@prisma/client/.prisma`, o mesmo
# que o `npm run build` faz. Aqui para que `prod-deps` herde o client pronto.
RUN npm run prisma:prepare

# Estágio de desenvolvimento
FROM base AS development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# Só as dependências que RODAM — sem nenhum arquivo de código-fonte, então esta
# camada é reaproveitada em todo build que não mexe em dependência ou schema.
#
# 🔴 `--omit=optional` é o que tira o ferramental do Prisma da produção. O
# `@prisma/client` 7 declara `prisma` (CLI) e `typescript` como peers OPCIONAIS,
# e o npm os marca `devOptional` no lockfile — `--omit=dev` sozinho os MANTÉM.
# Eram ~200 MB: CLI, Studio, `@prisma/dev` (um Postgres em WASM), engines,
# `effect`, `typescript`. Nada disso é carregado pelo app: migrations e seed
# rodam do host (`npx prisma migrate deploy`), nunca de dentro desta imagem.
# Verificado pelo lockfile em 29/set/2026: os 128 pacotes `devOptional` só são
# alcançáveis por dev ou peer opcional, e o único `optional` de produção é o
# `pg-cloudflare` (só existe para Cloudflare Workers).
# ⚠️ Se um dia a migration precisar rodar de DENTRO do container, use o estágio
# `migrate` abaixo — não traga o CLI de volta para `production`.
FROM base AS prod-deps
RUN npm prune --omit=dev --omit=optional --no-audit --no-fund

# Imagem de migração, sob demanda: `docker build --target migrate -t soundmeet-migrate .`
# e `docker run --rm -e DATABASE_URL=... soundmeet-migrate`. Não é construída
# pelo compose; existe para o deploy não depender de Node instalado no host.
FROM base AS migrate
COPY prisma ./prisma/
CMD ["npx", "prisma", "migrate", "deploy"]

# Estágio de build
FROM base AS build
COPY . .
RUN rm -f src/metadata.ts && npm run build

# Estágio de produção
FROM node:20-alpine AS production

# yt-dlp vem do release OFICIAL, não do apk.
#
# 🔴 O pacote do Alpine fica meses atrás do upstream. Em 24/ago/2026 ele
# entregava a build de 17/mar — cinco meses velha — e o YouTube recusava
# TODO download com 403: a URL assinada liberava só os primeiros ~512KB e
# recusava o resto, mesmo re-resolvendo a URL a cada bloco. Não era rate
# limit, não era bloqueio de IP, não era música de gravadora; era o extrator
# velho. A build de 19/ago usa o player client `visionos`, que ainda passa, e
# baixou o mesmo arquivo inteiro em 5s.
#
# O extrator do YouTube é alvo móvel: esta dependência PRECISA vir da fonte,
# senão o pipeline de IA musical morre inteiro sem nenhum erro no nosso código.
# Zipapp em vez do binário Linux porque este estágio é Alpine (musl) e o
# binário oficial é compilado contra glibc.
#
# `latest` por padrão é deliberado — versão velha aqui não degrada, quebra.
# Para build reproduzível, passe --build-arg YT_DLP_VERSION=2026.08.19.
ARG YT_DLP_VERSION=latest
RUN apk add --no-cache libc6-compat python3 ca-certificates \
    && if [ "$YT_DLP_VERSION" = "latest" ]; then \
         YT_DLP_URL="https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"; \
       else \
         YT_DLP_URL="https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp"; \
       fi \
    && wget -qO /usr/local/bin/yt-dlp "$YT_DLP_URL" \
    && chmod +rx /usr/local/bin/yt-dlp \
    && /usr/local/bin/yt-dlp --version

# Default seguro; o compose de desenvolvimento sobrescreve com `development`.
# DEPOIS do yt-dlp: qualquer linha acima dele invalida aquela camada e força um
# download novo do GitHub a cada build.
ENV NODE_ENV=production
WORKDIR /app

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nestjs

# Dependências ANTES do código: a camada de `node_modules` (a maior) só muda
# quando `prod-deps` muda. Deploy de código novo baixa só a camada do `dist`.
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist

# 🔴 NÃO REMOVA. Esta linha é o que faz a imagem SUBIR — e não parece.
#
# O plugin do @nestjs/swagger (nest-cli.json) gera um `_OPENAPI_METADATA_FACTORY`
# em cada DTO/input/presenter e, para enums e tipos referenciados, assa um
# `require()` com o caminho ABSOLUTO DO CÓDIGO-FONTE no momento do build —
# `require("/app/src/core/plans/domain/plan-tier.enum")`. São 61 arquivos do
# `dist`. O factory é chamado na aplicação dos decorators, ou seja, no LOAD do
# módulo: sem esse caminho resolver, `node dist/main` morre no boot com
# `MODULE_NOT_FOUND` antes de qualquer log da aplicação.
#
# O estágio de produção não copia `src/` (é TypeScript, e `require` não o
# carregaria de qualquer forma). O symlink faz `/app/src/X` cair em
# `/app/dist/X.js` — as duas árvores têm a mesma forma porque `rootDir: ./src`.
#
# Consequência a saber: `npm run start:prod` FORA do container não funciona,
# porque ali `./src` é o TypeScript de verdade. Rodar sempre pela imagem.
RUN ln -s ./dist ./src

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=12 CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (r) => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1));"

# `node` direto, não `npm run start:prod` (que é exatamente `node dist/main`).
# Com o npm no meio, o SIGTERM do `docker stop` chega ao npm e não ao app: o
# Nest não fecha conexões de Postgres/RabbitMQ com calma, e o container só morre
# no SIGKILL, 10 s depois. Um processo a menos, também, na memória.
CMD ["node", "dist/main"]
