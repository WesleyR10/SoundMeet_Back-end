import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";

import {
  GoogleCalendarSyncNoopDispatcher,
  GoogleCalendarSyncRabbitmqDispatcher,
} from "../google-calendar-sync.dispatcher";
import { GOOGLE_CALENDAR_SYNC_RABBITMQ } from "../rabbitmq/google-calendar-sync.rabbitmq";

describe("GoogleCalendarSyncRabbitmqDispatcher", () => {
  const makeAmqp = () =>
    ({
      publish: jest.fn().mockResolvedValue(undefined),
    }) as unknown as jest.Mocked<AmqpConnection>;

  it("publica confirmação com routing key, messageId e persistência corretos", async () => {
    const amqp = makeAmqp();
    const dispatcher = new GoogleCalendarSyncRabbitmqDispatcher(amqp);

    await dispatcher.enqueueBookingConfirmed({ booking_id: "booking-1" });

    expect(amqp.publish).toHaveBeenCalledWith(
      GOOGLE_CALENDAR_SYNC_RABBITMQ.exchange,
      GOOGLE_CALENDAR_SYNC_RABBITMQ.routingKeys.bookingConfirmed,
      { booking_id: "booking-1" },
      { messageId: "booking-1", persistent: true },
    );
  });

  it("publica cancelamento na routing key própria", async () => {
    const amqp = makeAmqp();
    const dispatcher = new GoogleCalendarSyncRabbitmqDispatcher(amqp);

    await dispatcher.enqueueBookingCancelled({ booking_id: "booking-2" });

    expect(amqp.publish).toHaveBeenCalledWith(
      GOOGLE_CALENDAR_SYNC_RABBITMQ.exchange,
      GOOGLE_CALENDAR_SYNC_RABBITMQ.routingKeys.bookingCancelled,
      { booking_id: "booking-2" },
      { messageId: "booking-2", persistent: true },
    );
  });
});

describe("GoogleCalendarSyncNoopDispatcher", () => {
  it("não faz nada (transporte desligado é o default seguro)", async () => {
    const dispatcher = new GoogleCalendarSyncNoopDispatcher();

    await expect(
      dispatcher.enqueueBookingConfirmed({ booking_id: "x" }),
    ).resolves.toBeUndefined();
    await expect(
      dispatcher.enqueueBookingCancelled({ booking_id: "x" }),
    ).resolves.toBeUndefined();
  });
});
