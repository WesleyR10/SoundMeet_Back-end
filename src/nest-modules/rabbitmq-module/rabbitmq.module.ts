import { AmqpConnection, RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import {
  DynamicModule,
  Global,
  Logger,
  Module,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { RabbitMQMessageBroker } from "../../core/shared/infra/message-broker/rabbitmq-message-broker";
import { ConfigSchemaType } from "../config-module/config.schema";
import { DlxLoggingConsumer } from "./rabbitmq-consume-error/dlx-logging.consumer";
import { RabbitmqConsumeErrorFilter } from "./rabbitmq-consume-error/rabbitmq-consume-error.filter";

type RabbitMQModuleOptions = {
  enableConsumers?: boolean;
};

@Global()
@Module({})
export class RabbitmqModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(RabbitmqModule.name);

  constructor(private readonly amqpConnection: AmqpConnection) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const channel = this.amqpConnection.channel;
      await channel.assertExchange("direct.delayed", "x-delayed-message", {
        durable: true,
        arguments: { "x-delayed-type": "direct" },
      });
      this.logger.log(
        "direct.delayed exchange (x-delayed-message) verified successfully",
      );
    } catch (err) {
      this.logger.error(
        "FATAL: direct.delayed exchange assertion failed — is the x-delayed-message plugin installed in RabbitMQ? " +
          (err instanceof Error ? err.message : String(err)),
      );
      // Fail-fast: propagate so NestJS shuts down on bootstrap failure
      throw err;
    }
  }

  static forRoot(options: RabbitMQModuleOptions = {}): DynamicModule {
    return {
      module: RabbitmqModule,
      imports: [
        RabbitMQModule.forRootAsync(RabbitMQModule, {
          useFactory: (configService: ConfigSchemaType) => ({
            uri: configService.get("RABBITMQ_URL") as string,
            registerHandlers:
              options.enableConsumers ||
              (configService.get("RABBITMQ_REGISTER_HANDLERS") as boolean),
            exchanges: [
              { name: "dlx.exchange", type: "topic" },
              { name: "soundmeet.events", type: "topic" },
              {
                name: "direct.delayed",
                type: "x-delayed-message",
                options: {
                  arguments: {
                    "x-delayed-type": "direct",
                  },
                },
              },
            ],
            queues: [
              {
                name: "dlx.queue",
                exchange: "dlx.exchange",
                routingKey: "#",
                createQueueIfNotExists: true,
                options: {
                  durable: true,
                },
              },
            ],
            channels: {
              default: {
                default: true,
              },
              ai_audio_separation: {
                prefetchCount: 1,
              },
              ai_cifra_analysis: {
                prefetchCount: 1,
              },
              synced_lyrics_bulk: {
                prefetchCount: 5,
              },
              gamification_events: {
                prefetchCount: 10,
              },
              google_calendar_sync: {
                prefetchCount: 5,
              },
            },
          }),
          inject: [ConfigService],
        }),
      ],
      providers: [RabbitmqConsumeErrorFilter, DlxLoggingConsumer],
      global: true,
      exports: [RabbitMQModule, RabbitmqConsumeErrorFilter],
    };
  }

  static forFeature(): DynamicModule {
    return {
      module: RabbitmqModule,
      providers: [
        {
          provide: "IMessageBroker",
          useFactory: (
            amqpConnection: AmqpConnection,
            configService: ConfigSchemaType,
          ) => {
            const exchange =
              (configService.get("RABBITMQ_EXCHANGE") as string) ||
              "soundmeet.exchange";
            return new RabbitMQMessageBroker(amqpConnection, exchange);
          },
          inject: [AmqpConnection, ConfigService],
        },
      ],
      exports: ["IMessageBroker"],
    };
  }
}
