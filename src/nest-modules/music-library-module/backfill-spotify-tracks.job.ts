import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

import { BackfillSpotifyTracksUseCase } from "../../core/music-library/application/use-cases/backfill-spotify-tracks/backfill-spotify-tracks.use-case";
import { EnvConfig } from "../config-module/config.schema";

/**
 * Resolve a faixa do Spotify das músicas cadastradas antes desta feature.
 *
 * De hora em hora, em lotes pequenos: o rate limit do Spotify é por aplicação e
 * **é o mesmo** que atende a materialização de uma análise recém-feita. Varrer
 * acervo antigo em rajada faria a música que o músico acabou de cadastrar
 * esperar pela janela.
 *
 * Não roda sem credencial — varrer para chamar um gateway inexistente só
 * encheria o log de ambiente que não usa a ponte.
 */
@Injectable()
export class BackfillSpotifyTracksJob {
  private readonly logger = new Logger(BackfillSpotifyTracksJob.name);

  constructor(
    private readonly configService: ConfigService<EnvConfig>,
    private readonly useCase: BackfillSpotifyTracksUseCase,
    @Inject("SpotifyCatalogGateway") private readonly gateway: unknown | null,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron(): Promise<void> {
    if (this.configService.get("NODE_ENV") === "test") return;
    if (!this.gateway) return;

    const output = await this.useCase.execute({});

    if (output.examined === 0) return;

    this.logger.log(
      JSON.stringify({
        event: "spotify.tracks.backfilled",
        examined: output.examined,
        resolved: output.resolved,
        not_found: output.not_found,
      }),
    );
  }
}
