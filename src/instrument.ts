// Precisa ser o PRIMEIRO import de main.ts (antes de @nestjs/core e de
// qualquer outro módulo) — o OpenTelemetry por baixo do @sentry/nestjs faz
// monkey-patch de http/express/pg/etc, e qualquer módulo carregado antes
// deste arquivo não fica auto-instrumentado.
import * as Sentry from "@sentry/nestjs";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

import { scrubSentryEvent } from "./nest-modules/shared-module/security/sentry-event-scrubber";

// SENTRY_DSN ausente = SDK inicializa em modo inerte (não envia nada) — não
// bloqueia boot em nenhum ambiente, ver CONFIG_MONITORING_SCHEMA.
const dsn = process.env.SENTRY_DSN || undefined;
const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.2);

// Erros de domínio esperados (404/422/402/409 — validação, not-found, gate de
// plano) nunca chegam aqui: GlobalExceptionFilter só chama
// Sentry.captureException nos branches de erro genuinamente inesperado
// (bug de verdade), então não precisa de beforeSend pra filtrar ruído.
Sentry.init({
  dsn,
  environment: process.env.NODE_ENV ?? "development",
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate,
  profilesSampleRate: tracesSampleRate,
  // O SDK anexa o CORPO da requisição a todo evento (até 10 KB, por padrão) —
  // senha, refresh token e CPF inclusive. Ver `sentry-event-scrubber.ts`.
  beforeSend: (event) => scrubSentryEvent(event),
  beforeSendTransaction: (event) => scrubSentryEvent(event),
});
