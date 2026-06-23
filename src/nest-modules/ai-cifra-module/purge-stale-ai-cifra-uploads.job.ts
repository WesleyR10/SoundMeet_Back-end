import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

import { PurgeStaleAiCifraUploadsUseCase } from "../../core/ai-cifra/application/use-cases/purge-stale-ai-cifra-uploads/purge-stale-ai-cifra-uploads.use-case";
import { EnvConfig } from "../config-module/config.schema";

@Injectable()
export class PurgeStaleAiCifraUploadsJob {
  constructor(
    private readonly configService: ConfigService<EnvConfig>,
    private readonly useCase: PurgeStaleAiCifraUploadsUseCase,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleCron(): Promise<void> {
    if (this.configService.get("NODE_ENV") === "test") {
      return;
    }
    await this.useCase.execute({});
  }
}
