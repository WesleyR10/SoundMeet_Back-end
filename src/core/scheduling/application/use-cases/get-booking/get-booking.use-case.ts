import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Booking, BookingId } from "../../../domain/booking.aggregate";
import { IBookingRepository } from "../../../domain/booking.repository";
import { BookingOutput, BookingOutputMapper } from "../common/booking-output";
import {
  assertNegotiationViewer,
  NegotiationActor,
} from "../common/negotiation-actor";

export type GetBookingInput = {
  booking_id: string;
} & NegotiationActor;

export type GetBookingOutput = BookingOutput;

/**
 * Leitura de uma reserva por id (Bloco 9.2), escopada aos participantes.
 *
 * Usa `assertNegotiationViewer` — e não `assertNegotiationParticipant` — de
 * propósito: qualquer integrante da banda pode **ver** o show marcado, mesmo
 * sem ser líder. Liderança só é exigida para decidir (confirmar/cancelar).
 */
export class GetBookingUseCase implements IUseCase<
  GetBookingInput,
  GetBookingOutput
> {
  constructor(private readonly bookingRepo: IBookingRepository) {}

  async execute(input: GetBookingInput): Promise<GetBookingOutput> {
    const booking = await this.bookingRepo.findById(
      new BookingId(input.booking_id),
    );

    if (!booking) {
      throw new NotFoundError(input.booking_id, Booking);
    }

    assertNegotiationViewer(
      input,
      {
        establishment_id: booking.establishment_id.id,
        musician_id: booking.musician_id?.id ?? null,
        band_id: booking.band_id?.id ?? null,
      },
      "esta reserva",
    );

    return BookingOutputMapper.toOutput(booking);
  }
}
