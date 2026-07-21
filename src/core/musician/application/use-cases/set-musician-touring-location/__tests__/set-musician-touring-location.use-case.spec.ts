import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { FakeGeocodingService } from "../../../../../shared/infra/geocoding/fake-geocoding.service";
import { Location } from "../../../../../shared/domain/value-objects/location.vo";
import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { SetMusicianTouringLocationUseCase } from "../set-musician-touring-location.use-case";

describe("SetMusicianTouringLocationUseCase — 7.13d", () => {
  let repository: MusicianInMemoryRepository;

  beforeEach(() => {
    repository = new MusicianInMemoryRepository();
  });

  it("activates touring mode with explicit coordinates, preserving the permanent base", async () => {
    const musician = Musician.fake().aMusician().build();
    const profile = musician.ensureProfile();
    profile.changeLocation(
      new Location({
        city: "São Paulo",
        state: "SP",
        latitude: -23.55,
        longitude: -46.63,
      }),
    );
    await repository.insert(musician);

    const useCase = new SetMusicianTouringLocationUseCase(repository);

    const output = await useCase.execute({
      id: musician.musician_id.id,
      city: "Recife",
      state: "PE",
      latitude: -8.0476,
      longitude: -34.877,
      duration_days: 5,
    });

    expect(output.profile?.location.city).toBe("São Paulo");
    expect(output.profile?.touring_location?.city).toBe("Recife");
    expect(output.profile?.is_touring).toBe(true);
    expect(output.profile?.touring_expires_at).toBeInstanceOf(Date);
  });

  it("geocodes the address when coordinates are not provided", async () => {
    const musician = Musician.fake().aMusician().build();
    await repository.insert(musician);

    const geocoding = new FakeGeocodingService({ latitude: -8.0476, longitude: -34.877 });
    const useCase = new SetMusicianTouringLocationUseCase(repository, geocoding);

    const output = await useCase.execute({
      id: musician.musician_id.id,
      city: "Recife",
      state: "PE",
      zip_code: "50000000",
      duration_days: 5,
    });

    expect(geocoding.queries).toHaveLength(1);
    expect(output.profile?.touring_location?.latitude).toBe(-8.0476);
  });

  it("throws when geocoding is unavailable and no coordinates were provided", async () => {
    const musician = Musician.fake().aMusician().build();
    await repository.insert(musician);

    const useCase = new SetMusicianTouringLocationUseCase(repository);

    await expect(
      useCase.execute({
        id: musician.musician_id.id,
        city: "Recife",
        state: "PE",
        duration_days: 5,
      }),
    ).rejects.toThrow(EntityValidationError);
  });

  it("throws when geocoding fails to resolve coordinates", async () => {
    const musician = Musician.fake().aMusician().build();
    await repository.insert(musician);

    const geocoding = new FakeGeocodingService(null);
    const useCase = new SetMusicianTouringLocationUseCase(repository, geocoding);

    await expect(
      useCase.execute({
        id: musician.musician_id.id,
        city: "Recife",
        state: "PE",
        duration_days: 5,
      }),
    ).rejects.toThrow(EntityValidationError);
  });

  it("accepts exactly the max touring duration (30 days)", async () => {
    const musician = Musician.fake().aMusician().build();
    await repository.insert(musician);

    const useCase = new SetMusicianTouringLocationUseCase(repository);

    await expect(
      useCase.execute({
        id: musician.musician_id.id,
        latitude: -8.0476,
        longitude: -34.877,
        duration_days: 30,
      } as any),
    ).resolves.toBeDefined();
  });

  it("throws when duration exceeds the max touring days (defense in depth at the aggregate)", async () => {
    const musician = Musician.fake().aMusician().build();
    await repository.insert(musician);

    const useCase = new SetMusicianTouringLocationUseCase(repository);

    await expect(
      useCase.execute({
        id: musician.musician_id.id,
        latitude: -8.0476,
        longitude: -34.877,
        duration_days: 31,
      } as any),
    ).rejects.toThrow(EntityValidationError);
  });

  it("throws NotFoundError when the musician does not exist", async () => {
    const useCase = new SetMusicianTouringLocationUseCase(repository);

    await expect(
      useCase.execute({
        id: "b7f8e6a0-1c2d-4e3f-9a1b-2c3d4e5f6a7b",
        latitude: -8.0476,
        longitude: -34.877,
        duration_days: 5,
      } as any),
    ).rejects.toThrow(NotFoundError);
  });
});
