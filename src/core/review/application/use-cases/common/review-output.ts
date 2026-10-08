import { Review } from "../../../domain/review.aggregate";

export type ReviewOutput = {
  id: string;
  target_type: string;
  target_id: string;
  author_type: string;
  author_id: string;
  rating: number;
  comment: string | null;
  context_type: string;
  context_id: string;
  created_at: Date;
  updated_at: Date;
};

export class ReviewOutputMapper {
  static toOutput(entity: Review): ReviewOutput {
    const { review_id, ...rest } = entity.toJSON();
    return { id: review_id, ...rest };
  }
}

/** Projeção do alvo depois da avaliação — evita um GET extra no cliente. */
export type TargetRatingOutput = {
  average: number;
  total: number;
};
