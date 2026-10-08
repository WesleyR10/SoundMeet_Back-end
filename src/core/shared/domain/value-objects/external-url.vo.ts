import { Either } from "../either";
import { ValueObject } from "../value-object";

/**
 * URL de terceiro que o usuário digitou — link de perfil social, site do
 * estabelecimento — validada na ESCRITA.
 *
 * 🔴 Por que existe (INP-2). Os dois frontends já barram URL hostil na leitura
 * (`shared/utils/external-url.ts`, SM-025), mas a API não barrava nada na
 * escrita: `socialLinks` do músico era `@IsObject()` sobre
 * `Record<string, unknown>` e `website` do estabelecimento era string livre.
 * A defesa do cliente não cobre cliente HTTP cru, app antigo, nem terceiro que
 * leia a nossa API sem passar pelo parser — e "o front filtra" transforma o
 * banco em depósito de `javascript:` e `http://169.254.169.254/`.
 *
 * ⚠️ **Parser manual, não `new URL()`.** No Node o `URL` é o WHATWG correto, e
 * ainda assim ele não serve aqui: WHATWG *normaliza* (remove TAB/CR/LF do meio
 * do esquema, trata `\` como `/`, percent-decodifica o host) porque o trabalho
 * dele é fazer o navegador chegar a algum lugar. O nosso trabalho é o oposto —
 * decidir se aceitamos guardar isto. Recusar o ambíguo é mais barato e mais
 * seguro do que reproduzir a normalização e errar num canto. É o mesmo parser
 * de `soundmeet-mobile/src/shared/utils/external-url.ts`, portado inteiro; lá o
 * motivo era outro (o `URL` do React Native diverge da WHATWG), mas a regra
 * resultante é a mesma nos três lugares — e agora ela também vale na escrita.
 */

export type ExternalUrlBlockReason =
  | "empty"
  | "too_long"
  | "unsafe_characters"
  | "not_https"
  | "has_userinfo"
  | "invalid_host";

export type ParsedExternalUrl = {
  scheme: string;
  host: string;
  port: string | null;
};

/** Limite de coluna do banco e teto contra payload absurdo. */
const MAX_LENGTH = 500;

/*
 * Controle, espaço e barra invertida. A WHATWG manda REMOVER tab/CR/LF antes de
 * parsear (um TAB no meio de `ht<TAB>tps://…` some e o resultado é `https://…`)
 * e tratar `\` como `/`. Reproduzir essa limpeza aqui seria copiar o navegador
 * de memória e errar em algum canto; recusar é a única resposta que não depende
 * de acertar a cópia.
 */
function hasUnsafeCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    // Controle C0 (0x00-0x1F), espaço (0x20) e DEL (0x7F).
    if (code <= 0x20 || code === 0x7f) return true;
    if (value[i] === "\\") return true;
  }
  return false;
}

/*
 * Host ASCII com pelo menos um ponto. Sem `%` porque a WHATWG percent-decodifica
 * o host (`%69nstagram.com` vira `instagram.com`) e sem não-ASCII porque o
 * homógrafo cirílico de `instagram.com` é indistinguível na tela.
 *
 * Exigir o ponto também nega, de graça, `localhost` e qualquer nome interno —
 * e o formato de rótulo nega IPv4 puro (`169.254.169.254` tem rótulos que
 * começam com dígito e o TLD numérico não casa a última alternativa).
 */
const HOSTNAME =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;

const SCHEME_AUTHORITY =
  /^([a-zA-Z][a-zA-Z\d+\-.]*):\/\/([^/?#]*)([/?#][\s\S]*)?$/;

function parseAuthority(raw: string): {
  scheme: string;
  userinfo: string | null;
  host: string;
  port: string | null;
} | null {
  const match = SCHEME_AUTHORITY.exec(raw);
  if (!match) return null;

  const authority = match[2];

  // `lastIndexOf` e não `indexOf`: o host é o que vem depois do ÚLTIMO `@` —
  // `https://a@instagram.com@evil.example/` aponta para `evil.example`, e é
  // exatamente esse o link que "começa com instagram.com" na tela do usuário.
  const at = authority.lastIndexOf("@");
  const hostPort = at >= 0 ? authority.slice(at + 1) : authority;

  // IPv6 (`[::1]`) não aparece em link de perfil, e parsear pela metade é pior
  // do que recusar.
  if (hostPort.startsWith("[")) return null;

  const colon = hostPort.indexOf(":");

  return {
    scheme: match[1].toLowerCase(),
    userinfo: at >= 0 ? authority.slice(0, at) : null,
    host: (colon >= 0 ? hostPort.slice(0, colon) : hostPort).toLowerCase(),
    port: colon >= 0 ? hostPort.slice(colon + 1) : null,
  };
}

/**
 * `endsWith('.' + domain)` e não `endsWith(domain)`: sem o ponto,
 * `notinstagram.com` passaria por `instagram.com` — que é exatamente o
 * "domínio parecido" que a allowlist existe para negar.
 */
export function isWithinDomain(host: string, domain: string): boolean {
  const registrable = domain.toLowerCase();
  return host === registrable || host.endsWith(`.${registrable}`);
}

/**
 * Analisa a URL sem lançar. `null` quando ela não é aceitável para guardar.
 */
export function parseExternalUrl(
  raw: string | null | undefined,
): ParsedExternalUrl | null {
  const result = inspectExternalUrl(raw);
  return result.ok ? result.parsed : null;
}

export type ExternalUrlInspection =
  | { ok: true; parsed: ParsedExternalUrl }
  | { ok: false; reason: ExternalUrlBlockReason };

export function inspectExternalUrl(
  raw: string | null | undefined,
): ExternalUrlInspection {
  const value = (raw ?? "").trim();

  if (!value) return { ok: false, reason: "empty" };
  if (value.length > MAX_LENGTH) return { ok: false, reason: "too_long" };
  if (hasUnsafeCharacters(value)) {
    return { ok: false, reason: "unsafe_characters" };
  }

  const parsed = parseAuthority(value);

  // Sem `esquema://` não é link absoluto; com esquema diferente de https, é
  // `javascript:`, `intent:`, `file:`, `data:` ou o downgrade `http:`.
  if (!parsed || parsed.scheme !== "https") {
    return { ok: false, reason: "not_https" };
  }
  if (parsed.userinfo !== null) return { ok: false, reason: "has_userinfo" };
  if (!HOSTNAME.test(parsed.host)) return { ok: false, reason: "invalid_host" };
  if (parsed.port !== null && !/^\d+$/.test(parsed.port)) {
    return { ok: false, reason: "invalid_host" };
  }

  return {
    ok: true,
    parsed: { scheme: parsed.scheme, host: parsed.host, port: parsed.port },
  };
}

export class ExternalUrl extends ValueObject {
  readonly value: string;
  readonly host: string;

  constructor(value: string, allowedDomains: readonly string[] = []) {
    super();

    const result = inspectExternalUrl(value);
    if (!result.ok) {
      throw new InvalidExternalUrlError(MESSAGES[result.reason]);
    }

    if (
      allowedDomains.length > 0 &&
      !allowedDomains.some((domain) =>
        isWithinDomain(result.parsed.host, domain),
      )
    ) {
      throw new InvalidExternalUrlError(
        `URL host is not allowed for this field (${result.parsed.host})`,
      );
    }

    this.value = (value ?? "").trim();
    this.host = result.parsed.host;
  }

  static create(
    value: string,
    allowedDomains: readonly string[] = [],
  ): Either<ExternalUrl, InvalidExternalUrlError> {
    return Either.safe<ExternalUrl, InvalidExternalUrlError>(
      () => new ExternalUrl(value, allowedDomains),
    );
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}

const MESSAGES: Record<ExternalUrlBlockReason, string> = {
  empty: "URL cannot be empty",
  too_long: `URL is too long (max ${MAX_LENGTH} characters)`,
  unsafe_characters: "URL contains control or ambiguous characters",
  not_https: "URL must be an absolute https:// address",
  has_userinfo: "URL must not contain credentials before the host",
  invalid_host: "URL host is invalid",
};

export class InvalidExternalUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidExternalUrlError";
  }
}

// ─── Link de rede social ──────────────────────────────────────────────────────

/**
 * Domínios registráveis de cada rede. Espelho de `SOCIAL_DOMAINS` em
 * `soundmeet-mobile/src/shared/utils/external-url.ts` — os dois lados precisam
 * concordar, senão o backend aceita o que o app se recusa a abrir (link morto
 * no perfil) ou recusa o que o app abriria (o músico não consegue salvar).
 */
export const SOCIAL_DOMAINS = {
  instagram: ["instagram.com"],
  // `youtu.be` é domínio registrável próprio, não subdomínio de youtube.com.
  youtube: ["youtube.com", "youtu.be"],
  spotify: ["spotify.com"],
} as const satisfies Record<string, readonly string[]>;

export type SocialUrlPlatform = keyof typeof SOCIAL_DOMAINS;

const SOCIAL_HANDLE_URL: Record<SocialUrlPlatform, (handle: string) => string> =
  {
    instagram: (handle) => `https://instagram.com/${handle}`,
    // O YouTube quer o `@` no caminho; o Instagram não.
    youtube: (handle) => `https://youtube.com/@${handle}`,
    spotify: (handle) => `https://open.spotify.com/${handle}`,
  };

const HAS_SCHEME = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

/**
 * Valida o que o músico digitou no campo de uma rede social.
 *
 * 🔴 **O campo NÃO guarda URL, e essa é a razão desta função existir.** O app
 * salva exatamente o que foi digitado — `@joao`, `instagram.com/joao` ou a URL
 * inteira (`musician.validation.ts` é `z.string().trim()`, sem validação de
 * URL), e só monta o endereço na hora de abrir, em `buildSocialUrl`. Exigir
 * `https://` na escrita daria 422 para todo músico que digitou handle, que é o
 * caminho principal da UI.
 *
 * Então a regra da escrita é a MESMA da leitura, portada de `buildSocialUrl`:
 * valor com esquema vale o que o esquema diz (e precisa ser https no domínio da
 * rede); valor sem esquema é handle e é montado sobre o domínio da própria
 * rede — `evil.example/x` no campo do Instagram vira
 * `https://instagram.com/evil.example/x`, um link morto dentro do Instagram, e
 * nunca uma visita a `evil.example`.
 */
export function inspectSocialLink(
  platform: SocialUrlPlatform,
  rawValue: string | null | undefined,
): ExternalUrlInspection {
  const value = (rawValue ?? "").trim();

  if (!value) return { ok: false, reason: "empty" };
  if (value.length > MAX_LENGTH) return { ok: false, reason: "too_long" };
  if (hasUnsafeCharacters(value)) {
    return { ok: false, reason: "unsafe_characters" };
  }

  const domains: readonly string[] = SOCIAL_DOMAINS[platform];

  // Já traz esquema: vale o que ele diz. Nunca prefixar `https://` sobre um
  // esquema existente — `https://javascript:alert(1)` esconderia a recusa.
  const candidate = HAS_SCHEME.test(value)
    ? value
    : buildFromHandle(platform, value, domains);

  const result = inspectExternalUrl(candidate);
  if (!result.ok) return result;

  if (!domains.some((domain) => isWithinDomain(result.parsed.host, domain))) {
    return { ok: false, reason: "invalid_host" };
  }

  return result;
}

function buildFromHandle(
  platform: SocialUrlPlatform,
  value: string,
  domains: readonly string[],
): string {
  const authority = value.split(/[/?#]/, 1)[0].toLowerCase();
  const isKnownHost = domains.some((domain) =>
    isWithinDomain(authority, domain),
  );

  return isKnownHost
    ? `https://${value}`
    : SOCIAL_HANDLE_URL[platform](value.replace(/^@+/, ""));
}
