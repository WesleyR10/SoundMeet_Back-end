import { Global, Module } from "@nestjs/common";
import {
  ConfigModule as NestConfigModule,
  ConfigModuleOptions,
} from "@nestjs/config";
import Joi from "joi";
import { join } from "path";

import { CONFIG_SCHEMA_TYPE } from "./config.schema";

export type ConfigSchemaType = typeof CONFIG_SCHEMA_TYPE;

export const CONFIG_ENV_SCHEMA = {
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  PORT: Joi.number().default(3000),
  APP_URL: Joi.string().default("https://soundmeet.com.br"),
  SWAGGER_EXAMPLES_ENABLED: Joi.boolean().default(true),
  SWAGGER_EXAMPLES_REQUIRED_ONLY: Joi.boolean().default(false),

  /*
   * SM-020 — a documentação some em produção por PADRÃO, e é preciso ligá-la
   * de propósito.
   *
   * `/api/docs` é o mapa completo da API: toda rota, todo DTO, todo campo,
   * incluindo as administrativas. Não é segredo em si — segurança não pode
   * depender de esconder o contrato —, mas é o atalho que transforma
   * reconhecimento em enumeração pronta. Desligado aqui, a rota devolve 404
   * como qualquer outra que não existe.
   *
   * O default inverte por ambiente porque o custo do engano é assimétrico:
   * esquecer de ligar em dev custa um `SWAGGER_ENABLED=true`, esquecer de
   * desligar em produção publica o mapa.
   */
  SWAGGER_ENABLED: Joi.boolean().when("NODE_ENV", {
    is: "production",
    then: Joi.boolean().default(false),
    otherwise: Joi.boolean().default(true),
  }),

  /*
   * Origens permitidas no CORS, separadas por vírgula.
   *
   * 🔴 Em produção é OBRIGATÓRIA e não tem default. Antes o `main.ts` embutia
   * `http://localhost:3000/3001/8080` na allowlist de TODOS os ambientes, com
   * `credentials: true` — ou seja, qualquer página servida do localhost da
   * máquina de um usuário logado podia chamar a API de produção com o cookie
   * dele. Uma allowlist que sempre contém localhost não é allowlist.
   *
   * Sem default em produção porque o valor certo é específico do deploy:
   * qualquer palpite nosso seria ou permissivo demais ou quebraria o front.
   */
  CORS_ALLOWED_ORIGINS: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().required(),
    otherwise: Joi.string().default(
      "http://localhost:3000,http://localhost:3001,http://localhost:8080",
    ),
  }),
};

export const CONFIG_DATABASE_CACHE_SCHEMA = {
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
};

export const CONFIG_RABBITMQ_SCHEMA = {
  RABBITMQ_URL: Joi.string()
    .uri({ scheme: ["amqp", "amqps"] })
    .required(),
  RABBITMQ_EXCHANGE: Joi.string().default("soundmeet.exchange"),
  RABBITMQ_QUEUE_REQUESTS: Joi.string().default("soundmeet.requests"),
  RABBITMQ_QUEUE_NOTIFICATIONS: Joi.string().default("soundmeet.notifications"),
  RABBITMQ_QUEUE_PAYMENTS: Joi.string().default("soundmeet.payments"),
  RABBITMQ_QUEUE_GAMIFICATION: Joi.string().default("soundmeet.gamification"),
  RABBITMQ_REGISTER_HANDLERS: Joi.boolean().default(false),

  RABBITMQ_ROUTING_KEY_AI_CIFRA_ANALYSIS_REQUESTED: Joi.string().optional(),
  RABBITMQ_ROUTING_KEY_AI_CIFRA_ANALYSIS_COMPLETED: Joi.string().optional(),
  RABBITMQ_ROUTING_KEY_AI_CIFRA_ANALYSIS_FAILED: Joi.string().optional(),
  RABBITMQ_ROUTING_KEY_AI_CIFRA_ANALYSIS_PROGRESS: Joi.string().optional(),
  RABBITMQ_QUEUE_AI_CIFRA_ANALYSIS: Joi.string().optional(),
  RABBITMQ_QUEUE_AI_CIFRA_ANALYSIS_COMPLETED: Joi.string().optional(),
  RABBITMQ_QUEUE_AI_CIFRA_ANALYSIS_FAILED: Joi.string().optional(),
  RABBITMQ_QUEUE_AI_CIFRA_ANALYSIS_PROGRESS: Joi.string().optional(),

  RABBITMQ_ROUTING_KEY_SYNCED_LYRICS_BULK_REQUESTED: Joi.string().optional(),
  RABBITMQ_QUEUE_SYNCED_LYRICS_BULK: Joi.string().optional(),
};

export const CONFIG_AUTH_SCHEMA = {
  AUTH_JWT_VALIDATION_MODE: Joi.string()
    .valid("local", "keycloak")
    .when("NODE_ENV", {
      is: "production",
      then: Joi.string().valid("keycloak").default("keycloak"),
      otherwise: Joi.string().valid("local", "keycloak").default("local"),
    }),
  KEYCLOAK_URL: Joi.string().required(),
  KEYCLOAK_REALM: Joi.string().default("soundmeet"),
  KEYCLOAK_CLIENT_ID: Joi.string().required(),
  KEYCLOAK_CLIENT_SECRET: Joi.string().required(),
  /*
   * AUTH-1 — client CONFIDENCIAL do auto-login pós-cadastro.
   *
   * O `soundmeet-mobile` deixou de aceitar Direct Access Grant: o client_id dele
   * viaja dentro do APK, então qualquer script batia direto no `/token` do
   * Keycloak com e-mail e senha, pulando o `@Throttle` do Nest inteiro.
   *
   * O cadastro ainda precisa devolver sessão (o usuário acabou de escolher a
   * senha; mandá-lo à tela de login em seguida seria pedir para digitar duas
   * vezes), e para isso o grant de senha continua existindo — mas atrás de um
   * secret que só o backend tem, onde o rate limit da nossa API é inescapável.
   */
  KEYCLOAK_REGISTRATION_CLIENT_ID: Joi.string().default(
    "soundmeet-registration",
  ),
  KEYCLOAK_REGISTRATION_CLIENT_SECRET: Joi.string().required(),
  KEYCLOAK_INTERNAL_URL: Joi.string().uri().optional(),
  KEYCLOAK_JWKS_URI: Joi.string().uri().optional(),
  KEYCLOAK_JWKS_CACHE_TTL_SECONDS: Joi.number().min(1).default(300),
  // Valor esperado em `aud` — é o audience injetado pelo oidc-audience-mapper
  // nos clients públicos, NÃO o client confidencial do backend. Sem default:
  // o verifier cai em KEYCLOAK_CLIENT_ID quando ausente.
  KEYCLOAK_AUDIENCE: Joi.string().optional(),
  // Clients autorizados a emitir token para esta API (claim `azp`). Vazio =
  // camada extra desligada; a checagem de `aud` continua valendo.
  KEYCLOAK_ALLOWED_AZP: Joi.string().allow("").optional(),
  // Em produção é TRAVADO em `true` (não só default): desligar a verificação de
  // audience num ambiente real reabre o token confusion — qualquer client do
  // realm passaria a emitir token aceito por esta API. Mesma postura de
  // `AUTH_JWT_VALIDATION_MODE`, que é `.valid("keycloak")` em prod. Fora de
  // produção continua opcional (ligar exige o audience mapper no realm —
  // scripts/keycloak-sync.mjs, ver Docs/auth/keycloak.md).
  KEYCLOAK_VERIFY_AUDIENCE: Joi.boolean().when("NODE_ENV", {
    is: "production",
    then: Joi.boolean().valid(true).default(true),
    otherwise: Joi.boolean().default(false),
  }),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default("24h"),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default("7d"),
};

export const CONFIG_STORAGE_SCHEMA = {
  AWS_REGION: Joi.string().default("us-east-1"),
  AWS_ACCESS_KEY_ID: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  AWS_SECRET_ACCESS_KEY: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  AWS_S3_BUCKET: Joi.string().default("soundmeet-media"),
  AWS_CLOUDFRONT_URL: Joi.string().optional(),
  MINIO_ENDPOINT: Joi.string().default("localhost"),
  MINIO_PORT: Joi.number().default(9000),
  MINIO_ACCESS_KEY: Joi.string().default("soundmeet"),
  MINIO_SECRET_KEY: Joi.string().default("soundmeet123"),
  MINIO_BUCKET: Joi.string().default("soundmeet-media"),
};

export const CONFIG_EXTERNAL_APIS_SCHEMA = {
  /*
   * 🔴 Obrigatória em produção, e a razão é o modo de falhar.
   *
   * O `MailService` faz `new Resend(apiKey)` no construtor, e o SDK LANÇA com
   * chave indefinida — então sem esta variável o app não sobe, com ou sem
   * validação. A diferença é a mensagem: sem o Joi, o operador recebe
   * `Missing API key. Pass it to the constructor new Resend("re_123")`, que não
   * nomeia a variável nem indica que o problema é de configuração, e o
   * container entra em restart loop enquanto alguém procura. Descoberto ao
   * executar `scripts/smoke-test-prod.sh` pela primeira vez.
   *
   * Fora de produção segue opcional: o SDK só é exercitado quando um e-mail é
   * enviado de fato.
   */
  RESEND_API_KEY: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  MAIL_FROM: Joi.string().default("noreply@soundmeet.com.br"),
  CIFRA_CLUB_API_KEY: Joi.string().optional(),
  ULTIMATE_GUITAR_API_KEY: Joi.string().optional(),
  SPOTIFY_CLIENT_ID: Joi.string().optional(),
  SPOTIFY_CLIENT_SECRET: Joi.string().optional(),
  SPOTIFY_REDIRECT_URI: Joi.string().allow("").optional(),
  SPOTIFY_APP_RETURN_URL: Joi.string().allow("").optional(),
  SPOTIFY_ACCOUNTS_URL: Joi.string().default("https://accounts.spotify.com"),
  SPOTIFY_API_URL: Joi.string().default("https://api.spotify.com"),
  SPOTIFY_MARKET: Joi.string().length(2).uppercase().default("BR"),
  GENIUS_CLIENT_ID: Joi.string().optional(),
  GENIUS_CLIENT_SECRET: Joi.string().optional(),
  GENIUS_ACCESS_TOKEN: Joi.string().optional(),
};

export const CONFIG_PAYMENT_SCHEMA = {
  // Asaas — cachê de show, escrow, assinaturas, saque PIX
  ASAAS_API_URL: Joi.string().uri().default("https://sandbox.asaas.com/api/v3"),
  ASAAS_API_KEY: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  ASAAS_WALLET_ID: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().uuid().required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  ASAAS_WEBHOOK_TOKEN: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
};

export const CONFIG_LIMITS_SCHEMA = {
  RATE_LIMIT_TTL: Joi.number().default(60), // Tempo de expiração do limite de taxa em segundos
  RATE_LIMIT_MAX: Joi.number().default(100), // Máximo de requisições permitidas por RATE_LIMIT_TTL
  MAX_FILE_SIZE: Joi.number().default(10485760), // Tamanho máximo de arquivo em bytes
  ALLOWED_IMAGE_TYPES: Joi.string().default("image/jpeg,image/png,image/webp"), // Tipos de arquivos de imagem permitidos
  ALLOWED_VIDEO_TYPES: Joi.string().default("video/mp4,video/webm"), // Tipos de arquivos de vídeo permitidos
  ALLOWED_AUDIO_TYPES: Joi.string().default("audio/mpeg,audio/wav,audio/ogg"), // Tipos de arquivos de áudio permitidos
  POINTS_SCAN_QR: Joi.number().default(10), // Pontos ganhos ao escanear um QR code
  POINTS_MUSIC_REQUEST: Joi.number().default(25), // Pontos ganhos ao fazer uma solicitação de música
  POINTS_REQUEST_ACCEPTED: Joi.number().default(50), // Pontos ganhos ao aceitar uma solicitação
  POINTS_TIP_MULTIPLIER: Joi.number().default(1), // Multiplicador de pontos ao dar um "tip"
  POINTS_SOCIAL_SHARE: Joi.number().default(50), // Pontos ganhos ao compartilhar uma solicitação socialmente
  MAX_REQUESTS_PER_USER_PER_EVENT: Joi.number().default(10), // Máximo de solicitações por usuário por evento
  REQUEST_COOLDOWN_MINUTES: Joi.number().default(120), // Cooldown ( Tempo mínimo entre solicitações) entre solicitações em minutos
  REQUEST_RESPONSE_TIME_MINUTES: Joi.number().default(60), // Tempo máximo para resposta de uma solicitação em minutos
  /*
   * Destaque pago do pedido musical.
   *
   * O piso existe para impedir que R$0,50 ocupe o topo da fila — a ordenação é
   * por valor. Fica em config, e não no domínio, porque reajustar piso não pode
   * custar mudança de código de negócio.
   */
  REQUEST_BOOST_MIN_AMOUNT: Joi.number().positive().default(2),
  /*
   * Janela para pagar depois do aceite do músico. Conta do ACEITE, não da
   * promessa — ver `RequestBoost.charged_at`.
   */
  REQUEST_BOOST_PAYMENT_WINDOW_MINUTES: Joi.number().positive().default(15),
  VOTING_INTERVAL_MINUTES: Joi.number().default(3), // Intervalo de votação em minutos

  BOOKING_DEFAULT_FREE_CANCELLATION_HOURS: Joi.number().min(0).default(72),
  BOOKING_COMPLETION_DELAY_HOURS: Joi.number().min(0).default(24), // Janela de disputa pós-show (Docs/payment-gateway-decisions.md) antes de completar automaticamente
  // A1 camada 2 — carência de saque após troca de chave PIX. 24h por padrão; 0 desliga.
  PIX_KEY_CHANGE_COOLDOWN_HOURS: Joi.number().min(0).default(24),
};

export const CONFIG_PRISMA_SCHEMA = {
  PRISMA_LOG_QUERIES: Joi.boolean().default(false),
};

// Monitoramento nunca é dependência dura de boot — SENTRY_DSN ausente
// (dev/testes, ou produção sem conta Sentry ainda) só desativa o envio de
// eventos, nunca impede o app de subir (diferente de ASAAS_API_KEY/
// TOKEN_ENCRYPTION_KEY, que são dependências reais de fluxo de produto).
export const CONFIG_MONITORING_SCHEMA = {
  SENTRY_DSN: Joi.string().allow("").optional(),
  SENTRY_TRACES_SAMPLE_RATE: Joi.number().min(0).max(1).default(0.2),
};

export const CONFIG_AI_AUDIO_SCHEMA = {
  AI_AUDIO_PROCESSING_TRANSPORT: Joi.string()
    .valid("http", "rabbitmq")
    .default("http"),
  AI_AUDIO_PROGRESS_TOKEN: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  // Mínimo de 1h: prazo zero apagaria os stems antes do ensaio começar.
  AI_AUDIO_STEMS_RETENTION_HOURS: Joi.number().min(1).optional(),
};

export const CONFIG_AI_CIFRA_SCHEMA = {
  AI_CIFRA_STORAGE_PROVIDER: Joi.string()
    .valid("minio", "aws_s3", "cloudflare_r2")
    .optional(),
  AI_CIFRA_MAX_FILE_SIZE: Joi.number().optional(),
  AI_CIFRA_ALLOWED_MIME_TYPES: Joi.string().optional(),
  AI_CIFRA_DEFAULT_MODEL_ID: Joi.string().optional(),
  AI_CIFRA_ANALYSIS_HTTP_BASE_URL: Joi.string().optional(),
  AI_CIFRA_ANALYSIS_HTTP_PATH: Joi.string().optional(),
  AI_CIFRA_ANALYSIS_HTTP_TIMEOUT_MS: Joi.number().optional(),
  AI_CIFRA_PROCESSING_TRANSPORT: Joi.string()
    .valid("http", "rabbitmq")
    .optional(),
  AI_CIFRA_PROCESSING_CONCURRENCY: Joi.number().min(1).optional(),
  AI_CIFRA_PROCESSING_MAX_QUEUE_SIZE: Joi.number().min(1).optional(),
  AI_CIFRA_PROCESSING_BACKPRESSURE_ENQUEUE_DELAY_MS: Joi.number()
    .min(0)
    .optional(),
  AI_CIFRA_PROCESSING_BACKPRESSURE_TICK_MS: Joi.number().min(0).optional(),
  AI_CIFRA_PROCESSING_MAX_RSS_MB: Joi.number().min(1).allow(null).optional(),
  AI_CIFRA_PROCESSING_MAX_LOADAVG_1: Joi.number().min(0).allow(null).optional(),
  AI_CIFRA_PROCESSING_GPU_MAX_MEMORY_PERCENT: Joi.number()
    .min(0)
    .max(100)
    .allow(null)
    .optional(),
  AI_CIFRA_PROCESSING_GPU_CHECK_INTERVAL_MS: Joi.number().min(0).optional(),
  AI_CIFRA_PROGRESS_TOKEN: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  // Shared secret backend → workers de IA (A-10). Required em produção, como o
  // progress token: sem ele o backend não consegue provar que é ele chamando o
  // worker, e o worker (fail-closed) recusaria todo processamento.
  AI_WORKER_TOKEN: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  AI_CIFRA_AUDIO_TTL_MINUTES: Joi.number().min(1).default(60),
  AI_CIFRA_SIMPMUSIC_YTDLP_BIN: Joi.string().default("yt-dlp"),
  AI_CIFRA_SIMPMUSIC_YTDLP_TIMEOUT_MS: Joi.number().min(1).default(30_000),
  AI_CIFRA_MUSIFY_PIPED_BASE_URL: Joi.string().uri().optional(),
  AI_CIFRA_MUSIFY_PIPED_TIMEOUT_MS: Joi.number().min(1).default(10_000),
};

export const CONFIG_SYNCED_LYRICS_SCHEMA = {
  SYNCED_LYRICS_BULK_TRANSPORT: Joi.string()
    .valid("inline", "rabbitmq")
    .default("inline"),
  SYNCED_LYRICS_BULK_CONCURRENCY: Joi.number().min(1).default(4),
  SYNCED_LYRICS_BULK_MAX_QUEUE_SIZE: Joi.number().min(1).default(500),
  SYNCED_LYRICS_BULK_BACKPRESSURE_ENQUEUE_DELAY_MS: Joi.number()
    .min(0)
    .default(250),
  SYNCED_LYRICS_BULK_BACKPRESSURE_TICK_MS: Joi.number().min(0).default(250),
  SYNCED_LYRICS_BULK_TOKEN: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
};

export const CONFIG_GOOGLE_CALENDAR_SCHEMA = {
  // Client OAuth próprio para Calendar — SEPARADO do login social
  // (GOOGLE_KEYCLOAK_CLIENT_ID/SECRET), que tem storeToken:false no Keycloak
  GOOGLE_CALENDAR_CLIENT_ID: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  GOOGLE_CALENDAR_CLIENT_SECRET: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  GOOGLE_CALENDAR_REDIRECT_URI: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().uri().required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  GOOGLE_CALENDAR_SYNC_TRANSPORT: Joi.string()
    .valid("noop", "rabbitmq")
    .default("noop"),
  RABBITMQ_ROUTING_KEY_GOOGLE_CALENDAR_BOOKING_CONFIRMED:
    Joi.string().optional(),
  RABBITMQ_ROUTING_KEY_GOOGLE_CALENDAR_BOOKING_CANCELLED:
    Joi.string().optional(),
  RABBITMQ_QUEUE_GOOGLE_CALENDAR_BOOKING_CONFIRMED: Joi.string().optional(),
  RABBITMQ_QUEUE_GOOGLE_CALENDAR_BOOKING_CANCELLED: Joi.string().optional(),
  // Mercado Pago — gateway da gorjeta. Sem a URL, a gorjeta cai no mock.
  MERCADOPAGO_API_URL: Joi.string().allow("").optional(),
  MERCADOPAGO_CLIENT_ID: Joi.string().allow("").optional(),
  // Segredo do app do marketplace: exigido em produção quando a URL está
  // configurada, porque sem ele o fluxo OAuth de vínculo não fecha.
  MERCADOPAGO_CLIENT_SECRET: Joi.string().allow("").optional(),
  MERCADOPAGO_REDIRECT_URI: Joi.string().allow("").optional(),
  // Descontada da NOSSA comissão ("gateway incluso"), nunca somada ao músico.
  MERCADOPAGO_FEE_PERCENTAGE: Joi.number().min(0).max(100).default(0.99),
  MERCADOPAGO_APP_RETURN_URL: Joi.string().allow("").optional(),
  // Fail-closed no controller: sem ele nenhum webhook é aceito.
  MERCADOPAGO_WEBHOOK_SECRET: Joi.string().allow("").optional(),
  // ⚠️ NÃO usado para criar gorjeta — a cobrança sai com o token do músico.
  MERCADOPAGO_PLATFORM_ACCESS_TOKEN: Joi.string().allow("").optional(),
  MERCADOPAGO_PUBLIC_KEY: Joi.string().allow("").optional(),
  ESCROW_ENABLED: Joi.boolean().default(false),
  // Exigido quando o escrow está ligado: cláusula de custódia sem dizer QUEM
  // custodia é papel fraco justamente onde o valor do documento está.
  ESCROW_CUSTODIAN_LEGAL_NAME: Joi.string().when("ESCROW_ENABLED", {
    is: true,
    then: Joi.string().min(3).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  // Segredo do HMAC do código de assinatura do contrato (segundo fator).
  // Sem ele, o hash de um código de 6 dígitos é quebrável por tabela.
  // Gerar com: openssl rand -hex 32
  CONTRACT_CHALLENGE_SECRET: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  // Chave AES-256-GCM (32 bytes base64) para tokens OAuth em repouso.
  // Gerar com: openssl rand -base64 32
  TOKEN_ENCRYPTION_KEY: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.string().base64().min(43).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
};

@Global()
@Module({})
export class ConfigModuleRoot extends NestConfigModule {
  static forRoot(options: ConfigModuleOptions = {}) {
    const { envFilePath, ...restOptions } = options;

    const defaultEnvFiles =
      process.env.NODE_ENV === "test"
        ? [".env.e2e", ".env.local", ".env"]
        : [".env.local", ".env"];

    const providedEnvFiles = envFilePath
      ? Array.isArray(envFilePath)
        ? envFilePath
        : [envFilePath]
      : [];

    const envsFolderFiles = [
      ...(process.env.NODE_ENV === "test"
        ? [join(process.cwd(), "envs", ".env.e2e")]
        : []),
      join(
        process.cwd(),
        "envs",
        `.env.${process.env.NODE_ENV || "development"}`,
      ),
      join(process.cwd(), "envs", `.env`),
    ];

    return super.forRoot({
      isGlobal: true,
      envFilePath: [
        ...providedEnvFiles,
        ...defaultEnvFiles,
        ...envsFolderFiles,
      ],
      validationSchema: Joi.object({
        ...CONFIG_ENV_SCHEMA,
        ...CONFIG_DATABASE_CACHE_SCHEMA,
        ...CONFIG_RABBITMQ_SCHEMA,
        ...CONFIG_AUTH_SCHEMA,
        ...CONFIG_STORAGE_SCHEMA,
        ...CONFIG_EXTERNAL_APIS_SCHEMA,
        ...CONFIG_PAYMENT_SCHEMA,
        ...CONFIG_LIMITS_SCHEMA,
        ...CONFIG_PRISMA_SCHEMA,
        ...CONFIG_MONITORING_SCHEMA,
        ...CONFIG_AI_AUDIO_SCHEMA,
        ...CONFIG_AI_CIFRA_SCHEMA,
        ...CONFIG_SYNCED_LYRICS_SCHEMA,
        ...CONFIG_GOOGLE_CALENDAR_SCHEMA,
      }),
      ...restOptions,
    });
  }
}
