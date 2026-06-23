export const SYNCED_LYRICS_RABBITMQ = {
  exchange: "direct.delayed",
  dlxExchange: "dlx.exchange",
  channel: "synced_lyrics_bulk",
  routingKeys: {
    bulkRequested:
      process.env.RABBITMQ_ROUTING_KEY_SYNCED_LYRICS_BULK_REQUESTED ||
      "ai-musician.synced-lyrics-bulk.requested",
  },
  queues: {
    bulkRequested:
      process.env.RABBITMQ_QUEUE_SYNCED_LYRICS_BULK ||
      "soundmeet.synced_lyrics_bulk",
  },
} as const;
