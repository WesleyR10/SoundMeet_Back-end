import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";

import { GetSyncedLyricsBulkJobUseCase } from "../../core/synced-lyrics/application/use-cases/get-synced-lyrics-bulk-job/get-synced-lyrics-bulk-job.use-case";
import { MatchSyncedLyricsOnLrclibUseCase } from "../../core/synced-lyrics/application/use-cases/match-synced-lyrics-on-lrclib/match-synced-lyrics-on-lrclib.use-case";
import { RequestSyncedLyricsBulkSyncUseCase } from "../../core/synced-lyrics/application/use-cases/request-synced-lyrics-bulk-sync/request-synced-lyrics-bulk-sync.use-case";
import {
  AuthGuard,
  InternalToken,
  InternalTokenGuard,
  Roles,
  RolesGuard,
} from "../auth-module";
import { MatchSyncedLyricsOnLrclibDto } from "./dto/match-synced-lyrics-on-lrclib.dto";
import { RequestSyncedLyricsBulkSyncDto } from "./dto/request-synced-lyrics-bulk-sync.dto";
import {
  LrcLibMatchPresenter,
  SyncedLyricsBulkJobPresenter,
} from "./synced-lyrics.presenter";
import { SyncedLyricsRateLimitGuard } from "./synced-lyrics-rate-limit.guard";

@ApiTags("SyncedLyrics")
@ApiBearerAuth("JWT-auth")
@Controller("synced-lyrics")
@UseGuards(SyncedLyricsRateLimitGuard)
export class SyncedLyricsLrclibController {
  @Inject(MatchSyncedLyricsOnLrclibUseCase)
  private matchUseCase: MatchSyncedLyricsOnLrclibUseCase;

  @Inject(RequestSyncedLyricsBulkSyncUseCase)
  private requestBulkUseCase: RequestSyncedLyricsBulkSyncUseCase;

  @Inject(GetSyncedLyricsBulkJobUseCase)
  private getBulkJobUseCase: GetSyncedLyricsBulkJobUseCase;

  /*
   * SM-026 — esta rota era anônima POR OMISSÃO, não por decisão.
   *
   * Quando o defeito foi encontrado não existia `AuthGuard` global: uma rota
   * sem `@UseGuards(AuthGuard)` nascia pública, e esta não tinha nem os guards
   * nem um `@Public()` que registrasse a escolha. Todas as outras rotas dos
   * dois controllers do módulo exigem `musician`/`admin`, o que mostra que a
   * ausência aqui foi esquecimento.
   *
   * ⚠️ Desde o AUTH-2 (29/ago/2026) o `AuthGuard` É `APP_GUARD` global e o
   * default inverteu — hoje uma rota nasce FECHADA e quem quiser anonimato
   * escreve `@Public()`. O `@UseGuards(AuthGuard, RolesGuard)` abaixo continua
   * porque é ele que traz o `RolesGuard`; o guard global torna a omissão
   * impossível, não redundante.
   *
   * O efeito prático: qualquer cliente anônimo podia automatizar buscas contra
   * a LRCLIB — API pública gratuita de terceiro — usando o nosso egress, o
   * nosso cache e a nossa reputação de IP. O cache de 6h não continha o abuso,
   * porque a chave inclui `artist`/`title`/`durationMs` e variar a consulta
   * força miss. Nenhum cliente (mobile ou web) chama esta rota: o contrato
   * fica sendo privado, como o do resto do módulo.
   */
  @Get("search")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Buscar correspondências na LRCLIB",
    description:
      "Retorna candidatos de LRCLIB para um par (artist, title), com score e meta de cache. Exige autenticação (musician/admin) — a rota consome uma API externa de terceiro.",
  })
  @ApiResponse({ status: 401, description: "Sem token." })
  @ApiQuery({ name: "artist", required: true, type: String })
  @ApiQuery({ name: "title", required: true, type: String })
  @ApiQuery({ name: "durationMs", required: false, type: Number })
  @ApiQuery({ name: "maxResults", required: false, type: Number })
  @ApiResponse({ status: 200, type: LrcLibMatchPresenter })
  async search(@Query() dto: MatchSyncedLyricsOnLrclibDto) {
    const output = await this.matchUseCase.execute({
      artist: dto.artist,
      title: dto.title,
      duration_ms: dto.durationMs,
      max_results: dto.maxResults,
    });
    return new LrcLibMatchPresenter(output);
  }

  @Post("bulk-sync")
  @SkipThrottle()
  @UseGuards(AuthGuard, RolesGuard, InternalTokenGuard)
  @Roles("musician", "admin")
  @InternalToken({
    envKey: "SYNCED_LYRICS_BULK_TOKEN",
    headerName: "x-synced-lyrics-bulk-token",
  })
  @ApiOperation({
    summary: "Solicitar bulk sync de LRC via LRCLIB",
    description:
      "Cria um job de bulk sync e enfileira um item por music_library_id.",
  })
  @ApiResponse({ status: 201, type: SyncedLyricsBulkJobPresenter })
  async requestBulkSync(@Body() dto: RequestSyncedLyricsBulkSyncDto) {
    const output = await this.requestBulkUseCase.execute({
      musician_id: dto.musician_id,
      music_library_ids: dto.music_library_ids,
      force: dto.force,
    });
    return new SyncedLyricsBulkJobPresenter(output);
  }

  @Get("bulk-jobs/:id")
  @SkipThrottle()
  @UseGuards(AuthGuard, RolesGuard, InternalTokenGuard)
  @Roles("musician", "admin")
  @InternalToken({
    envKey: "SYNCED_LYRICS_BULK_TOKEN",
    headerName: "x-synced-lyrics-bulk-token",
  })
  @ApiOperation({
    summary: "Consultar job de bulk sync",
    description: "Retorna status e contadores do job de bulk sync.",
  })
  @ApiResponse({ status: 200, type: SyncedLyricsBulkJobPresenter })
  async getBulkJob(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.getBulkJobUseCase.execute({ id });
    return new SyncedLyricsBulkJobPresenter(output);
  }
}
