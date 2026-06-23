import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { InternalTokenGuard } from "../internal-token.guard";

function createHttpContext(
  headers: Record<string, string> = {},
): ExecutionContext {
  return {
    getType: () => "http",
    getHandler: () => function handler() {},
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

describe("InternalTokenGuard", () => {
  const metadata = {
    envKey: "AI_CIFRA_PROGRESS_TOKEN",
    headerName: "x-ai-cifra-progress-token",
  };

  it("allows routes without internal token metadata", () => {
    const guard = new InternalTokenGuard(
      { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as any,
      { get: jest.fn() } as unknown as ConfigService,
    );

    expect(guard.canActivate(createHttpContext())).toBe(true);
  });

  it("rejects when expected token is not configured", () => {
    const guard = new InternalTokenGuard(
      { getAllAndOverride: jest.fn().mockReturnValue(metadata) } as any,
      { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService,
    );

    expect(() => guard.canActivate(createHttpContext())).toThrow(
      ForbiddenException,
    );
  });

  it("rejects invalid header token", () => {
    const guard = new InternalTokenGuard(
      { getAllAndOverride: jest.fn().mockReturnValue(metadata) } as any,
      {
        get: jest.fn().mockReturnValue("expected"),
      } as unknown as ConfigService,
    );

    expect(() =>
      guard.canActivate(
        createHttpContext({ "x-ai-cifra-progress-token": "wrong" }),
      ),
    ).toThrow(ForbiddenException);
  });

  it("allows a valid header token", () => {
    const guard = new InternalTokenGuard(
      { getAllAndOverride: jest.fn().mockReturnValue(metadata) } as any,
      {
        get: jest.fn().mockReturnValue("expected"),
      } as unknown as ConfigService,
    );

    expect(
      guard.canActivate(
        createHttpContext({ "x-ai-cifra-progress-token": "expected" }),
      ),
    ).toBe(true);
  });
});
