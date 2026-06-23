import { Chance } from "chance";

import { Uuid } from "../../shared/domain";
import { InvariantViolationError } from "../../shared/domain/errors/invariant-violation.error";
import { EventAttendee, EventAttendeeId } from "./event-attendee.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

export class EventAttendeeFakeBuilder<TBuild = any> {
  private _event_attendee_id: PropOrFactory<EventAttendeeId> | undefined =
    undefined;
  private _event_id: PropOrFactory<Uuid> = (_index) => new Uuid();
  private _audience_id: PropOrFactory<Uuid> = (_index) => new Uuid();
  private _joined_at: PropOrFactory<Date> = (_index) => new Date();
  private _left_at: PropOrFactory<Date | null> = (_index) => null;
  private _is_active: PropOrFactory<boolean> = (_index) => true;

  private countObjs;
  private chance: Chance.Chance;

  static aEventAttendee() {
    return new EventAttendeeFakeBuilder<EventAttendee>();
  }

  static anEventAttendee() {
    return new EventAttendeeFakeBuilder<EventAttendee>();
  }

  static theEventAttendees(countObjs: number) {
    return new EventAttendeeFakeBuilder<EventAttendee[]>(countObjs);
  }

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withEventAttendeeId(valueOrFactory: PropOrFactory<EventAttendeeId>) {
    this._event_attendee_id = valueOrFactory;
    return this;
  }

  withEventId(valueOrFactory: PropOrFactory<Uuid>) {
    this._event_id = valueOrFactory;
    return this;
  }

  withAudienceId(valueOrFactory: PropOrFactory<Uuid>) {
    this._audience_id = valueOrFactory;
    return this;
  }

  withJoinedAt(valueOrFactory: PropOrFactory<Date>) {
    this._joined_at = valueOrFactory;
    return this;
  }

  withLeftAt(valueOrFactory: PropOrFactory<Date | null>) {
    this._left_at = valueOrFactory;
    return this;
  }

  withIsActive(valueOrFactory: PropOrFactory<boolean>) {
    this._is_active = valueOrFactory;
    return this;
  }

  inactive() {
    this._is_active = (_index) => false;
    this._left_at = (_index) => new Date();
    return this;
  }

  build(): TBuild {
    const eventAttendees = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const entity = new EventAttendee({
          event_attendee_id: !this._event_attendee_id
            ? undefined
            : this.callFactory(this._event_attendee_id, index),
          event_id: this.callFactory(this._event_id, index),
          audience_id: this.callFactory(this._audience_id, index),
          joined_at: this.callFactory(this._joined_at, index),
          left_at: this.callFactory(this._left_at, index),
          is_active: this.callFactory(this._is_active, index),
        });
        entity.validate();
        return entity;
      });

    return this.countObjs === 1
      ? (eventAttendees[0] as any)
      : (eventAttendees as any);
  }

  get event_attendee_id() {
    return this.getValue("event_attendee_id");
  }

  private getValue(prop: any) {
    const optional = ["event_attendee_id"];
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
