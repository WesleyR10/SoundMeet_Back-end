import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { AudiencePushTokenStoreInMemory } from "../../../../infra/push-token/audience-push-token.store.in-memory";
import { RegisterAudiencePushTokenUseCase } from "../register-audience-push-token.use-case";

describe("RegisterAudiencePushTokenUseCase", () => {
  it("grava o token do aparelho do fã", async () => {
    const id = new Uuid().id;
    const store = new AudiencePushTokenStoreInMemory(new Set([id]));

    await new RegisterAudiencePushTokenUseCase(store).execute({
      id,
      push_token: "ExponentPushToken[abc]",
      push_token_platform: "android",
    });

    expect(store.tokens.get(id)).toEqual({
      push_token: "ExponentPushToken[abc]",
      platform: "android",
    });
  });

  it("fã inexistente responde NotFound", async () => {
    const store = new AudiencePushTokenStoreInMemory();

    await expect(
      new RegisterAudiencePushTokenUseCase(store).execute({
        id: new Uuid().id,
        push_token: "ExponentPushToken[abc]",
        push_token_platform: "ios",
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
