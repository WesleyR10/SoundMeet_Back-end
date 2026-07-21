import { Currency } from "@core/shared/domain/value-objects";

import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { FakeGeocodingService } from "../../../../../shared/infra/geocoding/fake-geocoding.service";
import { PriceRange } from "../../../../../shared/domain/value-objects/price-range.vo";
import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { UpdateMusicianProfileUseCase } from "../update-musician-profile.use-case";

describe("UpdateMusicianProfileUseCase Unit Tests", () => {
  let useCase: UpdateMusicianProfileUseCase;
  let repository: MusicianInMemoryRepository;

  beforeEach(() => {
    repository = new MusicianInMemoryRepository();
    useCase = new UpdateMusicianProfileUseCase(repository);
  });

  it("should update a musician profile", async () => {
    const musician = Musician.fake().aMusician().build();
    await repository.insert(musician);

    const input = {
      id: musician.musician_id.id,
      priceRanges: [
        {
          model: "per_hour" as const,
          min: 150,
          max: 300,
          currency: Currency.BRL,
          notes: "Negotiable",
        },
        {
          model: "per_event" as const,
          min: 800,
          max: 1500,
          currency: Currency.BRL,
          notes: null,
        },
      ],
      location: {
        city: "São Paulo",
        state: "SP",
      },
      experience: 5,
      instruments: ["Guitar", "Voice"],
      genres: ["Rock", "Pop"],
      socialLinks: { instagram: "@musician" },
    };

    const output = await useCase.execute(input);

    expect(output.id).toBe(musician.musician_id.id);
    expect(output.profile?.price_ranges).toStrictEqual([
      {
        model: "per_hour",
        min: 150,
        max: 300,
        currency: "BRL",
        notes: "Negotiable",
      },
      {
        model: "per_event",
        min: 800,
        max: 1500,
        currency: "BRL",
        notes: null,
      },
    ]);
    expect(output.profile?.location).toMatchObject({
      city: "São Paulo",
      state: "SP",
    });
    expect(output.profile?.experience).toBe(5);
    expect(output.profile?.instruments).toStrictEqual(["Guitar", "Voice"]);
    expect(output.profile?.genres).toStrictEqual(["Rock", "Pop"]);
    expect(output.profile?.social_links).toStrictEqual({
      instagram: "@musician",
    });

    const updatedMusician = await repository.findById(musician.musician_id);
    expect(
      updatedMusician?.profile?.priceRanges.map((range) => range.model),
    ).toStrictEqual(["per_hour", "per_event"]);
  });

  it("should throw error if musician not found", async () => {
    const input = {
      id: "9366b7dc-2d71-4799-b91c-c64adb205104",
      experience: 5,
    };

    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("should clear price ranges when passing null", async () => {
    const musician = Musician.fake().aMusician().build();
    musician.updatePriceRanges([
      new PriceRange({
        model: "per_event",
        min: 500,
        max: 1000,
        currency: "BRL" as Currency,
        notes: null,
      }),
    ]);
    await repository.insert(musician);

    const input = {
      id: musician.musician_id.id,
      priceRanges: null,
    };

    const output = await useCase.execute(input);

    expect(output.profile?.price_ranges).toStrictEqual([]);

    const updatedMusician = await repository.findById(musician.musician_id);
    expect(updatedMusician?.profile?.priceRanges).toStrictEqual([]);
  });
});

// ----------------------------------------------------------------
// Geocodificação do endereço (7.13c) — CEP/endereço → coordenadas
// ----------------------------------------------------------------
describe("UpdateMusicianProfileUseCase — geocodificação (7.13c)", () => {
  let repository: MusicianInMemoryRepository;
  let geocoding: FakeGeocodingService;
  let useCase: UpdateMusicianProfileUseCase;

  beforeEach(() => {
    repository = new MusicianInMemoryRepository();
    geocoding = new FakeGeocodingService();
    useCase = new UpdateMusicianProfileUseCase(repository, geocoding);
  });

  it("preenche coordenadas via geocoding quando o endereço vem sem lat/lng", async () => {
    geocoding.setCoordinates({ latitude: -23.5614, longitude: -46.6559 });
    const musician = Musician.fake().aMusician().build();
    await repository.insert(musician);

    await useCase.execute({
      id: musician.musician_id.id,
      location: {
        city: "São Paulo",
        state: "SP",
        street: "Avenida Paulista",
        zip_code: "01310-100",
      },
    });

    const updated = await repository.findById(musician.musician_id);
    expect(updated?.profile?.location.latitude).toBe(-23.5614);
    expect(updated?.profile?.location.longitude).toBe(-46.6559);
    expect(geocoding.queries).toHaveLength(1);
    expect(geocoding.queries[0].zip_code).toBe("01310-100");
  });

  it("não chama o geocoder quando o input já traz coordenadas", async () => {
    geocoding.setCoordinates({ latitude: 0, longitude: 0 });
    const musician = Musician.fake().aMusician().build();
    await repository.insert(musician);

    await useCase.execute({
      id: musician.musician_id.id,
      location: { city: "Rio de Janeiro", state: "RJ", latitude: -22.9, longitude: -43.17 },
    });

    const updated = await repository.findById(musician.musician_id);
    expect(updated?.profile?.location.latitude).toBe(-22.9);
    expect(geocoding.queries).toHaveLength(0);
  });

  it("mantém o endereço sem coordenadas quando o geocoder não resolve (null)", async () => {
    geocoding.setCoordinates(null);
    const musician = Musician.fake().aMusician().build();
    await repository.insert(musician);

    await useCase.execute({
      id: musician.musician_id.id,
      location: { city: "Curitiba", state: "PR", zip_code: "80010-000" },
    });

    const updated = await repository.findById(musician.musician_id);
    expect(updated?.profile?.location.city).toBe("Curitiba");
    expect(updated?.profile?.location.latitude).toBeNull();
    expect(geocoding.queries).toHaveLength(1);
  });
});
