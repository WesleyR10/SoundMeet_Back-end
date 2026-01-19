import { ListEstablishmentsInput } from "../../../core/establishment/application/use-cases/list-establishments/list-establishments.use-case";
import { EstablishmentFilter } from "../../../core/establishment/domain/establishment.repository";
import { SortDirection } from "../../../core/shared/domain/repository/search-params";

export class SearchEstablishmentsDto implements ListEstablishmentsInput {
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  filter?: EstablishmentFilter | null;
}
