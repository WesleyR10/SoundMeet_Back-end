import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { Response } from "express";

import { DownloadSyncedLyricsForMusicLibraryUseCase } from "../../core/synced-lyrics/application/use-cases/download-synced-lyrics-for-music-library/download-synced-lyrics-for-music-library.use-case";
import { GetChordSheetForMusicLibraryUseCase } from "../../core/synced-lyrics/application/use-cases/get-chord-sheet-for-music-library/get-chord-sheet-for-music-library.use-case";
import { GetRenderableChordSheetForMusicLibraryUseCase } from "../../core/synced-lyrics/application/use-cases/get-renderable-chord-sheet-for-music-library/get-renderable-chord-sheet-for-music-library.use-case";
import { GetSyncedLyricsForMusicLibraryUseCase } from "../../core/synced-lyrics/application/use-cases/get-synced-lyrics-for-music-library/get-synced-lyrics-for-music-library.use-case";
import { MaterializeChordSheetsUseCase } from "../../core/synced-lyrics/application/use-cases/materialize-chord-sheets/materialize-chord-sheets.use-case";
import { MaterializeRenderableChordSheetsUseCase } from "../../core/synced-lyrics/application/use-cases/materialize-renderable-chord-sheets/materialize-renderable-chord-sheets.use-case";
import { SearchSyncedLyricsUseCase } from "../../core/synced-lyrics/application/use-cases/search-synced-lyrics/search-synced-lyrics.use-case";
import { SyncSyncedLyricsForMusicLibraryUseCase } from "../../core/synced-lyrics/application/use-cases/sync-synced-lyrics-for-music-library/sync-synced-lyrics-for-music-library.use-case";
import { UpsertSyncedLyricsForMusicLibraryUseCase } from "../../core/synced-lyrics/application/use-cases/upsert-synced-lyrics-for-music-library/upsert-synced-lyrics-for-music-library.use-case";
import {
  AuthenticatedUser,
  AuthGuard,
  CurrentUser,
  CurrentUserContextGuard,
  InternalToken,
  InternalTokenGuard,
  Roles,
  RolesGuard,
} from "../auth-module";
import { MaterializeChordSheetsDto } from "./dto/materialize-chord-sheets.dto";
import { SearchSyncedLyricsDto } from "./dto/search-synced-lyrics.dto";
import { UpsertSyncedLyricsDto } from "./dto/upsert-synced-lyrics.dto";
import {
  ChordSheetPresenter,
  MaterializeChordSheetsPresenter,
  MaterializeRenderableChordSheetsPresenter,
  SyncedLyricsCollectionPresenter,
  SyncedLyricsPresenter,
} from "./synced-lyrics.presenter";
import { SyncedLyricsPreviewPresenter } from "./synced-lyrics-preview.presenter";
import { SyncedLyricsRateLimitGuard } from "./synced-lyrics-rate-limit.guard";

@ApiTags("SyncedLyrics")
@ApiBearerAuth("JWT-auth")
@Controller("music-library")
@UseGuards(SyncedLyricsRateLimitGuard)
export class SyncedLyricsController {
  @Inject(GetSyncedLyricsForMusicLibraryUseCase)
  private getUseCase: GetSyncedLyricsForMusicLibraryUseCase;

  @Inject(GetChordSheetForMusicLibraryUseCase)
  private getChordSheetUseCase: GetChordSheetForMusicLibraryUseCase;

  @Inject(GetRenderableChordSheetForMusicLibraryUseCase)
  private getRenderableChordSheetUseCase: GetRenderableChordSheetForMusicLibraryUseCase;

  @Inject(UpsertSyncedLyricsForMusicLibraryUseCase)
  private upsertUseCase: UpsertSyncedLyricsForMusicLibraryUseCase;

  @Inject(SearchSyncedLyricsUseCase)
  private searchUseCase: SearchSyncedLyricsUseCase;

  @Inject(DownloadSyncedLyricsForMusicLibraryUseCase)
  private downloadUseCase: DownloadSyncedLyricsForMusicLibraryUseCase;

  @Inject(SyncSyncedLyricsForMusicLibraryUseCase)
  private syncUseCase: SyncSyncedLyricsForMusicLibraryUseCase;

  @Inject(MaterializeChordSheetsUseCase)
  private materializeChordSheetsUseCase: MaterializeChordSheetsUseCase;

  @Inject(MaterializeRenderableChordSheetsUseCase)
  private materializeRenderableChordSheetsUseCase: MaterializeRenderableChordSheetsUseCase;

  @Get("synced-lyrics")
  @UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Pesquisar letras sincronizadas (LRC) da MusicLibrary",
    description:
      "Lista itens da MusicLibrary com campos de LRC (com paginação e filtros). Músico só pode acessar a própria biblioteca.",
  })
  @ApiQuery({ name: "musician_id", required: true, type: String })
  @ApiQuery({ name: "query", required: false, type: String })
  @ApiQuery({ name: "has_lrc", required: false, enum: ["true", "false"] })
  @ApiQuery({ name: "provider", required: false, type: String })
  @ApiQuery({ name: "hash", required: false, type: String })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "per_page", required: false, type: Number })
  @ApiQuery({
    name: "sort",
    required: false,
    enum: ["created_at", "updated_at", "title", "artist", "lrc_version"],
  })
  @ApiQuery({ name: "sort_dir", required: false, enum: ["asc", "desc"] })
  @ApiQuery({ name: "include_raw", required: false, enum: ["true", "false"] })
  @ApiResponse({ status: 200, type: SyncedLyricsCollectionPresenter })
  @ApiResponse({ status: 403, description: "Acesso negado" })
  async search(
    @Query() dto: SearchSyncedLyricsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    if (!currentUser.isAdmin && currentUser.userId !== dto.musician_id) {
      throw new ForbiddenException(
        "Você só pode consultar letras da sua própria biblioteca.",
      );
    }
    const output = await this.searchUseCase.execute({
      musician_id: dto.musician_id,
      page: dto.page,
      per_page: dto.per_page,
      sort: dto.sort,
      sort_dir: dto.sort_dir,
      query: dto.query,
      has_lrc:
        dto.has_lrc === "true"
          ? true
          : dto.has_lrc === "false"
            ? false
            : undefined,
      provider: dto.provider,
      hash: dto.hash,
      include_raw: dto.include_raw === "true",
    });
    return new SyncedLyricsCollectionPresenter(output);
  }

  @Get(":id/synced-lyrics")
  @UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Buscar letra sincronizada (LRC) da MusicLibrary",
    description:
      "Retorna o artefato normalizado de LRC associado a um item da MusicLibrary. Músico só pode acessar a própria biblioteca.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiQuery({ name: "musician_id", required: true, type: String })
  @ApiQuery({ name: "include_raw", required: false, type: Boolean })
  @ApiResponse({ status: 200, type: SyncedLyricsPresenter })
  @ApiResponse({ status: 403, description: "Acesso negado" })
  async findOne(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Query("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query("include_raw") include_raw?: string,
  ) {
    if (!currentUser.isAdmin && currentUser.userId !== musician_id) {
      throw new ForbiddenException(
        "Você só pode consultar letras da sua própria biblioteca.",
      );
    }
    const output = await this.getUseCase.execute({
      musician_id,
      music_library_id: id,
      include_raw: include_raw === "true",
    });
    return new SyncedLyricsPresenter(output);
  }

  @Get(":id/chord-sheet")
  @UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Buscar Chord Sheet da MusicLibrary",
    description:
      "Retorna um artefato unificado (letra normalizada + timeline de acordes + âncoras de alinhamento). Músico só pode acessar a própria biblioteca.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiQuery({ name: "musician_id", required: true, type: String })
  @ApiResponse({ status: 200, type: ChordSheetPresenter })
  @ApiResponse({ status: 403, description: "Acesso negado" })
  async chordSheet(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Query("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    if (!currentUser.isAdmin && currentUser.userId !== musician_id) {
      throw new ForbiddenException(
        "Você só pode acessar a cifra da sua própria biblioteca.",
      );
    }
    const output = await this.getChordSheetUseCase.execute({
      musician_id,
      music_library_id: id,
    });
    return new ChordSheetPresenter(output);
  }

  @Get(":id/chord-sheet/preview")
  @UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Visualizar folha de cifra pronta (HTML)",
    description:
      "Retorna um HTML renderizado a partir do renderable_chord_sheet para visualização no navegador. Músico só pode visualizar a própria biblioteca.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiQuery({ name: "musician_id", required: true, type: String })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: "Acesso negado" })
  async chordSheetPreview(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Query("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res() res: Response,
  ) {
    if (!currentUser.isAdmin && currentUser.userId !== musician_id) {
      throw new ForbiddenException(
        "Você só pode visualizar cifras da sua própria biblioteca.",
      );
    }
    const output = await this.getRenderableChordSheetUseCase.execute({
      musician_id,
      music_library_id: id,
    });

    const html = SyncedLyricsPreviewPresenter.toHtml({
      title: output.title,
      artist: output.artist,
      renderable: output.renderable_chord_sheet,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  }

  @Post("chord-sheets/materialize")
  @SkipThrottle()
  @UseGuards(AuthGuard, RolesGuard, InternalTokenGuard)
  @Roles("musician", "admin")
  @InternalToken({
    envKey: "SYNCED_LYRICS_BULK_TOKEN",
    headerName: "x-synced-lyrics-bulk-token",
  })
  @ApiOperation({
    summary: "Materializar chord sheets (JSON + ChordPro/HTML)",
    description:
      "Gera e persiste uma folha renderizável (JSON estruturado) unindo LRC + timeline de acordes.",
  })
  @ApiResponse({ status: 200, type: MaterializeChordSheetsPresenter })
  async materializeChordSheets(@Body() dto: MaterializeChordSheetsDto) {
    const output = await this.materializeChordSheetsUseCase.execute({
      musician_id: dto.musician_id,
      music_library_ids: dto.music_library_ids,
      force: dto.force,
    });
    return new MaterializeChordSheetsPresenter(output);
  }

  @Post("chord-sheets/materialize-renderable")
  @SkipThrottle()
  @UseGuards(AuthGuard, RolesGuard, InternalTokenGuard)
  @Roles("musician", "admin")
  @InternalToken({
    envKey: "SYNCED_LYRICS_BULK_TOKEN",
    headerName: "x-synced-lyrics-bulk-token",
  })
  @ApiOperation({
    summary: "Materializar chord sheets renderizáveis (renderModel)",
    description:
      "Gera e persiste um renderable_chord_sheet com ancoragem por token para preview HTML.",
  })
  @ApiResponse({ status: 200, type: MaterializeRenderableChordSheetsPresenter })
  async materializeRenderableChordSheets(
    @Body() dto: MaterializeChordSheetsDto,
  ) {
    const output = await this.materializeRenderableChordSheetsUseCase.execute({
      musician_id: dto.musician_id,
      music_library_ids: dto.music_library_ids,
      force: dto.force,
    });
    return new MaterializeRenderableChordSheetsPresenter(output);
  }

  @Post(":id/synced-lyrics")
  @UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Upsert de LRC na MusicLibrary",
    description:
      "Atualiza os campos de LRC (raw + normalized + qualidade) em um item existente da MusicLibrary. Músico só pode editar a própria biblioteca.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiQuery({ name: "musician_id", required: true, type: String })
  @ApiResponse({ status: 200, type: SyncedLyricsPresenter })
  @ApiResponse({ status: 403, description: "Acesso negado" })
  async upsert(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Query("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: UpsertSyncedLyricsDto,
  ) {
    if (!currentUser.isAdmin && currentUser.userId !== musician_id) {
      throw new ForbiddenException(
        "Você só pode editar letras da sua própria biblioteca.",
      );
    }
    const output = await this.upsertUseCase.execute({
      musician_id,
      music_library_id: id,
      raw: dto.raw,
      provider: dto.provider,
      provider_meta: dto.provider_meta ?? null,
      pipeline_version: dto.pipeline_version,
    });
    return new SyncedLyricsPresenter(output);
  }

  @Get(":id/synced-lyrics/download")
  @UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Download do LRC da MusicLibrary",
    description:
      "Retorna o arquivo .lrc (text/plain) para download. Músico só pode baixar letras da sua própria biblioteca.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiQuery({ name: "musician_id", required: true, type: String })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: "Acesso negado" })
  async download(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Query("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!currentUser.isAdmin && currentUser.userId !== musician_id) {
      throw new ForbiddenException(
        "Você só pode baixar letras da sua própria biblioteca.",
      );
    }
    const output = await this.downloadUseCase.execute({
      musician_id,
      music_library_id: id,
    });

    res.setHeader("Content-Type", output.content_type);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${output.filename}"`,
    );
    return output.body;
  }

  @Post(":id/synced-lyrics/sync")
  @UseGuards(AuthGuard, RolesGuard, InternalTokenGuard)
  @Roles("musician", "admin")
  @InternalToken({
    envKey: "SYNCED_LYRICS_BULK_TOKEN",
    headerName: "x-synced-lyrics-bulk-token",
  })
  @ApiOperation({
    summary: "Sincronizar LRC via LRCLIB",
    description:
      "Busca letras sincronizadas na LRCLIB e atualiza os campos de LRC na MusicLibrary.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiQuery({ name: "musician_id", required: true, type: String })
  @ApiQuery({ name: "force", required: false, enum: ["true", "false"] })
  @ApiResponse({ status: 200, type: SyncedLyricsPresenter })
  async sync(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Query("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @Query("force") force?: string,
  ) {
    const output = await this.syncUseCase.execute({
      musician_id,
      music_library_id: id,
      force: force === "true",
    });
    return new SyncedLyricsPresenter(output);
  }
}
