import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { IGoogleCalendarSyncDispatcher } from "../../core/google-calendar/application/ports/google-calendar-sync-dispatcher.interface";
import { BookingCancelledEvent } from "../../core/scheduling/domain/events/booking-cancelled.event";
import { BookingConfirmedEvent } from "../../core/scheduling/domain/events/booking-confirmed.event";

/**
 * Escuta os eventos de domínio do scheduling (cross-module via EventEmitter2,
 * mesmo precedente do notifications-module com os eventos do chat) e apenas
 * ENFILEIRA — a chamada real ao Google acontece no consumer da fila.
 *
 * O DomainEventMediator usa emitAsync: qualquer erro aqui subiria para o
 * ConfirmBooking/CancelBookingUseCase DEPOIS do booking já persistido — por
 * isso todo erro é engolido e logado, nunca propagado.
 */
@Injectable()
export class GoogleCalendarSyncEventsHandler {
  private readonly logger = new Logger(GoogleCalendarSyncEventsHandler.name);

  constructor(
    @Inject("GoogleCalendarSyncDispatcher")
    private readonly dispatcher: IGoogleCalendarSyncDispatcher,
  ) {}

  @OnEvent(BookingConfirmedEvent.name)
  async onBookingConfirmed(event: BookingConfirmedEvent) {
    try {
      await this.dispatcher.enqueueBookingConfirmed({
        booking_id: event.aggregate_id.id,
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "google_calendar_sync.enqueue_failed",
          action: "booking_confirmed",
          booking_id: event.aggregate_id.id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  @OnEvent(BookingCancelledEvent.name)
  async onBookingCancelled(event: BookingCancelledEvent) {
    try {
      await this.dispatcher.enqueueBookingCancelled({
        booking_id: event.aggregate_id.id,
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "google_calendar_sync.enqueue_failed",
          action: "booking_cancelled",
          booking_id: event.aggregate_id.id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
