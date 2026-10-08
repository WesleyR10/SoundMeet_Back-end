import { AggregateRoot, Uuid } from "../../shared/domain";
import { EntityValidationError } from "../../shared/domain/validators/validation.error";
import { ReviewValidatorFactory } from "./review.validator";
import { ReviewFakeBuilder } from "./review-fake.builder";
import {
  ReviewAuthorType,
  ReviewContextType,
  ReviewTargetType,
} from "./review-types";

// Reexporta para não quebrar quem já importa os tipos do agregado.
export * from "./review-types";

export type ReviewConstructorProps = {
  review_id?: ReviewId;
  target_type: ReviewTargetType;
  target_id: string;
  author_type: ReviewAuthorType;
  author_id: string;
  rating: number;
  comment?: string | null;
  context_type: ReviewContextType;
  context_id: string;
  created_at?: Date;
  updated_at?: Date;
};

export type ReviewCreateCommand = {
  target_type: ReviewTargetType;
  target_id: string;
  author_type: ReviewAuthorType;
  author_id: string;
  rating: number;
  comment?: string | null;
  context_type: ReviewContextType;
  context_id: string;
};

export class ReviewId extends Uuid {}

/**
 * Avaliação como **ledger**, não como contador.
 *
 * `Musician.rating`/`total_ratings` e `Establishment.rating`/`total_ratings`
 * são médias incrementais — não guardam quem avaliou, então sozinhas não
 * permitem impedir que a mesma pessoa avalie cem vezes, nem listar
 * comentários, nem recalcular a média se uma avaliação for removida.
 *
 * Este agregado é a fonte de verdade; aqueles campos passam a ser a
 * **projeção**. É o mesmo par que o projeto já usa em gamificação
 * (`UserScore` ledger / `UserPoints` projeção).
 *
 * Toda avaliação carrega o **contexto que prova o encontro**
 * (`context_type`/`context_id`): sem evento assistido ou show concluído não há
 * o que avaliar. É isso que torna rating farming inviável — não uma heurística
 * de frequência.
 *
 * ⚠️ **`rating` é `number` (inteiro 1–5), não o VO `Rating`.** O VO existe para
 * *médias* — aceita `0` e uma casa decimal —, então não protegeria a nota de
 * entrada. O precedente correto no schema é `RequestFeedback.rating Int // 1-5`.
 * A faixa é garantida por `ReviewRules`.
 */
export class Review extends AggregateRoot {
  review_id: ReviewId;
  target_type: ReviewTargetType;
  target_id: string;
  author_type: ReviewAuthorType;
  author_id: string;
  rating: number;
  comment: string | null;
  context_type: ReviewContextType;
  context_id: string;
  created_at: Date;
  updated_at: Date;

  constructor(props: ReviewConstructorProps) {
    super();
    this.review_id = props.review_id ?? new ReviewId();
    this.target_type = props.target_type;
    this.target_id = props.target_id;
    this.author_type = props.author_type;
    this.author_id = props.author_id;
    this.rating = props.rating;
    this.comment = props.comment ?? null;
    this.context_type = props.context_type;
    this.context_id = props.context_id;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): ReviewId {
    return this.review_id;
  }

  static create(command: ReviewCreateCommand): Review {
    const review = new Review({
      target_type: command.target_type,
      target_id: command.target_id,
      author_type: command.author_type,
      author_id: command.author_id,
      rating: command.rating,
      comment: command.comment ?? null,
      context_type: command.context_type,
      context_id: command.context_id,
    });

    // Avaliar a si mesmo não é avaliação — é autopromoção. Vale para o músico
    // que também é dono do bar (multi-role é suportado desde o Bloco 4E.14).
    if (review.author_id === review.target_id) {
      review.notification.setError(
        "Não é possível avaliar a si mesmo",
        "author_id",
      );
    }

    review.validate();

    if (review.notification.hasErrors()) {
      throw new EntityValidationError(review.notification.toJSON());
    }

    return review;
  }

  validate(fields?: string[]): void {
    const validator = ReviewValidatorFactory.create();
    validator.validate(this.notification, this, fields);
  }

  /**
   * Reavaliar substitui a nota anterior. Não há histórico de versões de
   * propósito: o valor de negócio é a nota vigente daquele encontro, e manter
   * versões exigiria recalcular a projeção com regras de qual versão conta.
   */
  changeRating(value: number, comment?: string | null): void {
    const previous = this.rating;
    this.rating = value;
    this.validate(["rating"]);

    if (this.notification.hasErrors()) {
      this.rating = previous;
      return;
    }

    this.comment = comment === undefined ? this.comment : (comment ?? null);
    this.updated_at = new Date();
  }

  static fake(): typeof ReviewFakeBuilder {
    return ReviewFakeBuilder;
  }

  toJSON() {
    return {
      review_id: this.review_id.id,
      target_type: this.target_type,
      target_id: this.target_id,
      author_type: this.author_type,
      author_id: this.author_id,
      rating: this.rating,
      comment: this.comment,
      context_type: this.context_type,
      context_id: this.context_id,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
