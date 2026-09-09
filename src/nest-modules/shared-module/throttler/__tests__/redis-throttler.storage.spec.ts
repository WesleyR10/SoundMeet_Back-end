type Handlers = Record<string, (...args: any[]) => void>;

const mockClient: {
  on: jest.Mock;
  connect: jest.Mock;
  eval: jest.Mock;
  quit: jest.Mock;
  __handlers: Handlers;
} = {
  on: jest.fn(),
  connect: jest.fn(),
  eval: jest.fn(),
  quit: jest.fn(),
  __handlers: {},
};

jest.mock("redis", () => ({
  createClient: jest.fn(() => {
    mockClient.__handlers = {};
    mockClient.on.mockImplementation((event: string, cb: any) => {
      mockClient.__handlers[event] = cb;
      return mockClient;
    });
    return mockClient;
  }),
}));

import { RedisThrottlerStorage } from "../redis-throttler.storage";

function markReady() {
  mockClient.__handlers["ready"]?.();
}

describe("RedisThrottlerStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.connect.mockResolvedValue(undefined);
  });

  it("fail-open enquanto não conectou (nunca bloqueia)", async () => {
    const storage = new RedisThrottlerStorage("redis://x");
    // sem disparar 'ready'
    const record = await storage.increment("k", 60000, 5, 60000, "default");

    expect(record).toEqual({
      totalHits: 0,
      timeToExpire: 0,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
    // não chegou a chamar o Redis
    expect(mockClient.eval).not.toHaveBeenCalled();
  });

  it("mapeia o resultado do EVAL, convertendo PTTL de ms para segundos", async () => {
    const storage = new RedisThrottlerStorage("redis://x");
    markReady();
    // [totalHits, hitPTTL(ms), isBlocked, blockPTTL(ms)]
    mockClient.eval.mockResolvedValue([3, 45000, 0, 0]);

    const record = await storage.increment("k", 60000, 5, 60000, "default");

    expect(record).toEqual({
      totalHits: 3,
      timeToExpire: 45, // 45000ms -> 45s
      isBlocked: false,
      timeToBlockExpire: 0,
    });
    expect(mockClient.eval).toHaveBeenCalledTimes(1);
  });

  it("reporta bloqueio quando o script devolve isBlocked=1", async () => {
    const storage = new RedisThrottlerStorage("redis://x");
    markReady();
    mockClient.eval.mockResolvedValue([6, 30000, 1, 55000]);

    const record = await storage.increment("k", 60000, 5, 60000, "default");

    expect(record.isBlocked).toBe(true);
    expect(record.totalHits).toBe(6);
    expect(record.timeToBlockExpire).toBe(55); // arredonda para cima
  });

  it("fail-open quando o EVAL lança (Redis instável não derruba o request)", async () => {
    const storage = new RedisThrottlerStorage("redis://x");
    markReady();
    mockClient.eval.mockRejectedValue(new Error("CONNRESET"));

    const record = await storage.increment("k", 60000, 5, 60000, "default");

    expect(record.isBlocked).toBe(false);
    expect(record.totalHits).toBe(0);
  });
});
