FROM node:18-alpine AS base

# Instalar dependências do sistema
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependências
RUN npm ci --only=production && npm cache clean --force

# Gerar Prisma Client
RUN npx prisma generate

# Estágio de desenvolvimento
FROM base AS development
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# Estágio de build
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

# Estágio de produção
FROM node:18-alpine AS production
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