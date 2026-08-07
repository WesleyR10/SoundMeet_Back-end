import { ApiProperty } from "@nestjs/swagger";

import { ReviewOutput } from "../../core/review/application/use-cases/common/review-output";
import { PaginationOutput } from "../../core/shared/application/pagination-output";
import { CollectionPresenter } from "../shared-module/collection.presenter";

export class ReviewPresenter {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ example: "musician" })
  target_type: string;

  @ApiProperty({ format: "uuid" })
  target_id: string;

  @ApiProperty({ example: "audience" })
  author_type: string;

  @ApiProperty({ format: "uuid" })
  author_id: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  rating: number;

  @ApiProperty({ nullable: true })
  comment: string | null;

  @ApiProperty({ example: "event" })
  context_type: string;

  @ApiProperty({ format: "uuid" })
  context_id: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;

  constructor(output: ReviewOutput) {
    this.id = output.id;
    this.target_type = output.target_type;
    this.target_id = output.target_id;
    this.author_type = output.author_type;
    this.author_id = output.author_id;
    this.rating = output.rating;
    this.comment = output.comment;
    this.context_type = output.context_type;
    this.context_id = output.context_id;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

/** Avaliação + a média já recalculada, evitando um GET extra no cliente. */
export class SubmitReviewPresenter {
  @ApiProperty({ type: ReviewPresenter })
  review: ReviewPresenter;

  @ApiProperty({ example: { average: 4.5, total: 2 } })
  target_rating: { average: number; total: number };

  constructor(output: {
    review: ReviewOutput;
    target_rating: { average: number; total: number };
  }) {
    this.review = new ReviewPresenter(output.review);
    this.target_rating = output.target_rating;
  }
}

export class ReviewCollectionPresenter extends CollectionPresenter {
  @ApiProperty({ type: [ReviewPresenter] })
  data: ReviewPresenter[];

  constructor(output: PaginationOutput<ReviewOutput>) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new ReviewPresenter(i));
  }
}
