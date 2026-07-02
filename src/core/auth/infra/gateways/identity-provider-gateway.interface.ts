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

export interface IIdentityProviderGateway {
  createUser(input: CreateIdentityUserInput): Promise<CreateIdentityUserResult>;
  assignRealmRole(userId: string, role: IdentityRealmRole): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  authenticateWithPassword(
    email: string,
    password: string,
  ): Promise<IdentityAuthenticationResult>;
}

export class IdentityProviderConflictError extends Error {
  constructor(message = "Email já cadastrado no provedor de identidade") {
    super(message);
    this.name = "IdentityProviderConflictError";
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
