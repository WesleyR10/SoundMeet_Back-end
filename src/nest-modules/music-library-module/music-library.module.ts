import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database-module/database.module";
import { MusicLibraryController } from "./music-library.controller";
import { MUSIC_LIBRARY_PROVIDERS } from "./music-library.providers";
import { MusicLibraryCatalogService } from "./music-library.service";

@Module({
  imports: [DatabaseModule],
  controllers: [MusicLibraryController],
  providers: [
    ...Object.values(MUSIC_LIBRARY_PROVIDERS.REPOSITORIES),
    ...Object.values(MUSIC_LIBRARY_PROVIDERS.USE_CASES),
    ...Object.values(MUSIC_LIBRARY_PROVIDERS.SERVICES),
  ],
  exports: [
    MUSIC_LIBRARY_PROVIDERS.REPOSITORIES.MUSIC_LIBRARY_REPOSITORY.provide,
    MUSIC_LIBRARY_PROVIDERS.USE_CASES.CREATE_MUSIC_LIBRARY_USE_CASE.provide,
    MUSIC_LIBRARY_PROVIDERS.USE_CASES.GET_MUSIC_LIBRARY_USE_CASE.provide,
    MUSIC_LIBRARY_PROVIDERS.USE_CASES.LIST_MUSIC_LIBRARY_USE_CASE.provide,
    MUSIC_LIBRARY_PROVIDERS.USE_CASES.UPDATE_MUSIC_LIBRARY_USE_CASE.provide,
    MusicLibraryCatalogService,
  ],
})
export class MusicLibraryModule {}
