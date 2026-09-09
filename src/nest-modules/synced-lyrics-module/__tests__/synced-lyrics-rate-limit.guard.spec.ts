import { ExecutionContext, HttpException, HttpStatus } from "@nestjs/common";

import { SyncedLyricsRateLimitGuard } from "../synced-lyrics-rate-limit.guard";

type RequestOverrides = {
  headers?: Record<string, unknown>;
  ip?: string;
};

function createHttpContext(
  method: string,
  overrides: RequestOverrides = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        headers: overrides.headers ?? {},
        ip: overrides.ip ?? "127.0.0.1",
        route: { path: "/music-library/synced-lyrics" },
      }),
    }),
  } as unknown as ExecutionContext;
}

function createGuard(
  cache: Record<string, jest.Mock>,
  jwtVerifier?: { verify: jest.Mock },
) {
  const guard = new SyncedLyricsRateLimitGuard();
  (guard as any).cache = cache;
  (guard as any).jwtVerifier = jwtVerifier;
  (guard as any).configService = {
    get: jest.fn((key: string) =>
      key === "RATE_LIMIT_MAX" ? 1 : key === "RATE_LIMIT_TTL" ? 60 : undefined,
    ),
  };
  return guard;
}

function createCache() {
  return {
    get: jest.fn().mockResolvedValue(0),
    set: jest.fn().mockResolvedValue(undefined),
  };
}

describe("SyncedLyricsRateLimitGuard", () => {
  it("fails open for public GET reads when cache is unavailable", async () => {
    const guard = createGuard({
      get: jest.fn().mockRejectedValue(new Error("cache down")),
      set: jest.fn(),
    });

    await expect(guard.canActivate(createHttpContext("GET"))).resolves.toBe(
      true,
    );
  });

  it("fails closed for write/bulk operations when cache is unavailable", async () => {
    const guard = createGuard({
      get: jest.fn().mockRejectedValue(new Error("cache down")),
      set: jest.fn(),
    });

    await expect(guard.canActivate(createHttpContext("POST"))).rejects.toThrow(
      HttpException,
    );
    await expect(
      guard.canActivate(createHttpContext("POST")),
    ).rejects.toMatchObject({
      response: "Rate limit unavailable",
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });

  it("rejects requests above the configured limit", async () => {
    const guard = createGuard({
      get: jest.fn().mockResolvedValue(1),
      set: jest.fn(),
    });

    await expect(guard.canActivate(createHttpContext("GET"))).rejects.toThrow(
      HttpException,
    );
  });

  /*
   * SM-027 — o bypass que existia: `x-forwarded-for` entrava na chave antes do
   * `request.ip`, e como o header é escrito pelo cliente, cada valor novo dava
   * um balde novo. Estes testes fixam que o header não influencia a chave.
   */
  describe("chave de rate limit (SM-027)", () => {
    function keyOf(cache: ReturnType<typeof createCache>): string {
      return String(cache.get.mock.calls[0][0]);
    }

    it("ignora X-Forwarded-For forjado — a chave é a mesma do IP do socket", async () => {
      const withoutHeader = createCache();
      await createGuard(withoutHeader).canActivate(
        createHttpContext("GET", { ip: "10.0.0.9" }),
      );

      const withForgedHeader = createCache();
      await createGuard(withForgedHeader).canActivate(
        createHttpContext("GET", {
          ip: "10.0.0.9",
          headers: { "x-forwarded-for": "203.0.113.7, 198.51.100.4" },
        }),
      );

      expect(keyOf(withForgedHeader)).toBe(keyOf(withoutHeader));
      expect(keyOf(withForgedHeader)).toContain("ip:10.0.0.9");
    });

    it("dois X-Forwarded-For diferentes do mesmo socket caem no MESMO balde", async () => {
      const first = createCache();
      await createGuard(first).canActivate(
        createHttpContext("GET", {
          ip: "10.0.0.9",
          headers: { "x-forwarded-for": "203.0.113.1" },
        }),
      );

      const second = createCache();
      await createGuard(second).canActivate(
        createHttpContext("GET", {
          ip: "10.0.0.9",
          headers: { "x-forwarded-for": "203.0.113.2" },
        }),
      );

      expect(keyOf(second)).toBe(keyOf(first));
    });

    it("usa o sub do JWT verificado quando há Bearer válido", async () => {
      const cache = createCache();
      const verifier = {
        verify: jest.fn().mockResolvedValue({ sub: "abc-123" }),
      };

      await createGuard(cache, verifier).canActivate(
        createHttpContext("GET", {
          ip: "10.0.0.9",
          headers: { authorization: "Bearer token-valido" },
        }),
      );

      expect(verifier.verify).toHaveBeenCalledWith("token-valido");
      expect(keyOf(cache)).toContain("user:abc-123");
      expect(keyOf(cache)).not.toContain("ip:");
    });

    it("degrada para IP quando o token é inválido — nunca lança", async () => {
      const cache = createCache();
      const verifier = {
        verify: jest.fn().mockRejectedValue(new Error("expirado")),
      };

      await expect(
        createGuard(cache, verifier).canActivate(
          createHttpContext("GET", {
            ip: "10.0.0.9",
            headers: { authorization: "Bearer token-velho" },
          }),
        ),
      ).resolves.toBe(true);

      expect(keyOf(cache)).toContain("ip:10.0.0.9");
    });

    it("prefixa user:/ip: para que um sub nunca colida com um endereço", async () => {
      const asUser = createCache();
      await createGuard(asUser, {
        verify: jest.fn().mockResolvedValue({ sub: "10.0.0.9" }),
      }).canActivate(
        createHttpContext("GET", {
          ip: "203.0.113.1",
          headers: { authorization: "Bearer t" },
        }),
      );

      const asIp = createCache();
      await createGuard(asIp).canActivate(
        createHttpContext("GET", { ip: "10.0.0.9" }),
      );

      expect(keyOf(asUser)).not.toBe(keyOf(asIp));
    });
  });
});
