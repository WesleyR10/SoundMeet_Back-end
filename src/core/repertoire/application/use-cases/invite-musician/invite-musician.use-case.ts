import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Repertoire, RepertoireId } from "../../../domain/repertoire.aggregate";
import { IRepertoireRepository } from "../../../domain/repertoire.repository";
import { RepertoireOutput, RepertoireOutputMapper } from "../common/repertoire-output";

export type InviteMusicianInput = {
  repertoire_id: string;
  invitee_musician_id: string;
};

export class InviteMusicianUseCase implements IUseCase<InviteMusicianInput, RepertoireOutput> {
  constructor(
    private readonly repertoireRepo: IRepertoireRepository,
    private readonly planCheckService: PlanCheckService,
  ) {}

  async execute(input: InviteMusicianInput): Promise<RepertoireOutput> {
    const id = new RepertoireId(input.repertoire_id);
    const repertoire = await this.repertoireRepo.findById(id);
    if (!repertoire) {
      throw new NotFoundError(input.repertoire_id, Repertoire);
    }

    await this.planCheckService.assertMusicianFeature(
      repertoire.musician_id,
      "repertoire_nominal_invite",
    );

    repertoire.inviteMusician(input.invitee_musician_id);
    await this.repertoireRepo.update(repertoire);

    return RepertoireOutputMapper.toOutput(repertoire);
  }
}
