import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

import { RefreshSpotifyTokensUseCase } from "../../core/audience/application/use-cases/refresh-spotify-tokens/refresh-spotify-tokens.use-case";
import { EnvConfig } from "../config-module/config.schema";

/**
 * Renova os tokens do Spotify que estão vencendo.
 *
 * De meia em meia hora porque o access token dura ~1h: uma varredura horária
 * deixaria uma janela em que o token vence entre duas execuções.
 *
 * Não roda quando a ponte está desligada (sem credenciais) — varrer para
 * chamar um gateway inexistente só encheria o log de erro em ambiente que não
 * usa a feature.
 */
@Injectable()
export class RefreshSpotifyTokensJob {
  private readonly logger = new Logger(RefreshSpotifyTokensJob.name);

  constructor(
    private readonly configService: ConfigService<EnvConfig>,
    private readonly useCase: RefreshSpotifyTokensUseCase,
    @Inject("SpotifyGateway") private readonly gateway: unknown | null,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCron(): Promise<void> {
    if (this.configService.get("NODE_ENV") === "test") return;
    if (!this.gateway) return;

    const output = await this.useCase.execute({});

    if (output.examined === 0) return;

    this.logger.log(
      JSON.stringify({
        event: "spotify.tokens.refreshed",
        examined: output.examined,
        refreshed: output.refreshed,
        failed: output.failed.length,
      }),
    );

    /*
     * Falha aqui significa vínculo revogado pelo fã ou credencial do app
     * inválida — nos dois casos alguém precisa saber, porque o sintoma para o
     * usuário é "salvar no Spotify parou de funcionar", sem pista da causa.
     */
    if (output.failed.length > 0) {
      this.logger.warn(
        JSON.stringify({
          event: "spotify.tokens.refresh_failed",
          failures: output.failed,
        }),
      );
    }
  }
}
