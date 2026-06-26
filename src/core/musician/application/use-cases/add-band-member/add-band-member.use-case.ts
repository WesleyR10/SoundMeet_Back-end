import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Band, BandId } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import { BandOutput, BandOutputMapper } from "../common/band-output";
import { AddBandMemberInput } from "./add-band-member.input";

export class AddBandMemberUseCase implements IUseCase<
  AddBandMemberInput,
  BandOutput
> {
  constructor(
    private readonly bandRepo: IBandRepository,
    private readonly musicianRepo: IMusicianRepository,
    private readonly planCheckService?: PlanCheckService,
  ) {}

  async execute(input: AddBandMemberInput): Promise<BandOutput> {
    const bandId = new BandId(input.band_id);
    const band = await this.bandRepo.findById(bandId);

    if (!band) {
      throw new NotFoundError(input.band_id, Band);
    }

    const musicianId = new MusicianId(input.musician_id);
    if (band.members.some((m) => m.musician_id.equals(musicianId))) {
      throw new EntityValidationError([
        {
          musician_id: ["Musician is already a member of this band"],
        },
      ]);
    }
    const musician = await this.musicianRepo.findById(musicianId);

    if (!musician) {
      throw new NotFoundError(input.musician_id, Musician);
    }

    if (!band.is_active) {
      throw new EntityValidationError([
        {
          band_id: ["Band is not active"],
        },
      ]);
    }

    if (!musician.is_active) {
      throw new EntityValidationError([
        {
          musician_id: ["Musician is not active"],
        },
      ]);
    }

    if (this.planCheckService) {
      const leader = band.members.find((m) => m.role === "leader");
      if (leader) {
        await this.planCheckService.assertMusicianFeature(
          leader.musician_id.id,
          "auto_split_management",
        );
      }
    }

    band.addMember(musicianId, input.role.trim(), input.instrument.trim());
    band.validate(["members"]);

    if (band.notification.hasErrors()) {
      throw new EntityValidationError(band.notification.toJSON());
    }

    await this.bandRepo.update(band);

    return BandOutputMapper.toOutput(band);
  }
}
