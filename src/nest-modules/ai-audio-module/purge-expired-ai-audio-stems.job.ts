import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

import { PurgeExpiredAiAudioStemsUseCase } from "../../core/ai-audio/application/use-cases/purge-expired-ai-audio-stems/purge-expired-ai-audio-stems.use-case";
import { EnvConfig } from "../config-module/config.schema";

/**
 * Varre os stems vencidos de hora em hora.
 *
 * Mais espaçado que o purge do ai-cifra (10 min) de propósito: lá a janela é de
 * minutos porque o objeto só existe durante o processamento; aqui o prazo é de
 * dias e uma varredura horária já mantém o atraso irrelevante — sem competir
 * com o caminho quente por storage e banco.
 */
@Injectable()
export class PurgeExpiredAiAudioStemsJob {
  constructor(
    private readonly configService: ConfigService<EnvConfig>,
    private readonly useCase: PurgeExpiredAiAudioStemsUseCase,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron(): Promise<void> {
    if (this.configService.get("NODE_ENV") === "test") {
      return;
    }
    await this.useCase.execute();
  }
}
