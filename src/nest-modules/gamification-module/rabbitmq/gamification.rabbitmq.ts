export const GAMIFICATION_RABBITMQ = {
  exchange: "soundmeet.events",
  dlxExchange: "dlx.exchange",
  channel: "gamification_events",
  routingKeys: {
    tipCompleted:
      process.env.RABBITMQ_ROUTING_KEY_PAYMENT_TIP_COMPLETED ||
      "payment.tip.completed",
  },
  queues: {
    tipCompleted:
      process.env.RABBITMQ_QUEUE_GAMIFICATION || "soundmeet.gamification",
  },
} as const;
