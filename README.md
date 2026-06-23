# SoundMeet Backend

## Docs e roadmap

- Features do produto: [Features-SoundMeet.md](file:///home/wesleyr10/Programação/Projetos/SoundMeet/soundmeet-backend/Docs/Features-SoundMeet.md)
- Worker de cifras (MIR): [ai-cifra-mir-worker/README.md](file:///home/wesleyr10/Programação/Projetos/SoundMeet/soundmeet-backend/ai-cifra-mir-worker/README.md)

### Futuras features (P&D)

- Mood/Emotion (recomendação, playlist, tags): referência em https://github.com/AMAAI-Lab/Music2Emotion
- Restauração/masterização com prompts (feature premium): referência em https://github.com/AMAAI-Lab/SonicMaster
- App referência de UX/contexto para playlists por emoção: https://github.com/AMAAI-Lab/calm-me-down

## Rotas (HTTP)

### Prefixo global

Todas as rotas de controllers usam o prefixo global:

- Base: `/api/v1`

Esse prefixo é configurado em [main.ts](file:///home/wesleyr10/Programação/Projetos/SoundMeet/soundmeet-backend/src/main.ts#L23-L25).

### Swagger

- UI: `GET /api/docs`
- JSON (OpenAPI): `GET /api/docs-json`

O Swagger é configurado em [main.ts](file:///home/wesleyr10/Programação/Projetos/SoundMeet/soundmeet-backend/src/main.ts#L27-L57).

### Health

- Liveness: `GET /api/v1/health`

Implementado em [health.controller.ts](file:///home/wesleyr10/Programação/Projetos/SoundMeet/soundmeet-backend/src/health.controller.ts) e registrado em [app.module.ts](file:///home/wesleyr10/Programação/Projetos/SoundMeet/soundmeet-backend/src/app.module.ts#L14-L42).

### Músicos

Controller: [musicians.controller.ts](file:///home/wesleyr10/Programação/Projetos/SoundMeet/soundmeet-backend/src/nest-modules/musicians-module/musicians.controller.ts)

- `POST /api/v1/musicians`
- `GET /api/v1/musicians`
- `GET /api/v1/musicians/:id`
- `PATCH /api/v1/musicians/:id`
- `DELETE /api/v1/musicians/:id`

### Bandas

Controller: [bands.controller.ts](file:///home/wesleyr10/Programação/Projetos/SoundMeet/soundmeet-backend/src/nest-modules/musicians-module/bands.controller.ts)

- `POST /api/v1/bands`
- `GET /api/v1/bands/:id`
- `POST /api/v1/bands/:id/members`
- `DELETE /api/v1/bands/:id/members/:musicianId`

### Público (Audience)

Controller: [audiences.controller.ts](file:///home/wesleyr10/Programação/Projetos/SoundMeet/soundmeet-backend/src/nest-modules/audiences-module/audiences.controller.ts)

- `POST /api/v1/audiences`
- `GET /api/v1/audiences`
- `GET /api/v1/audiences/:id`
- `PATCH /api/v1/audiences/:id`
- `DELETE /api/v1/audiences/:id`
- `PATCH /api/v1/audiences/:id/complete-profile`
- `POST /api/v1/audiences/:id/attend-event`
- `POST /api/v1/audiences/:id/scan-qr`
- `POST /api/v1/audiences/:id/music-requests`
- `POST /api/v1/audiences/:id/votes`
- `POST /api/v1/audiences/:id/tips`
- `POST /api/v1/audiences/:id/social-shares`
- `POST /api/v1/audiences/:id/indications`
- `GET /api/v1/audiences/:id/recommendations/musicians`

## Como criar novas rotas (padrão do projeto)

### Onde colocar cada coisa

- Core (DDD/Clean): `src/core/<dominio>/...`
  - Use-cases em `application/use-cases`
  - Entidades/VO em `domain`
  - Repositórios em `domain/repositories` (interface) e `infra/db` (implementação)
- Adaptador HTTP (NestJS): `src/nest-modules/<dominio>-module`
  - Controller: recebe DTO, chama use-case e retorna presenter
  - Providers: liga interface de repositório à implementação

### Fluxo recomendado

- Crie/ajuste o use-case no domínio (core) e seus validators/DTOs de input.
- Crie um DTO no controller usando `OmitType`/`PickType`/classes do `class-validator` quando necessário.
- No controller:
  - Defina o prefixo com `@Controller("...")` (sem incluir `/api/v1`, porque o prefixo global já aplica)
  - Use `@Inject(SeuUseCase)` e chame `execute()`
  - Documente com `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiParam`
- Registre o controller no módulo correspondente (ex.: [musicians.module.ts](file:///home/wesleyr10/Programação/Projetos/SoundMeet/soundmeet-backend/src/nest-modules/musicians-module/musicians.module.ts)).

## Docker Compose: serviços, health, observabilidade e logging

O arquivo de composição é [docker-compose.yml](file:///home/wesleyr10/Programação/Projetos/SoundMeet/soundmeet-backend/docker-compose.yml).

### Serviços e portas

- `app` (NestJS): `3000:3000`
  - Swagger: `http://localhost:3000/api/docs`
  - Health: `http://localhost:3000/api/v1/health`
- `postgres` (principal): `5432:5432`
- `postgres-keycloak` (Keycloak DB): sem porta externa (apenas rede interna)
- `mongo`: `27017:27017`
- `redis`: `6379:6379`
- `rabbitmq`: `5672:5672` e management `15672:15672`
- `keycloak`: `8080:8080`
- `minio`: `9000:9000` e console `9001:9001`
- `adminer`: `8081:8080`

### Healthchecks

Existem dois níveis:

- Health do container (Docker): `healthcheck:` em cada serviço do compose.
  - Exemplo do app: chama `GET /api/v1/health` dentro do container.
- Health da aplicação (HTTP): `GET /api/v1/health`.

O health do container serve para o Docker reportar `healthy/unhealthy` e para `depends_on` conseguir ordenar inicialização quando configurado.

### Observabilidade (profile ops)

Alguns serviços só sobem quando você habilita o profile `ops`:

- `cadvisor` (métricas de containers): `8082:8080`
- `dozzle` (UI de logs): `9999:8080`
- `uptime-kuma` (monitor de uptime): `3002:3001`

Para subir com observabilidade:

- `docker-compose --profile ops up -d --build`

### Logging e rotação de logs

O compose define uma configuração reutilizável:

```yaml
x-logging: &default-logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"
```

E aplica em cada serviço com:

```yaml
logging: *default-logging
```

Isso mantém `docker logs` funcionando e evita crescimento infinito do arquivo de logs (rotação por tamanho/quantidade).

## Rodando local (WSL + Windows)

Se você usa WSL2, o `localhost` do Windows e o `localhost` do WSL podem não ser o mesmo em alguns setups.

- Para testar sem configurar nada: acesse pelo IP do WSL.
  - Descobrir IP: `wsl hostname -I`
  - Exemplo: `http://<IP_DO_WSL>:3000/api/docs`
- Para tentar liberar `http://localhost:3000` no Windows:
  - Crie `%UserProfile%\.wslconfig` com:
    - `[wsl2]`
    - `localhostForwarding=true`
  - Execute: `wsl --shutdown`

## Comandos úteis

- Subir: `npm run docker:up`
- Derrubar: `npm run docker:down`
- Status: `npm run docker:ps`
- Logs do app: `npm run docker:logs:app`

