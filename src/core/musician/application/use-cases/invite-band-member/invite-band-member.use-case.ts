import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Band, BandId } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import { BandOutput, BandOutputMapper } from "../common/band-output";
import { InviteBandMemberInput } from "./invite-band-member.input";

export class InviteBandMemberUseCase implements IUseCase<
  InviteBandMemberInput,
  BandOutput
> {
  constructor(
    private readonly bandRepo: IBandRepository,
    private readonly musicianRepo: IMusicianRepository,
    private readonly planCheckService?: PlanCheckService,
  ) {}

  async execute(input: InviteBandMemberInput): Promise<BandOutput> {
    const bandId = new BandId(input.band_id);
    const musicianId = new MusicianId(input.musician_id);

    // Duas leituras independentes — sem paralelizar, todo convite pagaria um
    // round-trip extra ao banco que não depende de nada resolvido antes.
    const [band, musician] = await Promise.all([
      this.bandRepo.findById(bandId),
      this.musicianRepo.findById(musicianId),
    ]);

    if (!band) {
      throw new NotFoundError(input.band_id, Band);
    }

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
      const leader = band.acceptedMembers.find((m) => m.role === "leader");
      if (leader) {
        await this.planCheckService.assertMusicianFeature(
          leader.musician_id.id,
          "auto_split_management",
        );
      }
    }

    // A regra de "já é membro ou tem convite pendente" (e a reativação de um
    // convite recusado) vive só em Band.inviteMember() — checar de novo aqui
    // duplicaria a mesma invariante em dois lugares com risco de divergir.
    band.inviteMember(musicianId, input.role.trim(), input.instrument.trim());
    band.validate(["members"]);

    if (band.notification.hasErrors()) {
      throw new EntityValidationError(band.notification.toJSON());
    }

    await this.bandRepo.update(band);

    return BandOutputMapper.toOutput(band);
  }
}
