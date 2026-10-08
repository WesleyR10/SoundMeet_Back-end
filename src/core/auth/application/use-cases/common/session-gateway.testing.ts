import { IIdentitySessionGateway } from "../../../infra/gateways/identity-provider-gateway.interface";

export const FAKE_SESSION_TOKENS = {
  access_token: "access",
  refresh_token: "refresh",
  expires_in: 900,
  token_type: "Bearer",
};

export function makeSessionGateway(): jest.Mocked<IIdentitySessionGateway> {
  return {
    authenticateWithPassword: jest.fn(),
    refreshSession: jest.fn(),
    revokeSession: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  };
}
