import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Repertoire, RepertoireId } from "../../../domain/repertoire.aggregate";
import { IRepertoireRepository } from "../../../domain/repertoire.repository";

export type UnshareRepertoireInput = { repertoire_id: string };

export class UnshareRepertoireUseCase implements IUseCase<UnshareRepertoireInput, void> {
  constructor(private readonly repertoireRepo: IRepertoireRepository) {}

  async execute(input: UnshareRepertoireInput): Promise<void> {
    const id = new RepertoireId(input.repertoire_id);
    const repertoire = await this.repertoireRepo.findById(id);
    if (!repertoire) {
      throw new NotFoundError(input.repertoire_id, Repertoire);
    }

    repertoire.unshare();
    await this.repertoireRepo.update(repertoire);
  }
}
