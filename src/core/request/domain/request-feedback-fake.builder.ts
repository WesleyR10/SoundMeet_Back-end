import { Chance } from "chance";
import { v4 as uuidv4 } from "uuid";

import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import {
  RequestFeedback,
  RequestFeedbackId,
} from "./request-feedback.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

export class RequestFeedbackFakeBuilder<TBuild = any> {
  private _request_feedback_id: PropOrFactory<RequestFeedbackId> | undefined =
    undefined;
  private _request_id: PropOrFactory<string> = (_index) => uuidv4();
  private _rating: PropOrFactory<number> = (_index) =>
    this.chance.integer({ min: 1, max: 5 });
  private _comment: PropOrFactory<string | null> = (_index) =>
    this.chance.sentence({ words: 5 });
  private _created_at: PropOrFactory<Date> = (_index) => new Date();

  private countObjs;

  static aFeedback() {
    return new RequestFeedbackFakeBuilder<RequestFeedback>();
  }

  static theFeedbacks(countObjs: number) {
    return new RequestFeedbackFakeBuilder<RequestFeedback[]>(countObjs);
  }

  private chance: Chance.Chance;

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withRequestFeedbackId(valueOrFactory: PropOrFactory<RequestFeedbackId>) {
    this._request_feedback_id = valueOrFactory;
    return this;
  }

  withRequestId(valueOrFactory: PropOrFactory<string | Uuid>) {
    this._request_id =
      typeof valueOrFactory === "function"
        ? (index: number) => {
            const result = valueOrFactory(index);
            return result instanceof Uuid ? result.id : result;
          }
        : valueOrFactory instanceof Uuid
          ? valueOrFactory.id
          : valueOrFactory;
    return this;
  }

  withRating(valueOrFactory: PropOrFactory<number>) {
    this._rating = valueOrFactory;
    return this;
  }

  withComment(valueOrFactory: PropOrFactory<string | null>) {
    this._comment = valueOrFactory;
    return this;
  }

  withoutComment() {
    this._comment = () => null;
    return this;
  }

  withCreatedAt(valueOrFactory: PropOrFactory<Date>) {
    this._created_at = valueOrFactory;
    return this;
  }

  withInvalidRatingTooLow(value?: number) {
    this._rating = value ?? 0;
    return this;
  }

  withInvalidRatingTooHigh(value?: number) {
    this._rating = value ?? 6;
    return this;
  }

  build(): TBuild {
    const feedbacks = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const feedback = new RequestFeedback({
          request_feedback_id: !this._request_feedback_id
            ? undefined
            : this.callFactory(this._request_feedback_id, index),
          request_id: this.callFactory(this._request_id, index),
          rating: this.callFactory(this._rating, index),
          comment: this.callFactory(this._comment, index),
          created_at: this.callFactory(this._created_at, index),
        });
        feedback.validate();
        return feedback;
      });
    return this.countObjs === 1 ? (feedbacks[0] as any) : (feedbacks as any);
  }

  get request_feedback_id() {
    return this.getValue("request_feedback_id");
  }

  get request_id() {
    return this.getValue("request_id");
  }

  get rating() {
    return this.getValue("rating");
  }

  get comment() {
    return this.getValue("comment");
  }

  get created_at() {
    return this.getValue("created_at");
  }

  private getValue(prop: any) {
    const optional = ["request_feedback_id"];
    const privateProp = `_${prop}` as keyof this;
    if (!this[privateProp] && optional.includes(prop)) {
      throw new Error(
        `Property ${prop} not have a factory, use 'with' methods`,
      );
    }
    return this.callFactory(this[privateProp], 0);
  }

  private callFactory(factoryOrValue: PropOrFactory<any>, index: number) {
    return typeof factoryOrValue === "function"
      ? factoryOrValue(index)
      : factoryOrValue;
  }
}
