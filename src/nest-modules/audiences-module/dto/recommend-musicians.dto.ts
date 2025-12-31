import { RecommendMusiciansInput } from "../../../core/audience/application/use-cases/recommend-musicians/recommend-musicians.input";
import { SortDirection } from "../../../core/shared/domain/repository/search-params";

export class RecommendMusiciansDto implements Omit<
  RecommendMusiciansInput,
  "audience_id"
> {
  page?: number;
  per_page?: number;
  sort?: "rating" | "created_at";
  sort_dir?: SortDirection | null;
  only_active?: boolean;
}
