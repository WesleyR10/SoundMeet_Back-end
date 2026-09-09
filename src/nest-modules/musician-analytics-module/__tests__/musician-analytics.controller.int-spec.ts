import { Test, TestingModule } from "@nestjs/testing";

import { GetMusicianAnalyticsUseCase } from "../../../core/musician/application/use-cases/get-musician-analytics/get-musician-analytics.use-case";
import { Musician } from "../../../core/musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../../core/musician/domain/musician.repository";
import { MusicianInMemoryRepository } from "../../../core/musician/infra/db/in-memory/musician-in-memory.repository";
import { MusicianWallet } from "../../../core/payment/domain/musician-wallet.aggregate";
import { IMusicianWalletRepository } from "../../../core/payment/domain/repositories/musician-wallet.repository";
import { MusicianWalletInMemoryRepository } from "../../../core/payment/infra/db/in-memory/musician-wallet-in-memory.repository";
import { PlanLimitExceededError } from "../../../core/plans/domain/errors/plan-limit-exceeded.error";
import { PlanCheckService } from "../../../core/plans/domain/plan-check.service";
import { MusicianPlanTier } from "../../../core/plans/domain/plan-tier.enum";
import {
  Subscription,
  SubscriptionStatus,
} from "../../../core/plans/domain/subscription.aggregate";
import { SubscriptionInMemoryRepository } from "../../../core/plans/infra/db/in-memory/subscription-in-memory.repository";
import { Request } from "../../../core/request/domain/request.aggregate";
import { IRequestRepository } from "../../../core/request/domain/request.repository";
import { RequestStatus } from "../../../core/request/domain/value-objects/request-status.vo";
import { RequestInMemoryRepository } from "../../../core/request/infra/db/in-memory/request-in-memory.repository";
import { Money } from "../../../core/shared/domain/value-objects/money.vo";
import { applyAuthGuardMocks } from "../../shared-module/testing/auth-guard-mock";
import { MusicianAnalyticsController } from "../musician-analytics.controller";

describe("MusicianAnalyticsController Integration Tests", () => {
  let controller: MusicianAnalyticsController;
  let repository: IMusicianRepository;
  let requestRepository: IRequestRepository;
  let walletRepository: IMusicianWalletRepository;
  let subscriptionRepository: SubscriptionInMemoryRepository;

  /** Gate 9.7a: sem assinatura ativa o músico é FREE e o endpoint responde 402. */
  async function givenPaidPlan(musician_id: string) {
    await subscriptionRepository.insert(
      new Subscription({
        musician_id,
        plan_tier: MusicianPlanTier.PRO,
        persona: "musician",
        status: SubscriptionStatus.ACTIVE,
      }),
    );
  }

  beforeEach(async () => {
    const repositoryInstance = new MusicianInMemoryRepository();
    const requestRepositoryInstance = new RequestInMemoryRepository();
    const walletRepositoryInstance = new MusicianWalletInMemoryRepository();
    const subscriptionRepositoryInstance = new SubscriptionInMemoryRepository();
    subscriptionRepository = subscriptionRepositoryInstance;

    const moduleBuilder = Test.createTestingModule({
      controllers: [MusicianAnalyticsController],
      providers: [
        {
          provide: "MusicianRepository",
          useValue: repositoryInstance,
        },
        {
          provide: "RequestRepository",
          useValue: requestRepositoryInstance,
        },
        {
          provide: "MusicianWalletRepository",
          useValue: walletRepositoryInstance,
        },
        {
          provide: PlanCheckService,
          useValue: new PlanCheckService(subscriptionRepositoryInstance),
        },
        {
          provide: GetMusicianAnalyticsUseCase,
          useFactory: (
            repo: IMusicianRepository,
            planCheck: PlanCheckService,
            requestRepo: IRequestRepository,
            walletRepo: IMusicianWalletRepository,
          ) =>
            new GetMusicianAnalyticsUseCase(
              repo,
              planCheck,
              requestRepo,
              walletRepo,
            ),
          inject: [
            "MusicianRepository",
            PlanCheckService,
            "RequestRepository",
            "MusicianWalletRepository",
          ],
        },
      ],
    });

    const module: TestingModule =
      await applyAuthGuardMocks(moduleBuilder).compile();

    controller = module.get<MusicianAnalyticsController>(
      MusicianAnalyticsController,
    );
    repository = module.get<IMusicianRepository>("MusicianRepository");
    requestRepository = module.get<IRequestRepository>("RequestRepository");
    walletRepository = module.get<IMusicianWalletRepository>(
      "MusicianWalletRepository",
    );
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("GET :id/analytics", () => {
    it("retorna pedidos aceitos/rejeitados, total de gorjetas e músicas mais pedidas", async () => {
      const musician = Musician.fake().aMusician().build();
      await repository.insert(musician);

      await requestRepository.insert(
        Request.fake()
          .aRequest()
          .withMusicianId(musician.musician_id)
          .withStatus(RequestStatus.accepted())
          .build(),
      );
      await requestRepository.insert(
        Request.fake()
          .aRequest()
          .withMusicianId(musician.musician_id)
          .withStatus(RequestStatus.rejected())
          .build(),
      );
      await walletRepository.insert(
        MusicianWallet.fake()
          .aMusicianWallet()
          .withMusicianId(musician.musician_id)
          .withTotalEarned(new Money(250))
          .build(),
      );

      await givenPaidPlan(musician.musician_id.id);

      const output = await controller.getAnalytics(musician.musician_id.id);

      expect(output.accepted_requests_count).toBe(1);
      expect(output.rejected_requests_count).toBe(1);
      expect(output.total_tips_amount).toBe(250);
      expect(output.top_requested_songs).toEqual(expect.any(Array));
    });

    it("músico FREE recebe PlanLimitExceededError (402) — gate 9.7a", async () => {
      // Atravessa o controller de propósito: é a fronteira onde o mobile e o
      // web batem, e onde o `GlobalExceptionFilter` traduz o erro para 402.
      const musician = Musician.fake().aMusician().build();
      await repository.insert(musician);

      await expect(
        controller.getAnalytics(musician.musician_id.id),
      ).rejects.toThrow(PlanLimitExceededError);
    });
  });
});
