FROM node:20-alpine AS base

# Instalar dependências do sistema
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copiar arquivos de dependências
COPY package.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Instalar dependências (inclui dev para permitir geração do Prisma)
RUN npm install --no-audit --no-fund

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
RUN npm run build

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

USER nestjs

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
