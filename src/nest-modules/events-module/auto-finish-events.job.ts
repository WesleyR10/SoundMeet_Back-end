import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

import { AutoFinishEventsUseCase } from "../../core/events/application/use-cases/auto-finish-events/auto-finish-events.use-case";
import { EnvConfig } from "../config-module/config.schema";

/**
 * Bloco 9.4b — fecha eventos que já terminaram.
 *
 * A cada 10 minutos: shows musicais são curtos, e um evento que ficou "ativo"
 * depois de acabar contamina a busca pública, o badge de ao vivo e o atalho
 * `GET /establishments/:id/events/active` usado no fluxo de QR code.
 *
 * Mesmo formato de `ExpirePendingBookingsJob`, incluindo o curto-circuito em
 * ambiente de teste (senão o cron dispara durante a suíte).
 */
@Injectable()
export class AutoFinishEventsJob {
  private readonly logger = new Logger(AutoFinishEventsJob.name);

  constructor(
    private readonly configService: ConfigService<EnvConfig>,
    private readonly useCase: AutoFinishEventsUseCase,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleCron(): Promise<void> {
    if (this.configService.get("NODE_ENV") === "test") {
      return;
    }

    try {
      const { finished } = await this.useCase.execute({});
      if (finished > 0) {
        this.logger.log(
          JSON.stringify({ event: "events.auto_finished", count: finished }),
        );
      }
    } catch (error) {
      // Job não pode derrubar o processo: falha aqui é operacional, e a
      // próxima passada tenta de novo.
      this.logger.error(
        JSON.stringify({
          event: "events.auto_finish_failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
