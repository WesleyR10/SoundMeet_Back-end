import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Audience } from "../../../domain/audience.aggregate";
import { IAudiencePushTokenStore } from "../../../domain/ports/audience-push-token.store";
import { RegisterAudiencePushTokenInput } from "./register-audience-push-token.input";

/**
 * Registra o aparelho do fã para push. Até out/2026 o público não tinha token
 * nenhum — só socket, então com o app fechado ninguém era avisado de nada.
 * Quem consome é o aviso a seguidores (`NotifyFollowersUseCase`).
 */
export class RegisterAudiencePushTokenUseCase implements IUseCase<
  RegisterAudiencePushTokenInput,
  void
> {
  constructor(private readonly store: IAudiencePushTokenStore) {}

  async execute(input: RegisterAudiencePushTokenInput): Promise<void> {
    const saved = await this.store.save({
      audience_id: input.id,
      push_token: input.push_token,
      platform: input.push_token_platform,
    });
    if (!saved) {
      throw new NotFoundError(input.id, Audience);
    }
  }
}
