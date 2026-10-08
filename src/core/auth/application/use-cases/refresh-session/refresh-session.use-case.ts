import { IUseCase } from "../../../../shared/application/use-case.interface";
import { ExternalServiceError } from "../../../../shared/domain/errors/external-service.error";
import { UnauthorizedError } from "../../../../shared/domain/errors/unauthorized.error";
import {
  IdentityProviderSessionExpiredError,
  IIdentitySessionGateway,
} from "../../../infra/gateways/identity-provider-gateway.interface";
import {
  SessionTokensOutput,
  toSessionTokensOutput,
} from "../common/session-tokens.output";
import { RefreshSessionInput } from "./refresh-session.input";

/**
 * Renova a sessão que nasceu no client confidencial (login por senha e
 * cadastro).
 *
 * 🔴 Existe porque o Keycloak só aceita o refresh token do MESMO client que o
 * emitiu. Até aqui o app renovava tudo com o client público `soundmeet-mobile`,
 * e a sessão do CADASTRO — emitida pelo confidencial desde o AUTH-1 — era
 * recusada na primeira renovação: quem acabava de criar conta era deslogado
 * uns 15 minutos depois (`accessTokenLifespan`), sem erro visível.
 *
 * 401 aqui é o sinal para o app encerrar a sessão local. 503 não é: o
 * provedor pode só estar fora, e derrubar a sessão por isso deslogaria todo
 * mundo durante uma queda.
 */
export class RefreshSessionUseCase implements IUseCase<
  RefreshSessionInput,
  SessionTokensOutput
> {
  constructor(private readonly sessionGateway: IIdentitySessionGateway) {}

  async execute(input: RefreshSessionInput): Promise<SessionTokensOutput> {
    try {
      const tokens = await this.sessionGateway.refreshSession(
        input.refresh_token,
      );
      return toSessionTokensOutput(tokens);
    } catch (error) {
      if (error instanceof IdentityProviderSessionExpiredError) {
        throw new UnauthorizedError("Sessão expirada. Entre novamente.");
      }
      throw new ExternalServiceError(
        "Não foi possível renovar a sessão agora.",
        { cause: error },
      );
    }
  }
}
