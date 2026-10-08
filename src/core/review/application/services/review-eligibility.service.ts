import { ForbiddenException } from "@nestjs/common";

import { EventId } from "../../../events/domain/event.aggregate";
import { IEventRepository } from "../../../events/domain/event.repository";
import { IEventAttendeeRepository } from "../../../events/domain/event-attendee.repository";
import { IEventMusicianRepository } from "../../../events/domain/event-musician.repository";
import { BookingId } from "../../../scheduling/domain/booking.aggregate";
import { IBookingRepository } from "../../../scheduling/domain/booking.repository";
import { BookingStatusEnum } from "../../../shared/domain/value-objects/booking-status.vo";
import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import {
  ReviewAuthorType,
  ReviewContextType,
  ReviewTargetType,
} from "../../domain/review.aggregate";

export type EligibilityRequest = {
  target_type: ReviewTargetType;
  target_id: string;
  author_type: ReviewAuthorType;
  author_id: string;
  context_type: ReviewContextType;
  context_id: string;
};

/**
 * Prova que autor e alvo realmente se encontraram, antes de deixar a
 * avaliação entrar no ledger.
 *
 * Esta é a única defesa real contra rating farming. Sem ela, `POST
 * /musicians/:id/ratings` seria um endpoint para escrever a nota de qualquer
 * pessoa — e é a nota que ordena a busca do dashboard de contratação.
 *
 * **Não basta ter ido a um evento**: o alvo também precisa estar ligado
 * àquele evento. Checar só a presença deixaria um fã avaliar qualquer músico
 * do país usando um evento que ele assistiu.
 */
export class ReviewEligibilityService {
  constructor(
    private readonly bookingRepo: IBookingRepository,
    private readonly eventAttendeeRepo: IEventAttendeeRepository,
    private readonly eventRepo: IEventRepository,
    private readonly eventMusicianRepo: IEventMusicianRepository,
  ) {}

  async assertEligible(request: EligibilityRequest): Promise<void> {
    if (request.author_type === "audience") {
      return this.assertAudienceAttendedEventWithTarget(request);
    }
    return this.assertCompletedBookingBetweenParties(request);
  }

  /** Fã → músico ou estabelecimento, com o evento como prova. */
  private async assertAudienceAttendedEventWithTarget(
    request: EligibilityRequest,
  ): Promise<void> {
    if (request.context_type !== "event") {
      throw new ForbiddenException(
        "Avaliação do público precisa referenciar um evento.",
      );
    }

    const eventId = this.toUuid(request.context_id, "evento");

    const attendance = await this.eventAttendeeRepo.findByEventAndAudience(
      eventId,
      this.toUuid(request.author_id, "público"),
    );

    if (!attendance) {
      throw new ForbiddenException(
        "Só é possível avaliar eventos em que você esteve presente.",
      );
    }

    const event = await this.eventRepo.findById(new EventId(eventId.id));
    if (!event) {
      throw new ForbiddenException("Evento não encontrado.");
    }

    if (request.target_type === "establishment") {
      if (event.establishment_id.id !== request.target_id) {
        throw new ForbiddenException(
          "Este evento não pertence ao estabelecimento que você está avaliando.",
        );
      }
      return;
    }

    // Alvo é músico: ele precisa ter sido escalado NAQUELE evento. Sem esta
    // checagem, um fã avaliaria qualquer músico usando um evento qualquer.
    const performers = await this.eventMusicianRepo.findByEvent(eventId);
    const performed = performers.some(
      (p) => p.musician_id?.id === request.target_id,
    );

    if (!performed) {
      throw new ForbiddenException(
        "Este músico não se apresentou no evento informado.",
      );
    }
  }

  /** Músico ↔ estabelecimento, com o show concluído como prova. */
  private async assertCompletedBookingBetweenParties(
    request: EligibilityRequest,
  ): Promise<void> {
    if (request.context_type !== "booking") {
      throw new ForbiddenException(
        "Avaliação entre músico e estabelecimento precisa referenciar uma reserva.",
      );
    }

    const booking = await this.bookingRepo.findById(
      new BookingId(this.toUuid(request.context_id, "reserva").id),
    );

    if (!booking) {
      throw new ForbiddenException("Reserva não encontrada.");
    }

    // Só show CONCLUÍDO gera avaliação. Um booking cancelado ou apenas
    // confirmado ainda não produziu experiência para avaliar — e permitir
    // isso abriria retaliação por cancelamento.
    if (booking.status.value !== BookingStatusEnum.COMPLETED) {
      throw new ForbiddenException(
        "Só é possível avaliar após a conclusão do show.",
      );
    }

    const sides = [
      booking.establishment_id.id,
      booking.musician_id?.id,
      booking.band_id?.id,
    ].filter((id): id is string => !!id);

    if (!sides.includes(request.author_id)) {
      throw new ForbiddenException("Você não participou desta reserva.");
    }

    if (!sides.includes(request.target_id)) {
      throw new ForbiddenException("O avaliado não participou desta reserva.");
    }
  }

  private toUuid(value: string, label: string): Uuid {
    try {
      return new Uuid(value);
    } catch {
      throw new ForbiddenException(`Identificador de ${label} inválido.`);
    }
  }
}
