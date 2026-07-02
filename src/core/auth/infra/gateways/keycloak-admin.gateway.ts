import axios, { AxiosInstance, isAxiosError } from "axios";

import {
  CreateIdentityUserInput,
  CreateIdentityUserResult,
  IdentityAuthenticationResult,
  IdentityProviderConflictError,
  IdentityProviderUnavailableError,
  IdentityRealmRole,
  IIdentityProviderGateway,
} from "./identity-provider-gateway.interface";

export type KeycloakAdminGatewayConfig = {
  baseUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  mobileClientId: string;
  timeoutMs?: number;
};

type AdminTokenCache = {
  accessToken: string;
  expiresAt: number;
};

export class KeycloakAdminGateway implements IIdentityProviderGateway {
  private readonly adminHttp: AxiosInstance;
  private readonly tokenHttp: AxiosInstance;
  private adminTokenCache: AdminTokenCache | null = null;

  constructor(private readonly config: KeycloakAdminGatewayConfig) {
    this.adminHttp = axios.create({
      baseURL: `${config.baseUrl}/admin/realms/${config.realm}`,
      timeout: config.timeoutMs ?? 5000,
    });
    this.tokenHttp = axios.create({
      baseURL: `${config.baseUrl}/realms/${config.realm}/protocol/openid-connect`,
      timeout: config.timeoutMs ?? 5000,
    });
  }

  async createUser(
    input: CreateIdentityUserInput,
  ): Promise<CreateIdentityUserResult> {
    const token = await this.getAdminToken();

    const response = await this.adminHttp.post(
      "/users",
      {
        username: input.email,
        email: input.email,
        firstName: input.name,
        enabled: true,
        emailVerified: true,
        requiredActions: [],
        credentials: [
          { type: "password", value: input.password, temporary: false },
        ],
      },
      {
        headers: this.authHeader(token),
        validateStatus: () => true,
      },
    );

    if (response.status === 409) {
      throw new IdentityProviderConflictError();
    }
    if (response.status !== 201) {
      throw new IdentityProviderUnavailableError(
        `Keycloak createUser failed with status ${response.status}`,
        response.data,
      );
    }

    const location = response.headers["location"] as string | undefined;
    const externalId = location?.split("/").pop();
    if (!externalId) {
      throw new IdentityProviderUnavailableError(
        "Keycloak createUser did not return a Location header",
      );
    }

    return { external_id: externalId };
  }

  async assignRealmRole(
    userId: string,
    role: IdentityRealmRole,
  ): Promise<void> {
    try {
      const token = await this.getAdminToken();
      const roleResponse = await this.adminHttp.get(
        `/roles/${encodeURIComponent(role)}`,
        { headers: this.authHeader(token) },
      );

      await this.adminHttp.post(
        `/users/${userId}/role-mappings/realm`,
        [roleResponse.data],
        { headers: this.authHeader(token) },
      );
    } catch (error) {
      throw this.toUnavailableError(error);
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      const token = await this.getAdminToken();
      await this.adminHttp.delete(`/users/${userId}`, {
        headers: this.authHeader(token),
      });
    } catch (error) {
      throw this.toUnavailableError(error);
    }
  }

  async authenticateWithPassword(
    email: string,
    password: string,
  ): Promise<IdentityAuthenticationResult> {
    try {
      const body = new URLSearchParams({
        grant_type: "password",
        client_id: this.config.mobileClientId,
        username: email,
        password,
      });

      const { data } = await this.tokenHttp.post("/token", body, {
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });

      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        token_type: data.token_type,
      };
    } catch (error) {
      throw this.toUnavailableError(error);
    }
  }

  private async getAdminToken(): Promise<string> {
    const now = Date.now();
    if (this.adminTokenCache && this.adminTokenCache.expiresAt > now) {
      return this.adminTokenCache.accessToken;
    }

    try {
      const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      });

      const { data } = await this.tokenHttp.post("/token", body, {
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });

      // Renova 30s antes de expirar para evitar corrida com chamadas em voo.
      this.adminTokenCache = {
        accessToken: data.access_token,
        expiresAt: now + Math.max((data.expires_in ?? 60) - 30, 5) * 1000,
      };

      return this.adminTokenCache.accessToken;
    } catch (error) {
      throw this.toUnavailableError(error);
    }
  }

  private authHeader(token: string): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
  }

  private toUnavailableError(error: unknown): IdentityProviderUnavailableError {
    if (isAxiosError(error)) {
      return new IdentityProviderUnavailableError(
        `Keycloak request failed: ${error.response?.status ?? error.code ?? "network error"}`,
        error,
      );
    }
    return new IdentityProviderUnavailableError(undefined, error);
  }
}
