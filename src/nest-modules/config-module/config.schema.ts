import { ConfigService } from "@nestjs/config";

export const CONFIG_SCHEMA_TYPE = Symbol("CONFIG_SCHEMA_TYPE");

export type EnvConfig = {
  NODE_ENV: "development" | "production" | "test";
  PORT: number;
  APP_URL: string;

  SWAGGER_EXAMPLES_ENABLED?: boolean;
  SWAGGER_EXAMPLES_REQUIRED_ONLY?: boolean;
  /** SM-020 — falso por padrão em produção; `/api/docs` responde 404. */
  SWAGGER_ENABLED?: boolean;
  /** SM-020 — origens do CORS separadas por vírgula. Obrigatória em produção. */
  CORS_ALLOWED_ORIGINS?: string;

  // Database URLs
  DATABASE_URL: string;
  REDIS_URL: string;

  // RabbitMQ
  RABBITMQ_URL: string;
  RABBITMQ_EXCHANGE: string;
  RABBITMQ_QUEUE_REQUESTS: string;
  RABBITMQ_QUEUE_NOTIFICATIONS: string;
  RABBITMQ_QUEUE_PAYMENTS: string;
  RABBITMQ_QUEUE_GAMIFICATION: string;
  RABBITMQ_REGISTER_HANDLERS?: boolean;

  RABBITMQ_ROUTING_KEY_AI_AUDIO_UPLOAD_VALIDATED?: string;
  RABBITMQ_ROUTING_KEY_AI_AUDIO_UPLOAD_SEPARATED?: string;
  RABBITMQ_ROUTING_KEY_AI_AUDIO_UPLOAD_SEPARATION_FAILED?: string;
  RABBITMQ_QUEUE_AI_AUDIO_SEPARATION?: string;
  RABBITMQ_QUEUE_AI_AUDIO_SEPARATION_COMPLETED?: string;
  RABBITMQ_QUEUE_AI_AUDIO_SEPARATION_FAILED?: string;

  // Keycloak
  AUTH_JWT_VALIDATION_MODE?: "local" | "keycloak";
  KEYCLOAK_URL: string;
  KEYCLOAK_REALM: string;
  KEYCLOAK_CLIENT_ID: string;
  KEYCLOAK_CLIENT_SECRET: string;
  KEYCLOAK_REGISTRATION_CLIENT_ID: string;
  KEYCLOAK_REGISTRATION_CLIENT_SECRET: string;
  KEYCLOAK_INTERNAL_URL?: string;
  KEYCLOAK_JWKS_URI?: string;
  KEYCLOAK_JWKS_CACHE_TTL_SECONDS?: number;
  KEYCLOAK_AUDIENCE?: string;
  KEYCLOAK_ALLOWED_AZP?: string;
  KEYCLOAK_VERIFY_AUDIENCE?: boolean;

  // JWT
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;

  // AWS S3
  AWS_REGION: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_S3_BUCKET: string;
  AWS_CLOUDFRONT_URL?: string;

  // MinIO (Development)
  MINIO_ENDPOINT: string;
  MINIO_PORT: number;
  MINIO_ACCESS_KEY: string;
  MINIO_SECRET_KEY: string;
  MINIO_BUCKET: string;

  MINIO_PUBLIC_ENDPOINT?: string;
  MINIO_PUBLIC_PORT?: number;

  CLOUDFLARE_R2_ENDPOINT?: string;
  CLOUDFLARE_R2_ACCESS_KEY_ID?: string;
  CLOUDFLARE_R2_SECRET_ACCESS_KEY?: string;
  CLOUDFLARE_R2_BUCKET?: string;

  // Contrato digital (F1.3b) — storage PRIVADO, bucket próprio.
  // Nunca compartilhar o bucket público de mídia: o documento tem CPF, CNPJ,
  // endereço e valor de cachê.
  CONTRACT_STORAGE_PROVIDER?: "minio" | "aws_s3" | "cloudflare_r2";
  CONTRACT_STORAGE_BUCKET?: string;
  /** Base da página pública de verificação, impressa no rodapé do documento. */
  CONTRACT_VERIFICATION_BASE_URL?: string;
  /** Identificação da plataforma no documento (não a torna parte do contrato). */
  CONTRACT_ISSUER_LEGAL_NAME?: string;
  CONTRACT_ISSUER_DOCUMENT?: string;
  /**
   * Segredo do HMAC do código de assinatura (segundo fator).
   *
   * O código tem 6 dígitos — 1 milhão de possibilidades. Guardado como hash
   * sem chave, um dump do Redis se converte nos códigos vivos por tabela
   * pré-computada. Com este segredo, não. Gerar com `openssl rand -hex 32`.
   */
  CONTRACT_CHALLENGE_SECRET?: string;

  // AI Audio
  AI_AUDIO_STORAGE_PROVIDER?: "minio" | "aws_s3" | "cloudflare_r2";
  AI_AUDIO_SEPARATION_HTTP_BASE_URL?: string;
  AI_AUDIO_SEPARATION_HTTP_PATH?: string;
  AI_AUDIO_SEPARATION_HTTP_TIMEOUT_MS?: number;
  AI_AUDIO_PROCESSING_TRANSPORT?: "http" | "rabbitmq";
  AI_AUDIO_PROCESSING_CONCURRENCY?: number;
  AI_AUDIO_PROCESSING_MAX_QUEUE_SIZE?: number;
  AI_AUDIO_PROCESSING_BACKPRESSURE_ENQUEUE_DELAY_MS?: number;
  AI_AUDIO_PROCESSING_BACKPRESSURE_TICK_MS?: number;
  AI_AUDIO_PROCESSING_MAX_RSS_MB?: number | null;
  AI_AUDIO_PROCESSING_MAX_LOADAVG_1?: number | null;
  AI_AUDIO_PROCESSING_GPU_MAX_MEMORY_PERCENT?: number | null;
  AI_AUDIO_PROCESSING_GPU_CHECK_INTERVAL_MS?: number;
  AI_AUDIO_MAX_FILE_SIZE?: number;
  AI_AUDIO_ALLOWED_MIME_TYPES?: string;
  AI_AUDIO_DEFAULT_MODEL_ID?: string;
  /**
   * Horas que os stems separados ficam no storage antes de a varredura apagá-los.
   * Curto de propósito — stem é a gravação, separada; ver
   * `core/ai-audio/domain/stems-retention.ts`.
   */
  AI_AUDIO_STEMS_RETENTION_HOURS?: number;
  AI_AUDIO_PROGRESS_TOKEN?: string;

  RABBITMQ_ROUTING_KEY_AI_CIFRA_ANALYSIS_REQUESTED?: string;
  RABBITMQ_ROUTING_KEY_AI_CIFRA_ANALYSIS_COMPLETED?: string;
  RABBITMQ_ROUTING_KEY_AI_CIFRA_ANALYSIS_FAILED?: string;
  RABBITMQ_ROUTING_KEY_AI_CIFRA_ANALYSIS_PROGRESS?: string;
  RABBITMQ_QUEUE_AI_CIFRA_ANALYSIS?: string;
  RABBITMQ_QUEUE_AI_CIFRA_ANALYSIS_COMPLETED?: string;
  RABBITMQ_QUEUE_AI_CIFRA_ANALYSIS_FAILED?: string;
  RABBITMQ_QUEUE_AI_CIFRA_ANALYSIS_PROGRESS?: string;

  RABBITMQ_ROUTING_KEY_SYNCED_LYRICS_BULK_REQUESTED?: string;
  RABBITMQ_QUEUE_SYNCED_LYRICS_BULK?: string;

  // AI Cifra
  AI_CIFRA_STORAGE_PROVIDER?: "minio" | "aws_s3" | "cloudflare_r2";
  AI_CIFRA_ANALYSIS_HTTP_BASE_URL?: string;
  AI_CIFRA_ANALYSIS_HTTP_PATH?: string;
  AI_CIFRA_ANALYSIS_HTTP_TIMEOUT_MS?: number;
  AI_CIFRA_PROCESSING_TRANSPORT?: "http" | "rabbitmq";
  /**
   * Kill-switch da comunidade de cifras. "false" derruba as rotas de
   * /community/personal-chord-sheets sem deploy — as do dono seguem intactas.
   */
  PERSONAL_CHORD_SHEET_COMMUNITY_ENABLED?: string;
  AI_CIFRA_PROCESSING_CONCURRENCY?: number;
  AI_CIFRA_PROCESSING_MAX_QUEUE_SIZE?: number;
  AI_CIFRA_PROCESSING_BACKPRESSURE_ENQUEUE_DELAY_MS?: number;
  AI_CIFRA_PROCESSING_BACKPRESSURE_TICK_MS?: number;
  AI_CIFRA_PROCESSING_MAX_RSS_MB?: number | null;
  AI_CIFRA_PROCESSING_MAX_LOADAVG_1?: number | null;
  AI_CIFRA_PROCESSING_GPU_MAX_MEMORY_PERCENT?: number | null;
  AI_CIFRA_PROCESSING_GPU_CHECK_INTERVAL_MS?: number;
  AI_CIFRA_MAX_FILE_SIZE?: number;
  AI_CIFRA_ALLOWED_MIME_TYPES?: string;
  AI_CIFRA_DEFAULT_MODEL_ID?: string;
  AI_CIFRA_PROGRESS_TOKEN?: string;
  /**
   * Shared secret que o backend envia ao chamar os workers de IA (ai-cifra e
   * ai-audio-separation) no header `x-ai-worker-token`, e que os workers
   * validam (fail-closed). Protege endpoints internos que baixam qualquer
   * objeto do bucket com credenciais próprias e consomem GPU — antes abertos a
   * qualquer um na rede. Ver `Docs/audits/security-review-2026-08-28.md` (A-10).
   */
  AI_WORKER_TOKEN?: string;
  AI_CIFRA_AUDIO_TTL_MINUTES?: number;
  AI_CIFRA_SIMPMUSIC_YTDLP_BIN?: string;
  AI_CIFRA_SIMPMUSIC_YTDLP_TIMEOUT_MS?: number;
  AI_CIFRA_MUSIFY_PIPED_BASE_URL?: string;
  AI_CIFRA_MUSIFY_PIPED_TIMEOUT_MS?: number;

  // External APIs
  CIFRA_CLUB_API_KEY?: string;
  ULTIMATE_GUITAR_API_KEY?: string;
  /**
   * App do Spotify — vínculo OAuth do FÃ ("salvar a música que ouvi ao vivo").
   *
   * ⚠️ Estas duas viveram anos aqui sem nenhum consumidor, agrupadas com as
   * APIs de letra/cifra. Desde 21/ago/2026 elas alimentam o
   * `SpotifyAdapter` — não são mais placeholders.
   *
   * Ausentes = a feature não liga (o provider devolve `null` e a rota responde
   * "indisponível"), em vez de subir com credencial vazia e falhar no toque do
   * usuário.
   */
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
  /** Para onde o Spotify devolve o `code`. Precisa bater com o app registrado. */
  SPOTIFY_REDIRECT_URI?: string;
  /** Deep link de volta para o app depois do callback. */
  SPOTIFY_APP_RETURN_URL?: string;
  SPOTIFY_ACCOUNTS_URL?: string;
  SPOTIFY_API_URL?: string;
  /**
   * Mercado usado no casamento de faixa (ISO 3166-1 alpha-2). Faixa
   * indisponível no país não deve ser sugerida — o fã tocaria num link morto.
   */
  SPOTIFY_MARKET?: string;
  GENIUS_CLIENT_ID?: string;
  GENIUS_CLIENT_SECRET?: string;
  GENIUS_ACCESS_TOKEN?: string;

  // Synced Lyrics
  SYNCED_LYRICS_BULK_TRANSPORT?: "inline" | "rabbitmq";
  SYNCED_LYRICS_BULK_CONCURRENCY?: number;
  SYNCED_LYRICS_BULK_MAX_QUEUE_SIZE?: number;
  SYNCED_LYRICS_BULK_BACKPRESSURE_ENQUEUE_DELAY_MS?: number;
  SYNCED_LYRICS_BULK_BACKPRESSURE_TICK_MS?: number;
  SYNCED_LYRICS_BULK_TOKEN?: string;

  // Google Calendar (integração de agenda do músico — client OAuth próprio,
  // separado do login social GOOGLE_KEYCLOAK_CLIENT_ID/SECRET)
  GOOGLE_CALENDAR_CLIENT_ID?: string;
  GOOGLE_CALENDAR_CLIENT_SECRET?: string;
  GOOGLE_CALENDAR_REDIRECT_URI?: string;
  GOOGLE_CALENDAR_SYNC_TRANSPORT?: "noop" | "rabbitmq";
  RABBITMQ_ROUTING_KEY_GOOGLE_CALENDAR_BOOKING_CONFIRMED?: string;
  RABBITMQ_ROUTING_KEY_GOOGLE_CALENDAR_BOOKING_CANCELLED?: string;
  RABBITMQ_QUEUE_GOOGLE_CALENDAR_BOOKING_CONFIRMED?: string;
  RABBITMQ_QUEUE_GOOGLE_CALENDAR_BOOKING_CANCELLED?: string;
  // Chave AES-256-GCM (32 bytes base64) para segredos cifrados em repouso
  TOKEN_ENCRYPTION_KEY?: string;

  // Asaas — cachê de show, escrow, assinaturas, saque PIX
  ASAAS_API_URL: string;
  ASAAS_API_KEY?: string;
  ASAAS_WALLET_ID?: string;
  ASAAS_WEBHOOK_TOKEN?: string;

  // ─── Mercado Pago (gateway da GORJETA) ─────────────────────────────────
  /**
   * O vértice da gorjeta roda no MP, e não no Asaas: 0,99% **sem piso** contra
   * R$1,99 **fixos**. Num ticket de R$5–60 a taxa fixa dá prejuízo abaixo de
   * R$22 no plano FREE. Ver `Docs/payment-gateway-research-2026-08.md`.
   *
   * Ausente = gorjeta cai no `PixGatewayMock` (nada real é processado).
   */
  MERCADOPAGO_API_URL?: string;
  /** App do marketplace — usados só no fluxo OAuth de vínculo do músico. */
  MERCADOPAGO_CLIENT_ID?: string;
  MERCADOPAGO_CLIENT_SECRET?: string;
  /** Para onde o MP devolve o `code` depois da autorização. */
  MERCADOPAGO_REDIRECT_URI?: string;
  /**
   * Taxa do Mercado Pago por PIX recebido, em % (padrão 0,99).
   *
   * 🔴 Ela é DESCONTADA da comissão da plataforma, não somada a ela: a tabela
   * de preços promete "9% / 7% / 5% (**1% gateway incluso**)", e no marketplace
   * do MP a taxa dele sai do bruto antes da nossa. Sem esse desconto o músico
   * receberia 1pp a menos do que foi anunciado.
   *
   * Configurável porque o MP tem faixa de 0,49% para CNPJ com volume.
   */
  MERCADOPAGO_FEE_PERCENTAGE?: number;
  /**
   * Para onde o callback redireciona o NAVEGADOR depois de vincular.
   *
   * Deep link do app (`soundmeet://...`) por padrão — o músico sai do navegador
   * e volta para a tela de carteira, que é de onde ele saiu.
   */
  MERCADOPAGO_APP_RETURN_URL?: string;
  /**
   * Segredo da assinatura `x-signature` do webhook.
   *
   * 🔴 Sem ele o controller recusa TUDO (fail-closed): um webhook sem
   * autenticação deixaria qualquer POST confirmar gorjetas.
   */
  MERCADOPAGO_WEBHOOK_SECRET?: string;
  /**
   * Access token da conta da PLATAFORMA.
   *
   * ⚠️ **Não é usado para criar gorjeta.** A cobrança é criada com o token do
   * MÚSICO (OAuth) — é isso que faz o dinheiro cair na conta dele em vez da
   * nossa. Fica declarado para chamadas administrativas eventuais; usá-lo no
   * fluxo de gorjeta desfaria a arquitetura inteira.
   */
  MERCADOPAGO_PLATFORM_ACCESS_TOKEN?: string;
  /**
   * Public key do SDK de front-end (tokenização de cartão).
   *
   * Hoje nada no SoundMeet usa: a gorjeta é PIX e o cartão da assinatura roda
   * no Asaas. Declarada para o dia em que houver checkout de cartão no web.
   */
  MERCADOPAGO_PUBLIC_KEY?: string;
  /**
   * Custódia do cachê (F1.3a). 🔴 Ligar isto muda o CONTRATO: passa a
   * selecionar a variante `cache_pagamento.com_custodia` e a incluir a cláusula
   * `custodia_liberacao`. Só ligue com a Conta Escrow de fato habilitada no
   * provedor — contrato que promete custódia sem custódia é declaração falsa.
   */
  ESCROW_ENABLED?: boolean;
  /**
   * Razão social da INSTITUIÇÃO DE PAGAMENTO que mantém o valor.
   *
   * 🔴 Nunca "SoundMeet". A cláusula afirma que o valor custodiado não integra
   * o patrimônio da plataforma. Sem este nome, o escrow não é ligado no
   * contrato (falha para o lado seguro).
   */
  ESCROW_CUSTODIAN_LEGAL_NAME?: string;

  // Email — Resend
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  // MAIL_BASE_URL foi REMOVIDA em 28/set/2026. Valia
  // `https://api.soundmeet.com.br` e servia apenas ao link de verificação de
  // e-mail — que passou a apontar para a PÁGINA do web (`APP_URL` +
  // `/verificar-email`), não para a API. Mantê-la aqui deixaria uma variável
  // que o `.env` define e nada lê: o mesmo tipo de mentira silenciosa do
  // `verifyEmail: true` que não verificava nada.

  // Rate Limiting
  RATE_LIMIT_TTL: number;
  RATE_LIMIT_MAX: number;

  // File Upload
  MAX_FILE_SIZE: number;
  ALLOWED_IMAGE_TYPES: string;
  ALLOWED_VIDEO_TYPES: string;
  ALLOWED_AUDIO_TYPES: string;

  // Gamification
  POINTS_SCAN_QR: number;
  POINTS_MUSIC_REQUEST: number;
  POINTS_REQUEST_ACCEPTED: number;
  POINTS_TIP_MULTIPLIER: number;
  POINTS_SOCIAL_SHARE: number;

  // Anti-Spam
  MAX_REQUESTS_PER_USER_PER_EVENT: number;
  REQUEST_COOLDOWN_MINUTES: number;
  REQUEST_RESPONSE_TIME_MINUTES: number;
  /** Piso do destaque pago (R$). Ver `BoostMinimumAmountPolicy`. */
  REQUEST_BOOST_MIN_AMOUNT: number;
  /** Janela para pagar o destaque depois do aceite. Conta do aceite. */
  REQUEST_BOOST_PAYMENT_WINDOW_MINUTES: number;
  VOTING_INTERVAL_MINUTES: number;

  // Scheduling
  BOOKING_DEFAULT_FREE_CANCELLATION_HOURS: number;
  BOOKING_COMPLETION_DELAY_HOURS: number;

  /**
   * Carência de saque após trocar a chave PIX (A1 camada 2). Saque para uma
   * chave trocada há menos de X horas é bloqueado, dando ao dono tempo de reagir
   * à notificação. `0` desliga a carência.
   */
  PIX_KEY_CHANGE_COOLDOWN_HOURS: number;

  // Prisma
  PRISMA_LOG_QUERIES: boolean;

  // Monitoramento (Sentry)
  SENTRY_DSN?: string;
  SENTRY_TRACES_SAMPLE_RATE?: number;
};

export type ConfigSchemaType = ConfigService<EnvConfig>;
