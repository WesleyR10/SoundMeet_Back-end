import { Currency } from "@core/shared/domain/value-objects";

import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
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
      priceRange: {
        model: "per_hour" as const,
        min: 150,
        max: 300,
        currency: Currency.BRL,
        notes: "Negotiable",
      },
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
    expect(output.profile?.price_range).toStrictEqual({
      model: "per_hour",
      min: 150,
      max: 300,
      currency: "BRL",
      notes: "Negotiable",
    });
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
    expect(updatedMusician?.profile?.priceRange?.model).toBe("per_hour");
  });

  it("should throw error if musician not found", async () => {
    const input = {
      id: "9366b7dc-2d71-4799-b91c-c64adb205104",
      experience: 5,
    };

    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("should clear price range when passing null", async () => {
    const musician = Musician.fake().aMusician().build();
    musician.updatePriceRange(
      new PriceRange({
        model: "per_event",
        min: 500,
        max: 1000,
        currency: "BRL" as Currency,
        notes: null,
      }),
    );
    await repository.insert(musician);

    const input = {
      id: musician.musician_id.id,
      priceRange: null,
    };

    const output = await useCase.execute(input);

    expect(output.profile?.price_range).toBeNull();

    const updatedMusician = await repository.findById(musician.musician_id);
    expect(updatedMusician?.profile?.priceRange).toBeNull();
  });
});
