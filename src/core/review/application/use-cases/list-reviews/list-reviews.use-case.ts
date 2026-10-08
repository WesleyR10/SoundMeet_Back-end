import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { ReviewTargetType } from "../../../domain/review.aggregate";
import {
  IReviewRepository,
  ReviewSearchParams,
} from "../../../domain/review.repository";
import { ReviewOutput, ReviewOutputMapper } from "../common/review-output";

export type ListReviewsInput = {
  target_type: ReviewTargetType;
  target_id: string;
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: "asc" | "desc" | null;
  /** Só as que têm texto — a vitrine de comentários do perfil. */
  has_comment?: boolean | null;
};

export type ListReviewsOutput = PaginationOutput<ReviewOutput>;

/**
 * Avaliações recebidas por um alvo.
 *
 * `target_type`/`target_id` vêm da ROTA (`/musicians/:id/ratings`), não da
 * query: a listagem é sempre de um perfil específico. Sem isso o endpoint
 * viraria um dump do ledger inteiro.
 */
export class ListReviewsUseCase implements IUseCase<
  ListReviewsInput,
  ListReviewsOutput
> {
  constructor(private readonly reviewRepo: IReviewRepository) {}

  async execute(input: ListReviewsInput): Promise<ListReviewsOutput> {
    const params = ReviewSearchParams.create({
      page: input.page,
      per_page: input.per_page,
      sort: input.sort,
      sort_dir: input.sort_dir,
      filter: {
        target_type: input.target_type,
        target_id: input.target_id,
        has_comment: input.has_comment ?? null,
      },
    });

    const result = await this.reviewRepo.search(params);

    return PaginationOutputMapper.toOutput(
      result.items.map(ReviewOutputMapper.toOutput),
      result,
    );
  }
}
