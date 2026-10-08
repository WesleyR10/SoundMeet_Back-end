import axios from "axios";
import type { LookupAddress } from "dns";
import { lookup as dnsLookup } from "dns";
import { createWriteStream, promises as fs } from "fs";
import type { Readable } from "stream";

/**
 * Mitigação de SSRF (SM-001): nenhuma conexão de saída pode completar contra
 * IP privado/loopback/link-local/multicast/reservado — nem no primeiro
 * request, nem em nenhum dos redirects seguidos manualmente. A checagem é
 * refeita a cada hop porque o destino de um redirect é tão perigoso quanto a
 * URL original (ex.: um domínio público que redireciona para
 * `http://169.254.169.254/`).
 *
 * DNS rebinding: resolver o hostname e depois abrir a conexão separadamente
 * deixaria uma janela entre checar e conectar (o atacante troca o registro
 * DNS entre as duas). Por isso o IP validado é fixado (pinned) via a opção
 * `lookup` do axios/Node — a conexão TCP nunca resolve o hostname de novo.
 */

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfBlockedError";
  }
}

export class SafeUrlFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeUrlFetchError";
  }
}

type IpFamily = 4 | 6;

// IPv4: cada entrada é [rede, tamanho do prefixo]
const FORBIDDEN_IPV4_RANGES: Array<[string, number]> = [
  ["0.0.0.0", 8], // "esta rede" / unspecified
  ["10.0.0.0", 8], // RFC1918
  ["100.64.0.0", 10], // CGNAT (RFC6598) — usado por alguns proxies de metadata
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local — inclui o metadata endpoint de nuvem
  ["172.16.0.0", 12], // RFC1918
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.168.0.0", 16], // RFC1918
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reservado
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0;
}

function isForbiddenIpv4(ip: string): boolean {
  const asInt = ipv4ToInt(ip);
  if (asInt === null) return true; // não parseável — trata como perigoso
  for (const [network, prefix] of FORBIDDEN_IPV4_RANGES) {
    const networkInt = ipv4ToInt(network)!;
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    if ((asInt & mask) === (networkInt & mask)) {
      return true;
    }
  }
  return false;
}

/** Expande um endereço IPv6 (com ou sem "::") para 8 grupos hex de 16 bits. */
function expandIpv6Groups(ip: string): number[] | null {
  const withoutZone = ip.split("%")[0];
  const parts = withoutZone.split("::");
  if (parts.length > 2) return null;

  const parseGroups = (segment: string): number[] => {
    if (segment.length === 0) return [];
    return segment.split(":").map((g) => parseInt(g, 16));
  };

  let head = parseGroups(parts[0]);
  let tail = parts.length === 2 ? parseGroups(parts[1]) : [];

  // suporte a IPv4-mapped ("::ffff:1.2.3.4") no último segmento
  const last = tail.length > 0 ? tail[tail.length - 1] : head[head.length - 1];
  if (withoutZone.includes(".") && (tail.length > 0 || parts.length === 1)) {
    const dotted = withoutZone.split(":").pop()!;
    const asInt = ipv4ToInt(dotted);
    if (asInt === null) return null;
    const hi = (asInt >>> 16) & 0xffff;
    const lo = asInt & 0xffff;
    const groupsWithoutIpv4 = withoutZone
      .slice(0, withoutZone.lastIndexOf(":"))
      .split(parts.length === 2 ? "::" : ":");
    if (parts.length === 2) {
      head = parseGroups(groupsWithoutIpv4[0] ?? "");
      tail = parseGroups(groupsWithoutIpv4[1] ?? "").concat([hi, lo]);
    } else {
      head = parseGroups(groupsWithoutIpv4.join(":")).concat([hi, lo]);
      tail = [];
    }
  }

  if (head.some((g) => Number.isNaN(g) || g < 0 || g > 0xffff)) return null;
  if (tail.some((g) => Number.isNaN(g) || g < 0 || g > 0xffff)) return null;

  const missing = 8 - head.length - tail.length;
  if (parts.length === 1) {
    if (head.length !== 8) return null;
    return head;
  }
  if (missing < 0) return null;
  return [...head, ...new Array(missing).fill(0), ...tail];
}

function isForbiddenIpv6(ip: string): boolean {
  const groups = expandIpv6Groups(ip);
  if (!groups) return true; // não parseável — trata como perigoso

  const isZero = groups.every((g) => g === 0);
  if (isZero) return true; // "::" unspecified

  const isLoopback =
    groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1;
  if (isLoopback) return true; // ::1

  // IPv4-mapped (::ffff:0:0/96) — reavalia as regras de IPv4
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    const ipv4 = [
      (groups[6] >>> 8) & 0xff,
      groups[6] & 0xff,
      (groups[7] >>> 8) & 0xff,
      groups[7] & 0xff,
    ].join(".");
    return isForbiddenIpv4(ipv4);
  }

  if ((groups[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 (ULA)
  if ((groups[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 (link-local)
  if ((groups[0] & 0xff00) === 0xff00) return true; // ff00::/8 (multicast)

  return false;
}

function isForbiddenIp(address: string, family: IpFamily): boolean {
  return family === 4 ? isForbiddenIpv4(address) : isForbiddenIpv6(address);
}

async function resolveAllAddresses(hostname: string): Promise<LookupAddress[]> {
  return new Promise((resolve, reject) => {
    dnsLookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
      if (err) return reject(err);
      resolve(addresses as LookupAddress[]);
    });
  });
}

/**
 * Resolve o hostname e valida TODOS os IPs retornados (não só o primeiro) —
 * um resolver que devolve um IP público e um privado na mesma resposta ainda
 * é uma tentativa de bypass e deve ser bloqueada.
 */
async function resolvePinnedPublicAddress(
  hostname: string,
): Promise<{ address: string; family: IpFamily }> {
  const literalFamily = ipv4ToInt(hostname) !== null ? 4 : null;
  const addresses: LookupAddress[] = literalFamily
    ? [{ address: hostname, family: 4 }]
    : await resolveAllAddresses(hostname);

  if (addresses.length === 0) {
    throw new SsrfBlockedError(`Não foi possível resolver o host: ${hostname}`);
  }

  for (const { address, family } of addresses) {
    if (isForbiddenIp(address, family as IpFamily)) {
      throw new SsrfBlockedError(
        `Destino bloqueado (IP privado/reservado): ${address}`,
      );
    }
  }

  return {
    address: addresses[0].address,
    family: addresses[0].family as IpFamily,
  };
}

function assertSafeUrlShape(rawUrl: string): URL {
  let urlObj: URL;
  try {
    urlObj = new URL(rawUrl);
  } catch {
    throw new SafeUrlFetchError(`URL inválida: ${rawUrl}`);
  }

  if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
    throw new SsrfBlockedError(`Protocolo não permitido: ${urlObj.protocol}`);
  }
  if (urlObj.username || urlObj.password) {
    throw new SsrfBlockedError("URL com credenciais embutidas não é permitida");
  }
  return urlObj;
}

export type SafeFetchInput = {
  url: string;
  destPath: string;
  maxBytes: number;
  timeoutMs?: number;
  maxRedirects?: number;
  /** Content-Type declarado pelo cliente — usado só como fallback, nunca como fonte de verdade. */
  contentTypeHint?: string | null;
};

export type SafeFetchResult = {
  file_size: number;
  content_type: string | null;
  final_url: string;
};

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_REDIRECTS = 3;
const MAGIC_BYTES_SNIFF_SIZE = 4100;

/**
 * Baixa uma URL para arquivo com proteção SSRF completa: valida IP em cada
 * hop de redirect (segue manualmente, `maxRedirects: 0` no axios), fixa a
 * conexão TCP no IP validado (via `lookup`) para fechar a janela de DNS
 * rebinding, aplica limite de tamanho durante o streaming e detecta o
 * content-type real por magic bytes — nunca confia no header do servidor
 * nem no valor enviado pelo cliente.
 */
export async function safeFetchToFile(
  input: SafeFetchInput,
): Promise<SafeFetchResult> {
  const maxRedirects = input.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let currentUrl = input.url;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const urlObj = assertSafeUrlShape(currentUrl);
    const pinned = await resolvePinnedPublicAddress(urlObj.hostname);

    const pinnedLookup = (
      _hostname: string,
      options: unknown,
      callback: (err: Error | null, address: string, family: number) => void,
    ) => callback(null, pinned.address, pinned.family);

    const response = await axios.get(currentUrl, {
      responseType: "stream",
      timeout: timeoutMs,
      maxRedirects: 0,
      validateStatus: () => true,
      lookup: pinnedLookup as never,
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers?.location;
      if (typeof location !== "string" || location.length === 0) {
        throw new SafeUrlFetchError(
          `Redirect sem Location (status ${response.status})`,
        );
      }
      (response.data as Readable).resume?.();
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      (response.data as Readable).resume?.();
      throw new SafeUrlFetchError(
        `Falha ao baixar URL (status ${response.status})`,
      );
    }

    return await streamResponseToFile({
      stream: response.data as Readable,
      destPath: input.destPath,
      maxBytes: input.maxBytes,
      contentTypeHint: input.contentTypeHint ?? null,
      finalUrl: currentUrl,
    });
  }

  throw new SsrfBlockedError(`Excedeu o limite de ${maxRedirects} redirects`);
}

async function detectContentTypeFromBuffer(
  buffer: Buffer,
): Promise<string | null> {
  try {
    const { fileTypeFromBuffer } = await import("file-type");
    const detected = await fileTypeFromBuffer(buffer);
    return detected?.mime ?? null;
  } catch {
    return null;
  }
}

async function streamResponseToFile(input: {
  stream: Readable;
  destPath: string;
  maxBytes: number;
  contentTypeHint: string | null;
  finalUrl: string;
}): Promise<SafeFetchResult> {
  const writer = createWriteStream(input.destPath);
  let totalBytes = 0;
  const sizeError = new SafeUrlFetchError(
    "Arquivo excede o tamanho máximo permitido",
  );
  const sniffChunks: Buffer[] = [];
  let sniffedBytes = 0;

  await new Promise<void>((resolve, reject) => {
    writer.on("error", (err) => {
      input.stream.destroy();
      reject(err);
    });
    input.stream.on("error", (err) => {
      writer.destroy();
      reject(err);
    });
    input.stream.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > input.maxBytes) {
        input.stream.destroy(sizeError);
        return;
      }
      if (sniffedBytes < MAGIC_BYTES_SNIFF_SIZE) {
        sniffChunks.push(chunk);
        sniffedBytes += chunk.length;
      }
    });
    writer.on("finish", resolve);
    input.stream.pipe(writer);
  }).catch(async (err) => {
    await fs.unlink(input.destPath).catch(() => undefined);
    throw err;
  });

  const detectedContentType = await detectContentTypeFromBuffer(
    Buffer.concat(sniffChunks),
  );

  return {
    file_size: totalBytes,
    content_type: detectedContentType ?? input.contentTypeHint ?? null,
    final_url: input.finalUrl,
  };
}
