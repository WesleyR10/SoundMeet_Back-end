import { Chance } from "chance";

import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { UserScore, UserScoreId } from "./user-score.aggregate";
import { ScoreType, ScoreTypeEnum } from "./value-objects/score-type.vo";

type PropOrFactory<T> = T | ((index: number) => T);

export class UserScoreFakeBuilder<TBuild = any> {
  private _id: PropOrFactory<UserScoreId> | undefined = undefined;
  private _user_id: PropOrFactory<Uuid> = (_index) => new Uuid();
  private _score_type: PropOrFactory<ScoreType> = (_index) =>
    new ScoreType(this.chance.pickone(Object.values(ScoreTypeEnum)));
  private _points: PropOrFactory<number> = (_index) =>
    this.chance.integer({ min: 1, max: 100 });
  private _reference_id: PropOrFactory<string | null> = (_index) =>
    this.chance.guid();
  private _description: PropOrFactory<string | null> = (_index) =>
    this.chance.sentence({ words: 5 });
  private _created_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs;

  static aUserScore() {
    return new UserScoreFakeBuilder<UserScore>();
  }

  static theUserScores(countObjs: number) {
    return new UserScoreFakeBuilder<UserScore[]>(countObjs);
  }

  private chance: Chance.Chance;

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withUserScoreId(valueOrFactory: PropOrFactory<UserScoreId>) {
    this._id = valueOrFactory;
    return this;
  }

  withUserId(valueOrFactory: PropOrFactory<Uuid>) {
    this._user_id = valueOrFactory;
    return this;
  }

  withScoreType(valueOrFactory: PropOrFactory<ScoreType>) {
    this._score_type = valueOrFactory;
    return this;
  }

  withPoints(valueOrFactory: PropOrFactory<number>) {
    this._points = valueOrFactory;
    return this;
  }

  withReferenceId(valueOrFactory: PropOrFactory<string | null>) {
    this._reference_id = valueOrFactory;
    return this;
  }

  withDescription(valueOrFactory: PropOrFactory<string | null>) {
    this._description = valueOrFactory;
    return this;
  }

  withCreatedAt(valueOrFactory: PropOrFactory<Date>) {
    this._created_at = valueOrFactory;
    return this;
  }

  withInvalidUserId(value?: any) {
    this._user_id = value ?? "invalid-uuid";
    return this;
  }

  withInvalidScoreType(value?: any) {
    this._score_type = value ?? "INVALID_TYPE";
    return this;
  }

  withInvalidPoints(value?: number) {
    this._points = value ?? -1;
    return this;
  }

  build(): TBuild {
    const userScores = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const userScore = new UserScore({
          id: !this._id ? undefined : this.callFactory(this._id, index),
          user_id: this.callFactory(this._user_id, index).id,
          score_type: this.callFactory(this._score_type, index).value,
          points: this.callFactory(this._points, index),
          reference_id: this.callFactory(this._reference_id, index),
          description: this.callFactory(this._description, index),
          created_at: !this._created_at
            ? undefined
            : this.callFactory(this._created_at, index),
        });
        return userScore;
      });
    return this.countObjs === 1
      ? (userScores[0] as any)
      : (userScores as TBuild);
  }

  get id() {
    return this.getValue("id");
  }

  get user_id() {
    return this.getValue("user_id");
  }

  get score_type() {
    return this.getValue("score_type");
  }

  get points() {
    return this.getValue("points");
  }

  get reference_id() {
    return this.getValue("reference_id");
  }

  get description() {
    return this.getValue("description");
  }

  get created_at() {
    return this.getValue("created_at");
  }

  private getValue(prop: any) {
    const optional = ["id", "created_at"];
    const privateProp = `_${prop}` as keyof this;
    if (!this[privateProp] && optional.includes(prop)) {
      throw new Error(
        `Property ${prop} not have a factory, use 'with' methods`,
      );
    }
    return this.callFactory(this[privateProp] as any, 0);
  }

  private callFactory(factoryOrValue: PropOrFactory<any>, index: number) {
    return typeof factoryOrValue === "function"
      ? factoryOrValue(index)
      : factoryOrValue;
  }
}
