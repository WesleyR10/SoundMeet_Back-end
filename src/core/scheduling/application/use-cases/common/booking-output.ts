import { Booking } from "../../../domain/booking.aggregate";

export type BookingOutput = {
  id: string;
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
  event_id: string | null;
  start_at: Date;
  end_at: Date;
  fee: number | null;
  notes: string | null;
  status: string;
  buffer_minutes: number;
  buffered_start_at: Date;
  buffered_end_at: Date;
  expires_at: Date | null;
  free_cancellation_hours: number;
  confirmed_at: Date | null;
  cancelled_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export class BookingOutputMapper {
  static toOutput(entity: Booking): BookingOutput {
    const json = entity.toJSON();
    return {
      ...json,
      buffered_start_at: entity.bufferedStartAt,
      buffered_end_at: entity.bufferedEndAt,
    };
  }
}
