import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

import { ExpirePendingBookingsUseCase } from "../../core/scheduling/application/use-cases/expire-pending-bookings/expire-pending-bookings.use-case";
import { EnvConfig } from "../config-module/config.schema";

@Injectable()
export class ExpirePendingBookingsJob {
  constructor(
    private readonly configService: ConfigService<EnvConfig>,
    private readonly useCase: ExpirePendingBookingsUseCase,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron(): Promise<void> {
    if (this.configService.get("NODE_ENV") === "test") {
      return;
    }
    await this.useCase.execute({});
  }
}
