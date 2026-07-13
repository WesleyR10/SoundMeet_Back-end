import { MusicianPlanTier } from "../../../../../plans/domain/plan-tier.enum";
import {
  Subscription,
  SubscriptionStatus,
} from "../../../../../plans/domain/subscription.aggregate";
import { PlanCheckService } from "../../../../../plans/domain/plan-check.service";
import { SubscriptionInMemoryRepository } from "../../../../../plans/infra/db/in-memory/subscription-in-memory.repository";
import { MusicianWallet } from "../../../../../payment/domain/musician-wallet.aggregate";
import { MusicianWalletInMemoryRepository } from "../../../../../payment/infra/db/in-memory/musician-wallet-in-memory.repository";
import { Money } from "../../../../../shared/domain/value-objects/money.vo";
import { Request } from "../../../../../request/domain/request.aggregate";
import { RequestStatus } from "../../../../../request/domain/value-objects/request-status.vo";
import { RequestInMemoryRepository } from "../../../../../request/infra/db/in-memory/request-in-memory.repository";
import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { GetMusicianAnalyticsUseCase } from "../get-musician-analytics.use-case";

async function setup(tier?: MusicianPlanTier) {
  const musicianRepo = new MusicianInMemoryRepository();
  const subRepo = new SubscriptionInMemoryRepository();
  const requestRepo = new RequestInMemoryRepository();
  const walletRepo = new MusicianWalletInMemoryRepository();

  const musician = Musician.fake().aMusician().build();
  await musicianRepo.insert(musician);

  if (tier) {
    await subRepo.insert(
      new Subscription({
        musician_id: musician.musician_id.id,
        plan_tier: tier,
        persona: "musician",
        status: SubscriptionStatus.ACTIVE,
      }),
    );
  }

  const planCheckService = new PlanCheckService(subRepo);
  const useCase = new GetMusicianAnalyticsUseCase(
    musicianRepo,
    planCheckService,
    requestRepo,
    walletRepo,
  );

  return { useCase, musician, requestRepo, walletRepo };
}

describe("GetMusicianAnalyticsUseCase — gate 4C.1 (realtime_analytics)", () => {
  it("FREE: realtime_available=false", async () => {
    const { useCase, musician } = await setup();
    const output = await useCase.execute({ musician_id: musician.musician_id.id });
    expect(output.realtime_available).toBe(false);
    expect(output.plan_tier).toBe(MusicianPlanTier.FREE);
  });

  it("ESSENTIAL: realtime_available=true", async () => {
    const { useCase, musician } = await setup(MusicianPlanTier.ESSENTIAL);
    const output = await useCase.execute({ musician_id: musician.musician_id.id });
    expect(output.realtime_available).toBe(true);
    expect(output.plan_tier).toBe(MusicianPlanTier.ESSENTIAL);
  });

  it("PRO: realtime_available=true", async () => {
    const { useCase, musician } = await setup(MusicianPlanTier.PRO);
    const output = await useCase.execute({ musician_id: musician.musician_id.id });
    expect(output.realtime_available).toBe(true);
  });

  it("não lança erro para músico FREE — apenas sinaliza tier", async () => {
    const { useCase, musician } = await setup();
    await expect(
      useCase.execute({ musician_id: musician.musician_id.id }),
    ).resolves.not.toThrow();
  });
});

describe("GetMusicianAnalyticsUseCase — pedidos, gorjetas e músicas mais pedidas", () => {
  it("sem pedidos e sem wallet ainda — contagens e total zerados", async () => {
    const { useCase, musician } = await setup();
    const output = await useCase.execute({ musician_id: musician.musician_id.id });

    expect(output.accepted_requests_count).toBe(0);
    expect(output.rejected_requests_count).toBe(0);
    expect(output.total_tips_amount).toBe(0);
    expect(output.top_requested_songs).toEqual([]);
  });

  it("conta pedidos aceitos/rejeitados e ignora pendentes de outro músico", async () => {
    const { useCase, musician, requestRepo } = await setup();

    await requestRepo.insert(
      Request.fake()
        .aRequest()
        .withMusicianId(musician.musician_id)
        .withStatus(RequestStatus.accepted())
        .build(),
    );
    await requestRepo.insert(
      Request.fake()
        .aRequest()
        .withMusicianId(musician.musician_id)
        .withStatus(RequestStatus.accepted())
        .build(),
    );
    await requestRepo.insert(
      Request.fake()
        .aRequest()
        .withMusicianId(musician.musician_id)
        .withStatus(RequestStatus.rejected())
        .build(),
    );
    await requestRepo.insert(
      Request.fake()
        .aRequest()
        .withMusicianId(musician.musician_id)
        .withStatus(RequestStatus.pending())
        .build(),
    );

    const output = await useCase.execute({ musician_id: musician.musician_id.id });

    expect(output.accepted_requests_count).toBe(2);
    expect(output.rejected_requests_count).toBe(1);
  });

  it("retorna total_tips_amount a partir de wallet.total_earned", async () => {
    const { useCase, musician, walletRepo } = await setup();

    await walletRepo.insert(
      MusicianWallet.fake()
        .aMusicianWallet()
        .withMusicianId(musician.musician_id)
        .withTotalEarned(new Money(150))
        .build(),
    );

    const output = await useCase.execute({ musician_id: musician.musician_id.id });

    expect(output.total_tips_amount).toBe(150);
  });

  it("retorna top_requested_songs ordenado por popularidade, limitado a 5", async () => {
    const { useCase, musician, requestRepo } = await setup();

    for (let i = 0; i < 3; i++) {
      await requestRepo.insert(
        Request.fake()
          .aRequest()
          .withMusicianId(musician.musician_id)
          .withSongTitle("Evidências")
          .withArtist("Chitãozinho & Xororó")
          .build(),
      );
    }
    await requestRepo.insert(
      Request.fake()
        .aRequest()
        .withMusicianId(musician.musician_id)
        .withSongTitle("Trem-Bala")
        .withArtist("Ana Vilela")
        .build(),
    );

    const output = await useCase.execute({ musician_id: musician.musician_id.id });

    expect(output.top_requested_songs[0]).toEqual({
      song_title: "Evidências",
      artist: "Chitãozinho & Xororó",
      count: 3,
    });
    expect(output.top_requested_songs.length).toBeLessThanOrEqual(5);
  });
});
