import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  IPerformanceRepository,
  PerformanceSearchParams,
} from "../../../domain/performance.repository";
import {
  PerformanceOutput,
  PerformanceOutputMapper,
} from "../common/performance-output";

export type ListPerformancesInput = {
  /** Do JWT — não é filtro opcional, é o escopo. Ver a nota abaixo. */
  musician_id: string;
  establishment_id?: string | null;
  status?: string | null;
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: "asc" | "desc" | null;
};

export type ListPerformancesOutput = PaginationOutput<PerformanceOutput>;

/**
 * Histórico de shows do músico.
 *
 * 🔴 `musician_id` é **obrigatório e vem do token**, nunca da query. Sem ele o
 * `PerformanceSearchParams` montaria filtro vazio e o repositório devolveria os
 * sets de todos os músicos da plataforma — o vazamento exato que aconteceu em
 * `repertoire` em jul/2026. O override de `filter` protege contra o filtro ser
 * descartado; este campo protege contra ele nunca ter existido.
 */
export class ListPerformancesUseCase implements IUseCase<
  ListPerformancesInput,
  ListPerformancesOutput
> {
  constructor(private readonly performanceRepo: IPerformanceRepository) {}

  async execute(input: ListPerformancesInput): Promise<ListPerformancesOutput> {
    const params = PerformanceSearchParams.create({
      page: input.page,
      per_page: input.per_page,
      sort: input.sort,
      sort_dir: input.sort_dir,
      filter: {
        musician_id: input.musician_id,
        establishment_id: input.establishment_id ?? null,
        status: input.status ?? null,
      },
    });

    const searchResult = await this.performanceRepo.search(params);

    return PaginationOutputMapper.toOutput(
      searchResult.items.map((item) => PerformanceOutputMapper.toOutput(item)),
      searchResult,
    );
  }
}
