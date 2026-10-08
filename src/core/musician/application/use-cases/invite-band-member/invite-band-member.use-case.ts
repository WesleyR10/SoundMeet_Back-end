import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Band, BandId } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import { assertBandIsActive, assertBandLeader } from "../common/band-actor";
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
    private readonly domainEventMediator?: DomainEventMediator,
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

    assertBandLeader(band, input, "convidar integrantes");
    assertBandIsActive(band);

    if (!musician) {
      throw new NotFoundError(input.musician_id, Musician);
    }

    if (!musician.is_active) {
      throw new EntityValidationError([
        {
          musician_id: ["Musician is not active"],
        },
      ]);
    }

    // O gate é do plano do LÍDER, e o teto conta quem ocupa vaga: aceitos e
    // convites em aberto. Um convite recusado não ocupa — reconvidar essa
    // pessoa, sim, e por isso a contagem é feita antes do `inviteMember`.
    const leader = band.leader;
    if (this.planCheckService && leader) {
      const occupied = band.members.filter(
        (m) => m.status !== "declined",
      ).length;
      await this.planCheckService.assertBandCanAddMember(
        leader.musician_id.id,
        occupied,
      );
    }

    // A regra de "já é membro ou tem convite pendente" (e a reativação de um
    // convite recusado) vive só em Band.inviteMember() — checar de novo aqui
    // duplicaria a mesma invariante em dois lugares com risco de divergir.
    band.inviteMember(musicianId, "member", input.instrument.trim());
    band.validate(["members"]);

    if (band.notification.hasErrors()) {
      throw new EntityValidationError(band.notification.toJSON());
    }

    await this.bandRepo.update(band);
    // Depois do `update`: avisar um convite que não foi gravado mandaria o
    // músico a uma tela onde ele não existe.
    await this.domainEventMediator?.publish(band);
    band.clearEvents();

    return BandOutputMapper.toOutput(band);
  }
}
