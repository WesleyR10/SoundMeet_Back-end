import { ExecutionContext, HttpException, HttpStatus } from "@nestjs/common";

import { SyncedLyricsRateLimitGuard } from "../synced-lyrics-rate-limit.guard";

function createHttpContext(method: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        headers: {},
        ip: "127.0.0.1",
        route: { path: "/music-library/synced-lyrics" },
      }),
    }),
  } as unknown as ExecutionContext;
}

function createGuard(cache: Record<string, jest.Mock>) {
  const guard = new SyncedLyricsRateLimitGuard();
  (guard as any).cache = cache;
  (guard as any).configService = {
    get: jest.fn((key: string) =>
      key === "RATE_LIMIT_MAX" ? 1 : key === "RATE_LIMIT_TTL" ? 60 : undefined,
    ),
  };
  return guard;
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
});
