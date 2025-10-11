import { Chance } from "chance";
import { UserBadge, UserBadgeId } from "./user-badge.aggregate";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { BadgeTypeEnum } from "./value-objects/badge-type.vo";

type PropOrFactory<T> = T | ((index: number) => T);

export class UserBadgeFakeBuilder<TBuild = any> {
  private _id: PropOrFactory<UserBadgeId> | undefined = undefined;
  private _user_id: PropOrFactory<string> = (_index) => new Uuid().id;
  private _badge_type: PropOrFactory<BadgeTypeEnum> = (_index) =>
    BadgeTypeEnum.INICIANTE_MUSICAL;
  private _progress: PropOrFactory<number> = (_index) =>
    this.chance.integer({ min: 0, max: 100 });
  private _is_unlocked: PropOrFactory<boolean> = (_index) => false;
  private _unlocked_at: PropOrFactory<Date | null> = (_index) => null;
  private _created_at: PropOrFactory<Date> | undefined = undefined;
  private _updated_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs;

  static aUserBadge() {
    return new UserBadgeFakeBuilder<UserBadge>();
  }

  static theUserBadges(countObjs: number) {
    return new UserBadgeFakeBuilder<UserBadge[]>(countObjs);
  }

  private chance: Chance.Chance;

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withUserBadgeId(valueOrFactory: PropOrFactory<UserBadgeId>) {
    this._id = valueOrFactory;
    return this;
  }

  withUserId(valueOrFactory: PropOrFactory<string>) {
    this._user_id = valueOrFactory;
    return this;
  }

  withBadgeType(valueOrFactory: PropOrFactory<BadgeTypeEnum>) {
    this._badge_type = valueOrFactory;
    return this;
  }

  withProgress(valueOrFactory: PropOrFactory<number>) {
    this._progress = valueOrFactory;
    return this;
  }

  withIsUnlocked(valueOrFactory: PropOrFactory<boolean>) {
    this._is_unlocked = valueOrFactory;
    return this;
  }

  withUnlockedAt(valueOrFactory: PropOrFactory<Date | null>) {
    this._unlocked_at = valueOrFactory;
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

  withInvalidUserId(value?: any) {
    this._user_id = value ?? "invalid-uuid";
    return this;
  }

  withInvalidProgress(value?: number) {
    this._progress = value ?? -1;
    return this;
  }

  active() {
    this._is_unlocked = true;
    this._unlocked_at = (_index) => new Date();
    return this;
  }

  inactive() {
    this._is_unlocked = false;
    this._unlocked_at = (_index) => null;
    return this;
  }

  build(): TBuild {
    const userBadges = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const userBadge = new UserBadge({
          id: !this._id ? undefined : this.callFactory(this._id, index),
          user_id: this.callFactory(this._user_id, index),
          badge_type: this.callFactory(this._badge_type, index),
          progress: this.callFactory(this._progress, index),
          is_unlocked: this.callFactory(this._is_unlocked, index),
          unlocked_at: this.callFactory(this._unlocked_at, index),
          created_at: !this._created_at
            ? undefined
            : this.callFactory(this._created_at, index),
          updated_at: !this._updated_at
            ? undefined
            : this.callFactory(this._updated_at, index),
        });
        return userBadge;
      });
    return this.countObjs === 1
      ? (userBadges[0] as any)
      : (userBadges as TBuild);
  }

  get id() {
    return this.getValue("id");
  }

  get user_id() {
    return this.getValue("user_id");
  }

  get badge_type() {
    return this.getValue("badge_type");
  }

  get progress() {
    return this.getValue("progress");
  }

  get is_unlocked() {
    return this.getValue("is_unlocked");
  }

  get unlocked_at() {
    return this.getValue("unlocked_at");
  }

  get created_at() {
    return this.getValue("created_at");
  }

  get updated_at() {
    return this.getValue("updated_at");
  }

  private getValue(prop: any) {
    const optional = ["id", "created_at", "updated_at"];
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
