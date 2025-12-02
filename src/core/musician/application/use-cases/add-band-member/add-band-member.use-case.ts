import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Band, BandId } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import { IMusicianRepository } from "../../../domain/musician.repository";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { BandOutput, BandOutputMapper } from "../common/band-output";
import { AddBandMemberInput } from "./add-band-member.input";

export class AddBandMemberUseCase
  implements IUseCase<AddBandMemberInput, BandOutput>
{
  constructor(
    private readonly bandRepo: IBandRepository,
    private readonly musicianRepo: IMusicianRepository,
  ) {}

  async execute(input: AddBandMemberInput): Promise<BandOutput> {
    const bandId = new BandId(input.band_id);
    const band = await this.bandRepo.findById(bandId);

    if (!band) {
      throw new NotFoundError(input.band_id, Band);
    }

    const musicianId = new MusicianId(input.musician_id);
    const musician = await this.musicianRepo.findById(musicianId);

    if (!musician) {
      // We check if musician exists before adding
      throw new NotFoundError(input.musician_id, Musician);
    }

    band.addMember(musicianId, input.role, input.instrument);

    if (band.notification.hasErrors()) {
      throw new EntityValidationError(band.notification.toJSON());
    }

    await this.bandRepo.update(band);

    return BandOutputMapper.toOutput(band);
  }
}
