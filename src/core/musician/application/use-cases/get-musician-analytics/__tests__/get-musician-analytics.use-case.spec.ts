import { MusicianPlanTier } from "../../../../../plans/domain/plan-tier.enum";
import {
  Subscription,
  SubscriptionStatus,
} from "../../../../../plans/domain/subscription.aggregate";
import { PlanCheckService } from "../../../../../plans/domain/plan-check.service";
import { SubscriptionInMemoryRepository } from "../../../../../plans/infra/db/in-memory/subscription-in-memory.repository";
import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { GetMusicianAnalyticsUseCase } from "../get-musician-analytics.use-case";

async function setup(tier?: MusicianPlanTier) {
  const musicianRepo = new MusicianInMemoryRepository();
  const subRepo = new SubscriptionInMemoryRepository();

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
  const useCase = new GetMusicianAnalyticsUseCase(musicianRepo, planCheckService);

  return { useCase, musician };
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
