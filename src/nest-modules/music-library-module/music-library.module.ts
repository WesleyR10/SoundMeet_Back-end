import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database-module/database.module";
import { BackfillSpotifyTracksJob } from "./backfill-spotify-tracks.job";
import { MusicLibraryController } from "./music-library.controller";
import { MUSIC_LIBRARY_PROVIDERS } from "./music-library.providers";
import { MusicLibraryCatalogService } from "./music-library.service";
import { PublicRepertoireController } from "./public-repertoire.controller";

@Module({
  imports: [DatabaseModule],
  controllers: [MusicLibraryController, PublicRepertoireController],
  providers: [
    ...Object.values(MUSIC_LIBRARY_PROVIDERS.REPOSITORIES),
    ...Object.values(MUSIC_LIBRARY_PROVIDERS.USE_CASES),
    ...Object.values(MUSIC_LIBRARY_PROVIDERS.SERVICES),
    ...Object.values(MUSIC_LIBRARY_PROVIDERS.GATEWAYS),
    ...Object.values(MUSIC_LIBRARY_PROVIDERS.SPOTIFY_USE_CASES),
    BackfillSpotifyTracksJob,
  ],
  exports: [
    MUSIC_LIBRARY_PROVIDERS.REPOSITORIES.MUSIC_LIBRARY_REPOSITORY.provide,
    MUSIC_LIBRARY_PROVIDERS.USE_CASES.CREATE_MUSIC_LIBRARY_USE_CASE.provide,
    MUSIC_LIBRARY_PROVIDERS.USE_CASES.GET_MUSIC_LIBRARY_USE_CASE.provide,
    MUSIC_LIBRARY_PROVIDERS.USE_CASES.LIST_MUSIC_LIBRARY_USE_CASE.provide,
    MUSIC_LIBRARY_PROVIDERS.USE_CASES.UPDATE_MUSIC_LIBRARY_USE_CASE.provide,
    MusicLibraryCatalogService,
    // Consumido pelo `ai-cifra`, que resolve a faixa logo após materializar a
    // análise — é ali que `duration_seconds` acaba de ser gravado.
    MUSIC_LIBRARY_PROVIDERS.SPOTIFY_USE_CASES.RESOLVE_SPOTIFY_TRACK_USE_CASE
      .provide,
  ],
})
export class MusicLibraryModule {}
