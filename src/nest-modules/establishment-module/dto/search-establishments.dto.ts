import { SortDirection } from "../../../core/shared/domain/repository/search-params";
import { ListEstablishmentsInput } from "../../../core/establishment/application/use-cases/list-establishments/list-establishments.use-case";
import { EstablishmentFilter } from "../../../core/establishment/domain/establishment.repository";

export class SearchEstablishmentsDto implements ListEstablishmentsInput {
  page?: number;
  per_page?: number;
  sort?: string;
  sort_dir?: SortDirection;
  filter?: EstablishmentFilter;
}
