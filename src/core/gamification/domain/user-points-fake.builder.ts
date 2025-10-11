import { Chance } from "chance";
import { UserPoints, UserPointsId } from "./user-points.aggregate";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";

type PropOrFactory<T> = T | ((index: number) => T);

export class UserPointsFakeBuilder<TBuild = any> {
  private _id: PropOrFactory<UserPointsId> | undefined = undefined;
  private _user_id: PropOrFactory<Uuid> = (_index) => new Uuid();
  private _total_points: PropOrFactory<number> = (_index) =>
    this.chance.integer({ min: 0, max: 1000 });
  private _total_scans: PropOrFactory<number> = (_index) =>
    this.chance.integer({ min: 0, max: 50 });
  private _total_requests: PropOrFactory<number> = (_index) =>
    this.chance.integer({ min: 0, max: 20 });
  private _total_tips: PropOrFactory<number> = (_index) =>
    this.chance.integer({ min: 0, max: 10 });
  private _total_social_shares: PropOrFactory<number> = (_index) =>
    this.chance.integer({ min: 0, max: 15 });
  private _current_level: PropOrFactory<number> = (_index) =>
    this.chance.integer({ min: 1, max: 10 });
  private _is_active: PropOrFactory<boolean> = (_index) => true;
  private _created_at: PropOrFactory<Date> | undefined = undefined;
  private _updated_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs;

  static aUserPoints() {
    return new UserPointsFakeBuilder<UserPoints>();
  }

  static theUserPoints(countObjs: number) {
    return new UserPointsFakeBuilder<UserPoints[]>(countObjs);
  }

  private chance: Chance.Chance;

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withUserPointsId(valueOrFactory: PropOrFactory<UserPointsId>) {
    this._id = valueOrFactory;
    return this;
  }

  withUserId(valueOrFactory: PropOrFactory<Uuid>) {
    this._user_id = valueOrFactory;
    return this;
  }

  withTotalPoints(valueOrFactory: PropOrFactory<number>) {
    this._total_points = valueOrFactory;
    return this;
  }

  withTotalScans(valueOrFactory: PropOrFactory<number>) {
    this._total_scans = valueOrFactory;
    return this;
  }

  withTotalRequests(valueOrFactory: PropOrFactory<number>) {
    this._total_requests = valueOrFactory;
    return this;
  }

  withTotalTips(valueOrFactory: PropOrFactory<number>) {
    this._total_tips = valueOrFactory;
    return this;
  }

  withTotalSocialShares(valueOrFactory: PropOrFactory<number>) {
    this._total_social_shares = valueOrFactory;
    return this;
  }

  withCurrentLevel(valueOrFactory: PropOrFactory<number>) {
    this._current_level = valueOrFactory;
    return this;
  }

  withIsActive(valueOrFactory: PropOrFactory<boolean>) {
    this._is_active = valueOrFactory;
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

  withInvalidTotalPoints(value?: number) {
    this._total_points = value ?? -1;
    return this;
  }

  withInvalidCurrentLevel(value?: number) {
    this._current_level = value ?? 0;
    return this;
  }

  asTopFan() {
    this._total_points = 1000;
    this._total_scans = 50;
    this._current_level = 10;
    return this;
  }

  asActiveSupporter() {
    this._total_tips = 5;
    this._total_social_shares = 3;
    return this;
  }

  active() {
    this._is_active = true;
    return this;
  }

  inactive() {
    this._is_active = false;
    return this;
  }

  build(): TBuild {
    const userPoints = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const userPoint = new UserPoints({
          id: !this._id ? undefined : this.callFactory(this._id, index),
          user_id: this.callFactory(this._user_id, index),
          total_points: this.callFactory(this._total_points, index),
          total_scans: this.callFactory(this._total_scans, index),
          total_requests: this.callFactory(this._total_requests, index),
          total_tips: this.callFactory(this._total_tips, index),
          total_social_shares: this.callFactory(
            this._total_social_shares,
            index,
          ),
          current_level: this.callFactory(this._current_level, index),
          is_active: this.callFactory(this._is_active, index),
          created_at: !this._created_at
            ? undefined
            : this.callFactory(this._created_at, index),
          updated_at: !this._updated_at
            ? undefined
            : this.callFactory(this._updated_at, index),
        });
        return userPoint;
      });
    return this.countObjs === 1
      ? (userPoints[0] as any)
      : (userPoints as TBuild);
  }

  get id() {
    return this.getValue("id");
  }

  get user_id() {
    return this.getValue("user_id");
  }

  get total_points() {
    return this.getValue("total_points");
  }

  get total_scans() {
    return this.getValue("total_scans");
  }

  get total_requests() {
    return this.getValue("total_requests");
  }

  get total_tips() {
    return this.getValue("total_tips");
  }

  get total_social_shares() {
    return this.getValue("total_social_shares");
  }

  get current_level() {
    return this.getValue("current_level");
  }

  get is_active() {
    return this.getValue("is_active");
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
