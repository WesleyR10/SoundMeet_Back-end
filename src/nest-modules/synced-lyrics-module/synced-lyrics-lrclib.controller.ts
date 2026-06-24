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

import { GetSyncedLyricsBulkJobUseCase } from "../../core/synced-lyrics/application/use-cases/get-synced-lyrics-bulk-job/get-synced-lyrics-bulk-job.use-case";
import { MatchSyncedLyricsOnLrclibUseCase } from "../../core/synced-lyrics/application/use-cases/match-synced-lyrics-on-lrclib/match-synced-lyrics-on-lrclib.use-case";
import { RequestSyncedLyricsBulkSyncUseCase } from "../../core/synced-lyrics/application/use-cases/request-synced-lyrics-bulk-sync/request-synced-lyrics-bulk-sync.use-case";
import { SkipThrottle } from "@nestjs/throttler";

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

  @Get("search")
  @ApiOperation({
    summary: "Buscar correspondências na LRCLIB",
    description:
      "Retorna candidatos de LRCLIB para um par (artist, title), com score e meta de cache.",
  })
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
