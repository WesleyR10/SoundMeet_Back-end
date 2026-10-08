import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { ClearPushTokenUseCase } from "../clear-push-token.use-case";

describe("ClearPushTokenUseCase", () => {
  let repository: MusicianInMemoryRepository;
  let useCase: ClearPushTokenUseCase;

  beforeEach(() => {
    repository = new MusicianInMemoryRepository();
    useCase = new ClearPushTokenUseCase(repository);
  });

  it("apaga o token e a plataforma", async () => {
    const musician = Musician.fake().aMusician().build();
    musician.registerPushToken("ExponentPushToken[abc]", "android");
    await repository.insert(musician);

    await useCase.execute({ id: musician.musician_id.id });

    const found = await repository.findById(musician.musician_id);
    expect(found!.push_token).toBeNull();
    expect(found!.push_token_platform).toBeNull();
  });

  it("é idempotente: sem token, não grava e não falha", async () => {
    const musician = Musician.fake().aMusician().build();
    await repository.insert(musician);
    const updateSpy = jest.spyOn(repository, "update");

    await expect(
      useCase.execute({ id: musician.musician_id.id }),
    ).resolves.toBeUndefined();

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("não toca em mais nada do perfil", async () => {
    const musician = Musician.fake()
      .aMusician()
      .withStageName("Rafa Sax")
      .build();
    musician.registerPushToken("ExponentPushToken[abc]", "ios");
    musician.setOpenToGigs(true);
    await repository.insert(musician);

    await useCase.execute({ id: musician.musician_id.id });

    const found = await repository.findById(musician.musician_id);
    expect(found!.stage_name).toBe("Rafa Sax");
    expect(found!.open_to_gigs).toBe(true);
  });

  it("músico inexistente lança NotFoundError", async () => {
    await expect(
      useCase.execute({ id: "9366b7dc-2d71-4799-b91c-c64adb205104" }),
    ).rejects.toThrow(NotFoundError);
  });
});
