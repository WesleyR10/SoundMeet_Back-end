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
  /**
   * Lado que originou a proposta. `null` em bookings anteriores ao campo — o
   * consumidor trata a ausência como "não registrado". Ver o agregado.
   */
  proposed_by: string | null;
  buffer_minutes: number;
  buffered_start_at: Date;
  buffered_end_at: Date;
  expires_at: Date | null;
  free_cancellation_hours: number;
  confirmed_at: Date | null;
  cancelled_at: Date | null;
  completed_at: Date | null;
  /** Registro da apresentação — prova de execução do serviço (F1.3a). */
  checked_in_at: Date | null;
  checked_in_by: string | null;
  disputed_at: Date | null;
  dispute_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

export class BookingOutputMapper {
  static toOutput(entity: Booking): BookingOutput {
    const { booking_id, ...otherProps } = entity.toJSON();
    return {
      id: booking_id,
      ...otherProps,
      buffered_start_at: entity.bufferedStartAt,
      buffered_end_at: entity.bufferedEndAt,
    };
  }
}
