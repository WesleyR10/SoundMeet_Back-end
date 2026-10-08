import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IIdentitySessionGateway } from "../../../infra/gateways/identity-provider-gateway.interface";
import { RequestPasswordResetInput } from "./request-password-reset.input";

export const PASSWORD_RESET_REQUESTED_MESSAGE =
  "Se houver uma conta com este e-mail, enviamos um link para criar uma senha nova.";

/**
 * "Esqueci a senha" pelo app.
 *
 * Com o login PKCE a tela do Keycloak trazia o link de graça; com a tela
 * nativa ele precisa de rota. O e-mail é o do próprio Keycloak
 * (`execute-actions-email` → UPDATE_PASSWORD): o link abre a página dele, com
 * o tema SoundMeet, e a senha nova nunca passa pela nossa API.
 *
 * 🔴 Resposta IDÊNTICA em todos os casos — conta existe, não existe, e até
 * provedor fora do ar. Separar "falhou ao enviar" (503) de "enviado" só seria
 * possível depois de achar a conta, ou seja, o 503 apareceria só para e-mail
 * cadastrado: um oráculo de enumeração ligado toda vez que o SMTP cair. Mesma
 * postura de `resendVerification`. A falha vai para o log, não para a resposta.
 */
export class RequestPasswordResetUseCase implements IUseCase<
  RequestPasswordResetInput,
  { message: string }
> {
  constructor(private readonly sessionGateway: IIdentitySessionGateway) {}

  async execute(
    input: RequestPasswordResetInput,
  ): Promise<{ message: string }> {
    try {
      await this.sessionGateway.sendPasswordResetEmail(
        input.email.trim().toLowerCase(),
      );
    } catch (error) {
      console.error(
        "RequestPasswordResetUseCase: envio do e-mail de redefinição falhou",
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    return { message: PASSWORD_RESET_REQUESTED_MESSAGE };
  }
}
