import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";

import { RolesGuard } from "../roles.guard";

function createHttpContext(user?: Record<string, any>): ExecutionContext {
  return {
    getType: () => "http",
    getHandler: () => function handler() {},
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  it("allows public routes", () => {
    const guard = new RolesGuard({
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as any);

    expect(guard.canActivate(createHttpContext())).toBe(true);
  });

  it("requires an authenticated user when roles are configured", () => {
    const guard = new RolesGuard({
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(["musician"]),
    } as any);

    expect(() => guard.canActivate(createHttpContext())).toThrow(
      UnauthorizedException,
    );
  });

  it("allows a matching role", () => {
    const guard = new RolesGuard({
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(["musician"]),
    } as any);

    expect(guard.canActivate(createHttpContext({ roles: ["musician"] }))).toBe(
      true,
    );
  });

  it("allows admin as override role", () => {
    const guard = new RolesGuard({
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(["musician"]),
    } as any);

    expect(guard.canActivate(createHttpContext({ roles: ["admin"] }))).toBe(
      true,
    );
  });

  it("rejects users without a required role", () => {
    const guard = new RolesGuard({
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(["musician"]),
    } as any);

    expect(() =>
      guard.canActivate(createHttpContext({ roles: ["audience"] })),
    ).toThrow(ForbiddenException);
  });
});
