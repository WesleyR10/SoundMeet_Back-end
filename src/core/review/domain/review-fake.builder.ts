import { Chance } from "chance";

import { Review, ReviewId } from "./review.aggregate";
import {
  ReviewAuthorType,
  ReviewContextType,
  ReviewTargetType,
} from "./review-types";

type PropOrFactory<T> = T | ((index: number) => T);

export class ReviewFakeBuilder<TBuild = any> {
  private _review_id: PropOrFactory<ReviewId | undefined> = undefined;
  private _target_type: PropOrFactory<ReviewTargetType> = "musician";
  private _target_id: PropOrFactory<string> = () =>
    this.chance.guid({ version: 4 });
  private _author_type: PropOrFactory<ReviewAuthorType> = "audience";
  private _author_id: PropOrFactory<string> = () =>
    this.chance.guid({ version: 4 });
  private _rating: PropOrFactory<number> = () =>
    this.chance.integer({ min: 1, max: 5 });
  private _comment: PropOrFactory<string | null> = null;
  private _context_type: PropOrFactory<ReviewContextType> = "event";
  private _context_id: PropOrFactory<string> = () =>
    this.chance.guid({ version: 4 });
  private _count: number;
  private chance: Chance.Chance;
  private countObjs: number;

  static aReview() {
    return new ReviewFakeBuilder<Review>();
  }

  static theReviews(count: number) {
    return new ReviewFakeBuilder<Review[]>(count);
  }

  private constructor(count: number = 1) {
    this._count = count;
    this.countObjs = count;
    this.chance = new Chance();
  }

  withReviewId(value: PropOrFactory<ReviewId>) {
    this._review_id = value;
    return this;
  }

  withTargetType(value: PropOrFactory<ReviewTargetType>) {
    this._target_type = value;
    return this;
  }

  withTargetId(value: PropOrFactory<string>) {
    this._target_id = value;
    return this;
  }

  withAuthorType(value: PropOrFactory<ReviewAuthorType>) {
    this._author_type = value;
    return this;
  }

  withAuthorId(value: PropOrFactory<string>) {
    this._author_id = value;
    return this;
  }

  withRating(value: PropOrFactory<number>) {
    this._rating = value;
    return this;
  }

  withComment(value: PropOrFactory<string | null>) {
    this._comment = value;
    return this;
  }

  withContextType(value: PropOrFactory<ReviewContextType>) {
    this._context_type = value;
    return this;
  }

  withContextId(value: PropOrFactory<string>) {
    this._context_id = value;
    return this;
  }

  /** Atalho para o par músico↔estabelecimento, cujo contexto é o booking. */
  fromBooking(bookingId: PropOrFactory<string>) {
    this._context_type = "booking";
    this._context_id = bookingId;
    return this;
  }

  build(): TBuild {
    const reviews = new Array(this.countObjs).fill(undefined).map(
      (_, i) =>
        new Review({
          review_id: this._call(this._review_id, i),
          target_type: this._call(this._target_type, i),
          target_id: this._call(this._target_id, i),
          author_type: this._call(this._author_type, i),
          author_id: this._call(this._author_id, i),
          rating: this._call(this._rating, i),
          comment: this._call(this._comment, i),
          context_type: this._call(this._context_type, i),
          context_id: this._call(this._context_id, i),
        }),
    );
    return (this.countObjs === 1 ? reviews[0] : reviews) as TBuild;
  }

  private _call<T>(prop: PropOrFactory<T>, index: number): T {
    return typeof prop === "function"
      ? (prop as (index: number) => T)(index)
      : prop;
  }
}
