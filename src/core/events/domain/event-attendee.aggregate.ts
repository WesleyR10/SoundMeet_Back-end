import { AggregateRoot, Uuid } from "../../shared/domain";
import { EventAttendeeValidatorFactory } from "./event-attendee.validator";
import { EventAttendeeFakeBuilder } from "./event-attendee-fake.builder";

export type EventAttendeeConstructorProps = {
  event_attendee_id?: EventAttendeeId;
  event_id: Uuid;
  audience_id: Uuid;
  joined_at?: Date;
  left_at?: Date | null;
  is_active?: boolean;
};

export type EventAttendeeCreateCommand = {
  event_id: string;
  audience_id: string;
  joined_at?: Date;
};

export class EventAttendeeId extends Uuid {}

export class EventAttendee extends AggregateRoot {
  event_attendee_id: EventAttendeeId;
  event_id: Uuid;
  audience_id: Uuid;
  joined_at: Date;
  left_at: Date | null;
  is_active: boolean;

  constructor(props: EventAttendeeConstructorProps) {
    super();
    this.event_attendee_id = props.event_attendee_id ?? new EventAttendeeId();
    this.event_id = props.event_id;
    this.audience_id = props.audience_id;
    this.joined_at = props.joined_at ?? new Date();
    this.left_at = props.left_at ?? null;
    this.is_active = props.is_active ?? true;
  }

  static create(command: EventAttendeeCreateCommand): EventAttendee {
    const entity = new EventAttendee({
      event_id: new Uuid(command.event_id),
      audience_id: new Uuid(command.audience_id),
      joined_at: command.joined_at ?? new Date(),
    });
    entity.validate();
    return entity;
  }

  leave(left_at: Date): void {
    if (!this.is_active) {
      this.notification.addError(
        "Attendee already left the event",
        "is_active",
      );
      return;
    }
    this.is_active = false;
    this.left_at = left_at;
    this.validate();
  }

  rejoin(joined_at: Date): void {
    this.is_active = true;
    this.left_at = null;
    this.joined_at = joined_at;
    this.validate();
  }

  get isActive(): boolean {
    return this.is_active;
  }

  validate(fields?: string[]): boolean {
    const validator = EventAttendeeValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return EventAttendeeFakeBuilder;
  }

  get entity_id(): EventAttendeeId {
    return this.event_attendee_id;
  }

  toJSON() {
    return {
      event_attendee_id: this.event_attendee_id.id,
      event_id: this.event_id.id,
      audience_id: this.audience_id.id,
      joined_at: this.joined_at,
      left_at: this.left_at,
      is_active: this.is_active,
    };
  }
}
