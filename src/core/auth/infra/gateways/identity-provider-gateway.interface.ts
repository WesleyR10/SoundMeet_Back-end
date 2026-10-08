export type CreateIdentityUserInput = {
  email: string;
  name: string;
  password: string;
};

export type CreateIdentityUserResult = {
  external_id: string;
};

export type IdentityAuthenticationResult = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

/**
 * `establishment` entrou aqui no Bloco 9.1 (registro de estabelecimento).
 * `assignRealmRole`/`removeRealmRole` já eram genéricos — resolvem a role por
 * nome em `GET /roles/{name}` —, então nenhuma implementação precisou mudar:
 * a role `establishment` já existia no `realm-soundmeet.json`.
 */
export type IdentityRealmRole = "musician" | "audience" | "establishment";

export type IdentityUser = {
  email: string;
  name: string;
};

export interface IIdentityProviderGateway {
  createUser(input: CreateIdentityUserInput): Promise<CreateIdentityUserResult>;
  assignRealmRole(userId: string, role: IdentityRealmRole): Promise<void>;
  removeRealmRole(userId: string, role: IdentityRealmRole): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  authenticateWithPassword(
    email: string,
    password: string,
  ): Promise<IdentityAuthenticationResult>;
  getUser(userId: string): Promise<IdentityUser>;
}

/**
 * Ciclo de vida da SESSÃO do login por senha (AUTH-3, 25/set/2026).
 *
 * Porta separada de `IIdentityProviderGateway` de propósito: quem cadastra não
 * precisa renovar nem revogar sessão, e quem entra não precisa criar usuário.
 * Os tokens nascem no client CONFIDENCIAL (secret só no backend), e um refresh
 * token do Keycloak só é aceito pelo MESMO client que o emitiu — então renovar
 * e revogar também têm de passar por aqui. O app não tem como fazê-lo sozinho.
 */
export interface IIdentitySessionGateway {
  authenticateWithPassword(
    email: string,
    password: string,
  ): Promise<IdentityAuthenticationResult>;
  refreshSession(refreshToken: string): Promise<IdentityAuthenticationResult>;
  revokeSession(refreshToken: string): Promise<void>;
  /**
   * Dispara o e-mail de redefinição de senha. Conta inexistente NÃO é erro:
   * resolve em silêncio, para a rota não virar oráculo de cadastros.
   */
  sendPasswordResetEmail(email: string): Promise<void>;
}

/**
 * Troca do e-mail de LOGIN, chamada só depois que o usuário provou ser dono do
 * endereço novo (clique no link). Porta própria: quem confirma e-mail não
 * precisa criar usuário nem mexer em sessão.
 */
export interface IIdentityEmailGateway {
  /**
   * Troca e-mail e username (o realm usa e-mail como username) e marca o
   * e-mail como verificado. `false` quando o usuário não existe.
   * @throws IdentityProviderConflictError se outra conta já usa o e-mail.
   */
  updateUserEmail(userId: string, email: string): Promise<boolean>;
}

/** Refresh token vencido, revogado ou emitido por outro client. */
export class IdentityProviderSessionExpiredError extends Error {
  constructor(message = "Sessão expirada") {
    super(message);
    this.name = "IdentityProviderSessionExpiredError";
  }
}

export class IdentityProviderConflictError extends Error {
  constructor(message = "Email já cadastrado no provedor de identidade") {
    super(message);
    this.name = "IdentityProviderConflictError";
  }
}

export class IdentityProviderInvalidCredentialsError extends Error {
  constructor(message = "Credenciais inválidas") {
    super(message);
    this.name = "IdentityProviderInvalidCredentialsError";
  }
}

export class IdentityProviderUnavailableError extends Error {
  constructor(
    message = "Provedor de identidade indisponível",
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "IdentityProviderUnavailableError";
  }
}
