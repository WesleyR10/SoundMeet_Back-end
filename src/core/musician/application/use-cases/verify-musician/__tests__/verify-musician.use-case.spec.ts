import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { VerifyMusicianUseCase } from "../verify-musician.use-case";

describe("VerifyMusicianUseCase", () => {
  let repository: MusicianInMemoryRepository;
  let useCase: VerifyMusicianUseCase;

  beforeEach(() => {
    repository = new MusicianInMemoryRepository();
    useCase = new VerifyMusicianUseCase(repository);
  });

  it("marca o músico como verificado e persiste", async () => {
    const musician = Musician.fake().aMusician().build();
    await repository.insert(musician);
    expect(musician.is_verified).toBe(false);

    const output = await useCase.execute({ id: musician.musician_id.id });

    expect(output.is_verified).toBe(true);
    const found = await repository.findById(musician.musician_id);
    expect(found!.is_verified).toBe(true);
  });

  it("é idempotente: verificar de novo mantém verificado", async () => {
    const musician = Musician.fake().aMusician().build();
    await repository.insert(musician);

    await useCase.execute({ id: musician.musician_id.id });
    const output = await useCase.execute({ id: musician.musician_id.id });

    expect(output.is_verified).toBe(true);
  });

  it("não altera o resto do perfil", async () => {
    const musician = Musician.fake()
      .aMusician()
      .withStageName("Ana Batuque")
      .withOpenToGigs(true)
      .build();
    await repository.insert(musician);

    const output = await useCase.execute({ id: musician.musician_id.id });

    expect(output.stage_name).toBe("Ana Batuque");
    expect(output.open_to_gigs).toBe(true);
    expect(output.is_active).toBe(true);
  });

  it("músico inexistente lança NotFoundError", async () => {
    await expect(
      useCase.execute({ id: "9366b7dc-2d71-4799-b91c-c64adb205104" }),
    ).rejects.toThrow(NotFoundError);
  });
});
