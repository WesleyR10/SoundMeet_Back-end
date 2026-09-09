import type { HelmetOptions } from "helmet";

/**
 * As variáveis que decidem a superfície HTTP, já lidas do ambiente.
 *
 * Recebe valores em vez de um `ConfigService` de propósito: a política vira
 * função pura e passa a ser testável sem subir um módulo do Nest. Antes esta
 * lógica morava solta no `bootstrap()` — o único lugar do sistema que nenhum
 * teste alcança, o que é um péssimo endereço para as regras que definem quem
 * pode chamar a API e o que o navegador aceita executar.
 */
export type HttpSecurityEnv = {
  node_env?: string;
  /** Origens autorizadas no CORS, separadas por vírgula. */
  cors_allowed_origins?: string;
  /** Origem única, herdada de deploys anteriores. Somada à lista acima. */
  frontend_url?: string;
  swagger_enabled?: boolean;
};

export type HttpSecurityPolicy = {
  isProduction: boolean;
  swaggerEnabled: boolean;
  corsOrigins: string[];
  helmet: HelmetOptions;
};

/**
 * SM-020 — resolve, num lugar só, o que a API expõe ao navegador.
 *
 * Três decisões moram aqui, e as três dependem do ambiente:
 *
 * 1. **Quem pode chamar** (`corsOrigins`). A lista vinha literal no código e
 *    continha `http://localhost:3000/3001/8080` em TODOS os ambientes, com
 *    `credentials: true` — uma página servida do localhost da máquina de um
 *    usuário logado podia falar com a API de produção usando as credenciais
 *    dele. Uma allowlist que sempre contém localhost não é allowlist.
 * 2. **Se o contrato é público** (`swaggerEnabled`). Falso por padrão em
 *    produção: o default inverte por ambiente porque o custo do engano é
 *    assimétrico — esquecer de ligar em dev custa uma variável, esquecer de
 *    desligar em produção publica o mapa completo da API.
 * 3. **O que o navegador aceita** (`helmet`). Ver `buildHelmetOptions`.
 */
export function resolveHttpSecurityPolicy(
  env: HttpSecurityEnv,
): HttpSecurityPolicy {
  const isProduction = env.node_env === "production";
  const swaggerEnabled = env.swagger_enabled ?? !isProduction;

  return {
    isProduction,
    swaggerEnabled,
    corsOrigins: resolveCorsOrigins(env),
    helmet: buildHelmetOptions({ isProduction, swaggerEnabled }),
  };
}

/**
 * Duplicatas e entradas vazias são descartadas: a lista costuma nascer de
 * concatenação de variáveis, e `["", "https://x", "https://x"]` é o formato
 * natural de quem define `CORS_ALLOWED_ORIGINS` e `FRONTEND_URL` com o mesmo
 * host.
 */
function resolveCorsOrigins(env: HttpSecurityEnv): string[] {
  const candidates = [
    ...(env.cors_allowed_origins ?? "").split(","),
    env.frontend_url ?? "",
  ].map((origin) => origin.trim());

  return [...new Set(candidates.filter((origin) => origin.length > 0))];
}

/**
 * Cabeçalhos de segurança aplicados pela própria aplicação.
 *
 * Delegar isto ao proxy reverso é apostar numa configuração que vive fora deste
 * repositório, que ninguém revisa junto com o código e que some assim que
 * alguém expõe a porta direta, sobe um staging sem proxy ou adiciona um segundo
 * ingress. Aqui o cabeçalho viaja com o binário.
 *
 * A CSP descreve a realidade: uma API JSON não carrega recurso nenhum, então
 * `default-src 'none'`. A única página HTML servida daqui é o Swagger UI, que
 * precisa de script e style inline para renderizar — e é por isso que o
 * relaxamento está amarrado ao mesmo interruptor que liga a documentação, em
 * vez de ficar permanentemente ligado "porque o Swagger pode precisar".
 */
export function buildHelmetOptions(options: {
  isProduction: boolean;
  swaggerEnabled: boolean;
}): HelmetOptions {
  const { isProduction, swaggerEnabled } = options;

  const directives: Record<string, string[]> = swaggerEnabled
    ? {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      }
    : {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      };

  return {
    contentSecurityPolicy: { directives },
    // A API não serve página navegável: `same-origin` impede que uma resposta
    // seja embutida por outro site.
    crossOriginResourcePolicy: { policy: "same-origin" },
    // HSTS só faz sentido sob TLS, e fora de produção o app roda em http —
    // ligá-lo ali travaria o navegador do desenvolvedor em https por um ano.
    hsts: isProduction
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
    hidePoweredBy: true,
  };
}
