#!/usr/bin/env bash
#
# SM-020 — smoke test do `docker-compose.prod.yml`.
#
# 🔴 O endurecimento que este arquivo verifica é o tipo que falha silenciosamente:
# `read_only: true` não dá erro no `up`, dá erro na primeira escrita — que pode
# ser um upload de áudio às 22h de um sábado. Rodar isto ANTES do deploy é a
# diferença entre descobrir agora e descobrir em produção.
#
# Sobe a stack num projeto isolado (não toca o compose de desenvolvimento nem os
# containers que já estiverem de pé), confere seis invariantes e derruba tudo.
#
# Uso:  ./scripts/smoke-test-prod.sh
#       KEEP_UP=1 ./scripts/smoke-test-prod.sh   # deixa a stack rodando

set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

PROJECT="${SMOKE_PROJECT:-soundmeet-smoke}"
COMPOSE=(docker compose -f docker-compose.prod.yml -p "$PROJECT")
APP_PORT="${APP_PORT:-3099}"

failures=0
checks=0

pass() { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { checks=$((checks + 1)); failures=$((failures + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; }
info() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# O compose carrega `envs/.env.production` no serviço `app`, e em produção esse
# arquivo tem de existir mesmo.
#
# 🔴 Para o teste, geramos um com valores FICTÍCIOS MAS VÁLIDOS — copiar o
# `.example`, que tem os campos em branco de propósito, faz o Joi recusar o boot
# e o container entrar em restart loop. Foi assim que a primeira execução deste
# script descobriu que o `.example` omitia metade das variáveis obrigatórias.
#
# Nada aqui alcança serviço externo: as credenciais são sintaticamente válidas e
# semanticamente inúteis, que é exatamente o que um smoke test precisa.
ENV_FILE="envs/.env.production"
CREATED_ENV_FILE=0
if [ ! -f "$ENV_FILE" ]; then
  CREATED_ENV_FILE=1
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=3000
APP_URL=https://smoke.invalid
CORS_ALLOWED_ORIGINS=https://smoke.invalid
SWAGGER_ENABLED=false

AUTH_JWT_VALIDATION_MODE=keycloak
KEYCLOAK_URL=https://smoke.invalid
KEYCLOAK_REALM=soundmeet
KEYCLOAK_CLIENT_ID=soundmeet-api
KEYCLOAK_CLIENT_SECRET=$(openssl rand -hex 16)
KEYCLOAK_MOBILE_CLIENT_ID=soundmeet-mobile
KEYCLOAK_VERIFY_AUDIENCE=true
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=SMOKEACCESSKEYID
AWS_SECRET_ACCESS_KEY=$(openssl rand -hex 20)
AWS_S3_BUCKET=smoke-bucket
AWS_CLOUDFRONT_URL=https://smoke.invalid

ASAAS_API_URL=https://smoke.invalid
ASAAS_API_KEY=$(openssl rand -hex 16)
ASAAS_WALLET_ID=$(cat /proc/sys/kernel/random/uuid)
ASAAS_WEBHOOK_TOKEN=$(openssl rand -hex 16)

RESEND_API_KEY=re_$(openssl rand -hex 16)
MAIL_FROM=noreply@smoke.invalid

AI_AUDIO_PROGRESS_TOKEN=$(openssl rand -hex 16)
AI_CIFRA_PROGRESS_TOKEN=$(openssl rand -hex 16)
AI_WORKER_TOKEN=$(openssl rand -hex 16)
SYNCED_LYRICS_BULK_TOKEN=$(openssl rand -hex 16)

GOOGLE_CALENDAR_CLIENT_ID=smoke-client-id
GOOGLE_CALENDAR_CLIENT_SECRET=$(openssl rand -hex 16)
GOOGLE_CALENDAR_REDIRECT_URI=https://smoke.invalid/callback

CONTRACT_CHALLENGE_SECRET=$(openssl rand -hex 32)
TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)
EOF
fi

cleanup() {
  if [ "$CREATED_ENV_FILE" = "1" ]; then
    rm -f "$ENV_FILE"
  fi
  if [ "${KEEP_UP:-0}" != "1" ]; then
    info "Derrubando a stack de teste"
    "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1
  else
    info "KEEP_UP=1 — stack mantida no projeto '$PROJECT'"
  fi
}
trap cleanup EXIT

# Credenciais descartáveis: existem só durante o teste, e o compose recusa subir
# sem elas — o que é, ele mesmo, uma das garantias verificadas.
export SOUNDMEET_VERSION="smoke-$(date +%s)"
export APP_PORT
export CORS_ALLOWED_ORIGINS="https://smoke.invalid"
export POSTGRES_DB=soundmeet
export POSTGRES_USER=smoke
export POSTGRES_PASSWORD="smoke-$(openssl rand -hex 12)"
export RABBITMQ_USER=smoke
export RABBITMQ_PASSWORD="smoke-$(openssl rand -hex 12)"
export REDIS_PASSWORD="smoke-$(openssl rand -hex 12)"

info "0. O compose recusa subir sem credencial"
if env -u POSTGRES_PASSWORD "${COMPOSE[@]}" config --quiet >/dev/null 2>&1; then
  fail "subiu sem POSTGRES_PASSWORD — o \${VAR:?} não está protegendo"
else
  pass "recusa subir sem POSTGRES_PASSWORD"
fi

info "Subindo a stack (o build da imagem pode demorar na primeira vez)"
if ! "${COMPOSE[@]}" up -d --build --wait --wait-timeout 300; then
  fail "a stack não ficou saudável — veja: ${COMPOSE[*]} logs"
  "${COMPOSE[@]}" ps
  exit 1
fi
pass "todos os serviços ficaram healthy"

cid() { "${COMPOSE[@]}" ps -q "$1" 2>/dev/null; }

info "1. Nenhum container roda como root"
for svc in app postgres redis rabbitmq; do
  container="$(cid "$svc")"
  if [ -z "$container" ]; then
    fail "$svc: container não encontrado"
    continue
  fi
  uid="$(docker exec "$container" id -u 2>/dev/null)"
  if [ "$uid" = "0" ] || [ -z "$uid" ]; then
    fail "$svc roda como uid=${uid:-desconhecido}"
  else
    pass "$svc roda como uid=$uid"
  fi
done

info "2. A raiz do filesystem é somente leitura"
for svc in app postgres redis rabbitmq; do
  container="$(cid "$svc")"
  [ -z "$container" ] && continue
  if docker exec "$container" sh -c 'touch /smoke-proof' >/dev/null 2>&1; then
    fail "$svc permitiu escrever em /"
  else
    pass "$svc bloqueou escrita em /"
  fi
done

info "3. O app escreve em /tmp (uploads de áudio passam por os.tmpdir())"
app="$(cid app)"
if docker exec "$app" sh -c 'touch /tmp/smoke-proof && rm /tmp/smoke-proof' >/dev/null 2>&1; then
  pass "/tmp do app é gravável"
else
  fail "/tmp do app NÃO é gravável — todo upload de áudio falharia"
fi

info "4. Swagger desligado em produção"
code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/api/docs")"
if [ "$code" = "404" ]; then
  pass "/api/docs responde 404"
else
  fail "/api/docs respondeu $code — a documentação está exposta"
fi

info "5. Cabeçalhos de segurança do Helmet"
headers="$(curl -sI "http://127.0.0.1:${APP_PORT}/api/v1/health")"
for header in content-security-policy x-content-type-options; do
  if grep -qi "^${header}:" <<<"$headers"; then
    pass "$header presente"
  else
    fail "$header ausente"
  fi
done
if grep -qi '^x-powered-by:' <<<"$headers"; then
  fail "x-powered-by exposto"
else
  pass "x-powered-by removido"
fi

info "6. Bancos não publicam porta no host"
for svc in postgres redis rabbitmq; do
  published="$("${COMPOSE[@]}" ps --format json "$svc" 2>/dev/null | grep -o '"PublishedPort":[0-9]*' | grep -v ':0' | head -1)"
  if [ -n "$published" ]; then
    fail "$svc publicou porta no host ($published)"
  else
    pass "$svc só existe na rede interna"
  fi
done

info "Resultado"
if [ "$failures" -eq 0 ]; then
  printf '  \033[32m%d/%d verificações passaram\033[0m\n\n' "$checks" "$checks"
  exit 0
fi
printf '  \033[31m%d de %d verificações falharam\033[0m\n\n' "$failures" "$checks"
exit 1
