import { Band } from "@core/musician/domain";
import { BandInMemoryRepository } from "@core/musician/infra/db/in-memory/band-in-memory.repository";
import { NotFoundError } from "@core/shared/domain/errors/not-found.error";
import { Currency } from "@core/shared/domain/value-objects";

import { UpdateBandInput } from "../update-band.input";
import { UpdateBandUseCase } from "../update-band.use-case";

describe("UpdateBandUseCase Unit Tests", () => {
  let useCase: UpdateBandUseCase;
  let repository: BandInMemoryRepository;

  beforeEach(() => {
    repository = new BandInMemoryRepository();
    useCase = new UpdateBandUseCase(repository);
  });

  it("should update a band", async () => {
    const band = Band.fake().aBand().build();
    repository.items = [band];

    const input = new UpdateBandInput({
      id: band.band_id.id,
      name: "updated name",
      description: "updated description",
      is_active: false,
    });

    const output = await useCase.execute(input);

    expect(output).toMatchObject({
      id: band.band_id.id,
      name: "updated name",
      description: "updated description",
      is_active: false,
    });
  });

  it("should throw error when band not found", async () => {
    const input = new UpdateBandInput({
      id: "9366b7dc-2d71-4799-b91c-c64adb205104", // Valid UUID but not in repo
      name: "updated name",
    });

    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("should update price range", async () => {
    const band = Band.fake().aBand().build();
    repository.items = [band];

    const input = new UpdateBandInput({
      id: band.band_id.id,
      priceRange: {
        model: "per_hour",
        min: 200,
        max: 300,
        currency: Currency.BRL,
        notes: "updated notes",
      },
    });

    const output = await useCase.execute(input);

    expect(output.priceRange).toStrictEqual({
      model: "per_hour",
      min: 200,
      max: 300,
      currency: "BRL",
      notes: "updated notes",
    });
  });
});
