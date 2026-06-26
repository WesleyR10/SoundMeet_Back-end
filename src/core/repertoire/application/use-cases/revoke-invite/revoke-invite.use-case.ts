import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Repertoire, RepertoireId } from "../../../domain/repertoire.aggregate";
import { IRepertoireRepository } from "../../../domain/repertoire.repository";

export type RevokeInviteInput = {
  repertoire_id: string;
  invitee_id: string;
};

export class RevokeInviteUseCase implements IUseCase<RevokeInviteInput, void> {
  constructor(private readonly repertoireRepo: IRepertoireRepository) {}

  async execute(input: RevokeInviteInput): Promise<void> {
    const id = new RepertoireId(input.repertoire_id);
    const repertoire = await this.repertoireRepo.findById(id);
    if (!repertoire) {
      throw new NotFoundError(input.repertoire_id, Repertoire);
    }

    repertoire.revokeInvite(input.invitee_id);
    await this.repertoireRepo.update(repertoire);
  }
}
