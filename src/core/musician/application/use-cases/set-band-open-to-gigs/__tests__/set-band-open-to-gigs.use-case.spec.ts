import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Band } from "../../../../domain/band.aggregate";
import { BandInMemoryRepository } from "../../../../infra/db/in-memory/band-in-memory.repository";
import { SetBandOpenToGigsUseCase } from "../set-band-open-to-gigs.use-case";

describe("SetBandOpenToGigsUseCase Unit Tests", () => {
  let useCase: SetBandOpenToGigsUseCase;
  let repository: BandInMemoryRepository;

  beforeEach(() => {
    repository = new BandInMemoryRepository();
    useCase = new SetBandOpenToGigsUseCase(repository);
  });

  it("should opt a band in, independent of member consent", async () => {
    const band = Band.fake().aBand().build();
    repository.items = [band];

    const output = await useCase.execute({
      band_id: band.band_id.id,
      open_to_gigs: true,
    });

    expect(output.open_to_gigs).toBe(true);
    expect(repository.items[0].open_to_gigs).toBe(true);
  });

  it("should opt a band out", async () => {
    const band = Band.fake().aBand().withOpenToGigs(true).build();
    repository.items = [band];

    const output = await useCase.execute({
      band_id: band.band_id.id,
      open_to_gigs: false,
    });

    expect(output.open_to_gigs).toBe(false);
  });

  it("should throw error when band not found", async () => {
    await expect(
      useCase.execute({
        band_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
        open_to_gigs: true,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
