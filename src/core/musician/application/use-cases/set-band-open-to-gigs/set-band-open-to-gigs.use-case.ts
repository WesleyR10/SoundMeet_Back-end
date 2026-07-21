import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Band, BandId } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import { BandOutput, BandOutputMapper } from "../common/band-output";
import { SetBandOpenToGigsInput } from "./set-band-open-to-gigs.input";

export class SetBandOpenToGigsUseCase implements IUseCase<
  SetBandOpenToGigsInput,
  BandOutput
> {
  constructor(private readonly bandRepo: IBandRepository) {}

  async execute(input: SetBandOpenToGigsInput): Promise<BandOutput> {
    const band = await this.bandRepo.findById(new BandId(input.band_id));

    if (!band) {
      throw new NotFoundError(input.band_id, Band);
    }

    band.setOpenToGigs(input.open_to_gigs);

    await this.bandRepo.update(band);

    return BandOutputMapper.toOutput(band);
  }
}
