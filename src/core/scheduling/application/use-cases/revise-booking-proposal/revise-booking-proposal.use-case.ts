import { IBandRepository } from "../../../../musician/domain/band.repository";
import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IDateTimeService } from "../../../../shared/domain";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { IAvailabilityRepository } from "../../../domain/availability.repository";
import { Booking, BookingId } from "../../../domain/booking.aggregate";
import { IBookingRepository } from "../../../domain/booking.repository";
import { BookingOutput, BookingOutputMapper } from "../common/booking-output";
import { assertNegotiationParticipant } from "../common/negotiation-actor";
import { ReviseBookingProposalInput } from "./revise-booking-proposal.input";

/** Mesmo prazo padrão de `ProposeBookingUseCase`: a nova oferta ganha 48h. */
const DEFAULT_EXPIRATION_HOURS = 48;

/**
 * Nova proposta sobre uma negociação existente — a contraproposta do chat.
 *
 * Quem pode: qualquer um dos lados (`assertNegotiationParticipant`, com
 * liderança exigida quando o vínculo é só a banda), como na proposta original.
 * Quem responde: a contraparte, pelas rotas de sempre (`confirm`/`cancel`) —
 * `proposed_by` passa a apontar para quem revisou.
 *
 * ## Por que checar agenda aqui, se o `confirm` já checa
 *
 * O `ConfirmBookingUseCase` revalida disponibilidade e conflito — ele é a
 * barreira. Esta checagem é para a proposta não NASCER impossível: sem ela o
 * estabelecimento enviaria uma data em que o artista já tem show confirmado,
 * o artista tocaria em "Aceitar" e levaria um erro sobre uma escolha que não
 * foi dele.
 */
export class ReviseBookingProposalUseCase implements IUseCase<
  ReviseBookingProposalInput,
  BookingOutput
> {
  constructor(
    private readonly bookingRepo: IBookingRepository,
    private readonly dateTimeService: IDateTimeService,
    private readonly availabilityRepo?: IAvailabilityRepository,
    private readonly bandRepo?: IBandRepository,
    private readonly clock: IClock = { now: () => new Date() },
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(input: ReviseBookingProposalInput): Promise<BookingOutput> {
    const entity = await this.bookingRepo.findById(
      new BookingId(input.booking_id),
    );
    if (!entity) {
      throw new NotFoundError(input.booking_id, Booking);
    }

    await assertNegotiationParticipant(
      input,
      {
        establishment_id: entity.establishment_id.id,
        musician_id: entity.musician_id?.id ?? null,
        band_id: entity.band_id?.id ?? null,
      },
      "revisar esta proposta",
      this.bandRepo,
    );

    const now = this.clock.now();

    entity.reviseProposal({
      start_at: input.start_at,
      end_at: input.end_at,
      fee: input.fee ?? null,
      notes: input.notes?.trim() ? input.notes.trim() : null,
      proposed_by: input.proposed_by,
      expires_at: this.dateTimeService.addHours(now, DEFAULT_EXPIRATION_HOURS),
      now,
    });

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.assertPerformerCanTake(entity);

    await this.bookingRepo.update(entity);

    if (this.domainEventMediator) {
      await this.domainEventMediator.publish(entity);
      await this.domainEventMediator.publishIntegrationEvents(entity);
      entity.clearEvents();
    }

    return BookingOutputMapper.toOutput(entity);
  }

  /**
   * As mesmas três perguntas do `ConfirmBookingUseCase` — agenda publicada,
   * show confirmado no intervalo e teto de shows por dia —, feitas ANTES de a
   * proposta chegar ao artista. A contagem por dia usa o fuso da agenda, como
   * no confirm: um show às 23h de sexta em Manaus não pode contar no sábado.
   */
  private async assertPerformerCanTake(entity: Booking): Promise<void> {
    const start = entity.bufferedStartAt;
    const end = entity.bufferedEndAt;

    const musicianId = entity.musician_id?.id ?? null;
    const bandId = entity.band_id?.id ?? null;

    const availability = this.availabilityRepo
      ? musicianId
        ? await this.availabilityRepo.findByMusicianId(musicianId)
        : bandId
          ? await this.availabilityRepo.findByBandId(bandId)
          : null
      : null;

    if (
      availability &&
      !availability.isAvailable(start, end, this.dateTimeService)
    ) {
      entity.notification.addError(
        musicianId
          ? "Musician is unavailable for this period"
          : "Band is unavailable for this period",
        "availability",
      );
      throw new EntityValidationError(entity.notification.toJSON());
    }

    const conflicts = musicianId
      ? await this.bookingRepo.findConfirmedInRangeByMusician(
          musicianId,
          start,
          end,
        )
      : bandId
        ? await this.bookingRepo.findConfirmedInRangeByBand(bandId, start, end)
        : [];

    if (conflicts.length) {
      entity.notification.addError(
        musicianId
          ? "Musician already has a confirmed booking for this period"
          : "Band already has a confirmed booking for this period",
        "conflict",
      );
      throw new EntityValidationError(entity.notification.toJSON());
    }

    if (availability && availability.max_shows_per_day !== null) {
      const showsThatDay = musicianId
        ? await this.bookingRepo.countConfirmedOnDayByMusician(
            musicianId,
            entity.start_at,
            availability.timezone,
          )
        : await this.bookingRepo.countConfirmedOnDayByBand(
            bandId as string,
            entity.start_at,
            availability.timezone,
          );

      if (showsThatDay >= availability.max_shows_per_day) {
        entity.notification.addError(
          musicianId
            ? "Musician reached the maximum shows per day"
            : "Band reached the maximum shows per day",
          "max_shows_per_day",
        );
        throw new EntityValidationError(entity.notification.toJSON());
      }
    }
  }
}
