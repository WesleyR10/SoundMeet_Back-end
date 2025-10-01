import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { AudienceFilter } from "../../../domain/audience.repository";

export type ListAudiencesInput = {
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  filter?: AudienceFilter | null;
};
