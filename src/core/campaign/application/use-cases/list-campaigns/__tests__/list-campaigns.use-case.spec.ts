import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Campaign } from "../../../../domain/campaign.aggregate";
import { CampaignInMemoryRepository } from "../../../../infra/db/in-memory/campaign-in-memory.repository";
import { ListCampaignsUseCase } from "../list-campaigns.use-case";

describe("ListCampaignsUseCase Unit Tests", () => {
  let useCase: ListCampaignsUseCase;
  let repo: CampaignInMemoryRepository;

  beforeEach(() => {
    repo = new CampaignInMemoryRepository();
    useCase = new ListCampaignsUseCase(repo);
  });

  const buildCampaign = (establishment_id: string, title: string) =>
    Campaign.create({
      establishment_id,
      title,
      start_date: new Date("2026-08-01"),
      end_date: new Date("2026-08-31"),
    });

  it("should force the filter to the caller's establishment, ignoring a different requested establishment_id", async () => {
    const ownEstablishmentId = new Uuid().id;
    const otherEstablishmentId = new Uuid().id;

    await repo.insert(buildCampaign(ownEstablishmentId, "Minha campanha"));
    await repo.insert(buildCampaign(otherEstablishmentId, "Campanha alheia"));

    const output = await useCase.execute({
      requesting_establishment_id: ownEstablishmentId,
      // Tenta ler campanhas de outro estabelecimento — deve ser ignorado.
      establishment_id: otherEstablishmentId,
    });

    expect(output.items).toHaveLength(1);
    expect(output.items[0].title).toBe("Minha campanha");
  });

  it("should respect the explicit filter for admin callers", async () => {
    const establishment_id = new Uuid().id;
    await repo.insert(buildCampaign(establishment_id, "Campanha X"));
    await repo.insert(buildCampaign(new Uuid().id, "Campanha Y"));

    const output = await useCase.execute({
      establishment_id,
      is_admin: true,
    });

    expect(output.items).toHaveLength(1);
    expect(output.items[0].title).toBe("Campanha X");
  });
});
