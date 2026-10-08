import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Campaign } from "../../../../domain/campaign.aggregate";
import { CampaignInMemoryRepository } from "../../../../infra/db/in-memory/campaign-in-memory.repository";
import { DeleteCampaignUseCase } from "../delete-campaign.use-case";

describe("DeleteCampaignUseCase Unit Tests", () => {
  let useCase: DeleteCampaignUseCase;
  let repo: CampaignInMemoryRepository;

  beforeEach(() => {
    repo = new CampaignInMemoryRepository();
    useCase = new DeleteCampaignUseCase(repo);
  });

  const buildCampaign = (establishment_id: string) =>
    Campaign.create({
      establishment_id,
      title: "Noite de Samba",
      start_date: new Date("2026-08-01"),
      end_date: new Date("2026-08-31"),
    });

  it("should allow the owning establishment to delete its campaign", async () => {
    const establishment_id = new Uuid().id;
    const campaign = buildCampaign(establishment_id);
    await repo.insert(campaign);

    await useCase.execute({
      campaign_id: campaign.campaign_id.id,
      establishment_ids: [establishment_id],
    });

    expect(await repo.findById(campaign.campaign_id)).toBeNull();
  });

  it("should allow a multi-unit owner to delete a campaign from their 2nd/3rd establishment", async () => {
    const secondUnitId = new Uuid().id;
    const campaign = buildCampaign(secondUnitId);
    await repo.insert(campaign);

    await useCase.execute({
      campaign_id: campaign.campaign_id.id,
      establishment_ids: [new Uuid().id, secondUnitId],
    });

    expect(await repo.findById(campaign.campaign_id)).toBeNull();
  });

  it("should throw NotFoundError when a different establishment tries to delete it", async () => {
    const campaign = buildCampaign(new Uuid().id);
    await repo.insert(campaign);

    await expect(() =>
      useCase.execute({
        campaign_id: campaign.campaign_id.id,
        establishment_ids: [new Uuid().id],
      }),
    ).rejects.toThrow(NotFoundError);

    expect(await repo.findById(campaign.campaign_id)).not.toBeNull();
  });

  // Admin não tem establishmentIds no JWT — o controller manda [] e is_admin.
  it("should allow admin to delete any campaign", async () => {
    const campaign = buildCampaign(new Uuid().id);
    await repo.insert(campaign);

    await useCase.execute({
      campaign_id: campaign.campaign_id.id,
      establishment_ids: [],
      is_admin: true,
    });

    expect(await repo.findById(campaign.campaign_id)).toBeNull();
  });

  it("should throw NotFoundError when campaign does not exist", async () => {
    await expect(() =>
      useCase.execute({
        campaign_id: new Uuid().id,
        establishment_ids: [new Uuid().id],
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
