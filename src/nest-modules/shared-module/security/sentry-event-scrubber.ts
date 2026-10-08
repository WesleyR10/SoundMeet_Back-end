/**
 * Tira credencial e documento de todo evento antes de ele sair para o Sentry.
 *
 * 🔴 O `@sentry/nestjs` 10 ANEXA o corpo da requisição a todo erro capturado
 * (`maxIncomingRequestBodySize: 'medium'` — até 10 KB — é o default, e o
 * `requestDataIntegration` inclui `data: true`). `sendDefaultPii: false` não
 * muda isso: ele controla cookie e IP, não o corpo. Então qualquer 500
 * inesperado em `POST /auth/register` enviava a SENHA, o CPF e o celular
 * para um serviço de terceiro — e, com o login por senha de volta no app
 * (AUTH-3), toda falha inesperada em `POST /auth/login` faria o mesmo.
 *
 * Filtra por NOME de campo, recursivamente, em corpo, query e headers. Não
 * tenta reconhecer valor (um regex de CPF acharia número de pedido): o que
 * decide é a chave, que é o que o nosso próprio DTO controla.
 *
 * Mora aqui, e não dentro do `instrument.ts`, porque aquele arquivo roda antes
 * de tudo e não é alcançável por teste. Este módulo é puro — sem Nest, sem
 * Sentry — justamente para poder ser importado lá.
 */

export const FILTERED = "[Filtered]";

const SENSITIVE_KEY =
  /pass(word|wd)?|secret|token|authorization|cookie|api[-_]?key|cpf|cnpj|phone|celular/i;

const MAX_DEPTH = 8;

function redactValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return FILTERED;
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? FILTERED : redactValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Corpo e query chegam ao Sentry como STRING quase sempre (JSON ou
 * form-urlencoded). Parsear é o único jeito de filtrar por chave; o que não
 * parseia e menciona um nome sensível é descartado inteiro — perder o corpo
 * de um evento custa menos que mandar uma senha.
 */
function redactSerialized(raw: string): string {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return JSON.stringify(redactValue(parsed, 0));
    }
  } catch {
    // não é JSON — tenta form-urlencoded abaixo
  }

  if (raw.includes("=")) {
    const params = new URLSearchParams(raw);
    for (const key of [...new Set(params.keys())]) {
      if (SENSITIVE_KEY.test(key)) params.set(key, FILTERED);
    }
    return params.toString();
  }

  return SENSITIVE_KEY.test(raw) ? FILTERED : raw;
}

function redactField(value: unknown): unknown {
  if (typeof value === "string") return redactSerialized(value);
  return redactValue(value, 0);
}

type ScrubbableEvent = {
  request?: {
    data?: unknown;
    query_string?: unknown;
    headers?: Record<string, string>;
    cookies?: unknown;
  };
};

export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  const request = event.request;
  if (!request) return event;

  if (request.data !== undefined) request.data = redactField(request.data);
  if (request.query_string !== undefined) {
    request.query_string = redactField(request.query_string);
  }
  if (request.headers) {
    request.headers = redactValue(request.headers, 0) as Record<string, string>;
  }
  if (request.cookies !== undefined) delete request.cookies;

  return event;
}
