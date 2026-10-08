import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Band, BandId } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import { MusicianId } from "../../../domain/musician.aggregate";
import { assertBandIsActive } from "../common/band-actor";
import { BandOutput, BandOutputMapper } from "../common/band-output";
import { AcceptBandInviteInput } from "./accept-band-invite.input";

export class AcceptBandInviteUseCase implements IUseCase<
  AcceptBandInviteInput,
  BandOutput
> {
  constructor(
    private readonly bandRepo: IBandRepository,
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(input: AcceptBandInviteInput): Promise<BandOutput> {
    const bandId = new BandId(input.band_id);
    const band = await this.bandRepo.findById(bandId);

    if (!band) {
      throw new NotFoundError(input.band_id, Band);
    }

    // Banda dissolvida não ganha integrante. `archive()` já descarta os
    // convites em aberto; esta checagem cobre a corrida entre os dois.
    assertBandIsActive(band);

    const musicianId = new MusicianId(input.musician_id);
    band.acceptInvite(musicianId);

    if (band.notification.hasErrors()) {
      throw new EntityValidationError(band.notification.toJSON());
    }

    await this.bandRepo.update(band);
    await this.domainEventMediator?.publish(band);
    band.clearEvents();

    return BandOutputMapper.toOutput(band);
  }
}
