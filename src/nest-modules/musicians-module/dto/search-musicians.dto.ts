import { ListMusiciansInput } from "../../../core/musician/application/use-cases/list-musicians/list-musicians.use-case";
import { MusicianFilter } from "../../../core/musician/domain/musician.repository";
import { SortDirection } from "../../../core/shared/domain/repository/search-params";

export class SearchMusiciansDto implements ListMusiciansInput {
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  filter?: MusicianFilter | null;
}
