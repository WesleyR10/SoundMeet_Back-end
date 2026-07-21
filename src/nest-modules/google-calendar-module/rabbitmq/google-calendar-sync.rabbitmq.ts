export const GOOGLE_CALENDAR_SYNC_RABBITMQ = {
  exchange: "direct.delayed",
  dlxExchange: "dlx.exchange",
  channel: "google_calendar_sync",
  routingKeys: {
    bookingConfirmed:
      process.env.RABBITMQ_ROUTING_KEY_GOOGLE_CALENDAR_BOOKING_CONFIRMED ||
      "google-calendar.booking-confirmed.requested",
    bookingCancelled:
      process.env.RABBITMQ_ROUTING_KEY_GOOGLE_CALENDAR_BOOKING_CANCELLED ||
      "google-calendar.booking-cancelled.requested",
  },
  queues: {
    bookingConfirmed:
      process.env.RABBITMQ_QUEUE_GOOGLE_CALENDAR_BOOKING_CONFIRMED ||
      "soundmeet.google_calendar_booking_confirmed",
    bookingCancelled:
      process.env.RABBITMQ_QUEUE_GOOGLE_CALENDAR_BOOKING_CANCELLED ||
      "soundmeet.google_calendar_booking_cancelled",
  },
} as const;
