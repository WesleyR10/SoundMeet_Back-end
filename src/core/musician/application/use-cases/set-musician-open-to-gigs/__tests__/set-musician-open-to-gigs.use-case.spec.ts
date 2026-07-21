import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { SetMusicianOpenToGigsUseCase } from "../set-musician-open-to-gigs.use-case";

describe("SetMusicianOpenToGigsUseCase Unit Tests", () => {
  let useCase: SetMusicianOpenToGigsUseCase;
  let repository: MusicianInMemoryRepository;

  beforeEach(() => {
    repository = new MusicianInMemoryRepository();
    useCase = new SetMusicianOpenToGigsUseCase(repository);
  });

  it("should opt a musician in", async () => {
    const musician = Musician.fake().aMusician().build();
    repository.items = [musician];

    const output = await useCase.execute({
      id: musician.musician_id.id,
      open_to_gigs: true,
    });

    expect(output.open_to_gigs).toBe(true);
    expect(repository.items[0].open_to_gigs).toBe(true);
  });

  it("should opt a musician out", async () => {
    const musician = Musician.fake().aMusician().withOpenToGigs(true).build();
    repository.items = [musician];

    const output = await useCase.execute({
      id: musician.musician_id.id,
      open_to_gigs: false,
    });

    expect(output.open_to_gigs).toBe(false);
  });

  it("should throw error when musician not found", async () => {
    await expect(
      useCase.execute({
        id: "9366b7dc-2d71-4799-b91c-c64adb205104",
        open_to_gigs: true,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
