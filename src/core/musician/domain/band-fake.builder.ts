import { Chance } from "chance";

import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { Band, BandId, BandMemberProps } from "./band.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

export class BandFakeBuilder<TBuild = any> {
  private _band_id: PropOrFactory<BandId> | undefined = undefined;
  private _name: PropOrFactory<string> = (_index) => this.chance.company();
  private _description: PropOrFactory<string | null> = (_index) =>
    this.chance.paragraph();
  private _avatar: PropOrFactory<string | null> = (_index) =>
    this.chance.avatar();
  private _genres: PropOrFactory<string[]> = (_index) => [
    this.chance.word(),
    this.chance.word(),
  ];
  private _members: PropOrFactory<BandMemberProps[]> = [];
  private _is_active: PropOrFactory<boolean> = (_index) => true;
  private _created_at: PropOrFactory<Date> | undefined = undefined;
  private _updated_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs;

  static aBand() {
    return new BandFakeBuilder<Band>();
  }

  static theBands(countObjs: number) {
    return new BandFakeBuilder<Band[]>(countObjs);
  }

  private chance: Chance.Chance;

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = new Chance();
  }

  withBandId(valueOrFactory: PropOrFactory<BandId>) {
    this._band_id = valueOrFactory;
    return this;
  }

  withName(valueOrFactory: PropOrFactory<string>) {
    this._name = valueOrFactory;
    return this;
  }

  withDescription(valueOrFactory: PropOrFactory<string | null>) {
    this._description = valueOrFactory;
    return this;
  }

  withAvatar(valueOrFactory: PropOrFactory<string | null>) {
    this._avatar = valueOrFactory;
    return this;
  }

  withGenres(valueOrFactory: PropOrFactory<string[]>) {
    this._genres = valueOrFactory;
    return this;
  }

  withMembers(valueOrFactory: PropOrFactory<BandMemberProps[]>) {
    this._members = valueOrFactory;
    return this;
  }

  addMember(member: BandMemberProps) {
    if (Array.isArray(this._members)) {
      this._members.push(member);
    }
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

  build(): TBuild {
    const bands = new Array(this.countObjs).fill(undefined).map((_, index) => {
      const band = new Band({
        band_id: !this._band_id
          ? undefined
          : this.callFactory(this._band_id, index),
        name: this.callFactory(this._name, index),
        description: this.callFactory(this._description, index),
        avatar: this.callFactory(this._avatar, index),
        genres: this.callFactory(this._genres, index),
        members: this.callFactory(this._members, index),
        is_active: this.callFactory(this._is_active, index),
        created_at: !this._created_at
          ? undefined
          : this.callFactory(this._created_at, index),
        updated_at: !this._updated_at
          ? undefined
          : this.callFactory(this._updated_at, index),
      });
      return band;
    });
    return this.countObjs === 1
      ? (bands[0] as unknown as TBuild)
      : (bands as unknown as TBuild);
  }

  get band_id() {
    return this.getValue("band_id");
  }

  get name() {
    return this.getValue("name");
  }

  get description() {
    return this.getValue("description");
  }

  get avatar() {
    return this.getValue("avatar");
  }

  get genres() {
    return this.getValue("genres");
  }

  get members() {
    return this.getValue("members");
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
    const optional = ["band_id", "created_at", "updated_at"];
    const privateProp = `_${prop}` as keyof this;
    if (!this[privateProp] && optional.includes(prop)) {
      throw new Error(`Property ${prop} not has a factory, use 'with' methods`);
    }
    return this.callFactory(this[privateProp], 0);
  }

  private callFactory(factoryOrValue: PropOrFactory<any>, index: number) {
    return typeof factoryOrValue === "function"
      ? factoryOrValue(index)
      : factoryOrValue;
  }
}
