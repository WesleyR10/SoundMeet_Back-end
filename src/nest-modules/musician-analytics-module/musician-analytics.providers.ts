import { GetMusicianAnalyticsUseCase } from "../../core/musician/application/use-cases/get-musician-analytics/get-musician-analytics.use-case";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { ITipRepository } from "../../core/payment/domain/repositories/tip.repository";
import { PlanCheckService } from "../../core/plans/domain/plan-check.service";
import { IRequestRepository } from "../../core/request/domain/request.repository";

export const USE_CASES = {
  GET_MUSICIAN_ANALYTICS_USE_CASE: {
    provide: GetMusicianAnalyticsUseCase,
    useFactory: (
      musicianRepo: IMusicianRepository,
      planCheckService: PlanCheckService,
      requestRepo: IRequestRepository,
      tipRepo: ITipRepository,
    ) => {
      return new GetMusicianAnalyticsUseCase(
        musicianRepo,
        planCheckService,
        requestRepo,
        tipRepo,
      );
    },
    inject: [
      "MusicianRepository",
      PlanCheckService,
      "RequestRepository",
      "TipRepository",
    ],
  },
};

export const MUSICIAN_ANALYTICS_PROVIDERS = {
  USE_CASES,
};
