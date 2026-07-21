export type GoogleCalendarSyncEnqueueCommand = {
  booking_id: string;
};

/**
 * Porta de enfileiramento do sync — implementações no nest-module
 * (`google-calendar-sync.dispatcher.ts`): Noop (transporte desligado) e
 * RabbitMQ (produção). A chamada real à API do Google acontece só no consumer.
 */
export interface IGoogleCalendarSyncDispatcher {
  enqueueBookingConfirmed(
    command: GoogleCalendarSyncEnqueueCommand,
  ): Promise<void>;
  enqueueBookingCancelled(
    command: GoogleCalendarSyncEnqueueCommand,
  ): Promise<void>;
}
