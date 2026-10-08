import { ForbiddenException } from "@nestjs/common";

import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Booking, BookingId } from "../../../domain/booking.aggregate";
import { IBookingRepository } from "../../../domain/booking.repository";
import { BookingOutput, BookingOutputMapper } from "../common/booking-output";
import { DisputeBookingInput } from "./dispute-booking.input";

export type DisputeBookingOutput = BookingOutput;

/**
 * O estabelecimento contesta a apresentação.
 *
 * ## Só o CONTRATANTE contesta, e isso não é simetria esquecida
 *
 * Contestar é dizer "o serviço não foi entregue como combinado" — só quem pagou
 * e recebeu o serviço tem essa posição. O artista discordando de algo tem outro
 * caminho (o chat, o cancelamento, a mediação); deixá-lo contestar significaria
 * poder travar o próprio pagamento, o que não faz sentido nenhum.
 *
 * Por isso a checagem aqui **não** é `assertNegotiationParticipant`: aquele
 * aceita qualquer lado.
 *
 * ## Por que este use-case não toca a custódia
 *
 * `SchedulingModule` não conhece `payment` — marcar o booking é suficiente para
 * bloquear a liberação automática, porque `ProcessDueEscrowReleasesUseCase`
 * confere `booking.isDisputed` antes de liberar. Congelar o agregado
 * `BookingEscrow` é ato da mediação, que é humana por desenho.
 */
export class DisputeBookingUseCase implements IUseCase<
  DisputeBookingInput,
  DisputeBookingOutput
> {
  constructor(
    private readonly bookingRepo: IBookingRepository,
    private readonly clock: IClock = { now: () => new Date() },
  ) {}

  async execute(input: DisputeBookingInput): Promise<DisputeBookingOutput> {
    const booking = await this.bookingRepo.findById(
      new BookingId(input.booking_id),
    );
    if (!booking) {
      throw new NotFoundError(input.booking_id, Booking);
    }

    this.assertIsContractor(input, booking);

    const wasDisputed = booking.isDisputed;

    booking.dispute({ reason: input.reason, at: this.clock.now() });

    if (booking.notification.hasErrors()) {
      throw new EntityValidationError(booking.notification.toJSON());
    }

    if (!wasDisputed) {
      await this.bookingRepo.update(booking);
    }

    return BookingOutputMapper.toOutput(booking);
  }

  private assertIsContractor(
    input: DisputeBookingInput,
    booking: Booking,
  ): void {
    if (input.is_admin === true) {
      return;
    }

    const actorIds = (input.requesting_participant_ids ?? []).filter(Boolean);

    /*
     * Fail-closed sobre lista vazia. Os helpers de `negotiation-actor` pulam a
     * checagem quando o ator não tem identidade — convenção dos jobs internos —
     * e aqui isso deixaria qualquer token sem claim contestar qualquer show.
     */
    if (!actorIds.includes(booking.establishment_id.id)) {
      throw new ForbiddenException(
        "Somente o estabelecimento contratante pode contestar a apresentação.",
      );
    }
  }
}
