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
  // Estabelecimento autenticado — quando presente e não-admin, força o
  // filtro pro próprio estabelecimento, ignorando qualquer establishment_id
  // que o cliente tenha pedido (evita listar campanhas de outro
  // estabelecimento). Ausente = chamada interna/admin, sem restrição.
  requesting_establishment_id?: string;
  is_admin?: boolean;
};

export type ListCampaignsOutput = PaginationOutput<CampaignOutput>;

export class ListCampaignsUseCase
  implements IUseCase<ListCampaignsInput, ListCampaignsOutput>
{
  constructor(private readonly campaignRepo: ICampaignRepository) {}

  async execute(input: ListCampaignsInput): Promise<ListCampaignsOutput> {
    const establishment_id =
      !input.is_admin && input.requesting_establishment_id
        ? input.requesting_establishment_id
        : (input.establishment_id ?? null);

    const params = CampaignSearchParams.create({
      page: input.page,
      per_page: input.per_page,
      sort: input.sort,
      sort_dir: input.sort_dir,
      filter: {
        establishment_id,
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
