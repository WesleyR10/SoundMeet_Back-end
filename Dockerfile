FROM node:20-alpine AS base

# Instalar dependências do sistema
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Copiar arquivos de dependências
COPY package.json ./
COPY package-lock.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Instalar dependências (inclui dev para permitir geração do Prisma)
RUN npm ci --no-audit --no-fund

# Variáveis necessárias para leitura do schema durante a geração
ENV DATABASE_URL=postgresql://soundmeet:soundmeet123@postgres:5432/soundmeet

# Gerar Prisma Client
RUN npx prisma generate

# Estágio de desenvolvimento
FROM base AS development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# Estágio de build
FROM base AS build
COPY . .
RUN rm -f src/metadata.ts && npm run build && npm prune --omit=dev

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
WORKDIR /app

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copiar arquivos necessários
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma

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

CMD ["npm", "run", "start:prod"]
