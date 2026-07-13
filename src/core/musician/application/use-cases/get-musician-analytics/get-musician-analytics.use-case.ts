import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { MusicianPlanTier } from "../../../../plans/domain/plan-tier.enum";
import { IMusicianWalletRepository } from "../../../../payment/domain/repositories/musician-wallet.repository";
import { IRequestRepository } from "../../../../request/domain/request.repository";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";

export type GetMusicianAnalyticsInput = {
  musician_id: string;
};

export type TopRequestedSongOutput = {
  song_title: string;
  artist?: string;
  count: number;
};

export type GetMusicianAnalyticsOutput = {
  musician_id: string;
  average_rating: number;
  total_ratings: number;
  plan_tier: string;
  realtime_available: boolean;
  accepted_requests_count: number;
  rejected_requests_count: number;
  total_tips_amount: number;
  top_requested_songs: TopRequestedSongOutput[];
};

export class GetMusicianAnalyticsUseCase implements IUseCase<
  GetMusicianAnalyticsInput,
  GetMusicianAnalyticsOutput
> {
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    private readonly planCheckService: PlanCheckService,
    private readonly requestRepo: IRequestRepository,
    private readonly walletRepo: IMusicianWalletRepository,
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

    const [accepted, rejected, wallet, topSongs] = await Promise.all([
      this.requestRepo.findAcceptedRequestsByMusician(input.musician_id),
      this.requestRepo.findRejectedRequestsByMusician(input.musician_id),
      this.walletRepo.findByMusicianId(input.musician_id),
      this.requestRepo.findPopularSongs(input.musician_id, 5),
    ]);

    return {
      musician_id: musician.musician_id.id,
      average_rating: musician.rating.value,
      total_ratings: musician.total_ratings,
      plan_tier: tier as string,
      realtime_available: features.realtime_analytics,
      accepted_requests_count: accepted.length,
      rejected_requests_count: rejected.length,
      total_tips_amount: wallet?.total_earned.amount ?? 0,
      top_requested_songs: topSongs,
    };
  }
}
