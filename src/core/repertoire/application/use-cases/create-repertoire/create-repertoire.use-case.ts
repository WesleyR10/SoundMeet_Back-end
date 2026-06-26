import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { Repertoire } from "../../../domain/repertoire.aggregate";
import { IRepertoireRepository } from "../../../domain/repertoire.repository";
import {
  MusicLibraryBasicData,
  RepertoireOutput,
  RepertoireOutputMapper,
} from "../common/repertoire-output";

export type CreateRepertoireInput = {
  musician_id: string;
  name: string;
};

export class CreateRepertoireUseCase
  implements IUseCase<CreateRepertoireInput, RepertoireOutput>
{
  constructor(
    private readonly repertoireRepo: IRepertoireRepository,
    private readonly planCheckService: PlanCheckService,
  ) {}

  async execute(input: CreateRepertoireInput): Promise<RepertoireOutput> {
    const currentCount = await this.repertoireRepo.countByMusicianId(input.musician_id);
    await this.planCheckService.assertMusicianCanCreateRepertoire(
      input.musician_id,
      currentCount,
    );

    const repertoire = Repertoire.create({
      musician_id: input.musician_id,
      name: input.name,
    });

    await this.repertoireRepo.insert(repertoire);

    return RepertoireOutputMapper.toOutput(repertoire, new Map<string, MusicLibraryBasicData>());
  }
}
