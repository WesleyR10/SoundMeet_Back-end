import { ListBandsInput } from "../../../core/musician/application/use-cases/list-bands/list-bands.input";
import { BandFilter } from "../../../core/musician/domain/band.repository";
import { SortDirection } from "../../../core/shared/domain/repository/search-params";

export class SearchBandsDto implements ListBandsInput {
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  filter?: BandFilter | null;
}
