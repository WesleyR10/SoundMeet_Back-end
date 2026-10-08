import { IUseCase } from "../../../../shared/application/use-case.interface";
import { ExternalServiceError } from "../../../../shared/domain/errors/external-service.error";
import { UnauthorizedError } from "../../../../shared/domain/errors/unauthorized.error";
import {
  IdentityProviderInvalidCredentialsError,
  IIdentitySessionGateway,
} from "../../../infra/gateways/identity-provider-gateway.interface";
import {
  SessionTokensOutput,
  toSessionTokensOutput,
} from "../common/session-tokens.output";
import { LoginInput } from "./login.input";

/** Mensagem ÚNICA para toda recusa — ver o comentário em `execute`. */
export const INVALID_CREDENTIALS_MESSAGE = "E-mail ou senha incorretos";

/**
 * Login por e-mail e senha, dentro do app (AUTH-3, 25/set/2026).
 *
 * 🔴 Reverte parcialmente o AUTH-1, que tirou o login por senha da API. Dos três
 * problemas que o AUTH-1 apontou, o único explorável era o grant morar num
 * client PÚBLICO: o `client_id` viaja no APK, e um script batia direto no
 * `/token` do Keycloak pulando o `@Throttle`. Aqui o grant roda no client
 * CONFIDENCIAL — o secret nunca sai do backend, então o rate limit desta rota
 * é inescapável. Os outros dois (senha passando pelo backend; MFA) são o preço
 * consciente de ter a tela dentro do app, e estão em `Docs/autenticacao/login-e-cadastro.md`.
 */
export class LoginUseCase implements IUseCase<LoginInput, SessionTokensOutput> {
  constructor(private readonly sessionGateway: IIdentitySessionGateway) {}

  async execute(input: LoginInput): Promise<SessionTokensOutput> {
    try {
      const tokens = await this.sessionGateway.authenticateWithPassword(
        input.email.trim().toLowerCase(),
        input.password,
      );
      return toSessionTokensOutput(tokens);
    } catch (error) {
      // Senha errada, e-mail inexistente, conta bloqueada pelo brute force e
      // conta desabilitada viram a MESMA resposta. Qualquer diferença — texto,
      // status — responderia "este e-mail tem conta" para quem testa uma lista.
      if (error instanceof IdentityProviderInvalidCredentialsError) {
        throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
      }
      throw new ExternalServiceError(
        "Não foi possível entrar agora. Tente novamente em instantes.",
        { cause: error },
      );
    }
  }
}
