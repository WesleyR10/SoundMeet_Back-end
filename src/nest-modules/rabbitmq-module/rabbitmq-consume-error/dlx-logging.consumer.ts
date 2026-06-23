import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable, Logger } from "@nestjs/common";
import { ConsumeMessage } from "amqplib";

@Injectable()
export class DlxLoggingConsumer {
  private readonly logger = new Logger(DlxLoggingConsumer.name);

  @RabbitSubscribe({
    exchange: "dlx.exchange",
    routingKey: "#",
    queue: "dlx.queue",
    createQueueIfNotExists: false,
    queueOptions: { durable: true },
  })
  onDeadLetter(payload: unknown, msg: ConsumeMessage): void {
    const headers = msg.properties.headers ?? {};

    this.logger.error(
      JSON.stringify({
        event: "rabbitmq.dead_letter",
        queue: (headers["x-death"] as any)?.[0]?.queue ?? "unknown",
        routing_key: msg.fields.routingKey,
        exchange: msg.fields.exchange,
        message_id: msg.properties.messageId ?? null,
        correlation_id: msg.properties.correlationId ?? null,
        retry_count: Number(headers["x-retry-count"]) || 0,
        payload,
      }),
    );
  }
}
