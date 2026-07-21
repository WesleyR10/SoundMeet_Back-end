import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Location } from "../../../../../shared/domain/value-objects/location.vo";
import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { ClearMusicianTouringLocationUseCase } from "../clear-musician-touring-location.use-case";

describe("ClearMusicianTouringLocationUseCase — 7.13d", () => {
  let repository: MusicianInMemoryRepository;
  let useCase: ClearMusicianTouringLocationUseCase;

  beforeEach(() => {
    repository = new MusicianInMemoryRepository();
    useCase = new ClearMusicianTouringLocationUseCase(repository);
  });

  it("clears an active touring location, keeping the permanent base", async () => {
    const musician = Musician.fake().aMusician().build();
    const profile = musician.ensureProfile();
    profile.changeLocation(new Location({ city: "São Paulo", state: "SP" }));
    profile.setTouringLocation(
      new Location({ city: "Recife", state: "PE", latitude: -8.0476, longitude: -34.877 }),
      new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    );
    await repository.insert(musician);

    const output = await useCase.execute({ id: musician.musician_id.id });

    expect(output.profile?.touring_location).toBeNull();
    expect(output.profile?.touring_expires_at).toBeNull();
    expect(output.profile?.is_touring).toBe(false);
    expect(output.profile?.location.city).toBe("São Paulo");
  });

  it("is a no-op when the musician has no profile", async () => {
    const musician = Musician.fake().aMusician().build();
    await repository.insert(musician);

    const output = await useCase.execute({ id: musician.musician_id.id });

    expect(output.profile).toBeNull();
  });

  it("throws NotFoundError when the musician does not exist", async () => {
    await expect(
      useCase.execute({ id: "b7f8e6a0-1c2d-4e3f-9a1b-2c3d4e5f6a7b" }),
    ).rejects.toThrow(NotFoundError);
  });
});
