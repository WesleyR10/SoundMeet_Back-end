import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
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
  private readonly logger = new Logger(AuthJwtVerifier.name);
  private readonly observedAudiences = new Set<string>();

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

  /**
   * Exige que o token tenha sido emitido PARA esta API, e não apenas pelo mesmo
   * realm. Sem isso, qualquer client do realm (inclusive um de integração com
   * escopo diferente) produzia token aceito aqui — token confusion.
   *
   * A checagem virou E lógico: `aud` precisa conter exatamente o audience desta
   * API, e — quando há allowlist configurada — o `azp` precisa ser um client
   * autorizado. Antes era OU, então bastava o `azp` bater para dispensar o `aud`.
   */
  private assertKeycloakClient(payload: Record<string, any>) {
    const expectedAudience = this.getExpectedAudience();
    const audiences = this.normalizeAudiences(payload.aud);
    const azp = typeof payload.azp === "string" ? payload.azp : null;

    if (!this.shouldVerifyAudience()) {
      this.logAudienceTelemetry(expectedAudience, audiences, azp);
      return;
    }

    if (!audiences.includes(expectedAudience)) {
      throw new UnauthorizedException("Invalid JWT audience");
    }

    const allowedAzp = this.getAllowedAzp();
    if (allowedAzp.length > 0 && (!azp || !allowedAzp.includes(azp))) {
      throw new UnauthorizedException("Invalid JWT authorized party");
    }
  }

  private shouldVerifyAudience(): boolean {
    const configured = this.configService.get<boolean>(
      "KEYCLOAK_VERIFY_AUDIENCE",
    );
    if (typeof configured === "boolean") {
      return configured;
    }
    return this.configService.get<string>("NODE_ENV") === "production";
  }

  /**
   * `KEYCLOAK_AUDIENCE` existe separado de `KEYCLOAK_CLIENT_ID` porque os dois
   * não são o mesmo conceito: o client id é a credencial confidencial que o
   * backend usa na Admin API, enquanto o audience é o valor que o
   * `oidc-audience-mapper` injeta nos tokens dos clients públicos. Hoje eles
   * divergem (`soundmeet-backend` vs `soundmeet-api`) — ligar a verificação sem
   * essa separação rejeitaria todo token válido.
   */
  private getExpectedAudience(): string {
    return (
      this.configService.get<string>("KEYCLOAK_AUDIENCE") ??
      this.configService.get<string>("KEYCLOAK_CLIENT_ID")!
    );
  }

  private getAllowedAzp(): string[] {
    return (this.configService.get<string>("KEYCLOAK_ALLOWED_AZP") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private normalizeAudiences(audience: unknown): string[] {
    if (Array.isArray(audience)) {
      return audience.filter(
        (value): value is string => typeof value === "string",
      );
    }
    return typeof audience === "string" ? [audience] : [];
  }

  /**
   * Etapa 1 da migração: com a verificação desligada, registra o que os tokens
   * reais trazem para dimensionar o impacto antes de tornar obrigatório. Loga
   * uma vez por combinação para não inundar o log a cada request.
   */
  private logAudienceTelemetry(
    expectedAudience: string,
    audiences: string[],
    azp: string | null,
  ): void {
    const signature = `${audiences.join("|")}#${azp ?? ""}`;
    if (this.observedAudiences.has(signature)) {
      return;
    }
    this.observedAudiences.add(signature);

    const wouldReject = !audiences.includes(expectedAudience);
    this.logger.warn(
      JSON.stringify({
        event: "auth.audience_check_disabled",
        expected_audience: expectedAudience,
        token_aud: audiences,
        token_azp: azp,
        would_reject_if_enabled: wouldReject,
      }),
    );
  }
}
