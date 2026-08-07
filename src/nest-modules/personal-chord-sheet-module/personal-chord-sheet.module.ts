import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database-module/database.module";
import { MusiciansModule } from "../musicians-module/musicians.module";
import { PlansModule } from "../plans-module/plans.module";
import { SyncedLyricsModule } from "../synced-lyrics-module/synced-lyrics.module";
import {
  CommunityChordSheetController,
  PersonalChordSheetAdminController,
  PersonalChordSheetController,
} from "./personal-chord-sheet.controller";
import {
  PERSONAL_CHORD_SHEET_COMMUNITY_ENABLED,
  PERSONAL_CHORD_SHEET_PROVIDERS,
} from "./personal-chord-sheet.providers";

// SyncedLyricsModule importado aqui (não o contrário) — sem isso seria um
// ciclo: synced-lyrics não conhece cifra pessoal, então só esta direção é
// segura. Reaproveita GetChordSheetForMusicLibraryUseCase, já exportado de lá,
// sem tocar em core/synced-lyrics. MusiciansModule entra só pelo
// "BandRepository", que resolve os pares de banda do escopo "band".
@Module({
  imports: [DatabaseModule, PlansModule, SyncedLyricsModule, MusiciansModule],
  controllers: [
    PersonalChordSheetController,
    CommunityChordSheetController,
    PersonalChordSheetAdminController,
  ],
  providers: [
    ...Object.values(PERSONAL_CHORD_SHEET_PROVIDERS.REPOSITORIES),
    ...Object.values(PERSONAL_CHORD_SHEET_PROVIDERS.SERVICES),
    ...Object.values(PERSONAL_CHORD_SHEET_PROVIDERS.USE_CASES),
    {
      /**
       * Kill-switch da comunidade.
       *
       * Publicar cifra com letra é risco de licenciamento assumido
       * conscientemente (Docs/AI-musician/chord-sheet.md registra que LRCLIB não
       * é licença de exibição). Poder desligar a vitrine sem deploy é a
       * mitigação barata: desligado, as rotas de comunidade respondem 404 e as
       * do dono seguem intactas — ninguém perde a própria cifra.
       */
      provide: PERSONAL_CHORD_SHEET_COMMUNITY_ENABLED,
      useValue:
        (process.env.PERSONAL_CHORD_SHEET_COMMUNITY_ENABLED ?? "true") ===
        "true",
    },
  ],
})
export class PersonalChordSheetModule {}
