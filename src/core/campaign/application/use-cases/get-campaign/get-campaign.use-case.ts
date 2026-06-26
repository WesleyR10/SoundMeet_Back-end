import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Campaign, CampaignId } from "../../../domain/campaign.aggregate";
import { ICampaignRepository } from "../../../domain/campaign.repository";
import { CampaignOutput, CampaignOutputMapper } from "../common/campaign-output";

export type GetCampaignInput = { campaign_id: string };
export type GetCampaignOutput = CampaignOutput;

export class GetCampaignUseCase
  implements IUseCase<GetCampaignInput, GetCampaignOutput>
{
  constructor(private readonly campaignRepo: ICampaignRepository) {}

  async execute(input: GetCampaignInput): Promise<GetCampaignOutput> {
    const campaign = await this.campaignRepo.findById(
      new CampaignId(input.campaign_id),
    );
    if (!campaign) {
      throw new NotFoundError(input.campaign_id, Campaign);
    }
    return CampaignOutputMapper.toOutput(campaign);
  }
}
