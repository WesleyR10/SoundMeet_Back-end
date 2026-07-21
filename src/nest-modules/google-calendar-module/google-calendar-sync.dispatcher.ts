import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";

import {
  GoogleCalendarSyncEnqueueCommand,
  IGoogleCalendarSyncDispatcher,
} from "../../core/google-calendar/application/ports/google-calendar-sync-dispatcher.interface";
import { GOOGLE_CALENDAR_SYNC_RABBITMQ } from "./rabbitmq/google-calendar-sync.rabbitmq";

/**
 * Default seguro quando `GOOGLE_CALENDAR_SYNC_TRANSPORT` não é "rabbitmq" ou
 * não há conexão AMQP — a feature fica inerte sem quebrar o fluxo de booking.
 */
export class GoogleCalendarSyncNoopDispatcher implements IGoogleCalendarSyncDispatcher {
  async enqueueBookingConfirmed(
    _command: GoogleCalendarSyncEnqueueCommand,
  ): Promise<void> {}

  async enqueueBookingCancelled(
    _command: GoogleCalendarSyncEnqueueCommand,
  ): Promise<void> {}
}

export class GoogleCalendarSyncRabbitmqDispatcher implements IGoogleCalendarSyncDispatcher {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  async enqueueBookingConfirmed(
    command: GoogleCalendarSyncEnqueueCommand,
  ): Promise<void> {
    await this.publish(
      GOOGLE_CALENDAR_SYNC_RABBITMQ.routingKeys.bookingConfirmed,
      command,
    );
  }

  async enqueueBookingCancelled(
    command: GoogleCalendarSyncEnqueueCommand,
  ): Promise<void> {
    await this.publish(
      GOOGLE_CALENDAR_SYNC_RABBITMQ.routingKeys.bookingCancelled,
      command,
    );
  }

  private async publish(
    routingKey: string,
    command: GoogleCalendarSyncEnqueueCommand,
  ): Promise<void> {
    await this.amqpConnection.publish(
      GOOGLE_CALENDAR_SYNC_RABBITMQ.exchange,
      routingKey,
      command,
      {
        messageId: command.booking_id,
        persistent: true,
      },
    );
  }
}
