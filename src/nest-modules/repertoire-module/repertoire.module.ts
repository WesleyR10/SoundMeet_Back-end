import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database-module/database.module";
import { MusicLibraryModule } from "../music-library-module/music-library.module";
import { PlansModule } from "../plans-module/plans.module";
import {
  RepertoireController,
  RepertoireInvitesController,
  RepertoirePublicController,
} from "./repertoire.controller";
import { REPERTOIRE_PROVIDERS } from "./repertoire.providers";

@Module({
  imports: [DatabaseModule, PlansModule, MusicLibraryModule],
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
