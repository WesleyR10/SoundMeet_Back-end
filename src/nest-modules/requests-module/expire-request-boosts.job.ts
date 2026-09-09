import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

import { ExpireStaleRequestBoostsUseCase } from "../../core/request/application/use-cases/expire-stale-request-boosts/expire-stale-request-boosts.use-case";
import { EnvConfig } from "../config-module/config.schema";

/**
 * Tira do topo da fila os destaques aceitos que ninguém pagou.
 *
 * ## A cada 5 minutos, e não de hora em hora
 *
 * Diferente da custódia (prazo em DIAS), aqui a janela é de minutos e o efeito
 * é visível no palco: enquanto o destaque não expira, um pedido que ninguém
 * pagou ocupa a primeira posição da fila do músico, na frente de quem pagou. A
 * resolução da varredura precisa ser da ordem da janela.
 *
 * ⚠️ **Nada aqui estoura.** O use-case já isola cada pedido; o que sobe até
 * aqui é falha de infraestrutura, e deixá-la propagar num `@Cron` mata o
 * agendador do processo inteiro.
 */
@Injectable()
export class ExpireRequestBoostsJob {
  private readonly logger = new Logger(ExpireRequestBoostsJob.name);

  constructor(
    private readonly configService: ConfigService<EnvConfig>,
    private readonly useCase: ExpireStaleRequestBoostsUseCase,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron(): Promise<void> {
    if (this.configService.get("NODE_ENV") === "test") {
      return;
    }

    try {
      const output = await this.useCase.execute();

      if (output.expired.length === 0) {
        return;
      }

      this.logger.log(
        JSON.stringify({
          event: "request.boost.expire_sweep",
          expired: output.expired.length,
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "request.boost.expire_sweep_failed",
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
  }
}
