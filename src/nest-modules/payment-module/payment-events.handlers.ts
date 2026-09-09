import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { AddPointsInput } from "../../core/gamification/application/use-cases/add-points/add-points.input";
import { AddPointsUseCase } from "../../core/gamification/application/use-cases/add-points/add-points.use-case";
import { PointsSourceEnum } from "../../core/gamification/domain/value-objects/points-source.vo";
import {
  TipCompletedEvent,
  TipCompletedIntegrationEvent,
} from "../../core/payment/domain/events/tip-completed.event";
import { TipFailedEvent } from "../../core/payment/domain/events/tip-failed.event";
import { IMessageBroker } from "../../core/shared/application/message-broker.interface";
import { PaymentEventProcessingService } from "./payment-event-processing.service";

@Injectable()
export class PaymentEventsHandlers {
  private readonly logger = new Logger(PaymentEventsHandlers.name);

  constructor(
    @Inject(AddPointsUseCase)
    private readonly addPointsUseCase: AddPointsUseCase,
    private readonly eventProcessing: PaymentEventProcessingService,
    @Inject("IMessageBroker")
    private readonly messageBroker: IMessageBroker,
  ) {}

  @OnEvent(TipCompletedEvent.name)
  async handleTipCompleted(event: TipCompletedEvent): Promise<void> {
    const tipId = event.aggregate_id.id;
    const audienceId = event.audience_id.id;

    try {
      await this.eventProcessing.processOnce(
        `tip_completed:${tipId}:${audienceId}`,
        () =>
          this.addPointsUseCase.execute(
            new AddPointsInput({
              user_id: audienceId,
              source: PointsSourceEnum.TIP,
              metadata: {
                tip_id: tipId,
                amount: event.amount.amount,
                musician_id: event.musician_id?.id ?? null,
                band_id: event.band_id?.id ?? null,
              },
            }),
          ),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "payment.tip.completed",
          tip_id: tipId,
          audience_id: audienceId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  @OnEvent(TipCompletedIntegrationEvent.name)
  async handleTipCompletedIntegration(
    event: TipCompletedIntegrationEvent,
  ): Promise<void> {
    try {
      await this.messageBroker.publishEvent(event);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "payment.tip.completed.publish_failed",
          tip_id: event.payload.tip_id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  @OnEvent(TipFailedEvent.name)
  handleTipFailed(event: TipFailedEvent): void {
    this.logger.warn(
      JSON.stringify({
        event: "payment.tip.failed",
        tip_id: event.aggregate_id.id,
        musician_id: event.musician_id?.id ?? null,
        audience_id: event.audience_id?.id ?? null,
        occurred_on: event.occurred_on,
      }),
    );
  }
}
