import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Campaign, CampaignId } from "../../../domain/campaign.aggregate";
import { ICampaignRepository } from "../../../domain/campaign.repository";

export type DeleteCampaignInput = {
  campaign_id: string;
  // Todas as unidades do estabelecimento autenticado — um dono com 2ª/3ª
  // unidade (registerEstablishment permite até 3) não conseguia apagar a
  // própria campanha comparando só a 1ª unidade.
  establishment_ids: string[];
  is_admin?: boolean;
};

export class DeleteCampaignUseCase implements IUseCase<
  DeleteCampaignInput,
  void
> {
  constructor(private readonly campaignRepo: ICampaignRepository) {}

  async execute(input: DeleteCampaignInput): Promise<void> {
    const campaignId = new CampaignId(input.campaign_id);
    const campaign = await this.campaignRepo.findById(campaignId);

    if (!campaign) {
      throw new NotFoundError(input.campaign_id, Campaign);
    }

    if (
      !input.is_admin &&
      !input.establishment_ids.includes(campaign.establishment_id)
    ) {
      throw new NotFoundError(input.campaign_id, Campaign);
    }

    await this.campaignRepo.delete(campaignId);
  }
}
