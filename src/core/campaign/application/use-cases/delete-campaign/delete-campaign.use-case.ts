import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Campaign, CampaignId } from "../../../domain/campaign.aggregate";
import { ICampaignRepository } from "../../../domain/campaign.repository";

export type DeleteCampaignInput = {
  campaign_id: string;
  establishment_id: string;
};

export class DeleteCampaignUseCase
  implements IUseCase<DeleteCampaignInput, void>
{
  constructor(private readonly campaignRepo: ICampaignRepository) {}

  async execute(input: DeleteCampaignInput): Promise<void> {
    const campaignId = new CampaignId(input.campaign_id);
    const campaign = await this.campaignRepo.findById(campaignId);

    if (!campaign) {
      throw new NotFoundError(input.campaign_id, Campaign);
    }

    if (campaign.establishment_id !== input.establishment_id) {
      throw new NotFoundError(input.campaign_id, Campaign);
    }

    await this.campaignRepo.delete(campaignId);
  }
}
