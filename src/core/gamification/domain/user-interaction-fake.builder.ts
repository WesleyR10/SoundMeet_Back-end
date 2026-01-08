import { Chance } from "chance";

import { Uuid } from "../../shared/domain";
import {
  UserInteraction,
  UserInteractionId,
} from "./user-interaction.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

export class UserInteractionFakeBuilder<TBuild = any> {
  private _id: PropOrFactory<UserInteractionId> | undefined = undefined;
  private _user_id: PropOrFactory<string> | undefined = undefined;
  private _interaction_type: PropOrFactory<string> | undefined = undefined;
  private _target_id: PropOrFactory<string | null> | undefined = undefined;
  private _metadata: PropOrFactory<Record<string, any> | null> | undefined =
    undefined;
  private _points_earned: PropOrFactory<number> | undefined = undefined;
  private _created_at: PropOrFactory<Date> | undefined = undefined;
  private _updated_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs;

  static aUserInteraction() {
    return new UserInteractionFakeBuilder<UserInteraction>();
  }

  static theUserInteractions(countObjs: number) {
    return new UserInteractionFakeBuilder<UserInteraction[]>(countObjs);
  }

  private chance: Chance.Chance;

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withUserInteractionId(valueOrFactory: PropOrFactory<UserInteractionId>) {
    this._id = valueOrFactory;
    return this;
  }

  withUserId(valueOrFactory: PropOrFactory<string>) {
    this._user_id = valueOrFactory;
    return this;
  }

  withInteractionType(valueOrFactory: PropOrFactory<string>) {
    this._interaction_type = valueOrFactory;
    return this;
  }

  withTargetId(valueOrFactory: PropOrFactory<string | null>) {
    this._target_id = valueOrFactory;
    return this;
  }

  withMetadata(valueOrFactory: PropOrFactory<Record<string, any> | null>) {
    this._metadata = valueOrFactory;
    return this;
  }

  withPointsEarned(valueOrFactory: PropOrFactory<number>) {
    this._points_earned = valueOrFactory;
    return this;
  }

  withCreatedAt(valueOrFactory: PropOrFactory<Date>) {
    this._created_at = valueOrFactory;
    return this;
  }

  withUpdatedAt(valueOrFactory: PropOrFactory<Date>) {
    this._updated_at = valueOrFactory;
    return this;
  }

  withInvalidUserIdEmpty(value: "" = "") {
    this._user_id = value;
    return this;
  }

  withInvalidInteractionTypeEmpty(value: "" = "") {
    this._interaction_type = value;
    return this;
  }

  withInvalidPointsEarnedNegative(value: number = -1) {
    this._points_earned = value;
    return this;
  }

  build(): TBuild {
    const userInteractions = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const userInteraction = new UserInteraction({
          user_interaction_id: !this._id
            ? undefined
            : this.callFactory(this._id, index),
          user_id: this.callFactory(this._user_id, index) ?? new Uuid().id,
          interaction_type:
            this.callFactory(this._interaction_type, index) ??
            this.chance.pickone([
              "qr_scan",
              "music_request",
              "tip",
              "social_share",
            ]),
          target_id:
            this.callFactory(this._target_id, index) ??
            (this.chance.bool() ? new Uuid().id : null),
          metadata:
            this.callFactory(this._metadata, index) ??
            (this.chance.bool()
              ? {
                  establishment_name: this.chance.company(),
                  song_title: this.chance.sentence({ words: 3 }),
                  amount: this.chance.floating({ min: 1, max: 100, fixed: 2 }),
                }
              : null),
          points_earned:
            this.callFactory(this._points_earned, index) ??
            this.chance.integer({ min: 1, max: 50 }),
          created_at: this.callFactory(this._created_at, index) ?? new Date(),
          updated_at: this.callFactory(this._updated_at, index) ?? new Date(),
        });
        userInteraction.validate();
        return userInteraction;
      });
    return this.countObjs === 1
      ? (userInteractions[0] as any)
      : (userInteractions as TBuild);
  }

  get id() {
    return this.getValue("id");
  }

  get user_id() {
    return this.getValue("user_id");
  }

  get interaction_type() {
    return this.getValue("interaction_type");
  }

  get target_id() {
    return this.getValue("target_id");
  }

  get metadata() {
    return this.getValue("metadata");
  }

  get points_earned() {
    return this.getValue("points_earned");
  }

  get created_at() {
    return this.getValue("created_at");
  }

  get updated_at() {
    return this.getValue("updated_at");
  }

  private getValue(prop: any) {
    const optional = [
      "id",
      "target_id",
      "metadata",
      "created_at",
      "updated_at",
    ];
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
