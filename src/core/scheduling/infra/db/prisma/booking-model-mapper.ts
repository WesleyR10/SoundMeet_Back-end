import { BookingStatus as PrismaBookingStatus } from "@prisma/client";

import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { Booking, BookingId } from "../../../domain/booking.aggregate";

export type BookingModelProps = {
  id: string;
  establishmentId: string;
  musicianId: string | null;
  bandId: string | null;
  eventId: string | null;
  start_at: Date;
  end_at: Date;
  fee: number | null;
  notes: string | null;
  status: PrismaBookingStatus;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  buffer_minutes: number;
  expires_at: Date | null;
  free_cancellation_hours: number;
  confirmed_at: Date | null;
  cancelled_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export class BookingModelMapper {
  static toModel(entity: Booking): BookingModelProps {
    return {
      id: entity.booking_id.id,
      establishmentId: entity.establishment_id.id,
      musicianId: entity.musician_id?.id ?? null,
      bandId: entity.band_id?.id ?? null,
      eventId: entity.event_id?.id ?? null,
      start_at: entity.start_at,
      end_at: entity.end_at,
      fee: entity.fee,
      notes: entity.notes,
      status: entity.status.value as PrismaBookingStatus,
      cancelled_by: entity.cancelled_by,
      cancellation_reason: entity.cancellation_reason,
      buffer_minutes: entity.buffer_minutes,
      expires_at: entity.expires_at,
      free_cancellation_hours: entity.free_cancellation_hours,
      confirmed_at: entity.confirmed_at,
      cancelled_at: entity.cancelled_at,
      completed_at: entity.completed_at,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: BookingModelProps): Booking {
    const booking = new Booking({
      booking_id: new BookingId(model.id),
      establishment_id: model.establishmentId,
      musician_id: model.musicianId,
      band_id: model.bandId,
      event_id: model.eventId,
      start_at: model.start_at,
      end_at: model.end_at,
      fee: model.fee !== null ? Number(model.fee) : null,
      notes: model.notes,
      status: model.status,
      cancelled_by: model.cancelled_by,
      cancellation_reason: model.cancellation_reason,
      buffer_minutes: model.buffer_minutes,
      expires_at: model.expires_at,
      free_cancellation_hours: model.free_cancellation_hours,
      confirmed_at: model.confirmed_at,
      cancelled_at: model.cancelled_at,
      completed_at: model.completed_at,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });

    booking.validate();

    if (booking.notification.hasErrors()) {
      throw new LoadEntityError(booking.notification.toJSON());
    }

    return booking;
  }
}
