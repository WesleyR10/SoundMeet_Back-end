import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Band } from "../../../../domain/band.aggregate";
import { BandInMemoryRepository } from "../../../../infra/db/in-memory/band-in-memory.repository";
import { GetBandInput } from "../get-band.input";
import { GetBandUseCase } from "../get-band.use-case";

describe("GetBandUseCase Unit Tests", () => {
  let useCase: GetBandUseCase;
  let repository: BandInMemoryRepository;

  beforeEach(() => {
    repository = new BandInMemoryRepository();
    useCase = new GetBandUseCase(repository);
  });

  it("should get a band", async () => {
    const band = Band.fake().aBand().build();
    repository.items = [band];

    const input = new GetBandInput({
      id: band.band_id.id,
    });

    const output = await useCase.execute(input);

    expect(output).toMatchObject({
      id: band.band_id.id,
      name: band.name,
      description: band.description,
      is_active: band.is_active,
    });
  });

  it("should throw error when band not found", async () => {
    const input = new GetBandInput({
      id: "9366b7dc-2d71-4799-b91c-c64adb205104", // Valid UUID but not in repo
    });

    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });
});
