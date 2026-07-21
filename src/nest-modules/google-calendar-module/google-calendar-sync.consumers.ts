import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable, UseFilters, ValidationPipe } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";

import { SyncBookingCancelledInput } from "../../core/google-calendar/application/use-cases/sync-booking-cancelled/sync-booking-cancelled.input";
import { SyncBookingCancelledToGoogleCalendarUseCase } from "../../core/google-calendar/application/use-cases/sync-booking-cancelled/sync-booking-cancelled.use-case";
import { SyncBookingConfirmedInput } from "../../core/google-calendar/application/use-cases/sync-booking-confirmed/sync-booking-confirmed.input";
import { SyncBookingConfirmedToGoogleCalendarUseCase } from "../../core/google-calendar/application/use-cases/sync-booking-confirmed/sync-booking-confirmed.use-case";
import { RabbitmqConsumeErrorFilter } from "../rabbitmq-module/rabbitmq-consume-error/rabbitmq-consume-error.filter";
import { GOOGLE_CALENDAR_SYNC_RABBITMQ } from "./rabbitmq/google-calendar-sync.rabbitmq";

// Chamadas ao Google são rápidas — 15s cobre retries internos do adapter.
const SYNC_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`GoogleCalendarSync timed out after ${ms}ms`)),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

@UseFilters(RabbitmqConsumeErrorFilter)
@Injectable()
export class GoogleCalendarSyncConsumers {
  constructor(private moduleRef: ModuleRef) {}

  @RabbitSubscribe({
    exchange: GOOGLE_CALENDAR_SYNC_RABBITMQ.exchange,
    routingKey: GOOGLE_CALENDAR_SYNC_RABBITMQ.routingKeys.bookingConfirmed,
    queue: GOOGLE_CALENDAR_SYNC_RABBITMQ.queues.bookingConfirmed,
    allowNonJsonMessages: false,
    queueOptions: {
      durable: true,
      deadLetterExchange: GOOGLE_CALENDAR_SYNC_RABBITMQ.dlxExchange,
      deadLetterRoutingKey:
        GOOGLE_CALENDAR_SYNC_RABBITMQ.routingKeys.bookingConfirmed,
      channel: GOOGLE_CALENDAR_SYNC_RABBITMQ.channel,
    },
  })
  async onBookingConfirmed(msg: { booking_id?: string }) {
    const input = new SyncBookingConfirmedInput({
      booking_id: `${msg?.booking_id ?? ""}`,
    });

    await new ValidationPipe({
      errorHttpStatusCode: 422,
    }).transform(input, {
      metatype: SyncBookingConfirmedInput,
      type: "body",
    });

    const useCase = await this.moduleRef.resolve(
      SyncBookingConfirmedToGoogleCalendarUseCase,
    );

    await withTimeout(
      useCase.execute({ booking_id: input.booking_id }),
      SYNC_TIMEOUT_MS,
    );
  }

  @RabbitSubscribe({
    exchange: GOOGLE_CALENDAR_SYNC_RABBITMQ.exchange,
    routingKey: GOOGLE_CALENDAR_SYNC_RABBITMQ.routingKeys.bookingCancelled,
    queue: GOOGLE_CALENDAR_SYNC_RABBITMQ.queues.bookingCancelled,
    allowNonJsonMessages: false,
    queueOptions: {
      durable: true,
      deadLetterExchange: GOOGLE_CALENDAR_SYNC_RABBITMQ.dlxExchange,
      deadLetterRoutingKey:
        GOOGLE_CALENDAR_SYNC_RABBITMQ.routingKeys.bookingCancelled,
      channel: GOOGLE_CALENDAR_SYNC_RABBITMQ.channel,
    },
  })
  async onBookingCancelled(msg: { booking_id?: string }) {
    const input = new SyncBookingCancelledInput({
      booking_id: `${msg?.booking_id ?? ""}`,
    });

    await new ValidationPipe({
      errorHttpStatusCode: 422,
    }).transform(input, {
      metatype: SyncBookingCancelledInput,
      type: "body",
    });

    const useCase = await this.moduleRef.resolve(
      SyncBookingCancelledToGoogleCalendarUseCase,
    );

    await withTimeout(
      useCase.execute({ booking_id: input.booking_id }),
      SYNC_TIMEOUT_MS,
    );
  }
}
