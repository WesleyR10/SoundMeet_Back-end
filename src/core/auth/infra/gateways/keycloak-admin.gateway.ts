import axios, { AxiosInstance, isAxiosError } from "axios";

import {
  IdentityClaimAttribute,
  IIdentityClaimsWriter,
} from "../../../shared/application/identity-claims.interface";
import {
  CreateIdentityUserInput,
  CreateIdentityUserResult,
  IdentityAuthenticationResult,
  IdentityProviderConflictError,
  IdentityProviderInvalidCredentialsError,
  IdentityProviderSessionExpiredError,
  IdentityProviderUnavailableError,
  IdentityRealmRole,
  IdentityUser,
  IIdentityEmailGateway,
  IIdentityProviderGateway,
  IIdentitySessionGateway,
} from "./identity-provider-gateway.interface";

const PASSWORD_RESET_LINK_LIFESPAN_SECONDS = 30 * 60;

export type KeycloakAdminGatewayConfig = {
  baseUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  /**
   * Client CONFIDENCIAL do Direct Access Grant (AUTH-1).
   *
   * Antes o grant de senha usava `mobileClientId` — um client PÚBLICO cujo id
   * viaja dentro do APK. Isso deixava qualquer script bater direto no `/token`
   * do Keycloak com e-mail e senha, **pulando o `@Throttle` do Nest**: o limite
   * de 10/min do `POST /auth/login` protegia só quem tinha a gentileza de
   * passar pela nossa API.
   *
   * Com um secret que só o backend conhece, o grant deixa de ser alcançável de
   * fora e o rate limit volta a ser inescapável.
   *
   * AUTH-3: o nome ficou do cadastro, mas o client hoje serve também o login
   * por senha, o refresh e a revogação dessas sessões. Renomear no Keycloak
   * criaria outro client e invalidaria as sessões já abertas.
   */
  registrationClientId: string;
  registrationClientSecret: string;
  timeoutMs?: number;
};

type AdminTokenCache = {
  accessToken: string;
  expiresAt: number;
};

export class KeycloakAdminGateway
  implements
    IIdentityProviderGateway,
    IIdentitySessionGateway,
    IIdentityClaimsWriter,
    IIdentityEmailGateway
{
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
      const roleRepresentation = await this.getRoleRepresentation(role, token);

      await this.adminHttp.post(
        `/users/${userId}/role-mappings/realm`,
        [roleRepresentation],
        { headers: this.authHeader(token) },
      );
    } catch (error) {
      throw this.toUnavailableError(error);
    }
  }

  async removeRealmRole(
    userId: string,
    role: IdentityRealmRole,
  ): Promise<void> {
    try {
      const token = await this.getAdminToken();
      const roleRepresentation = await this.getRoleRepresentation(role, token);

      await this.adminHttp.delete(`/users/${userId}/role-mappings/realm`, {
        headers: this.authHeader(token),
        data: [roleRepresentation],
      });
    } catch (error) {
      throw this.toUnavailableError(error);
    }
  }

  private async getRoleRepresentation(
    role: IdentityRealmRole,
    token: string,
  ): Promise<unknown> {
    const response = await this.adminHttp.get(
      `/roles/${encodeURIComponent(role)}`,
      { headers: this.authHeader(token) },
    );
    return response.data;
  }

  /**
   * Acrescenta um valor a um atributo multivalorado do usuário (read-modify-
   * write, porque o Keycloak não tem operação de append).
   *
   * O mapper do realm (`establishment_ids`/`band_ids`) lê esse atributo e o
   * projeta como claim no access token. Sem esta escrita, criar um
   * estabelecimento deixava o dono trancado para fora dele: o id existe no
   * Postgres, mas o JWT nunca o menciona e todo ownership guard nega.
   *
   * Idempotente — reexecutar não duplica o valor.
   */
  async addClaimValue(
    userId: string,
    attribute: IdentityClaimAttribute,
    value: string,
  ): Promise<void> {
    try {
      const token = await this.getAdminToken();
      const { data: user } = await this.adminHttp.get(`/users/${userId}`, {
        headers: this.authHeader(token),
      });

      const attributes: Record<string, string[]> = user.attributes ?? {};
      const current = this.normalizeAttributeValues(attributes[attribute]);
      if (current.includes(value)) {
        return;
      }

      await this.adminHttp.put(
        `/users/${userId}`,
        { attributes: { ...attributes, [attribute]: [...current, value] } },
        { headers: this.authHeader(token) },
      );
    } catch (error) {
      throw this.toUnavailableError(error);
    }
  }

  /**
   * Tira um valor de um atributo multivalorado — o inverso de `addClaimValue`,
   * com o mesmo read-modify-write e o mesmo cuidado de mandar o mapa de
   * atributos INTEIRO no PUT.
   *
   * Idempotente: valor ausente, ou usuário que não existe mais, não é erro.
   */
  async removeClaimValue(
    userId: string,
    attribute: IdentityClaimAttribute,
    value: string,
  ): Promise<void> {
    try {
      const token = await this.getAdminToken();
      const response = await this.adminHttp.get(`/users/${userId}`, {
        headers: this.authHeader(token),
        validateStatus: (status) => status === 200 || status === 404,
      });
      if (response.status === 404) {
        return;
      }

      const attributes: Record<string, string[]> =
        response.data.attributes ?? {};
      const current = this.normalizeAttributeValues(attributes[attribute]);
      if (!current.includes(value)) {
        return;
      }

      await this.adminHttp.put(
        `/users/${userId}`,
        {
          attributes: {
            ...attributes,
            [attribute]: current.filter((item) => item !== value),
          },
        },
        { headers: this.authHeader(token) },
      );
    } catch (error) {
      throw this.toUnavailableError(error);
    }
  }

  // O Keycloak devolve atributos como string[], mas um valor único gravado à
  // mão pela console vem como string crua — normalizamos os dois formatos.
  private normalizeAttributeValues(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return raw.filter((v): v is string => typeof v === "string");
    }
    return typeof raw === "string" && raw.length > 0 ? [raw] : [];
  }

  async getUser(userId: string): Promise<IdentityUser> {
    try {
      const token = await this.getAdminToken();
      const { data } = await this.adminHttp.get(`/users/${userId}`, {
        headers: this.authHeader(token),
      });

      return {
        email: data.email,
        name: data.firstName ?? data.username ?? data.email,
      };
    } catch (error) {
      throw this.toUnavailableError(error);
    }
  }

  /**
   * 🔴 PUT com a representação INTEIRA, não parcial: a partir do Keycloak 24
   * (produção roda 26) um PUT sem `attributes` pode descartar os atributos não
   * declarados no perfil de usuário — e `establishment_ids`/`band_ids` são
   * exatamente o que autoriza o dono. Mesmo cuidado de `addClaimValue`.
   */
  async updateUserEmail(userId: string, email: string): Promise<boolean> {
    const token = await this.getAdminToken();
    const current = await this.adminHttp.get(`/users/${userId}`, {
      headers: this.authHeader(token),
      validateStatus: () => true,
    });
    if (current.status === 404) return false;
    if (current.status !== 200) {
      throw new IdentityProviderUnavailableError(
        `Keycloak getUser failed with status ${current.status}`,
        current.data,
      );
    }

    const response = await this.adminHttp.put(
      `/users/${userId}`,
      { ...current.data, email, username: email, emailVerified: true },
      { headers: this.authHeader(token), validateStatus: () => true },
    );
    if (response.status === 409) {
      throw new IdentityProviderConflictError();
    }
    if (response.status !== 204 && response.status !== 200) {
      throw new IdentityProviderUnavailableError(
        `Keycloak updateUserEmail failed with status ${response.status}`,
        response.data,
      );
    }
    return true;
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
      // `offline_access` pelo mesmo motivo do PKCE do app: sem ele a sessão
      // morre com `ssoSessionIdleTimeout` (30 min parado), e o músico que
      // deixou o celular no tripé durante o show voltaria para o login.
      return await this.requestTokens({
        grant_type: "password",
        username: email,
        password,
        scope: "openid offline_access",
      });
    } catch (error) {
      // O discriminador real é o código `invalid_grant`, não o status: o
      // Keycloak deste realm responde 401 (não 400) para senha errada no
      // direct grant, e a checagem antiga só cobria 400 — toda credencial
      // inválida caía em toUnavailableError e virava 503 "Não foi possível
      // autenticar no provedor de identidade" em vez de 401 "Credenciais
      // inválidas". Aceitar os dois status mantém o caminho de
      // indisponibilidade real (sem `response`) intacto.
      //
      // 🔴 Conta bloqueada pelo brute force, desabilitada ou com ação pendente
      // também chegam como `invalid_grant` — e caem no MESMO erro de propósito.
      // Distinguir "senha errada" de "conta bloqueada" diria ao atacante que o
      // e-mail existe e que ele acertou o alvo.
      if (this.isInvalidGrant(error)) {
        throw new IdentityProviderInvalidCredentialsError();
      }
      throw this.toUnavailableError(error);
    }
  }

  /**
   * Renova pelo client confidencial. O Keycloak recusa (`invalid_grant`,
   * "Unmatching clients") refresh token apresentado por client diferente do
   * que o emitiu — por isso o app não consegue renovar sozinho uma sessão que
   * nasceu aqui, nem a do cadastro.
   */
  async refreshSession(
    refreshToken: string,
  ): Promise<IdentityAuthenticationResult> {
    try {
      return await this.requestTokens({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });
    } catch (error) {
      if (this.isInvalidGrant(error)) {
        throw new IdentityProviderSessionExpiredError();
      }
      throw this.toUnavailableError(error);
    }
  }

  /**
   * `/revoke` e não `/logout`: é o endpoint que derruba também a sessão
   * OFFLINE — e é offline a sessão que o login por senha abre. Token já
   * inválido responde 200 (RFC 7009 §2.2), então não há o que distinguir.
   */
  async revokeSession(refreshToken: string): Promise<void> {
    try {
      await this.tokenHttp.post(
        "/revoke",
        new URLSearchParams({
          client_id: this.config.registrationClientId,
          client_secret: this.config.registrationClientSecret,
          token: refreshToken,
          token_type_hint: "refresh_token",
        }),
        { headers: { "content-type": "application/x-www-form-urlencoded" } },
      );
    } catch (error) {
      throw this.toUnavailableError(error);
    }
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      const token = await this.getAdminToken();
      const { data: users } = await this.adminHttp.get("/users", {
        params: { email, exact: true, max: 1 },
        headers: this.authHeader(token),
      });

      const user = Array.isArray(users) ? users[0] : undefined;
      if (!user?.id || user.enabled === false) {
        return;
      }

      // O link leva à página do Keycloak (tema SoundMeet) para escolher a senha
      // nova. 30 min: é um link que dá acesso à conta, não pode viver o dia todo.
      await this.adminHttp.put(
        `/users/${user.id}/execute-actions-email`,
        ["UPDATE_PASSWORD"],
        {
          params: { lifespan: PASSWORD_RESET_LINK_LIFESPAN_SECONDS },
          headers: this.authHeader(token),
        },
      );
    } catch (error) {
      throw this.toUnavailableError(error);
    }
  }

  /**
   * Toda conversa com o `/token` em nome do usuário passa pelo client
   * confidencial — o secret nunca sai deste processo.
   */
  private async requestTokens(
    grant: Record<string, string>,
  ): Promise<IdentityAuthenticationResult> {
    const body = new URLSearchParams({
      ...grant,
      client_id: this.config.registrationClientId,
      client_secret: this.config.registrationClientSecret,
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
  }

  private isInvalidGrant(error: unknown): boolean {
    return (
      isAxiosError(error) &&
      (error.response?.status === 400 || error.response?.status === 401) &&
      (error.response?.data as any)?.error === "invalid_grant"
    );
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
