import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import {
  CampaignSearchParams,
} from "../../../domain/campaign.repository";
import { ICampaignRepository } from "../../../domain/campaign.repository";
import { CampaignOutput, CampaignOutputMapper } from "../common/campaign-output";

export type ListCampaignsInput = {
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: "asc" | "desc" | null;
  establishment_id?: string | null;
  status?: string | null;
  title?: string | null;
};

export type ListCampaignsOutput = PaginationOutput<CampaignOutput>;

export class ListCampaignsUseCase
  implements IUseCase<ListCampaignsInput, ListCampaignsOutput>
{
  constructor(private readonly campaignRepo: ICampaignRepository) {}

  async execute(input: ListCampaignsInput): Promise<ListCampaignsOutput> {
    const params = CampaignSearchParams.create({
      page: input.page,
      per_page: input.per_page,
      sort: input.sort,
      sort_dir: input.sort_dir,
      filter: {
        establishment_id: input.establishment_id ?? null,
        status: input.status ?? null,
        title: input.title ?? null,
      },
    });

    const result = await this.campaignRepo.search(params);

    return PaginationOutputMapper.toOutput(
      result.items.map(CampaignOutputMapper.toOutput),
      result,
    );
  }
}
