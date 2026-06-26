import { PlanLimitExceededError } from "../../../../../plans/domain/errors/plan-limit-exceeded.error";
import { EstablishmentPlanTier } from "../../../../../plans/domain/plan-tier.enum";
import {
  Subscription,
  SubscriptionStatus,
} from "../../../../../plans/domain/subscription.aggregate";
import { PlanCheckService } from "../../../../../plans/domain/plan-check.service";
import { SubscriptionInMemoryRepository } from "../../../../../plans/infra/db/in-memory/subscription-in-memory.repository";
import { CampaignInMemoryRepository } from "../../../../infra/db/in-memory/campaign-in-memory.repository";
import { CreateCampaignUseCase } from "../create-campaign.use-case";

const ESTABLISHMENT_ID = "00000000-0000-0000-0000-000000000099";

function makeEstablishmentSub(
  tier: EstablishmentPlanTier,
  status = SubscriptionStatus.ACTIVE,
) {
  return new Subscription({
    establishment_id: ESTABLISHMENT_ID,
    plan_tier: tier,
    persona: "establishment",
    status,
  });
}

const baseInput = {
  establishment_id: ESTABLISHMENT_ID,
  title: "Noite de Samba",
  start_date: new Date("2026-07-01"),
  end_date: new Date("2026-07-31"),
};

async function setup(
  tier?: EstablishmentPlanTier,
  cancelled = false,
) {
  const subRepo = new SubscriptionInMemoryRepository();
  const campaignRepo = new CampaignInMemoryRepository();

  if (tier) {
    const sub = makeEstablishmentSub(
      tier,
      cancelled ? SubscriptionStatus.CANCELLED : SubscriptionStatus.ACTIVE,
    );
    await subRepo.insert(sub);
  }

  const planCheckService = new PlanCheckService(subRepo);
  const useCase = new CreateCampaignUseCase(campaignRepo, planCheckService);

  return { useCase };
}

describe("CreateCampaignUseCase — gate 4C.10", () => {
  it("(a) FREE: lança PlanLimitExceededError ao tentar criar campanha", async () => {
    const { useCase } = await setup();
    await expect(useCase.execute(baseInput)).rejects.toThrow(PlanLimitExceededError);
  });

  it("(b) GROWTH: cria campanha com sucesso", async () => {
    const { useCase } = await setup(EstablishmentPlanTier.GROWTH);
    const output = await useCase.execute(baseInput);
    expect(output.campaign_id).toBeDefined();
    expect(output.title).toBe("Noite de Samba");
    expect(output.status).toBe("draft");
  });

  it("(b) PRO: cria campanha com sucesso", async () => {
    const { useCase } = await setup(EstablishmentPlanTier.PRO);
    const output = await useCase.execute(baseInput);
    expect(output.campaign_id).toBeDefined();
  });

  it("(c) subscription cancelada comporta-se como FREE", async () => {
    const { useCase } = await setup(EstablishmentPlanTier.GROWTH, true);
    await expect(useCase.execute(baseInput)).rejects.toThrow(PlanLimitExceededError);
  });
});
