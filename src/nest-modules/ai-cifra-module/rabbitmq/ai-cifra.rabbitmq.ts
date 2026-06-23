export const AI_CIFRA_RABBITMQ = {
  exchange: "direct.delayed",
  dlxExchange: "dlx.exchange",
  channel: "ai_cifra_analysis",
  routingKeys: {
    analysisRequested:
      process.env.RABBITMQ_ROUTING_KEY_AI_CIFRA_ANALYSIS_REQUESTED ||
      "ai-musician.cifra-analysis.requested",
    analysisCompleted:
      process.env.RABBITMQ_ROUTING_KEY_AI_CIFRA_ANALYSIS_COMPLETED ||
      "ai-musician.cifra-analysis.completed",
    analysisFailed:
      process.env.RABBITMQ_ROUTING_KEY_AI_CIFRA_ANALYSIS_FAILED ||
      "ai-musician.cifra-analysis.failed",
    analysisProgress:
      process.env.RABBITMQ_ROUTING_KEY_AI_CIFRA_ANALYSIS_PROGRESS ||
      "ai-musician.cifra-analysis.progress",
  },
  queues: {
    analysisRequested:
      process.env.RABBITMQ_QUEUE_AI_CIFRA_ANALYSIS ||
      "soundmeet.ai_cifra_analysis",
    analysisCompleted:
      process.env.RABBITMQ_QUEUE_AI_CIFRA_ANALYSIS_COMPLETED ||
      "soundmeet.ai_cifra_analysis.completed",
    analysisFailed:
      process.env.RABBITMQ_QUEUE_AI_CIFRA_ANALYSIS_FAILED ||
      "soundmeet.ai_cifra_analysis.failed",
    analysisProgress:
      process.env.RABBITMQ_QUEUE_AI_CIFRA_ANALYSIS_PROGRESS ||
      "soundmeet.ai_cifra_analysis.progress",
  },
} as const;
