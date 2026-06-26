import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Repertoire, RepertoireId } from "../../../domain/repertoire.aggregate";
import { IRepertoireRepository } from "../../../domain/repertoire.repository";
import { RepertoireOutput, RepertoireOutputMapper } from "../common/repertoire-output";

export type RenameRepertoireInput = {
  repertoire_id: string;
  name: string;
};

export class RenameRepertoireUseCase
  implements IUseCase<RenameRepertoireInput, RepertoireOutput>
{
  constructor(private readonly repertoireRepo: IRepertoireRepository) {}

  async execute(input: RenameRepertoireInput): Promise<RepertoireOutput> {
    const id = new RepertoireId(input.repertoire_id);
    const repertoire = await this.repertoireRepo.findById(id);
    if (!repertoire) {
      throw new NotFoundError(input.repertoire_id, Repertoire);
    }

    repertoire.rename(input.name);
    await this.repertoireRepo.update(repertoire);

    return RepertoireOutputMapper.toOutput(repertoire);
  }
}
