import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IDateTimeService } from "../../../../shared/domain/date-time.service";
import { SortDirection } from "../../../../shared/domain/repository/search-params";
import {
  EstablishmentFilter,
  EstablishmentSearchParams,
  IEstablishmentRepository,
} from "../../../domain/establishment.repository";
import {
  EstablishmentOutput,
  EstablishmentOutputMapper,
} from "../common/establishment-output";

export class ListEstablishmentsUseCase implements IUseCase<
  ListEstablishmentsInput,
  ListEstablishmentsOutput
> {
  constructor(
    private readonly establishmentRepo: IEstablishmentRepository,
    private readonly dateTimeService?: IDateTimeService,
  ) {}

  async execute(
    input: ListEstablishmentsInput,
  ): Promise<ListEstablishmentsOutput> {
    const params = EstablishmentSearchParams.create(input);
    const searchResult = await this.establishmentRepo.search(params);

    return this.toOutput(searchResult);
  }

  private toOutput(searchResult: any): ListEstablishmentsOutput {
    const { items: _items } = searchResult;
    const items = _items.map((i) => {
      return EstablishmentOutputMapper.toOutput(i, this.dateTimeService);
    });
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}

export type ListEstablishmentsInput = {
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  filter?: EstablishmentFilter | null;
};

export type ListEstablishmentsOutput = PaginationOutput<EstablishmentOutput>;
