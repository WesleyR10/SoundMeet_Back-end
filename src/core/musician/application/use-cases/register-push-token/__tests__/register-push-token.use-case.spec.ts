import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { RegisterPushTokenUseCase } from "../register-push-token.use-case";

describe("RegisterPushTokenUseCase Unit Tests", () => {
  let useCase: RegisterPushTokenUseCase;
  let repository: MusicianInMemoryRepository;

  beforeEach(() => {
    repository = new MusicianInMemoryRepository();
    useCase = new RegisterPushTokenUseCase(repository);
  });

  it("should register a push token for a musician", async () => {
    const musician = Musician.fake().aMusician().build();
    await repository.insert(musician);

    const output = await useCase.execute({
      id: musician.musician_id.id,
      push_token: "ExponentPushToken[abc123]",
      push_token_platform: "android",
    });

    expect(output.id).toBe(musician.musician_id.id);

    const updatedMusician = await repository.findById(musician.musician_id);
    expect(updatedMusician?.push_token).toBe("ExponentPushToken[abc123]");
    expect(updatedMusician?.push_token_platform).toBe("android");
  });

  it("should overwrite a previously registered token (last device wins)", async () => {
    const musician = Musician.fake().aMusician().build();
    musician.registerPushToken("ExponentPushToken[old]", "ios");
    await repository.insert(musician);

    await useCase.execute({
      id: musician.musician_id.id,
      push_token: "ExponentPushToken[new]",
      push_token_platform: "android",
    });

    const updatedMusician = await repository.findById(musician.musician_id);
    expect(updatedMusician?.push_token).toBe("ExponentPushToken[new]");
    expect(updatedMusician?.push_token_platform).toBe("android");
  });

  it("should throw error if musician not found", async () => {
    await expect(
      useCase.execute({
        id: "9366b7dc-2d71-4799-b91c-c64adb205104",
        push_token: "ExponentPushToken[abc123]",
        push_token_platform: "ios",
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
