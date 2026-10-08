import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  BandSearchParams,
  BandSearchResult,
  IBandRepository,
} from "../../../domain/band.repository";
import { BandOutput, BandOutputMapper } from "../common/band-output";
import { ListBandsInput } from "./list-bands.input";

export type ListBandsOutput = PaginationOutput<BandOutput>;

/**
 * A busca PÚBLICA de bandas — descoberta por quem contrata.
 *
 * 🔴 Sempre passa por `BandSearchParams.createPublic` (no radar E ativa), sem
 * exceção. Até out/2026 havia uma: `filter.musician_id` ("minhas bandas")
 * pulava o gate, porque o músico precisa ver a própria banda mesmo fora do
 * radar. Só que a rota é anônima e o filtro era de qualquer um — passando o id
 * de um integrante, vinham as bandas dele que o líder NÃO tinha posto na
 * busca. "Minhas bandas" hoje é `ListMyBandsUseCase`, autenticada, com o id
 * tirado do token.
 */
export class ListBandsUseCase implements IUseCase<
  ListBandsInput,
  ListBandsOutput
> {
  constructor(private readonly bandRepo: IBandRepository) {}

  async execute(input: ListBandsInput): Promise<ListBandsOutput> {
    const searchResult = await this.bandRepo.search(
      BandSearchParams.createPublic(input),
    );

    return this.toOutput(searchResult);
  }

  private toOutput(searchResult: BandSearchResult): ListBandsOutput {
    const { items: _items } = searchResult;
    const items = _items.map((item) => BandOutputMapper.toOutput(item));
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}
