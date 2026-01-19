import { AggregateRoot, Uuid } from "../../shared/domain";
import { EventValidatorFactory } from "./event.validator";
import { EventFakeBuilder } from "./event-fake.builder";

export type EventStatus = "scheduled" | "active" | "completed" | "cancelled";

export type EventConstructorProps = {
  event_id?: EventId;
  establishment_id: Uuid;
  name: string;
  description?: string | null;
  date: Date;
  start_at: Date;
  end_at: Date;
  status?: EventStatus;
  max_capacity?: number | null;
  current_capacity?: number;
  is_public?: boolean;
  cover_charge?: number | null;
  created_at?: Date;
  updated_at?: Date;
};

export type EventCreateCommand = {
  establishment_id: string;
  name: string;
  description?: string | null;
  date: Date;
  start_at: Date;
  end_at: Date;
  max_capacity?: number | null;
  is_public?: boolean;
  cover_charge?: number | null;
};

export type EventUpdateCommand = {
  name?: string;
  description?: string | null;
  date?: Date;
  start_at?: Date;
  end_at?: Date;
  max_capacity?: number | null;
  is_public?: boolean;
  cover_charge?: number | null;
};

export class EventId extends Uuid {}

export class Event extends AggregateRoot {
  event_id: EventId;
  establishment_id: Uuid;
  name: string;
  description: string | null;
  date: Date;
  start_at: Date;
  end_at: Date;
  status: EventStatus;
  max_capacity: number | null;
  current_capacity: number;
  is_public: boolean;
  cover_charge: number | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: EventConstructorProps) {
    super();
    this.event_id = props.event_id ?? new EventId();
    this.establishment_id = props.establishment_id;
    this.name = props.name;
    this.description = props.description ?? null;
    this.date = props.date;
    this.start_at = props.start_at;
    this.end_at = props.end_at;
    this.status = props.status ?? "scheduled";
    this.max_capacity = props.max_capacity ?? null;
    this.current_capacity = props.current_capacity ?? 0;
    this.is_public = props.is_public ?? true;
    this.cover_charge = props.cover_charge ?? null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  static create(command: EventCreateCommand): Event {
    const entity = new Event({
      establishment_id: new Uuid(command.establishment_id),
      name: command.name,
      description: command.description,
      date: command.date,
      start_at: command.start_at,
      end_at: command.end_at,
      max_capacity: command.max_capacity ?? null,
      is_public: command.is_public ?? true,
      cover_charge: command.cover_charge ?? null,
    });
    entity.validate();
    return entity;
  }

  update(command: EventUpdateCommand): void {
    if (command.name !== undefined) {
      this.name = command.name;
    }
    if (command.description !== undefined) {
      this.description = command.description;
    }
    if (command.date !== undefined) {
      this.date = command.date;
    }
    if (command.start_at !== undefined) {
      this.start_at = command.start_at;
    }
    if (command.end_at !== undefined) {
      this.end_at = command.end_at;
    }
    if (command.max_capacity !== undefined) {
      this.max_capacity = command.max_capacity;
    }
    if (command.is_public !== undefined) {
      this.is_public = command.is_public;
    }
    if (command.cover_charge !== undefined) {
      this.cover_charge = command.cover_charge;
    }

    this.updated_at = new Date();
    this.validate();
  }

  activate(): void {
    if (this.status === "cancelled") {
      this.notification.addError("Event is cancelled", "status");
      return;
    }
    if (this.status === "completed") {
      this.notification.addError("Event is completed", "status");
      return;
    }
    this.status = "active";
    this.updated_at = new Date();
  }

  cancel(): void {
    if (this.status === "completed") {
      this.notification.addError("Event is completed", "status");
      return;
    }
    this.status = "cancelled";
    this.updated_at = new Date();
  }

  finish(): void {
    if (this.status === "cancelled") {
      this.notification.addError("Event is cancelled", "status");
      return;
    }
    this.status = "completed";
    this.updated_at = new Date();
  }

  addAttendee(): void {
    if (this.status === "cancelled" || this.status === "completed") {
      this.notification.addError("Event is not accepting attendees", "status");
      return;
    }
    if (
      this.max_capacity !== null &&
      this.current_capacity >= this.max_capacity
    ) {
      this.notification.addError("Event is at full capacity", "max_capacity");
      return;
    }
    this.current_capacity += 1;
    this.updated_at = new Date();
  }

  removeAttendee(): void {
    if (this.current_capacity <= 0) {
      this.notification.addError(
        "Event current capacity cannot be negative",
        "current_capacity",
      );
      return;
    }
    this.current_capacity -= 1;
    this.updated_at = new Date();
  }

  validate(fields?: string[]): boolean {
    const validator = EventValidatorFactory.create();
    const isValid = validator.validate(this.notification, this, fields);

    if (this.start_at && this.end_at) {
      if (this.end_at.getTime() <= this.start_at.getTime()) {
        this.notification.addError(
          "end_at must be greater than start_at",
          "end_at",
        );
      }
    }

    if (this.max_capacity !== null) {
      if (this.max_capacity < 0) {
        this.notification.addError(
          "max_capacity must be greater than or equal to 0",
          "max_capacity",
        );
      }
      if (this.current_capacity > this.max_capacity) {
        this.notification.addError(
          "current_capacity cannot exceed max_capacity",
          "current_capacity",
        );
      }
    }

    if (this.current_capacity < 0) {
      this.notification.addError(
        "current_capacity must be greater than or equal to 0",
        "current_capacity",
      );
    }

    if (this.cover_charge !== null && this.cover_charge < 0) {
      this.notification.addError(
        "cover_charge must be greater than or equal to 0",
        "cover_charge",
      );
    }

    return isValid && !this.notification.hasErrors();
  }

  static fake() {
    return EventFakeBuilder;
  }

  get entity_id(): EventId {
    return this.event_id;
  }

  toJSON() {
    return {
      event_id: this.event_id.id,
      establishment_id: this.establishment_id.id,
      name: this.name,
      description: this.description,
      date: this.date,
      start_at: this.start_at,
      end_at: this.end_at,
      status: this.status,
      max_capacity: this.max_capacity,
      current_capacity: this.current_capacity,
      is_public: this.is_public,
      cover_charge: this.cover_charge,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
