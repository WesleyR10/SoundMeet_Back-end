import { Band } from "@core/musician/domain/band.aggregate";
import { BandInMemoryRepository } from "@core/musician/infra/db/in-memory/band-in-memory.repository";

import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { DeleteBandUseCase } from "../delete-band.use-case";

describe("DeleteBandUseCase Unit Tests", () => {
  let useCase: DeleteBandUseCase;
  let repository: BandInMemoryRepository;

  beforeEach(() => {
    repository = new BandInMemoryRepository();
    useCase = new DeleteBandUseCase(repository);
  });

  it("should delete a band", async () => {
    const band = Band.fake().aBand().build();
    await repository.insert(band);

    await useCase.execute({ id: band.band_id.id });

    const foundBand = await repository.findById(band.band_id);
    expect(foundBand).toBeNull();
  });

  it("should throw error if band not found", async () => {
    await expect(() =>
      useCase.execute({ id: "9366b7dc-2d71-4799-b91c-c64adb205104" }),
    ).rejects.toThrow(NotFoundError);
  });
});
