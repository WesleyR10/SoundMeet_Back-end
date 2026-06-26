import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { ICampaignRepository } from "../../../domain/campaign.repository";
import { Campaign } from "../../../domain/campaign.aggregate";
import { CampaignOutput, CampaignOutputMapper } from "../common/campaign-output";

export type CreateCampaignInput = {
  establishment_id: string;
  title: string;
  description?: string | null;
  start_date: Date;
  end_date: Date;
  target_genres?: string[];
};

export type CreateCampaignOutput = CampaignOutput;

export class CreateCampaignUseCase
  implements IUseCase<CreateCampaignInput, CreateCampaignOutput>
{
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly planCheckService: PlanCheckService,
  ) {}

  async execute(input: CreateCampaignInput): Promise<CreateCampaignOutput> {
    await this.planCheckService.assertEstablishmentFeature(
      input.establishment_id,
      "promotional_campaigns",
    );

    const campaign = Campaign.create({
      establishment_id: input.establishment_id,
      title: input.title,
      description: input.description ?? null,
      start_date: input.start_date,
      end_date: input.end_date,
      target_genres: input.target_genres ?? [],
    });

    await this.campaignRepo.insert(campaign);

    return CampaignOutputMapper.toOutput(campaign);
  }
}
