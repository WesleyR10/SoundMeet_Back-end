import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Campaign, CampaignId } from "../../../domain/campaign.aggregate";
import { ICampaignRepository } from "../../../domain/campaign.repository";
import { CampaignOutput, CampaignOutputMapper } from "../common/campaign-output";

export type GetCampaignInput = {
  campaign_id: string;
  // Estabelecimento autenticado (undefined = chamada interna/admin, sem
  // restrição — mesmo convênio de get-request.use-case.ts). `:id` na rota é
  // o campaign_id, não o establishment_id, então EstablishmentOwnershipGuard
  // não se aplica aqui — a checagem é feita neste use-case, como já é feito
  // em delete-campaign.use-case.ts.
  requesting_establishment_id?: string;
  is_admin?: boolean;
};
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

    if (
      !input.is_admin &&
      input.requesting_establishment_id &&
      campaign.establishment_id !== input.requesting_establishment_id
    ) {
      // NotFoundError (não Forbidden) — mesma escolha de
      // delete-campaign.use-case.ts, evita confirmar a existência do
      // campaign_id para quem não é dono.
      throw new NotFoundError(input.campaign_id, Campaign);
    }

    return CampaignOutputMapper.toOutput(campaign);
  }
}
