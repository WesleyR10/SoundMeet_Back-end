import { IUseCase } from "../../../../shared/application/use-case.interface";
import { SortDirection } from "../../../../shared/domain/repository/search-params";
import {
  IIndicationRepository,
  IndicationSearchParams,
} from "../../../domain/indication.repository";
import { IndicationStatus } from "../../../domain/indication-types";
import {
  IndicationOutput,
  IndicationOutputMapper,
} from "../common/indication-output";

export type ListEstablishmentIndicationsInput = {
  /**
   * 🔴 Vem SEMPRE do escopo do dono (path + ownership guard), nunca de query.
   * É o filtro que impede a caixa de entrada de um estabelecimento de devolver
   * as indicações de outro.
   */
  establishment_id: string;
  status?: IndicationStatus;
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
};

export type ListEstablishmentIndicationsOutput = {
  items: IndicationOutput[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
  /** Badge da caixa: quantas ainda não foram vistas. */
  new_count: number;
};

/** Caixa de indicações do estabelecimento — a metade B2B que nunca existiu. */
export class ListEstablishmentIndicationsUseCase implements IUseCase<
  ListEstablishmentIndicationsInput,
  ListEstablishmentIndicationsOutput
> {
  constructor(private readonly indicationRepo: IIndicationRepository) {}

  async execute(
    input: ListEstablishmentIndicationsInput,
  ): Promise<ListEstablishmentIndicationsOutput> {
    const params = IndicationSearchParams.create({
      page: input.page,
      per_page: input.per_page,
      sort: input.sort,
      sort_dir: input.sort_dir,
      filter: {
        // O escopo do dono é montado AQUI, depois de qualquer entrada do
        // cliente, para que nenhum filtro vindo de fora possa sobrescrevê-lo.
        ...(input.status ? { status: input.status } : {}),
        establishment_id: input.establishment_id,
      },
    });

    const [result, newCount] = await Promise.all([
      this.indicationRepo.search(params),
      this.indicationRepo.countNewByEstablishment(input.establishment_id),
    ]);

    return {
      items: result.items.map(IndicationOutputMapper.toOutput),
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
      last_page: result.last_page,
      new_count: newCount,
    };
  }
}
