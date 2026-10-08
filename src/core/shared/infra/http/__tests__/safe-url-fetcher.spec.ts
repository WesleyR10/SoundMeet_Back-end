import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { PassThrough } from "stream";

jest.mock("axios");
jest.mock("dns", () => ({
  lookup: jest.fn(),
}));
// file-type é ESM-only; o loader de módulos do Jest não interopera com
// `require(esm)` do jeito que o Node em produção interopera (dist compilado
// já usa esse caminho com sucesso — só o test runner não). `virtual: true`
// simula o módulo sem depender dessa interop, mantendo o teste focado em
// "o código usa o resultado do detector", não na integração com o pacote.
jest.mock("file-type", () => ({ fileTypeFromBuffer: jest.fn() }), {
  virtual: true,
});

import axios from "axios";
import * as dns from "dns";
import { fileTypeFromBuffer } from "file-type";

import {
  safeFetchToFile,
  SafeUrlFetchError,
  SsrfBlockedError,
} from "../safe-url-fetcher";

const mockedAxiosGet = axios.get as jest.Mock;
const mockedDnsLookup = dns.lookup as unknown as jest.Mock;
const mockedFileTypeFromBuffer = fileTypeFromBuffer as jest.Mock;

function mockDnsResolution(
  addresses: Array<{ address: string; family: number }>,
) {
  mockedDnsLookup.mockImplementation(
    (
      _hostname: string,
      _options: unknown,
      callback: (err: Error | null, addrs: unknown) => void,
    ) => {
      callback(null, addresses);
    },
  );
}

function mockHttpResponse(input: {
  status: number;
  headers?: Record<string, string>;
  body?: Buffer;
}) {
  const stream = new PassThrough();
  mockedAxiosGet.mockResolvedValueOnce({
    status: input.status,
    headers: input.headers ?? {},
    data: stream,
  });
  if (input.body) {
    process.nextTick(() => {
      stream.end(input.body);
    });
  } else {
    process.nextTick(() => stream.end());
  }
  return stream;
}

describe("safeFetchToFile (SM-001 SSRF)", () => {
  let destPath: string;

  beforeEach(() => {
    jest.clearAllMocks();
    destPath = join(tmpdir(), `safe-fetch-test-${randomUUID()}`);
  });

  afterEach(async () => {
    await fs.unlink(destPath).catch(() => undefined);
  });

  it("bloqueia loopback IPv4 (127.0.0.1)", async () => {
    mockDnsResolution([{ address: "127.0.0.1", family: 4 }]);

    await expect(
      safeFetchToFile({
        url: "http://127.0.0.1/secret",
        destPath,
        maxBytes: 1024,
      }),
    ).rejects.toThrow(SsrfBlockedError);
    expect(mockedAxiosGet).not.toHaveBeenCalled();
  });

  it("bloqueia loopback IPv6 (::1)", async () => {
    mockDnsResolution([{ address: "::1", family: 6 }]);

    await expect(
      safeFetchToFile({ url: "http://localhost/x", destPath, maxBytes: 1024 }),
    ).rejects.toThrow(SsrfBlockedError);
  });

  it("bloqueia o metadata endpoint de nuvem (169.254.169.254)", async () => {
    mockDnsResolution([{ address: "169.254.169.254", family: 4 }]);

    await expect(
      safeFetchToFile({
        url: "http://169.254.169.254/latest/meta-data/",
        destPath,
        maxBytes: 1024,
      }),
    ).rejects.toThrow(SsrfBlockedError);
  });

  it.each([["10.0.0.5"], ["172.16.5.1"], ["192.168.1.1"], ["100.64.0.1"]])(
    "bloqueia faixa RFC1918/CGNAT: %s",
    async (ip) => {
      mockDnsResolution([{ address: ip, family: 4 }]);
      await expect(
        safeFetchToFile({
          url: "http://internal.example/x",
          destPath,
          maxBytes: 1024,
        }),
      ).rejects.toThrow(SsrfBlockedError);
    },
  );

  it("bloqueia IPv4-mapped IPv6 apontando para faixa privada (::ffff:127.0.0.1)", async () => {
    mockDnsResolution([{ address: "::ffff:127.0.0.1", family: 6 }]);
    await expect(
      safeFetchToFile({
        url: "http://sneaky.example/x",
        destPath,
        maxBytes: 1024,
      }),
    ).rejects.toThrow(SsrfBlockedError);
  });

  it("bloqueia quando o resolver devolve IP público E privado (DNS rebinding)", async () => {
    mockDnsResolution([
      { address: "8.8.8.8", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    await expect(
      safeFetchToFile({
        url: "http://rebind.example/x",
        destPath,
        maxBytes: 1024,
      }),
    ).rejects.toThrow(SsrfBlockedError);
  });

  it("rejeita URL com credenciais embutidas", async () => {
    await expect(
      safeFetchToFile({
        url: "http://user:pass@example.com/x",
        destPath,
        maxBytes: 1024,
      }),
    ).rejects.toThrow(SsrfBlockedError);
    expect(mockedDnsLookup).not.toHaveBeenCalled();
  });

  it("rejeita protocolo não http/https", async () => {
    await expect(
      safeFetchToFile({ url: "file:///etc/passwd", destPath, maxBytes: 1024 }),
    ).rejects.toThrow(SsrfBlockedError);
  });

  it("bloqueia redirect público -> privado", async () => {
    mockDnsResolution([{ address: "1.2.3.4", family: 4 }]);
    mockHttpResponse({
      status: 302,
      headers: { location: "http://internal.example/private" },
    });
    mockDnsResolution([{ address: "10.0.0.1", family: 4 }]);

    await expect(
      safeFetchToFile({
        url: "http://public.example/redirect",
        destPath,
        maxBytes: 1024,
      }),
    ).rejects.toThrow(SsrfBlockedError);
  });

  it("bloqueia após exceder o limite de redirects", async () => {
    mockDnsResolution([{ address: "1.2.3.4", family: 4 }]);
    for (let i = 0; i < 5; i++) {
      mockHttpResponse({
        status: 302,
        headers: { location: `http://public.example/hop-${i}` },
      });
    }

    await expect(
      safeFetchToFile({
        url: "http://public.example/start",
        destPath,
        maxBytes: 1024,
        maxRedirects: 3,
      }),
    ).rejects.toThrow(/redirects/);
  });

  it("baixa com sucesso um host público e detecta content-type por magic bytes", async () => {
    mockDnsResolution([{ address: "1.2.3.4", family: 4 }]);
    mockedFileTypeFromBuffer.mockResolvedValueOnce({
      ext: "png",
      mime: "image/png",
    });
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const body = Buffer.concat([pngHeader, Buffer.alloc(100, 0)]);
    mockHttpResponse({ status: 200, body });

    const result = await safeFetchToFile({
      url: "http://public.example/audio.mp3",
      destPath,
      maxBytes: 1_000_000,
      contentTypeHint: "audio/mpeg",
    });

    expect(result.file_size).toBe(body.length);
    expect(result.content_type).toBe("image/png");
    const written = await fs.readFile(destPath);
    expect(written.equals(body)).toBe(true);
  });

  it("usa o content_type hint do cliente só quando magic bytes não detectam nada", async () => {
    mockDnsResolution([{ address: "1.2.3.4", family: 4 }]);
    mockedFileTypeFromBuffer.mockResolvedValueOnce(undefined);
    const body = Buffer.from("not a real media file, just text bytes here");
    mockHttpResponse({ status: 200, body });

    const result = await safeFetchToFile({
      url: "http://public.example/audio.mp3",
      destPath,
      maxBytes: 1_000_000,
      contentTypeHint: "audio/mpeg",
    });

    expect(result.content_type).toBe("audio/mpeg");
  });

  it("rejeita resposta maior que o limite de tamanho", async () => {
    mockDnsResolution([{ address: "1.2.3.4", family: 4 }]);
    const body = Buffer.alloc(2048, 1);
    mockHttpResponse({ status: 200, body });

    await expect(
      safeFetchToFile({
        url: "http://public.example/big",
        destPath,
        maxBytes: 1024,
      }),
    ).rejects.toThrow(SafeUrlFetchError);

    await expect(fs.access(destPath)).rejects.toThrow();
  });
});
