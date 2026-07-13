#!/bin/bash
set -e

# Criar .env se não existir
if [ ! -f ./envs/.env ]; then
  if [ -f ./envs/.env.example ]; then
    cp ./envs/.env.example ./envs/.env
    echo "✅ Arquivo .env criado a partir do .env.example"
  else
    echo "❌ Erro: ./envs/.env.example não encontrado"
    exit 1
  fi
fi

# Carregar variáveis de ambiente
set -a
source ./envs/.env
set +a

echo "🚀 Iniciando bootstrap..."

# Subir serviços
npm run docker:up

# Aguardar PostgreSQL
echo "⏳ Aguardando PostgreSQL..."
docker exec soundmeet-postgres sh -c "until pg_isready -U ${POSTGRES_USER:-soundmeet} -d ${POSTGRES_DB:-soundmeet} >/dev/null 2>&1; do sleep 1; done"

# Executar migrations
echo "📦 Executando Prisma migrations..."
npx prisma db push || {
  echo "⚠️  Tentando com gateway IP..."
  GW=$(ip route | awk '/default/ {print $3; exit}')
  DATABASE_URL=$(echo "$DATABASE_URL" | sed "s|localhost:5432|${GW:-localhost}:5432|")
  DATABASE_URL=$DATABASE_URL npx prisma db push
}

echo "✅ Bootstrap concluído!"
