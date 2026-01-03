import { Transform } from "class-transformer";

import { BookingOutput } from "../../core/scheduling/application/use-cases/common/booking-output";

export class BookingPresenter {
  id: string;
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
  event_id: string | null;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  start_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  end_at: Date;
  fee: number | null;
  notes: string | null;
  status: string;
  buffer_minutes: number;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  buffered_start_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  buffered_end_at: Date;
  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  expires_at: Date | null;
  free_cancellation_hours: number;
  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  confirmed_at: Date | null;
  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  cancelled_at: Date | null;
  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  completed_at: Date | null;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: BookingOutput) {
    this.id = output.id;
    this.establishment_id = output.establishment_id;
    this.musician_id = output.musician_id;
    this.band_id = output.band_id;
    this.event_id = output.event_id;
    this.start_at = output.start_at;
    this.end_at = output.end_at;
    this.fee = output.fee;
    this.notes = output.notes;
    this.status = output.status;
    this.buffer_minutes = output.buffer_minutes;
    this.buffered_start_at = output.buffered_start_at;
    this.buffered_end_at = output.buffered_end_at;
    this.expires_at = output.expires_at;
    this.free_cancellation_hours = output.free_cancellation_hours;
    this.confirmed_at = output.confirmed_at;
    this.cancelled_at = output.cancelled_at;
    this.completed_at = output.completed_at;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}
