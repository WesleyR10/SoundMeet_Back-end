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

    /*
     * 🔴 O `sub` de um token RECUSADO fica registrado para o handler.
     *
     * Rota pública com representação dupla (`GET /musicians/:id`) precisa
     * distinguir "estranho com token velho" de "o próprio dono com token
     * velho": ao segundo ela responde 401, para o app renovar a sessão em vez
     * de exibir a versão pública do perfil dele como se fosse a completa.
     */
    describe("token recusado deixa o `sub` não verificado em request", () => {
      const tokenWith = (payload: unknown) =>
        `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;

      const guardRejecting = () =>
        new AuthGuard(
          {
            verify: jest.fn().mockRejectedValue(new Error("jwt expired")),
          } as unknown as AuthJwtVerifier,
          { getAllAndOverride: jest.fn().mockReturnValue(true) } as any,
          { get: jest.fn() } as any,
        );

      it("registra o sub e NÃO popula request.user", async () => {
        const request = {
          headers: {
            authorization: `Bearer ${tokenWith({ sub: "musico-1" })}`,
          },
        };

        await expect(
          guardRejecting().canActivate(createHttpContext(request)),
        ).resolves.toBe(true);

        expect((request as any).rejectedTokenSub).toBe("musico-1");
        expect((request as any).user).toBeUndefined();
      });

      it.each([
        ["token que não é JWT", "lixo"],
        ["payload que não é JSON", "h.%%%.s"],
        ["sub ausente", tokenWith({ aud: "x" })],
        ["sub que não é texto", tokenWith({ sub: 42 })],
        ["sub vazio", tokenWith({ sub: "" })],
      ])("%s: não registra nada e não lança", async (_label, token) => {
        const request = { headers: { authorization: `Bearer ${token}` } };

        await expect(
          guardRejecting().canActivate(createHttpContext(request)),
        ).resolves.toBe(true);

        expect((request as any).rejectedTokenSub).toBeUndefined();
      });

      it("token VÁLIDO não deixa sub recusado", async () => {
        const request = {
          headers: {
            authorization: `Bearer ${tokenWith({ sub: "musico-1" })}`,
          },
        };
        const guard = new AuthGuard(
          {
            verify: jest.fn().mockResolvedValue({ sub: "musico-1" }),
          } as unknown as AuthJwtVerifier,
          { getAllAndOverride: jest.fn().mockReturnValue(true) } as any,
          { get: jest.fn() } as any,
        );

        await guard.canActivate(createHttpContext(request));

        expect((request as any).rejectedTokenSub).toBeUndefined();
        expect((request as any).user).toMatchObject({ sub: "musico-1" });
      });

      it("rota NÃO pública segue respondendo 401 e não registra sub nenhum", async () => {
        const request = {
          headers: {
            authorization: `Bearer ${tokenWith({ sub: "musico-1" })}`,
          },
        };
        const guard = new AuthGuard(
          {
            verify: jest.fn().mockRejectedValue(new Error("jwt expired")),
          } as unknown as AuthJwtVerifier,
          { getAllAndOverride: jest.fn().mockReturnValue(false) } as any,
          { get: jest.fn() } as any,
        );

        await expect(
          guard.canActivate(createHttpContext(request)),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        expect((request as any).rejectedTokenSub).toBeUndefined();
      });
    });
  });
});
