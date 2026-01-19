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
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copiar arquivos necessários
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma
RUN ln -s ./dist ./src

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=12 CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (r) => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1));"

CMD ["npm", "run", "start:prod"]
