export const AI_AUDIO_RABBITMQ = {
  exchange: "direct.delayed",
  dlxExchange: "dlx.exchange",
  channel: "ai_audio_separation",
  routingKeys: {
    separationRequested:
      process.env.RABBITMQ_ROUTING_KEY_AI_AUDIO_UPLOAD_VALIDATED ||
      "ai-musician.audio-upload.validated",
    separationCompleted:
      process.env.RABBITMQ_ROUTING_KEY_AI_AUDIO_UPLOAD_SEPARATED ||
      "ai-musician.audio-upload.separated",
    separationFailed:
      process.env.RABBITMQ_ROUTING_KEY_AI_AUDIO_UPLOAD_SEPARATION_FAILED ||
      "ai-musician.audio-upload.separation-failed",
  },
  queues: {
    separationRequested:
      process.env.RABBITMQ_QUEUE_AI_AUDIO_SEPARATION ||
      "soundmeet.ai_audio_separation",
    separationCompleted:
      process.env.RABBITMQ_QUEUE_AI_AUDIO_SEPARATION_COMPLETED ||
      "soundmeet.ai_audio_separation.completed",
    separationFailed:
      process.env.RABBITMQ_QUEUE_AI_AUDIO_SEPARATION_FAILED ||
      "soundmeet.ai_audio_separation.failed",
  },
} as const;
