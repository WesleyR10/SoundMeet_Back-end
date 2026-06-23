import { UnauthorizedException } from "@nestjs/common";
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

  it("verifies keycloak JWTs through JWKS, issuer and optional audience", async () => {
    const { publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const jwk = publicKey.export({ format: "jwk" }) as Record<string, unknown>;
    const verifyAsync = jest.fn().mockResolvedValue({
      sub: "user-id",
      azp: "soundmeet-api",
    });
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        keys: [
          {
            ...jwk,
            kid: "key-1",
            alg: "RS256",
            use: "sig",
          },
        ],
      }),
    } as Response);

    const verifier = new AuthJwtVerifier(
      { verifyAsync } as unknown as JwtService,
      createConfig({
        AUTH_JWT_VALIDATION_MODE: "keycloak",
        KEYCLOAK_URL: "https://keycloak.local",
        KEYCLOAK_REALM: "soundmeet",
        KEYCLOAK_CLIENT_ID: "soundmeet-api",
        KEYCLOAK_VERIFY_AUDIENCE: true,
        KEYCLOAK_JWKS_CACHE_TTL_SECONDS: 300,
      }),
    );

    const payload = await verifier.verify(
      createTokenWithHeader({ alg: "RS256", kid: "key-1" }),
    );

    expect(payload).toEqual({ sub: "user-id", azp: "soundmeet-api" });
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
