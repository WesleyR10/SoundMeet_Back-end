import { Chance } from "chance";

import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { Ranking, RankingId } from "./ranking.aggregate";
import {
  RankingPeriodEnum,
  RankingTypeEnum,
} from "./value-objects/ranking-type.vo";

type PropOrFactory<T> = T | ((index: number) => T);

export class RankingFakeBuilder<TBuild = any> {
  private _id: PropOrFactory<RankingId> | undefined = undefined;
  private _user_id: PropOrFactory<Uuid> = (_index) => new Uuid();
  private _establishment_id: PropOrFactory<Uuid> = (_index) => new Uuid();
  private _position: PropOrFactory<number> = (_index) =>
    this.chance.integer({ min: 1, max: 100 });
  private _points: PropOrFactory<number> = (_index) =>
    this.chance.integer({ min: 0, max: 1000 });
  private _ranking_type: PropOrFactory<RankingTypeEnum> = (_index) =>
    this.chance.pickone(Object.values(RankingTypeEnum));
  private _period_type: PropOrFactory<RankingPeriodEnum> = (_index) =>
    this.chance.pickone(Object.values(RankingPeriodEnum));
  private _period_start: PropOrFactory<Date> = (_index) =>
    new Date(this.chance.date({ year: 2024 }));
  private _period_end: PropOrFactory<Date> = (_index) => {
    const start = this.callFactory(this._period_start, _index);
    const startDate = start instanceof Date ? start : new Date(start);
    return new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days later
  };
  private _is_active: PropOrFactory<boolean> = (_index) => true;
  private _created_at: PropOrFactory<Date> | undefined = undefined;
  private _updated_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs;

  static aRanking() {
    return new RankingFakeBuilder<Ranking>();
  }

  static theRankings(countObjs: number) {
    return new RankingFakeBuilder<Ranking[]>(countObjs);
  }

  private chance: Chance.Chance;

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withRankingId(valueOrFactory: PropOrFactory<RankingId>) {
    this._id = valueOrFactory;
    return this;
  }

  withUserId(valueOrFactory: PropOrFactory<Uuid>) {
    this._user_id = valueOrFactory;
    return this;
  }

  withEstablishmentId(valueOrFactory: PropOrFactory<Uuid>) {
    this._establishment_id = valueOrFactory;
    return this;
  }

  withPosition(valueOrFactory: PropOrFactory<number>) {
    this._position = valueOrFactory;
    return this;
  }

  withPoints(valueOrFactory: PropOrFactory<number>) {
    this._points = valueOrFactory;
    return this;
  }

  withScore(valueOrFactory: PropOrFactory<number>) {
    this._points = valueOrFactory;
    return this;
  }

  withPeriodType(valueOrFactory: PropOrFactory<RankingPeriodEnum>) {
    this._period_type = valueOrFactory;
    return this;
  }

  withPeriodStart(valueOrFactory: PropOrFactory<Date>) {
    this._period_start = valueOrFactory;
    return this;
  }

  withPeriodEnd(valueOrFactory: PropOrFactory<Date>) {
    this._period_end = valueOrFactory;
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

  withInvalidPosition(value?: number) {
    this._position = value ?? 0;
    return this;
  }

  withInvalidPoints(value?: number) {
    this._points = value ?? -1;
    return this;
  }

  asTopPosition() {
    this._position = (_index) => this.chance.integer({ min: 1, max: 3 });
    return this;
  }

  asFirstPlace() {
    this._position = 1;
    this._points = (_index) => this.chance.integer({ min: 800, max: 1000 });
    return this;
  }

  asWeeklyRanking() {
    this._period_type = RankingPeriodEnum.WEEKLY;
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
    this._period_start = startOfWeek;
    this._period_end = endOfWeek;
    return this;
  }

  asMonthlyRanking() {
    this._period_type = RankingPeriodEnum.MONTHLY;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    this._period_start = startOfMonth;
    this._period_end = endOfMonth;
    return this;
  }

  deactivated() {
    this._is_active = false;
    return this;
  }

  inactive() {
    this._is_active = false;
    return this;
  }

  active() {
    this._is_active = true;
    return this;
  }

  withPeriod(start: Date, end: Date): this {
    this._period_start = start;
    this._period_end = end;
    return this;
  }

  build(): TBuild {
    const rankings = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const ranking = new Ranking({
          id: !this._id ? undefined : this.callFactory(this._id, index),
          user_id: this.callFactory(this._user_id, index).id,
          ranking_type: this.callFactory(this._ranking_type, index),
          period: this.callFactory(this._period_type, index),
          position: this.callFactory(this._position, index),
          score: this.callFactory(this._points, index),
          period_start: this.callFactory(this._period_start, index),
          period_end: this.callFactory(this._period_end, index),
          is_active: this.callFactory(this._is_active, index),
          created_at: !this._created_at
            ? undefined
            : this.callFactory(this._created_at, index),
          updated_at: !this._updated_at
            ? undefined
            : this.callFactory(this._updated_at, index),
        });
        return ranking;
      });
    return this.countObjs === 1 ? (rankings[0] as any) : (rankings as TBuild);
  }

  get id() {
    return this.getValue("id");
  }

  get user_id() {
    return this.getValue("user_id");
  }

  get establishment_id() {
    return this.getValue("establishment_id");
  }

  get position() {
    return this.getValue("position");
  }

  get points() {
    return this.getValue("points");
  }

  get period_type() {
    return this.getValue("period_type");
  }

  get period_start() {
    return this.getValue("period_start");
  }

  get period_end() {
    return this.getValue("period_end");
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
