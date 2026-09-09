import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

import { ProcessDueEscrowReleasesUseCase } from "../../core/payment/application/use-cases/process-due-escrow-releases/process-due-escrow-releases.use-case";
import { EnvConfig } from "../config-module/config.schema";

/**
 * Libera as custódias cujo prazo de contestação venceu.
 *
 * ## Por que existe, se o provedor libera sozinho
 *
 * A Conta Escrow do provedor tem liberação automática na expiração
 * (`daysToExpire`), e ela é a rede de segurança. Este job é o caminho
 * **rápido**: check-in feito e janela de contestação vencida antes do prazo do
 * provedor, o músico recebe agora em vez de esperar o teto. Num produto cujo
 * argumento é "o cachê cai mais rápido no plano pago", isso é o produto.
 *
 * ## De hora em hora, e não de minuto em minuto
 *
 * O prazo é medido em DIAS. Varrer de hora em hora é resolução de sobra e
 * mantém a carga previsível — mesmo intervalo de `CompleteConfirmedBookingsJob`.
 *
 * ⚠️ **Nada aqui estoura.** O use-case já isola cada custódia; o que sobe até
 * aqui é falha de infraestrutura, e deixá-la propagar num `@Cron` mata o
 * agendador do processo inteiro.
 */
@Injectable()
export class EscrowReleaseJob {
  private readonly logger = new Logger(EscrowReleaseJob.name);

  constructor(
    private readonly configService: ConfigService<EnvConfig>,
    private readonly useCase: ProcessDueEscrowReleasesUseCase,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
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
          event: "escrow.release.sweep",
          examined: output.examined,
          released: output.released,
          skipped: output.skipped.length,
        }),
      );

      /*
       * Os pulos vão em `warn` e COM o motivo: uma custódia parada é dinheiro
       * de alguém esperando, e o motivo é o que diz se é normal ("prazo em
       * curso") ou acionável ("apresentação não registrada", "contestação em
       * aberto"). Silenciá-los transformaria dinheiro retido em silêncio.
       */
      for (const skip of output.skipped) {
        this.logger.warn(
          JSON.stringify({
            event: "escrow.release.skipped",
            escrow_id: skip.escrow_id,
            reason: skip.reason,
          }),
        );
      }
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "escrow.release.sweep_failed",
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
  }
}
