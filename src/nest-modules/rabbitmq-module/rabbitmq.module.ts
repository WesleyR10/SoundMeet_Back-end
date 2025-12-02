import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RabbitMQModule, MessageHandlerErrorBehavior } from "@golevelup/nestjs-rabbitmq";
import { ConfigSchemaType } from "../config-module/config.schema";
import { SharedModule } from "../shared-module/shared.module";

// Publishers
import { RequestPublisher } from "./publishers/request.publisher";
import { NotificationPublisher } from "./publishers/notification.publisher";
import { PaymentPublisher } from "./publishers/payment.publisher";
import { GamificationPublisher } from "./publishers/gamification.publisher";

// Consumers
import { RequestConsumer } from "./consumers/request.consumer";
import { NotificationConsumer } from "./consumers/notification.consumer";
import { PaymentConsumer } from "./consumers/payment.consumer";
import { GamificationConsumer } from "./consumers/gamification.consumer";

@Global()
@Module({})
export class RabbitmqModule {
  static forRoot() {
    return {
      module: RabbitmqModule,
      imports: [
        // Importar SharedModule para acessar os services
        SharedModule,
        RabbitMQModule.forRootAsync(RabbitMQModule, {
          inject: [ConfigService],
          useFactory: (configService: ConfigSchemaType) => {
            return {
              exchanges: [
                {
                  name: configService.get("RABBITMQ_EXCHANGE")!,
                  type: "topic",
                  options: {
                    durable: true,
                  },
                },
              ],
              uri: configService.get("RABBITMQ_URL")!,
              connectionInitOptions: {
                wait: false,
                timeout: 20000,
                reject: true,
              },
              enableControllerDiscovery: true,
              prefetchCount: 10,
              defaultRpcTimeout: 10000,
              defaultExchangeType: "topic",
              defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.REQUEUE,
              channels: {
                "channel-1": {
                  prefetchCount: 15,
                  default: true,
                },
                "channel-2": {
                  prefetchCount: 2,
                },
              },
            };
          },
        }),
      ],
      providers: [
        // Publishers
        RequestPublisher,
        NotificationPublisher,
        PaymentPublisher,
        GamificationPublisher,

        // Consumers
        RequestConsumer,
        NotificationConsumer,
        PaymentConsumer,
        GamificationConsumer,
      ],
      exports: [
        RabbitMQModule,
        RequestPublisher,
        NotificationPublisher,
        PaymentPublisher,
        GamificationPublisher,
        RequestConsumer,
        NotificationConsumer,
        PaymentConsumer,
        GamificationConsumer,
      ],
    };
  }
}
