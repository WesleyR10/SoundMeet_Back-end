import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

import { RecalculateEstablishmentAnalyticsUseCase } from "../../core/establishment/application/use-cases/recalculate-establishment-analytics/recalculate-establishment-analytics.use-case";
import { EnvConfig } from "../config-module/config.schema";

@Injectable()
export class RecalculateEstablishmentAnalyticsJob {
  constructor(
    private readonly configService: ConfigService<EnvConfig>,
    private readonly useCase: RecalculateEstablishmentAnalyticsUseCase,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleCron(): Promise<void> {
    if (this.configService.get("NODE_ENV") === "test") {
      return;
    }
    await this.useCase.execute({});
  }
}
