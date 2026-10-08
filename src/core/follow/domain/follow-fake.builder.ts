import { Chance } from "chance";

import { Follow, FollowId } from "./follow.aggregate";
import { FollowTargetType } from "./follow-types";

type PropOrFactory<T> = T | ((index: number) => T);

export class FollowFakeBuilder<TBuild = any> {
  private _follow_id: PropOrFactory<FollowId | undefined> = undefined;
  private _audience_id: PropOrFactory<string> = () =>
    this.chance.guid({ version: 4 });
  private _target_type: PropOrFactory<FollowTargetType> = "musician";
  private _target_id: PropOrFactory<string> = () =>
    this.chance.guid({ version: 4 });
  private _notifications_enabled: PropOrFactory<boolean> = true;
  private chance: Chance.Chance;
  private countObjs: number;

  static aFollow() {
    return new FollowFakeBuilder<Follow>();
  }

  static theFollows(count: number) {
    return new FollowFakeBuilder<Follow[]>(count);
  }

  private constructor(count: number = 1) {
    this.countObjs = count;
    this.chance = new Chance();
  }

  withFollowId(value: PropOrFactory<FollowId>) {
    this._follow_id = value;
    return this;
  }

  withAudienceId(value: PropOrFactory<string>) {
    this._audience_id = value;
    return this;
  }

  withTarget(type: PropOrFactory<FollowTargetType>, id: PropOrFactory<string>) {
    this._target_type = type;
    this._target_id = id;
    return this;
  }

  withNotificationsEnabled(value: PropOrFactory<boolean>) {
    this._notifications_enabled = value;
    return this;
  }

  build(): TBuild {
    const follows = new Array(this.countObjs).fill(undefined).map(
      (_, i) =>
        new Follow({
          follow_id: this._call(this._follow_id, i),
          audience_id: this._call(this._audience_id, i),
          target_type: this._call(this._target_type, i),
          target_id: this._call(this._target_id, i),
          notifications_enabled: this._call(this._notifications_enabled, i),
        }),
    );
    return (this.countObjs === 1 ? follows[0] : follows) as TBuild;
  }

  private _call<T>(prop: PropOrFactory<T>, index: number): T {
    return typeof prop === "function"
      ? (prop as (index: number) => T)(index)
      : prop;
  }
}
