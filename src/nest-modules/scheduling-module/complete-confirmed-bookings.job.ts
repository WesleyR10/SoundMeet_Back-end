import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

import { CompleteConfirmedBookingsUseCase } from "../../core/scheduling/application/use-cases/complete-confirmed-bookings/complete-confirmed-bookings.use-case";
import { EnvConfig } from "../config-module/config.schema";

@Injectable()
export class CompleteConfirmedBookingsJob {
  constructor(
    private readonly configService: ConfigService<EnvConfig>,
    private readonly useCase: CompleteConfirmedBookingsUseCase,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron(): Promise<void> {
    if (this.configService.get("NODE_ENV") === "test") {
      return;
    }
    await this.useCase.execute({});
  }
}
