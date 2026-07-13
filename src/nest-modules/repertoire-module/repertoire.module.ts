import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database-module/database.module";
import { MusicLibraryModule } from "../music-library-module/music-library.module";
import { PlansModule } from "../plans-module/plans.module";
import { SyncedLyricsModule } from "../synced-lyrics-module/synced-lyrics.module";
import {
  RepertoireController,
  RepertoireInvitesController,
  RepertoirePublicController,
} from "./repertoire.controller";
import { REPERTOIRE_PROVIDERS } from "./repertoire.providers";

// SyncedLyricsModule importado aqui (não o contrário) — sem isso seria um
// ciclo: SyncedLyricsModule não conhece Repertoire, então só essa direção é
// segura. Usado pelos endpoints novos de chord-sheet-via-repertório (convite
// nominal + link público), que reaproveitam GetChordSheetForMusicLibraryUseCase
// já existente sem tocar em core/synced-lyrics.
@Module({
  imports: [DatabaseModule, PlansModule, MusicLibraryModule, SyncedLyricsModule],
  controllers: [
    RepertoireController,
    RepertoirePublicController,
    RepertoireInvitesController,
  ],
  providers: [
    ...Object.values(REPERTOIRE_PROVIDERS.REPOSITORIES),
    ...Object.values(REPERTOIRE_PROVIDERS.USE_CASES),
  ],
})
export class RepertoireModule {}
