import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Repertoire, RepertoireId } from "../../../domain/repertoire.aggregate";
import { IRepertoireRepository } from "../../../domain/repertoire.repository";

export type RemoveSongInput = { repertoire_id: string; song_id: string };

export class RemoveSongUseCase implements IUseCase<RemoveSongInput, void> {
  constructor(private readonly repertoireRepo: IRepertoireRepository) {}

  async execute(input: RemoveSongInput): Promise<void> {
    const id = new RepertoireId(input.repertoire_id);
    const repertoire = await this.repertoireRepo.findById(id);
    if (!repertoire) {
      throw new NotFoundError(input.repertoire_id, Repertoire);
    }

    repertoire.removeSong(input.song_id);
    await this.repertoireRepo.update(repertoire);
  }
}
