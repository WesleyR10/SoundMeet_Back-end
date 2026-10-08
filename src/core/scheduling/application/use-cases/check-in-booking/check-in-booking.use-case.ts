import { IBandRepository } from "../../../../musician/domain/band.repository";
import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Booking, BookingId } from "../../../domain/booking.aggregate";
import { IBookingRepository } from "../../../domain/booking.repository";
import { BookingOutput, BookingOutputMapper } from "../common/booking-output";
import { assertNegotiationParticipant } from "../common/negotiation-actor";
import { CheckInBookingInput } from "./check-in-booking.input";

export type CheckInBookingOutput = BookingOutput;

/**
 * O artista registra que a apresentação aconteceu.
 *
 * ## Por que vale mesmo sem escrow
 *
 * É a camada 3 de proteção contra chargeback de
 * `decisoes-de-gateway.md`: prova documental de execução do serviço,
 * datada pelo servidor. Numa disputa "serviço não entregue", é ela somada ao
 * contrato assinado que fecha o caso.
 *
 * ## Quem pode
 *
 * `assertNegotiationParticipant` — o mesmo de confirmar e cancelar, **incluindo
 * a regra do líder de banda**. Check-in é declaração de fato em nome de quem
 * tocou; deixar qualquer integrante declarar pela banda abriria a porta para o
 * registro sair errado sem ninguém responsável.
 *
 * 🔴 **O estabelecimento também é participante e, portanto, também pode.** É
 * deliberado: em muita casa quem tem o app aberto no fim da noite é o dono, e
 * um check-in feito pela contraparte é prova ainda mais forte a favor do
 * artista. O que o `by` registra é qual LADO declarou.
 */
export class CheckInBookingUseCase implements IUseCase<
  CheckInBookingInput,
  CheckInBookingOutput
> {
  constructor(
    private readonly bookingRepo: IBookingRepository,
    private readonly bandRepo?: IBandRepository,
    private readonly clock: IClock = { now: () => new Date() },
  ) {}

  async execute(input: CheckInBookingInput): Promise<CheckInBookingOutput> {
    const booking = await this.bookingRepo.findById(
      new BookingId(input.booking_id),
    );
    if (!booking) {
      throw new NotFoundError(input.booking_id, Booking);
    }

    await assertNegotiationParticipant(
      input,
      {
        establishment_id: booking.establishment_id.id,
        musician_id: booking.musician_id?.id ?? null,
        band_id: booking.band_id?.id ?? null,
      },
      "registrar a apresentação deste show",
      this.bandRepo,
    );

    const wasCheckedIn = booking.isCheckedIn;

    booking.checkIn({
      at: this.clock.now(),
      by: booking.band_id ? "band" : "musician",
    });

    if (booking.notification.hasErrors()) {
      throw new EntityValidationError(booking.notification.toJSON());
    }

    // Já registrado: devolve o estado sem gravar de novo. Repetir o `update`
    // mexeria em `updated_at` por nada e daria a impressão de um segundo fato.
    if (!wasCheckedIn) {
      await this.bookingRepo.update(booking);
    }

    return BookingOutputMapper.toOutput(booking);
  }
}
