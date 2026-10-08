import { IdentityAuthenticationResult } from "../../../infra/gateways/identity-provider-gateway.interface";

/**
 * Sessão devolvida ao app pelo login por senha e pela renovação.
 *
 * Sem `role`/`profile_id` de propósito (o cadastro devolve os dois): a verdade
 * sobre o papel são as roles do JWT, e o app já as lê para decidir o stack —
 * inclusive para recusar conta de estabelecimento, que é persona web-only.
 */
export type SessionTokensOutput = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

export function toSessionTokensOutput(
  tokens: IdentityAuthenticationResult,
): SessionTokensOutput {
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
    token_type: tokens.token_type,
  };
}
