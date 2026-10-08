import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import {
  Review,
  ReviewAuthorType,
  ReviewContextType,
  ReviewId,
  ReviewTargetType,
} from "../../../domain/review.aggregate";

export type ReviewModel = {
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

export class ReviewModelMapper {
  static toModel(entity: Review): ReviewModel {
    return {
      id: entity.review_id.id,
      target_type: entity.target_type,
      target_id: entity.target_id,
      author_type: entity.author_type,
      author_id: entity.author_id,
      rating: entity.rating,
      comment: entity.comment,
      context_type: entity.context_type,
      context_id: entity.context_id,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: ReviewModel): Review {
    const review = new Review({
      review_id: new ReviewId(model.id),
      target_type: model.target_type as ReviewTargetType,
      target_id: model.target_id,
      author_type: model.author_type as ReviewAuthorType,
      author_id: model.author_id,
      rating: model.rating,
      comment: model.comment,
      context_type: model.context_type as ReviewContextType,
      context_id: model.context_id,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });

    // As colunas polimórficas são String (sem enum no banco, por serem
    // escopo de produto em evolução), então uma linha corrompida só é
    // detectada aqui — falhar na carga é melhor que propagar lixo.
    review.validate();
    if (review.notification.hasErrors()) {
      throw new LoadEntityError(review.notification.toJSON());
    }

    return review;
  }
}
