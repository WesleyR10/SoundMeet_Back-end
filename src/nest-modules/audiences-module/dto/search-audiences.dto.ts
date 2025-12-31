import { ListAudiencesInput } from "../../../core/audience/application/use-cases/list-audiences/list-audiences.input";
import { AudienceFilter } from "../../../core/audience/domain/audience.repository";
import { SortDirection } from "../../../core/shared/domain/repository/search-params";

export class SearchAudiencesDto implements ListAudiencesInput {
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  filter?: AudienceFilter | null;
}
