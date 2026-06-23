import { AggregateRoot, Uuid } from "../../shared/domain";
import { EventMusicianValidatorFactory } from "./event-musician.validator";
import { EventMusicianFakeBuilder } from "./event-musician-fake.builder";

export type EventMusicianStatus = "confirmed" | "pending" | "cancelled";

export type EventMusicianConstructorProps = {
  event_musician_id?: EventMusicianId;
  event_id: Uuid;
  musician_id?: Uuid | null;
  band_id?: Uuid | null;
  fee?: number | null;
  status?: EventMusicianStatus;
  start_at?: Date | null;
  end_at?: Date | null;
  created_at?: Date;
};

export type EventMusicianCreateCommand = {
  event_id: string;
  musician_id?: string | null;
  band_id?: string | null;
  fee?: number | null;
  status?: EventMusicianStatus;
  start_at?: Date | null;
  end_at?: Date | null;
};

export class EventMusicianId extends Uuid {}

export class EventMusician extends AggregateRoot {
  event_musician_id: EventMusicianId;
  event_id: Uuid;
  musician_id: Uuid | null;
  band_id: Uuid | null;
  fee: number | null;
  status: EventMusicianStatus;
  start_at: Date | null;
  end_at: Date | null;
  created_at: Date;

  constructor(props: EventMusicianConstructorProps) {
    super();
    this.event_musician_id = props.event_musician_id ?? new EventMusicianId();
    this.event_id = props.event_id;
    this.musician_id = props.musician_id ?? null;
    this.band_id = props.band_id ?? null;
    this.fee = props.fee ?? null;
    this.status = props.status ?? "confirmed";
    this.start_at = props.start_at ?? null;
    this.end_at = props.end_at ?? null;
    this.created_at = props.created_at ?? new Date();
  }

  static create(command: EventMusicianCreateCommand): EventMusician {
    const entity = new EventMusician({
      event_id: new Uuid(command.event_id),
      musician_id: command.musician_id ? new Uuid(command.musician_id) : null,
      band_id: command.band_id ? new Uuid(command.band_id) : null,
      fee: command.fee ?? null,
      status: command.status ?? "confirmed",
      start_at: command.start_at ?? null,
      end_at: command.end_at ?? null,
    });
    entity.validate();
    return entity;
  }

  confirm(): void {
    if (this.status === "cancelled") {
      this.notification.addError(
        "Cancelled lineup entries cannot be confirmed",
        "status",
      );
      return;
    }
    this.status = "confirmed";
    this.validate();
  }

  cancel(): void {
    this.status = "cancelled";
    this.validate();
  }

  changeFee(fee: number | null): void {
    this.fee = fee ?? null;
    this.validate();
  }

  setPerformanceWindow(start_at: Date | null, end_at: Date | null): void {
    this.start_at = start_at ?? null;
    this.end_at = end_at ?? null;
    this.validate();
  }

  validate(fields?: string[]): boolean {
    const validator = EventMusicianValidatorFactory.create();
    const isValid = validator.validate(this.notification, this, fields);

    const hasMusician = this.musician_id !== null;
    const hasBand = this.band_id !== null;
    if (hasMusician === hasBand) {
      this.notification.addError(
        "Either musician_id or band_id must be provided (exclusively)",
        "target",
      );
    }

    if (this.fee !== null && this.fee < 0) {
      this.notification.addError(
        "fee must be greater than or equal to 0",
        "fee",
      );
    }

    if (this.start_at && this.end_at) {
      if (this.end_at.getTime() <= this.start_at.getTime()) {
        this.notification.addError(
          "end_at must be greater than start_at",
          "end_at",
        );
      }
    }

    return isValid && !this.notification.hasErrors();
  }

  static fake() {
    return EventMusicianFakeBuilder;
  }

  get entity_id(): EventMusicianId {
    return this.event_musician_id;
  }

  toJSON() {
    return {
      event_musician_id: this.event_musician_id.id,
      event_id: this.event_id.id,
      musician_id: this.musician_id?.id ?? null,
      band_id: this.band_id?.id ?? null,
      fee: this.fee,
      status: this.status,
      start_at: this.start_at,
      end_at: this.end_at,
      created_at: this.created_at,
    };
  }
}
