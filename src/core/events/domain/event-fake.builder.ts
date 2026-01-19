import { Chance } from "chance";

import { Uuid } from "../../shared/domain";
import { Event, EventId, EventStatus } from "./event.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

export class EventFakeBuilder<TBuild = any> {
  private _event_id: PropOrFactory<EventId> | undefined = undefined;
  private _establishment_id: PropOrFactory<Uuid> = (_index) => new Uuid();
  private _name: PropOrFactory<string> = (_index) =>
    `Event ${this.chance.word()} ${this.chance.integer({ min: 1, max: 999 })}`;
  private _description: PropOrFactory<string | null> = (_index) => null;
  private _date: PropOrFactory<Date> = (_index) => new Date();
  private _start_at: PropOrFactory<Date> = (_index) =>
    new Date(Date.now() + 60 * 60 * 1000);
  private _end_at: PropOrFactory<Date> = (_index) =>
    new Date(Date.now() + 2 * 60 * 60 * 1000);
  private _status: PropOrFactory<EventStatus> = (_index) => "scheduled";
  private _max_capacity: PropOrFactory<number | null> = (_index) => null;
  private _current_capacity: PropOrFactory<number> = (_index) => 0;
  private _is_public: PropOrFactory<boolean> = (_index) => true;
  private _cover_charge: PropOrFactory<number | null> = (_index) => null;
  private _created_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs;
  private chance: Chance.Chance;

  static anEvent() {
    return new EventFakeBuilder<Event>();
  }

  static theEvents(countObjs: number) {
    return new EventFakeBuilder<Event[]>(countObjs);
  }

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withEventId(valueOrFactory: PropOrFactory<EventId>) {
    this._event_id = valueOrFactory;
    return this;
  }

  withEstablishmentId(valueOrFactory: PropOrFactory<Uuid>) {
    this._establishment_id = valueOrFactory;
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

  withDate(valueOrFactory: PropOrFactory<Date>) {
    this._date = valueOrFactory;
    return this;
  }

  withStartAt(valueOrFactory: PropOrFactory<Date>) {
    this._start_at = valueOrFactory;
    return this;
  }

  withEndAt(valueOrFactory: PropOrFactory<Date>) {
    this._end_at = valueOrFactory;
    return this;
  }

  withStatus(valueOrFactory: PropOrFactory<EventStatus>) {
    this._status = valueOrFactory;
    return this;
  }

  withMaxCapacity(valueOrFactory: PropOrFactory<number | null>) {
    this._max_capacity = valueOrFactory;
    return this;
  }

  withCurrentCapacity(valueOrFactory: PropOrFactory<number>) {
    this._current_capacity = valueOrFactory;
    return this;
  }

  withIsPublic(valueOrFactory: PropOrFactory<boolean>) {
    this._is_public = valueOrFactory;
    return this;
  }

  withCoverCharge(valueOrFactory: PropOrFactory<number | null>) {
    this._cover_charge = valueOrFactory;
    return this;
  }

  withCreatedAt(valueOrFactory: PropOrFactory<Date>) {
    this._created_at = valueOrFactory;
    return this;
  }

  build(): TBuild {
    const events = new Array(this.countObjs).fill(undefined).map((_, index) => {
      const entity = new Event({
        event_id: !this._event_id
          ? undefined
          : this.callFactory(this._event_id, index),
        establishment_id: this.callFactory(this._establishment_id, index),
        name: this.callFactory(this._name, index),
        description: this.callFactory(this._description, index),
        date: this.callFactory(this._date, index),
        start_at: this.callFactory(this._start_at, index),
        end_at: this.callFactory(this._end_at, index),
        status: this.callFactory(this._status, index),
        max_capacity: this.callFactory(this._max_capacity, index),
        current_capacity: this.callFactory(this._current_capacity, index),
        is_public: this.callFactory(this._is_public, index),
        cover_charge: this.callFactory(this._cover_charge, index),
        ...(this._created_at && {
          created_at: this.callFactory(this._created_at, index),
        }),
      });
      entity.validate();
      return entity;
    });

    return this.countObjs === 1 ? (events[0] as any) : (events as any);
  }

  private callFactory<T>(factoryOrValue: PropOrFactory<T>, index: number): T {
    return typeof factoryOrValue === "function"
      ? (factoryOrValue as any)(index)
      : factoryOrValue;
  }
}
