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

  // 1.d (auditoria jul/2026): rota @Public() (ex.: GET /musicians/:id) que
  // precisa diferenciar "dono vendo o próprio perfil" de "estranho vendo" —
  // sem soft-auth, currentUser nunca seria populado numa rota pública.
  describe("soft-auth em rotas @Public()", () => {
    it("popula request.user quando um Bearer válido acompanha uma rota pública", async () => {
      const request = { headers: { authorization: "Bearer token" } };
      const verify = jest.fn().mockResolvedValue({
        sub: "musician-id",
        realm_access: { roles: ["musician"] },
      });
      const guard = new AuthGuard(
        { verify } as unknown as AuthJwtVerifier,
        { getAllAndOverride: jest.fn().mockReturnValue(true) } as any,
        { get: jest.fn() } as any,
      );

      await expect(guard.canActivate(createHttpContext(request))).resolves.toBe(
        true,
      );
      expect(verify).toHaveBeenCalledWith("token");
      expect(request).toMatchObject({
        user: { sub: "musician-id", roles: ["musician"] },
      });
    });

    it("NUNCA lança em rota pública com token inválido — degrada para anônimo", async () => {
      const request = { headers: { authorization: "Bearer token-invalido" } };
      const verify = jest.fn().mockRejectedValue(new Error("invalid token"));
      const guard = new AuthGuard(
        { verify } as unknown as AuthJwtVerifier,
        { getAllAndOverride: jest.fn().mockReturnValue(true) } as any,
        { get: jest.fn() } as any,
      );

      await expect(guard.canActivate(createHttpContext(request))).resolves.toBe(
        true,
      );
      expect((request as any).user).toBeUndefined();
    });

    it("rota pública sem token nenhum permanece anônima, sem tentar verificar", async () => {
      const request = { headers: {} };
      const verify = jest.fn();
      const guard = new AuthGuard(
        { verify } as unknown as AuthJwtVerifier,
        { getAllAndOverride: jest.fn().mockReturnValue(true) } as any,
        { get: jest.fn() } as any,
      );

      await expect(guard.canActivate(createHttpContext(request))).resolves.toBe(
        true,
      );
      expect(verify).not.toHaveBeenCalled();
      expect((request as any).user).toBeUndefined();
    });
  });
});
