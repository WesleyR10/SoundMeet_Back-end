# Segurança HTTP e container (SM-020)

> Saiu das regras de negócio para cá: é política da API inteira, não de um domínio.

*Seção original: “Superfície HTTP e container (SM-020) *(26/ago/2026)*”.*


Código: `src/nest-modules/shared-module/security/http-security.policy.ts`, `main.ts`,
`docker-compose.prod.yml`, `docker/rabbitmq-delayed/Dockerfile`.

- [x] 🔴 **A allowlist de CORS vem do ambiente, e produção não tem default.**
  A lista era literal no `main.ts` e continha `http://localhost:3000/3001/8080` em
  **todos** os ambientes, com `credentials: true` — uma página servida do localhost
  da máquina de um usuário logado podia chamar a API de produção com as credenciais
  dele. Uma allowlist que sempre contém localhost não é allowlist.
  `CORS_ALLOWED_ORIGINS` é obrigatória em produção (o Joi recusa o boot) porque
  qualquer palpite nosso seria permissivo demais ou quebraria o front.

- [x] **Swagger desligado por padrão em produção** (`SWAGGER_ENABLED`).
  `/api/docs` publicava o contrato completo da API, com `persistAuthorization`
  guardando o token no `localStorage` de quem abrisse a página. O default inverte
  por ambiente porque o custo do engano é assimétrico: esquecer de ligar em dev
  custa uma variável, esquecer de desligar em produção publica o mapa.

- [x] **Helmet aplicado pela aplicação, não pelo proxy.** Delegar ao proxy é apostar
  numa configuração que vive fora do repositório, que ninguém revisa junto com o
  código e que some no primeiro staging sem proxy. A CSP é `default-src 'none'` —
  uma API JSON não carrega recurso nenhum — e o `'unsafe-inline'` que o Swagger UI
  exige está **amarrado ao interruptor dele**, em vez de valer permanentemente.

- [x] **A política mora em módulo testável, não no `bootstrap()`.** As três decisões
  (quem chama, se o contrato é público, o que o navegador executa) foram extraídas
  para `resolveHttpSecurityPolicy`, função pura com 13 testes. `bootstrap()` é o
  único ponto do sistema que nenhum teste alcança — péssimo endereço para essas
  regras.

- [x] **Workers de IA deixaram de rodar como root.** `ai-cifra-mir-worker` e
  `soundmeet-audio-separation` rodam como `worker` (uid 1001). Eles decodificam áudio
  de origem externa com FFmpeg e bibliotecas nativas — exatamente onde um arquivo
  malformado vira execução arbitrária. O `Dockerfile` do backend **já** era non-root.

- [x] 🔴 **O plugin do RabbitMQ passou a ter checksum.** `ADD <url>` não verifica
  nada: release substituído, conta comprometida ou proxy hostil entregavam um
  plugin adulterado que o broker carregava em silêncio — e um plugin do RabbitMQ vê
  toda mensagem do sistema. Agora o SHA-256 é conferido e o build **falha** se não
  bater.

- [x] **`docker-compose.prod.yml` novo, com o compose de desenvolvimento intacto.**
  Imagens por digest, `read_only`, `cap_drop: ALL`, `no-new-privileges`, nenhuma
  porta de banco publicada e nenhuma senha com default (`${VAR:?}` recusa subir).
  Endurecer o compose de dev tornaria o ambiente de trabalho hostil sem tornar a
  produção segura — produção não roda a partir dele.
  - ⚠️ `/tmp` do `app` é **volume, não tmpfs**: os uploads de áudio passam inteiros
    por `os.tmpdir()`, e um tmpfs colocaria centenas de MB na RAM do host.
  - ✅ **Validado em 26/ago/2026** por `scripts/smoke-test-prod.sh`: 18/18
    verificações passam (non-root nos quatro serviços, raiz somente leitura,
    `/tmp` do app gravável, `/api/docs` 404, cabeçalhos do Helmet, nenhuma porta
    de banco publicada). O script sobe a stack num projeto isolado e derruba no
    fim — não toca o compose de desenvolvimento.
  - 🔴 **A primeira execução encontrou cinco defeitos que só apareceriam no
    deploy**, e é por isso que o smoke test não é opcional:
    1. `envs/.env.production.example` **omitia doze variáveis obrigatórias** — o
       Joi recusava o boot e o container entrava em restart loop.
    2. `RESEND_API_KEY` **não estava no schema Joi**. O `MailService` faz
       `new Resend(apiKey)` no construtor e o SDK lança com chave indefinida:
       o app não subia, com a mensagem `Missing API key`, que não nomeia a
       variável nem indica que o problema é de configuração. Agora é obrigatória
       em produção e falha no validador, com mensagem acionável.
    3. O healthcheck do RabbitMQ era `rabbitmq-diagnostics ping`, que confirma o
       nó Erlang e **não** os listeners. O broker leva ~22s para completar o
       boot; o `ping` respondia OK em poucos segundos, o `depends_on:
       service_healthy` liberava o app na janela e ele morria em `ECONNREFUSED`
       no timeout de 5s do cliente AMQP — crash loop a cada deploy, sem nada de
       errado no broker. Hoje é `check_port_connectivity`.
       ⚠️ O compose de **desenvolvimento** tem o mesmo `ping` e o mesmo defeito
       latente; lá o `restart: unless-stopped` mascara.
    4. `REDIS_URL` não levava a senha que o próprio compose configurava via
       `requirepass` — o app subia, conectava e morria no primeiro comando com
       `NOAUTH Authentication required`.
    5. `container_name` fixo colidia com o compose de desenvolvimento e
       impediria staging e produção no mesmo host. Removido: o nome vem do
       projeto (`-p`).
  - Os workers de GPU **não** estão nesse compose: em produção vivem em host próprio
    (um por placa de 8GB). O endurecimento deles está nos Dockerfiles.
  - 🔴 **O Keycloak também não** — ele já tem compose próprio
    (`infra/keycloak/docker-compose.prod.yml`, SM-014), com decisões deliberadas e
    diferentes: digest **em variável** (a versão migra 22→26 na Fase 4c, e fixar 22
    congelaria a migração), `KC_PROXY_HEADERS` em vez do obsoleto `KC_PROXY`, porta
    não publicada e banco externo. Declarar o serviço nos dois lugares não daria
    erro — daria dois arquivos discordando sobre como subir o provedor de
    identidade, e o deploy seguiria o que alguém abrisse primeiro.
