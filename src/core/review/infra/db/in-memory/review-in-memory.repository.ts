import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  Review,
  ReviewAuthorType,
  ReviewId,
  ReviewTargetType,
} from "../../../domain/review.aggregate";
import {
  IReviewRepository,
  ReviewFilter,
  ReviewSearchParams,
  ReviewSearchResult,
} from "../../../domain/review.repository";

export class ReviewInMemoryRepository
  extends InMemorySearchableRepository<Review, ReviewId, ReviewFilter>
  implements IReviewRepository
{
  sortableFields: string[] = ["rating", "created_at"];

  getEntity(): new (...args: any[]) => Review {
    return Review;
  }

  async findByAuthorAndContext(params: {
    target_type: ReviewTargetType;
    target_id: string;
    author_id: string;
    context_id: string;
  }): Promise<Review | null> {
    return (
      this.items.find(
        (r) =>
          r.target_type === params.target_type &&
          r.target_id === params.target_id &&
          r.author_id === params.author_id &&
          r.context_id === params.context_id,
      ) ?? null
    );
  }

  async aggregateForTarget(params: {
    target_type: ReviewTargetType;
    target_id: string;
  }): Promise<{ average: number; total: number }> {
    const items = this.items.filter(
      (r) =>
        r.target_type === params.target_type &&
        r.target_id === params.target_id,
    );

    if (items.length === 0) {
      return { average: 0, total: 0 };
    }

    const sum = items.reduce((acc, r) => acc + r.rating, 0);
    // Uma casa decimal — é o que o VO Rating aceita e o que a projeção guarda.
    return {
      average: Math.round((sum / items.length) * 10) / 10,
      total: items.length,
    };
  }

  async aggregateForTargetByAuthor(params: {
    target_type: ReviewTargetType;
    target_id: string;
  }): Promise<
    Partial<Record<ReviewAuthorType, { average: number; total: number }>>
  > {
    const items = this.items.filter(
      (r) =>
        r.target_type === params.target_type &&
        r.target_id === params.target_id,
    );

    const sums = new Map<ReviewAuthorType, { sum: number; count: number }>();
    for (const review of items) {
      const bucket = sums.get(review.author_type) ?? { sum: 0, count: 0 };
      bucket.sum += review.rating;
      bucket.count += 1;
      sums.set(review.author_type, bucket);
    }

    const result: Partial<
      Record<ReviewAuthorType, { average: number; total: number }>
    > = {};
    // Só os tipos PRESENTES entram — um tipo sem avaliação nenhuma ficaria
    // com média 0, que lê como "avaliado mal" em vez de "não avaliado".
    for (const [authorType, { sum, count }] of sums) {
      result[authorType] = {
        average: Math.round((sum / count) * 10) / 10,
        total: count,
      };
    }

    return result;
  }

  async search(props: ReviewSearchParams): Promise<ReviewSearchResult> {
    const result = await super.search(props);
    return new ReviewSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: Review[],
    filter: ReviewFilter | null,
  ): Promise<Review[]> {
    if (!filter) return items;

    return items.filter((r) => {
      const byTargetType = filter.target_type
        ? r.target_type === filter.target_type
        : true;
      const byTargetId = filter.target_id
        ? r.target_id === filter.target_id
        : true;
      const byAuthorType = filter.author_type
        ? r.author_type === filter.author_type
        : true;
      const byAuthorId = filter.author_id
        ? r.author_id === filter.author_id
        : true;
      const byContextType = filter.context_type
        ? r.context_type === filter.context_type
        : true;
      const byContextId = filter.context_id
        ? r.context_id === filter.context_id
        : true;
      const byHasComment =
        typeof filter.has_comment === "boolean"
          ? filter.has_comment
            ? !!r.comment && r.comment.trim().length > 0
            : !r.comment || r.comment.trim().length === 0
          : true;

      return (
        byTargetType &&
        byTargetId &&
        byAuthorType &&
        byAuthorId &&
        byContextType &&
        byContextId &&
        byHasComment
      );
    });
  }

  protected applySort(
    items: Review[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ): Review[] {
    // Perfil mostra a avaliação mais recente primeiro — é o que o visitante
    // espera ver, e o que o dashboard usa para reagir ao feedback novo.
    return sort
      ? super.applySort(items, sort, sort_dir)
      : super.applySort(items, "created_at", "desc");
  }
}
