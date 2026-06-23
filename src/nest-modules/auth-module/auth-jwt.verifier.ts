import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createPublicKey } from "crypto";

import { ConfigSchemaType } from "../config-module/config.schema";

type JwtHeader = {
  alg?: string;
  kid?: string;
};

type JwksKey = {
  kid: string;
  kty: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
};

type JwksResponse = {
  keys: JwksKey[];
};

type CachedKey = {
  pem: string;
  expiresAt: number;
};

@Injectable()
export class AuthJwtVerifier {
  private readonly keyCache = new Map<string, CachedKey>();

  constructor(
    private readonly jwtService: JwtService,
    @Inject(ConfigService)
    private readonly configService: ConfigSchemaType,
  ) {}

  async verify(token: string): Promise<Record<string, any>> {
    if (this.shouldUseKeycloak()) {
      return this.verifyKeycloakToken(token);
    }

    return this.jwtService.verifyAsync<Record<string, any>>(token, {
      secret: this.configService.get<string>("JWT_SECRET"),
    });
  }

  private shouldUseKeycloak(): boolean {
    const mode = this.configService.get<string>("AUTH_JWT_VALIDATION_MODE");
    if (mode) {
      return mode === "keycloak";
    }
    return this.configService.get<string>("NODE_ENV") === "production";
  }

  private async verifyKeycloakToken(
    token: string,
  ): Promise<Record<string, any>> {
    const header = this.decodeHeader(token);
    if (header.alg !== "RS256" || !header.kid) {
      throw new UnauthorizedException("Invalid JWT header");
    }

    const publicKey = await this.getPublicKey(header.kid);
    const issuer = this.getKeycloakIssuer();
    const payload = await this.jwtService.verifyAsync<Record<string, any>>(
      token,
      {
        secret: publicKey,
        algorithms: ["RS256"],
        issuer,
      },
    );

    this.assertKeycloakClient(payload);
    return payload;
  }

  private decodeHeader(token: string): JwtHeader {
    const [encodedHeader] = token.split(".");
    if (!encodedHeader) {
      throw new UnauthorizedException("Invalid JWT");
    }

    try {
      return JSON.parse(
        Buffer.from(encodedHeader, "base64url").toString("utf8"),
      ) as JwtHeader;
    } catch {
      throw new UnauthorizedException("Invalid JWT header");
    }
  }

  private async getPublicKey(kid: string): Promise<string> {
    const now = Date.now();
    const cached = this.keyCache.get(kid);
    if (cached && cached.expiresAt > now) {
      return cached.pem;
    }

    const jwks = await this.fetchJwks();
    const key = jwks.keys.find((item) => item.kid === kid);
    if (!key) {
      this.keyCache.delete(kid);
      throw new UnauthorizedException("Unknown JWT key");
    }

    const pem = createPublicKey({
      key,
      format: "jwk",
    }).export({
      format: "pem",
      type: "spki",
    }) as string;

    const ttlMs =
      this.configService.get<number>("KEYCLOAK_JWKS_CACHE_TTL_SECONDS") ?? 300;
    this.keyCache.set(kid, {
      pem,
      expiresAt: now + ttlMs * 1000,
    });
    return pem;
  }

  private async fetchJwks(): Promise<JwksResponse> {
    const response = await fetch(this.getJwksUri());
    if (!response.ok) {
      throw new UnauthorizedException("Unable to fetch JWKS");
    }

    const jwks = (await response.json()) as JwksResponse;
    if (!Array.isArray(jwks.keys)) {
      throw new UnauthorizedException("Invalid JWKS response");
    }
    return jwks;
  }

  private getJwksUri(): string {
    const configured = this.configService.get<string>("KEYCLOAK_JWKS_URI");
    if (configured) {
      return configured;
    }
    return `${this.getKeycloakIssuer()}/protocol/openid-connect/certs`;
  }

  private getKeycloakIssuer(): string {
    const baseUrl = this.configService
      .get<string>("KEYCLOAK_URL")!
      .replace(/\/$/, "");
    const realm = this.configService.get<string>("KEYCLOAK_REALM");
    return `${baseUrl}/realms/${realm}`;
  }

  private assertKeycloakClient(payload: Record<string, any>) {
    const shouldVerifyAudience =
      this.configService.get<boolean>("KEYCLOAK_VERIFY_AUDIENCE") ?? false;
    if (!shouldVerifyAudience) {
      return;
    }

    const clientId = this.configService.get<string>("KEYCLOAK_CLIENT_ID");
    const audience = payload.aud;
    const audiences = Array.isArray(audience) ? audience : [audience];
    if (audiences.includes(clientId) || payload.azp === clientId) {
      return;
    }

    throw new UnauthorizedException("Invalid JWT audience");
  }
}
