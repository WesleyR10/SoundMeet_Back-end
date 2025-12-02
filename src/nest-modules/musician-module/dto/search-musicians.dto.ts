import { ListMusiciansInput } from "../../../core/musician/application/use-cases/list-musicians/list-musicians.use-case";
import { SortDirection } from "../../../core/shared/domain/repository/search-params";

export class SearchMusiciansDto implements ListMusiciansInput {
  page?: number;
  per_page?: number;
  sort?: string;
  sort_dir?: SortDirection;
  filter?: string;
}
