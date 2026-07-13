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

export type IdentityRealmRole = "musician" | "audience";

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
