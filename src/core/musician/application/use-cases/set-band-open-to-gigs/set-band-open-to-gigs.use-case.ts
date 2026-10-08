import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Band, BandId } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import { assertBandIsActive, assertBandLeader } from "../common/band-actor";
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

    assertBandLeader(band, input, "decidir se a banda aparece na busca");
    // Banda dissolvida não volta ao radar por esta porta.
    assertBandIsActive(band);

    band.setOpenToGigs(input.open_to_gigs);

    await this.bandRepo.update(band);

    return BandOutputMapper.toOutput(band);
  }
}
