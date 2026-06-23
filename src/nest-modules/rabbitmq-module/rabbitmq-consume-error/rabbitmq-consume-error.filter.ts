import { AmqpConnection, Nack } from "@golevelup/nestjs-rabbitmq";
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConsumeMessage, MessagePropertyHeaders } from "amqplib";

import { NotFoundError } from "../../../core/shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../core/shared/domain/validators/validation.error";

@Catch()
export class RabbitmqConsumeErrorFilter implements ExceptionFilter {
  static readonly RETRY_COUNT_HEADER = "x-retry-count";
  static readonly MAX_RETRIES = 3;

  static readonly NON_RETRIABLE_ERRORS = [
    NotFoundError,
    EntityValidationError,
    UnprocessableEntityException,
  ];

  constructor(private amqpConnection: AmqpConnection) {}

  async catch(exception: Error, host: ArgumentsHost) {
    if (host.getType<"rmq">() !== "rmq") {
      return;
    }

    const isNonRetriable = RabbitmqConsumeErrorFilter.NON_RETRIABLE_ERRORS.some(
      (error) => exception instanceof error,
    );

    if (isNonRetriable) {
      return new Nack(false);
    }

    const ctx = host.switchToRpc();
    const message = ctx.getContext<ConsumeMessage>();

    if (this.shouldRetry(message.properties.headers)) {
      await this.retry(message);
      return;
    }

    return new Nack(false);
  }

  private shouldRetry(
    messageHeaders: MessagePropertyHeaders | undefined,
  ): boolean {
    const retryHeader = RabbitmqConsumeErrorFilter.RETRY_COUNT_HEADER;
    const maxRetries = RabbitmqConsumeErrorFilter.MAX_RETRIES;
    const headers = messageHeaders ?? {};
    const current = Number(headers[retryHeader] ?? 0);
    return current < maxRetries;
  }

  private static readonly BASE_DELAY_MS = 5_000;
  private static readonly MAX_DELAY_MS = 60_000;

  private static computeDelay(retryCount: number): number {
    const exponential =
      RabbitmqConsumeErrorFilter.BASE_DELAY_MS * Math.pow(2, retryCount);
    const jitter = Math.floor(Math.random() * 1_000);
    return Math.min(
      exponential + jitter,
      RabbitmqConsumeErrorFilter.MAX_DELAY_MS,
    );
  }

  private async retry(message: ConsumeMessage) {
    const messageHeaders: MessagePropertyHeaders = {
      ...(message.properties.headers ?? {}),
    };
    const retryHeader = RabbitmqConsumeErrorFilter.RETRY_COUNT_HEADER;
    const retryCount = Number(messageHeaders[retryHeader] ?? 0);
    messageHeaders[retryHeader] = retryCount + 1;
    messageHeaders["x-delay"] =
      RabbitmqConsumeErrorFilter.computeDelay(retryCount);

    return this.amqpConnection.publish(
      "direct.delayed",
      message.fields.routingKey,
      message.content,
      {
        correlationId: message.properties.correlationId,
        headers: messageHeaders,
      },
    );
  }
}
