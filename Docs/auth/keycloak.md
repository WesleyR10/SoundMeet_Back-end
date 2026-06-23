# Keycloak - SoundMeet

## Decisao

O SoundMeet usa um unico realm Keycloak chamado `soundmeet`, com roles globais, roles granulares no client da API e groups/attributes para representar contexto de permissao.

Esta decisao foi escolhida porque o SoundMeet e uma plataforma multi-lado:

- publico (`audience`) interage com QR Code, pedidos, votos e gorjetas;
- musicos (`musician`) gerenciam perfil, catalogo, IA musical, agenda e bandas;
- estabelecimentos (`establishment`) gerenciam perfil, eventos, contratacao e analytics;
- administradores (`admin`) operam a plataforma;
- o mesmo usuario pode acumular papeis, por exemplo musico e dono de estabelecimento.

Realm separado por tenant foi evitado por enquanto porque aumentaria complexidade operacional antes do produto precisar de isolamento enterprise forte.

## Arquivos

- Realm export: `infra/keycloak/realm-soundmeet.json`
- Script idempotente: `scripts/keycloak-sync.mjs`
- Compose local: `docker-compose.yml`

## Como aplicar localmente

1. Suba Keycloak e banco:

```bash
docker compose up -d postgres-keycloak keycloak
```

2. Sincronize a configuracao versionada:

```bash
npm run keycloak:sync:local
```

3. Acesse:

- Admin console: `http://localhost:8080`
- Usuario admin local: `admin`
- Senha local: `admin123`

## Clients

### `soundmeet-api`

Client confidencial usado como resource server da API NestJS.

Responsabilidades:

- concentrar roles granulares da API;
- expor mappers de claims usados pelo backend;
- permitir service account apenas para automacoes internas controladas.

Em desenvolvimento, o secret padrao aplicado pelo script e:

```bash
KEYCLOAK_API_CLIENT_SECRET=soundmeet-api-local-secret
```

Em staging/producao, esse valor deve vir de secret manager/env seguro.

### `soundmeet-web`

Client publico para frontend web com Authorization Code + PKCE.

### `soundmeet-mobile`

Client publico para app mobile com deep links e Authorization Code + PKCE.

### `soundmeet-admin`

Client publico para console administrativo.

## Roles

### Realm roles

- `audience`
- `musician`
- `establishment`
- `admin`
- `support`

Essas roles definem o tipo principal de usuario e sao consumidas pelo `RolesGuard`.

### Client roles de `soundmeet-api`

- `establishment_owner`
- `establishment_staff`
- `band_manager`
- `band_member`
- `event_manager`
- `payment_manager`
- `analytics_viewer`
- `ai_operator`

Essas roles devem ser usadas para autorizacoes mais finas, quando a role global for insuficiente.

## Multi-tenancy e permissionamento contextual

O modelo atual e single realm com groups e attributes.

Claims suportadas nos tokens:

- `tenant_id`
- `organization_id`
- `establishment_ids`
- `band_ids`
- `groups`

O script `scripts/keycloak-sync.mjs` replica os mappers de contexto do client `soundmeet-api` para `soundmeet-web`, `soundmeet-mobile` e `soundmeet-admin`, e adiciona audience mapper para `soundmeet-api`. Isso permite que tokens emitidos pelos clients publicos carreguem contexto suficiente para o backend.

Uso esperado:

- `tenant_id`: fronteira logica principal do usuario. No MVP pode ser `soundmeet`.
- `organization_id`: organizacao comercial/operacional quando houver B2B.
- `establishment_ids`: estabelecimentos que o usuario pode operar.
- `band_ids`: bandas que o usuario pode gerenciar ou integrar.
- `groups`: trilha hierarquica do Keycloak para auditoria e suporte.

O backend nao deve confiar apenas em role global. Para rotas sensiveis, o fluxo recomendado e:

1. validar JWT com issuer/JWKS;
2. validar role minima com `RolesGuard`;
3. validar ownership/escopo no use case ou guard especifico usando IDs do dominio.

Exemplo:

- `establishment` permite acessar superficie de estabelecimento;
- `establishment_ids` decide quais estabelecimentos aquele usuario realmente pode alterar.

## Estrutura de groups

Base versionada:

```text
/soundmeet
  /audiences
  /musicians
  /establishments
    /_template
      /owners
      /staff
      /analytics
  /bands
    /_template
      /managers
      /members
  /admins
  /support
```

Para entidades reais, a convencao futura deve ser:

```text
/soundmeet/establishments/{establishment_id}/owners
/soundmeet/establishments/{establishment_id}/staff
/soundmeet/bands/{band_id}/managers
/soundmeet/bands/{band_id}/members
```

Os grupos `_template` nao representam entidades reais; servem como padrao operacional para automacoes futuras.

## Backend NestJS

O backend valida tokens em `auth-module`:

- `AUTH_JWT_VALIDATION_MODE=local`: usa `JWT_SECRET`, adequado para testes/dev isolado.
- `AUTH_JWT_VALIDATION_MODE=keycloak`: valida RS256 via JWKS, issuer do realm e opcionalmente audience/`azp`.

Variaveis relevantes:

```bash
AUTH_JWT_VALIDATION_MODE=keycloak
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=soundmeet
KEYCLOAK_CLIENT_ID=soundmeet-api
KEYCLOAK_JWKS_URI=http://localhost:8080/realms/soundmeet/protocol/openid-connect/certs
KEYCLOAK_JWKS_CACHE_TTL_SECONDS=300
KEYCLOAK_VERIFY_AUDIENCE=false
```

Quando a API roda dentro do Docker, `KEYCLOAK_URL` deve continuar representando o issuer publico do token (`http://localhost:8080` no ambiente local). Ja `KEYCLOAK_JWKS_URI` pode apontar para o host interno Docker (`http://keycloak:8080/...`) para evitar acesso via host bridge.

`KEYCLOAK_VERIFY_AUDIENCE=false` e tolerante para desenvolvimento, porque alguns clients publicos podem nao emitir `aud` exatamente como a API espera sem ajustes adicionais de audience mapper. Em producao, a recomendacao e ligar:

```bash
KEYCLOAK_VERIFY_AUDIENCE=true
```

e garantir que tokens emitidos pelos clients carreguem `aud` ou `azp` compativel com `soundmeet-api`.

## Seguranca

- Nao versionar secrets reais de clients.
- Usar HTTPS e `sslRequired=external` fora do ambiente local.
- Usar PKCE nos clients publicos.
- Manter access token curto (`900s` no export).
- Validar ownership no backend; roles nao substituem regras de dominio.
- Evitar realm por tenant ate existir necessidade enterprise real.

## Evolucao futura

Quando o produto evoluir para B2B/enterprise, reavaliar:

- Keycloak Organizations em versoes mais novas;
- realm por tenant apenas para clientes com isolamento contratual forte;
- automacao de criacao de groups por estabelecimento/banda;
- guards especificos de ownership usando `establishment_ids` e `band_ids`;
- mappers de audience estritos para producao.
