import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Repertoire, RepertoireId } from "../../../domain/repertoire.aggregate";
import { IRepertoireRepository } from "../../../domain/repertoire.repository";

export type DeleteRepertoireInput = { repertoire_id: string };
export type DeleteRepertoireOutput = void;

export class DeleteRepertoireUseCase
  implements IUseCase<DeleteRepertoireInput, DeleteRepertoireOutput>
{
  constructor(private readonly repertoireRepo: IRepertoireRepository) {}

  async execute(input: DeleteRepertoireInput): Promise<void> {
    const id = new RepertoireId(input.repertoire_id);
    const repertoire = await this.repertoireRepo.findById(id);
    if (!repertoire) {
      throw new NotFoundError(input.repertoire_id, Repertoire);
    }
    await this.repertoireRepo.delete(id);
  }
}
