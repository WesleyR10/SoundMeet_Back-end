import { Chance } from "chance";

import { Uuid } from "../../shared/domain";
import { InvariantViolationError } from "../../shared/domain/errors/invariant-violation.error";
import {
  EventMusician,
  EventMusicianId,
  EventMusicianStatus,
} from "./event-musician.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

export class EventMusicianFakeBuilder<TBuild = any> {
  private _event_musician_id: PropOrFactory<EventMusicianId> | undefined =
    undefined;
  private _event_id: PropOrFactory<Uuid> = (_index) => new Uuid();
  private _musician_id: PropOrFactory<Uuid | null> = (_index) => new Uuid();
  private _band_id: PropOrFactory<Uuid | null> = (_index) => null;
  private _fee: PropOrFactory<number | null> = (_index) => null;
  private _status: PropOrFactory<EventMusicianStatus> = (_index) => "confirmed";
  private _start_at: PropOrFactory<Date | null> = (_index) => null;
  private _end_at: PropOrFactory<Date | null> = (_index) => null;
  private _created_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs;
  private chance: Chance.Chance;

  static aEventMusician() {
    return new EventMusicianFakeBuilder<EventMusician>();
  }

  static anEventMusician() {
    return new EventMusicianFakeBuilder<EventMusician>();
  }

  static theEventMusicians(countObjs: number) {
    return new EventMusicianFakeBuilder<EventMusician[]>(countObjs);
  }

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withEventMusicianId(valueOrFactory: PropOrFactory<EventMusicianId>) {
    this._event_musician_id = valueOrFactory;
    return this;
  }

  withEventId(valueOrFactory: PropOrFactory<Uuid>) {
    this._event_id = valueOrFactory;
    return this;
  }

  withMusicianId(valueOrFactory: PropOrFactory<Uuid | null>) {
    this._musician_id = valueOrFactory;
    return this;
  }

  withBandId(valueOrFactory: PropOrFactory<Uuid | null>) {
    this._band_id = valueOrFactory;
    return this;
  }

  withFee(valueOrFactory: PropOrFactory<number | null>) {
    this._fee = valueOrFactory;
    return this;
  }

  withStatus(valueOrFactory: PropOrFactory<EventMusicianStatus>) {
    this._status = valueOrFactory;
    return this;
  }

  withStartAt(valueOrFactory: PropOrFactory<Date | null>) {
    this._start_at = valueOrFactory;
    return this;
  }

  withEndAt(valueOrFactory: PropOrFactory<Date | null>) {
    this._end_at = valueOrFactory;
    return this;
  }

  withCreatedAt(valueOrFactory: PropOrFactory<Date>) {
    this._created_at = valueOrFactory;
    return this;
  }

  asMusician(valueOrFactory: PropOrFactory<Uuid> = (_index) => new Uuid()) {
    this._musician_id = valueOrFactory;
    this._band_id = (_index) => null;
    return this;
  }

  asBand(valueOrFactory: PropOrFactory<Uuid> = (_index) => new Uuid()) {
    this._band_id = valueOrFactory;
    this._musician_id = (_index) => null;
    return this;
  }

  build(): TBuild {
    const eventMusicians = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const entity = new EventMusician({
          event_musician_id: !this._event_musician_id
            ? undefined
            : this.callFactory(this._event_musician_id, index),
          event_id: this.callFactory(this._event_id, index),
          musician_id: this.callFactory(this._musician_id, index),
          band_id: this.callFactory(this._band_id, index),
          fee: this.callFactory(this._fee, index),
          status: this.callFactory(this._status, index),
          start_at: this.callFactory(this._start_at, index),
          end_at: this.callFactory(this._end_at, index),
          ...(this._created_at && {
            created_at: this.callFactory(this._created_at, index),
          }),
        });
        entity.validate();
        return entity;
      });

    return this.countObjs === 1
      ? (eventMusicians[0] as any)
      : (eventMusicians as any);
  }

  get event_musician_id() {
    return this.getValue("event_musician_id");
  }

  get created_at() {
    return this.getValue("created_at");
  }

  private getValue(prop: any) {
    const optional = ["event_musician_id", "created_at"];
    const privateProp = `_${prop}` as keyof this;
    if (!this[privateProp] && optional.includes(prop)) {
      throw new InvariantViolationError(
        `Property ${prop} not have a factory, use 'with' methods`,
      );
    }
    return this.callFactory(this[privateProp] as any, 0);
  }

  private callFactory<T>(factoryOrValue: PropOrFactory<T>, index: number): T {
    return typeof factoryOrValue === "function"
      ? (factoryOrValue as any)(index)
      : factoryOrValue;
  }
}
