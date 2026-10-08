import { ITipRepository } from "../../../../payment/domain/repositories/tip.repository";
import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { MusicianPlanTier } from "../../../../plans/domain/plan-tier.enum";
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
  /**
   * Desde o 9.7a é sempre `true` para quem chega até aqui — o FREE não passa
   * do gate. Mantido no output porque o mobile e o web já o leem, e porque
   * volta a discriminar no dia em que houver um tier pago sem tempo real.
   */
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
    private readonly tipRepo: ITipRepository,
  ) {}

  async execute(
    input: GetMusicianAnalyticsInput,
  ): Promise<GetMusicianAnalyticsOutput> {
    const musicianId = new MusicianId(input.musician_id);
    const musician = await this.musicianRepo.findById(musicianId);

    if (!musician) {
      throw new NotFoundError(input.musician_id, Musician);
    }

    // Gate real, decidido em 9.7a (16/ago/2026). Até então isto era um SOFT
    // gate: o use-case lia `realtime_analytics` e apenas REPORTAVA a flag no
    // output, entregando ao FREE exatamente os mesmos números do PRO — a
    // promessa da tabela de preços não tinha lastro nenhum.
    //
    // Cobrado ANTES do Promise.all de propósito: o FREE não paga as quatro
    // consultas cujo resultado ele não vai receber. E depois do findById, para
    // que músico inexistente continue sendo 404 e não 402.
    await this.planCheckService.assertMusicianFeature(
      input.musician_id,
      "realtime_analytics",
    );

    const tier = await this.planCheckService.getMusicianPlanTier(
      input.musician_id,
    );
    const features = await this.planCheckService.getMusicianFeatures(
      input.musician_id,
    );

    const [accepted, rejected, tipsTotal, topSongs] = await Promise.all([
      this.requestRepo.findAcceptedRequestsByMusician(input.musician_id),
      this.requestRepo.findRejectedRequestsByMusician(input.musician_id),
      // 🔴 Era `wallet.total_earned`, que soma também o CACHÊ liberado da
      // custódia (e o ganho externo do Mercado Pago). O campo se chama "total
      // em gorjetas" e passou a dizer só isso (30/set/2026).
      this.tipRepo.sumCompletedByMusician(input.musician_id),
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
      total_tips_amount: tipsTotal,
      top_requested_songs: topSongs,
    };
  }
}
