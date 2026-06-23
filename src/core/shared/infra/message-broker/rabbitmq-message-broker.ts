import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { randomUUID } from "crypto";

import { IMessageBroker } from "../../application/message-broker.interface";
import { IIntegrationEvent } from "../../domain/events/domain-event.interface";
import { resolveMessageBrokerConfig } from "./events-message-broker-config";

export class RabbitMQMessageBroker implements IMessageBroker {
  constructor(
    private conn: AmqpConnection,
    private defaultExchange: string,
  ) {}

  async publishEvent(event: IIntegrationEvent): Promise<void> {
    const config = resolveMessageBrokerConfig(event, this.defaultExchange);
    await this.conn.publish(config.exchange, config.routing_key, event, {
      messageId: randomUUID(),
      timestamp: Date.now(),
    });
  }
}
