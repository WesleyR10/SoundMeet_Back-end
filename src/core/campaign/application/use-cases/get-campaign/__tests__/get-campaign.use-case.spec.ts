import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Campaign } from "../../../../domain/campaign.aggregate";
import { CampaignInMemoryRepository } from "../../../../infra/db/in-memory/campaign-in-memory.repository";
import { GetCampaignUseCase } from "../get-campaign.use-case";

describe("GetCampaignUseCase Unit Tests", () => {
  let useCase: GetCampaignUseCase;
  let repo: CampaignInMemoryRepository;

  beforeEach(() => {
    repo = new CampaignInMemoryRepository();
    useCase = new GetCampaignUseCase(repo);
  });

  const buildCampaign = (establishment_id: string) =>
    Campaign.create({
      establishment_id,
      title: "Noite de Samba",
      start_date: new Date("2026-08-01"),
      end_date: new Date("2026-08-31"),
    });

  it("should allow the owning establishment to fetch its campaign", async () => {
    const establishment_id = new Uuid().id;
    const campaign = buildCampaign(establishment_id);
    await repo.insert(campaign);

    const output = await useCase.execute({
      campaign_id: campaign.campaign_id.id,
      requesting_establishment_id: establishment_id,
    });

    expect(output.campaign_id).toBe(campaign.campaign_id.id);
  });

  it("should throw NotFoundError when a different establishment requests it", async () => {
    const campaign = buildCampaign(new Uuid().id);
    await repo.insert(campaign);

    await expect(() =>
      useCase.execute({
        campaign_id: campaign.campaign_id.id,
        requesting_establishment_id: new Uuid().id,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("should allow admin regardless of establishment", async () => {
    const campaign = buildCampaign(new Uuid().id);
    await repo.insert(campaign);

    const output = await useCase.execute({
      campaign_id: campaign.campaign_id.id,
      requesting_establishment_id: new Uuid().id,
      is_admin: true,
    });

    expect(output.campaign_id).toBe(campaign.campaign_id.id);
  });
});
