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

export class ListBandsUseCase implements IUseCase<
  ListBandsInput,
  ListBandsOutput
> {
  constructor(private readonly bandRepo: IBandRepository) {}

  async execute(input: ListBandsInput): Promise<ListBandsOutput> {
    // "Minhas bandas" (filter.musician_id) é o próprio músico vendo bandas
    // das quais é membro aceito — visibilidade não depende do opt-in de
    // descoberta por estabelecimento, então o gate de consentimento NÃO se
    // aplica aqui (senão o músico ficaria sem ver a própria banda até o
    // líder ativar open_to_gigs). Qualquer outra busca é pública/descoberta
    // por terceiros e passa pelo gate via BandSearchParams.createPublic.
    const isSelfLookup = !!input.filter?.musician_id;
    const params = isSelfLookup
      ? BandSearchParams.create(input)
      : BandSearchParams.createPublic(input);
    const searchResult = await this.bandRepo.search(params);

    return this.toOutput(searchResult);
  }

  private toOutput(searchResult: BandSearchResult): ListBandsOutput {
    const { items: _items } = searchResult;
    const items = _items.map((item) => BandOutputMapper.toOutput(item));
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}
