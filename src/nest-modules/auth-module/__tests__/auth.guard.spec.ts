import { ExecutionContext, UnauthorizedException } from "@nestjs/common";

import { AuthGuard } from "../auth.guard";
import { AuthJwtVerifier } from "../auth-jwt.verifier";

function createHttpContext(request: Record<string, any>): ExecutionContext {
  return {
    getType: () => "http",
    getHandler: () => function handler() {},
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe("AuthGuard", () => {
  it("allows public routes without token", async () => {
    const guard = new AuthGuard(
      { verify: jest.fn() } as unknown as AuthJwtVerifier,
      { getAllAndOverride: jest.fn().mockReturnValue(true) } as any,
      { get: jest.fn() } as any,
    );

    await expect(
      guard.canActivate(createHttpContext({ headers: {} })),
    ).resolves.toBe(true);
  });

  it("rejects requests without bearer token", async () => {
    const guard = new AuthGuard(
      { verify: jest.fn() } as unknown as AuthJwtVerifier,
      { getAllAndOverride: jest.fn().mockReturnValue(false) } as any,
      { get: jest.fn() } as any,
    );

    await expect(
      guard.canActivate(createHttpContext({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("verifies bearer token and normalizes Keycloak roles", async () => {
    const request = { headers: { authorization: "Bearer token" } };
    const verify = jest.fn().mockResolvedValue({
      sub: "user-id",
      realm_access: { roles: ["audience"] },
      resource_access: {
        soundmeet: { roles: ["musician"] },
      },
    });
    const guard = new AuthGuard(
      { verify } as unknown as AuthJwtVerifier,
      { getAllAndOverride: jest.fn().mockReturnValue(false) } as any,
      {
        get: jest.fn((key: string) =>
          key === "KEYCLOAK_CLIENT_ID" ? "soundmeet" : "secret",
        ),
      } as any,
    );

    await expect(guard.canActivate(createHttpContext(request))).resolves.toBe(
      true,
    );
    expect(verify).toHaveBeenCalledWith("token");
    expect(request).toMatchObject({
      user: {
        sub: "user-id",
        roles: ["audience", "musician"],
      },
    });
  });
});
