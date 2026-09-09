import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

import { RefreshMercadoPagoTokensUseCase } from "../../core/payment/application/use-cases/refresh-mercadopago-tokens/refresh-mercadopago-tokens.use-case";
import { EnvConfig } from "../config-module/config.schema";

/**
 * Renova os tokens OAuth do Mercado Pago antes de vencerem.
 *
 * ## Por que diário, e não horário
 *
 * O token vale 180 dias e a folga de renovação é de 15. Varrer de hora em hora
 * seria 24× a carga para ganhar nada — e a janela é tão larga que o job pode
 * pular vários dias sem consequência.
 *
 * ## O que acontece se este job parar
 *
 * Os vínculos vão vencendo, e cada músico precisa **reautorizar na mão** — que
 * é exatamente a fricção que o `offline_access` existe para eliminar. Pior: o
 * sintoma aparece como "a gorjeta parou de funcionar", meses depois, sem
 * ninguém ligar à autorização. Por isso as falhas vão em `error` com o
 * `musician_id`: elas são acionáveis, uma a uma.
 */
@Injectable()
export class RefreshMercadoPagoTokensJob {
  private readonly logger = new Logger(RefreshMercadoPagoTokensJob.name);

  constructor(
    private readonly configService: ConfigService<EnvConfig>,
    private readonly useCase: RefreshMercadoPagoTokensUseCase,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async handleCron(): Promise<void> {
    if (this.configService.get("NODE_ENV") === "test") {
      return;
    }

    try {
      const output = await this.useCase.execute({});

      if (output.examined === 0) {
        return;
      }

      this.logger.log(
        JSON.stringify({
          event: "mercadopago.token.refresh_sweep",
          examined: output.examined,
          refreshed: output.refreshed,
          failed: output.failed.length,
        }),
      );

      for (const failure of output.failed) {
        this.logger.error(
          JSON.stringify({
            event: "mercadopago.token.refresh_failed",
            musician_id: failure.musician_id,
            reason: failure.reason,
          }),
        );
      }
    } catch (error) {
      // Deixar propagar num `@Cron` mata o agendador do processo inteiro.
      this.logger.error(
        JSON.stringify({
          event: "mercadopago.token.refresh_sweep_failed",
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
  }
}
