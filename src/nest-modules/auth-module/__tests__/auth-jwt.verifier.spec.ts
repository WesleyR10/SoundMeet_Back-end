import { Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { generateKeyPairSync } from "crypto";

import { AuthJwtVerifier } from "../auth-jwt.verifier";

function createConfig(values: Record<string, unknown>) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as any;
}

function createTokenWithHeader(header: Record<string, unknown>) {
  return [
    Buffer.from(JSON.stringify(header)).toString("base64url"),
    Buffer.from(JSON.stringify({ sub: "user-id" })).toString("base64url"),
    "signature",
  ].join(".");
}

describe("AuthJwtVerifier", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("verifies local JWTs with JWT_SECRET outside keycloak mode", async () => {
    const verifyAsync = jest.fn().mockResolvedValue({ sub: "user-id" });
    const verifier = new AuthJwtVerifier(
      { verifyAsync } as unknown as JwtService,
      createConfig({
        AUTH_JWT_VALIDATION_MODE: "local",
        JWT_SECRET: "local-secret",
      }),
    );

    await expect(verifier.verify("token")).resolves.toEqual({ sub: "user-id" });
    expect(verifyAsync).toHaveBeenCalledWith("token", {
      secret: "local-secret",
    });
  });

  function mockJwks() {
    const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwk = publicKey.export({ format: "jwk" }) as Record<string, unknown>;
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        keys: [{ ...jwk, kid: "key-1", alg: "RS256", use: "sig" }],
      }),
    } as Response);
  }

  function keycloakVerifier(
    payload: Record<string, unknown>,
    config: Record<string, unknown> = {},
  ) {
    mockJwks();
    const verifyAsync = jest.fn().mockResolvedValue(payload);
    const verifier = new AuthJwtVerifier(
      { verifyAsync } as unknown as JwtService,
      createConfig({
        AUTH_JWT_VALIDATION_MODE: "keycloak",
        KEYCLOAK_URL: "https://keycloak.local",
        KEYCLOAK_REALM: "soundmeet",
        KEYCLOAK_CLIENT_ID: "soundmeet-backend",
        KEYCLOAK_AUDIENCE: "soundmeet-api",
        KEYCLOAK_VERIFY_AUDIENCE: true,
        KEYCLOAK_JWKS_CACHE_TTL_SECONDS: 300,
        ...config,
      }),
    );
    return {
      verifyAsync,
      run: () =>
        verifier.verify(createTokenWithHeader({ alg: "RS256", kid: "key-1" })),
    };
  }

  it("verifies keycloak JWTs through JWKS, issuer and audience", async () => {
    const { verifyAsync, run } = keycloakVerifier({
      sub: "user-id",
      aud: ["account", "soundmeet-api"],
      azp: "soundmeet-mobile",
    });

    await expect(run()).resolves.toMatchObject({ sub: "user-id" });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://keycloak.local/realms/soundmeet/protocol/openid-connect/certs",
    );
    expect(verifyAsync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        algorithms: ["RS256"],
        issuer: "https://keycloak.local/realms/soundmeet",
      }),
    );
  });

  it("aceita aud como string simples", async () => {
    const { run } = keycloakVerifier({ sub: "user-id", aud: "soundmeet-api" });
    await expect(run()).resolves.toMatchObject({ sub: "user-id" });
  });

  it("rejeita token de outro client do mesmo realm (token confusion)", async () => {
    // Antes o `azp` sozinho dispensava o `aud` — este era o furo.
    const { run } = keycloakVerifier({
      sub: "user-id",
      aud: ["account"],
      azp: "soundmeet-integracao-terceira",
    });
    await expect(run()).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejeita token sem aud", async () => {
    const { run } = keycloakVerifier({ sub: "user-id", azp: "soundmeet-api" });
    await expect(run()).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("usa KEYCLOAK_CLIENT_ID quando KEYCLOAK_AUDIENCE não está setado", async () => {
    const { run } = keycloakVerifier(
      { sub: "user-id", aud: "soundmeet-backend" },
      { KEYCLOAK_AUDIENCE: undefined },
    );
    await expect(run()).resolves.toMatchObject({ sub: "user-id" });
  });

  it("recusa azp fora da allowlist quando ela está configurada", async () => {
    const base = {
      sub: "user-id",
      aud: ["soundmeet-api"],
    };

    await expect(
      keycloakVerifier(
        { ...base, azp: "soundmeet-mobile" },
        { KEYCLOAK_ALLOWED_AZP: "soundmeet-mobile, soundmeet-web" },
      ).run(),
    ).resolves.toMatchObject({ sub: "user-id" });

    await expect(
      keycloakVerifier(
        { ...base, azp: "soundmeet-admin" },
        { KEYCLOAK_ALLOWED_AZP: "soundmeet-mobile, soundmeet-web" },
      ).run(),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(
      keycloakVerifier(base, {
        KEYCLOAK_ALLOWED_AZP: "soundmeet-mobile",
      }).run(),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("deixa passar com verificação desligada, mas emite telemetria", async () => {
    const warn = jest
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);

    const { run } = keycloakVerifier(
      { sub: "user-id", aud: ["account"], azp: "soundmeet-web" },
      { KEYCLOAK_VERIFY_AUDIENCE: false },
    );

    await expect(run()).resolves.toMatchObject({ sub: "user-id" });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('"would_reject_if_enabled":true'),
    );
  });

  it("liga a verificação por padrão em produção", async () => {
    const { run } = keycloakVerifier(
      { sub: "user-id", aud: ["account"] },
      { KEYCLOAK_VERIFY_AUDIENCE: undefined, NODE_ENV: "production" },
    );
    await expect(run()).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects keycloak JWTs with unsupported algorithms", async () => {
    const verifier = new AuthJwtVerifier(
      { verifyAsync: jest.fn() } as unknown as JwtService,
      createConfig({
        AUTH_JWT_VALIDATION_MODE: "keycloak",
      }),
    );

    await expect(
      verifier.verify(createTokenWithHeader({ alg: "HS256", kid: "key-1" })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
