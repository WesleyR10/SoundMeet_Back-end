import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable, Logger, UseFilters } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";

import { CalculateRankingUseCase } from "../../core/gamification/application/use-cases/calculate-ranking/calculate-ranking.use-case";
import {
  RankingPeriodEnum,
  RankingTypeEnum,
} from "../../core/gamification/domain/value-objects/ranking-type.vo";
import { TipCompletedIntegrationEventPayload } from "../../core/payment/domain/events/tip-completed.event";
import { RabbitmqConsumeErrorFilter } from "../rabbitmq-module/rabbitmq-consume-error/rabbitmq-consume-error.filter";
import { GAMIFICATION_RABBITMQ } from "./rabbitmq/gamification.rabbitmq";

@UseFilters(RabbitmqConsumeErrorFilter)
@Injectable()
export class GamificationTipCompletedConsumer {
  private readonly logger = new Logger(GamificationTipCompletedConsumer.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  @RabbitSubscribe({
    exchange: GAMIFICATION_RABBITMQ.exchange,
    routingKey: GAMIFICATION_RABBITMQ.routingKeys.tipCompleted,
    queue: GAMIFICATION_RABBITMQ.queues.tipCompleted,
    allowNonJsonMessages: false,
    queueOptions: {
      durable: true,
      deadLetterExchange: GAMIFICATION_RABBITMQ.dlxExchange,
      deadLetterRoutingKey: GAMIFICATION_RABBITMQ.routingKeys.tipCompleted,
      channel: GAMIFICATION_RABBITMQ.channel,
    },
  })
  async onTipCompleted(
    msg: { payload?: Partial<TipCompletedIntegrationEventPayload> } & Record<
      string,
      unknown
    >,
  ): Promise<void> {
    const tipId = msg?.payload?.tip_id ?? "(unknown)";

    this.logger.log(
      JSON.stringify({
        event: "gamification.tip_completed.received",
        tip_id: tipId,
      }),
    );

    const useCase = await this.moduleRef.resolve(CalculateRankingUseCase);

    await Promise.all([
      useCase.execute({
        type: RankingTypeEnum.TOP_FAS,
        period: RankingPeriodEnum.MONTHLY,
      }),
      useCase.execute({
        type: RankingTypeEnum.TOP_APOIADORES,
        period: RankingPeriodEnum.MONTHLY,
      }),
    ]);

    this.logger.log(
      JSON.stringify({
        event: "gamification.rankings.recalculated",
        tip_id: tipId,
        types: [RankingTypeEnum.TOP_FAS, RankingTypeEnum.TOP_APOIADORES],
      }),
    );
  }
}
