import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import {
  MusicianOutput,
  MusicianOutputMapper,
} from "../common/musician-profile-output";

export class GetMusicianUseCase implements IUseCase<
  GetMusicianInput,
  GetMusicianOutput
> {
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    private readonly planCheckService: PlanCheckService,
  ) {}

  async execute(input: GetMusicianInput): Promise<GetMusicianOutput> {
    const musicianId = new MusicianId(input.id);
    const entity = await this.musicianRepo.findById(musicianId);

    if (!entity) {
      throw new NotFoundError(input.id, Musician);
    }

    const plan_tier = await this.planCheckService.getMusicianPlanTier(
      input.id,
    );

    return { ...MusicianOutputMapper.toOutput(entity), plan_tier };
  }
}

export type GetMusicianInput = {
  id: string;
};

export type GetMusicianOutput = MusicianOutput;
