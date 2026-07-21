import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Band, BandId } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import { MusicianId } from "../../../domain/musician.aggregate";
import { BandOutput, BandOutputMapper } from "../common/band-output";
import { AcceptBandInviteInput } from "./accept-band-invite.input";

export class AcceptBandInviteUseCase implements IUseCase<
  AcceptBandInviteInput,
  BandOutput
> {
  constructor(private readonly bandRepo: IBandRepository) {}

  async execute(input: AcceptBandInviteInput): Promise<BandOutput> {
    const bandId = new BandId(input.band_id);
    const band = await this.bandRepo.findById(bandId);

    if (!band) {
      throw new NotFoundError(input.band_id, Band);
    }

    const musicianId = new MusicianId(input.musician_id);
    band.acceptInvite(musicianId);

    if (band.notification.hasErrors()) {
      throw new EntityValidationError(band.notification.toJSON());
    }

    await this.bandRepo.update(band);

    return BandOutputMapper.toOutput(band);
  }
}
