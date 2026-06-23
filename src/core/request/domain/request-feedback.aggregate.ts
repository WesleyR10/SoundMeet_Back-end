import { AggregateRoot, Uuid } from "../../shared/domain";
import { RequestFeedbackValidatorFactory } from "./request-feedback.validator";
import { RequestFeedbackFakeBuilder } from "./request-feedback-fake.builder";

export type RequestFeedbackConstructorProps = {
  request_feedback_id?: RequestFeedbackId;
  request_id: string;
  rating: number;
  comment?: string | null;
  created_at?: Date;
};

export type RequestFeedbackCreateCommand = {
  request_id: string;
  rating: number;
  comment?: string | null;
};

export class RequestFeedbackId extends Uuid {}

export class RequestFeedback extends AggregateRoot {
  request_feedback_id: RequestFeedbackId;
  request_id: Uuid;
  rating: number;
  comment: string | null;
  created_at: Date;

  constructor(props: RequestFeedbackConstructorProps) {
    super();
    this.request_feedback_id =
      props.request_feedback_id ?? new RequestFeedbackId();
    this.request_id = new Uuid(props.request_id);
    this.rating = props.rating;
    this.comment = props.comment ?? null;
    this.created_at = props.created_at ?? new Date();
  }

  get entity_id(): RequestFeedbackId {
    return this.request_feedback_id;
  }

  static create(command: RequestFeedbackCreateCommand): RequestFeedback {
    const feedback = new RequestFeedback(command);
    feedback.validate(["request_id", "rating", "comment"]);
    return feedback;
  }

  changeRating(rating: number): void {
    this.rating = rating;
    this.validate(["rating"]);
  }

  changeComment(comment: string | null): void {
    this.comment = comment;
    this.validate(["comment"]);
  }

  get hasComment(): boolean {
    return this.comment !== null && this.comment.trim().length > 0;
  }

  get isPositive(): boolean {
    return this.rating >= 4;
  }

  get isNeutral(): boolean {
    return this.rating === 3;
  }

  get isNegative(): boolean {
    return this.rating <= 2;
  }

  validate(fields?: string[]) {
    const validator = RequestFeedbackValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return RequestFeedbackFakeBuilder;
  }

  toJSON() {
    return {
      request_feedback_id: this.request_feedback_id.id,
      request_id: this.request_id.id,
      rating: this.rating,
      comment: this.comment,
      created_at: this.created_at,
      has_comment: this.hasComment,
      is_positive: this.isPositive,
      is_neutral: this.isNeutral,
      is_negative: this.isNegative,
    };
  }
}
