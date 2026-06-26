import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { MusicianPlanTier } from "../../../../plans/domain/plan-tier.enum";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";

export type GetMusicianAnalyticsInput = {
  musician_id: string;
};

export type GetMusicianAnalyticsOutput = {
  musician_id: string;
  average_rating: number;
  total_ratings: number;
  plan_tier: string;
  realtime_available: boolean;
};

export class GetMusicianAnalyticsUseCase implements IUseCase<
  GetMusicianAnalyticsInput,
  GetMusicianAnalyticsOutput
> {
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    private readonly planCheckService: PlanCheckService,
  ) {}

  async execute(
    input: GetMusicianAnalyticsInput,
  ): Promise<GetMusicianAnalyticsOutput> {
    const musicianId = new MusicianId(input.musician_id);
    const musician = await this.musicianRepo.findById(musicianId);

    if (!musician) {
      throw new NotFoundError(input.musician_id, Musician);
    }

    const tier = await this.planCheckService.getMusicianPlanTier(
      input.musician_id,
    );
    const features = await this.planCheckService.getMusicianFeatures(
      input.musician_id,
    );

    return {
      musician_id: musician.musician_id.id,
      average_rating: musician.rating.value,
      total_ratings: musician.total_ratings,
      plan_tier: tier as string,
      realtime_available: features.realtime_analytics,
    };
  }
}
