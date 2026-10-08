import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IIdentitySessionGateway } from "../../../infra/gateways/identity-provider-gateway.interface";
import { LogoutInput } from "./logout.input";

/**
 * Revoga no provedor a sessão aberta pelo login por senha.
 *
 * Nunca lança. O app já apagou a sessão local ANTES de chamar (ver
 * `clear-session.ts` no mobile): falha de rede ou do provedor não pode impedir
 * ninguém de sair, e responder erro aqui só produziria um aviso que a pessoa
 * não tem o que fazer com ele.
 */
export class LogoutUseCase implements IUseCase<LogoutInput, void> {
  constructor(private readonly sessionGateway: IIdentitySessionGateway) {}

  async execute(input: LogoutInput): Promise<void> {
    try {
      await this.sessionGateway.revokeSession(input.refresh_token);
    } catch (error) {
      console.error(
        "LogoutUseCase: revogação no provedor falhou",
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
