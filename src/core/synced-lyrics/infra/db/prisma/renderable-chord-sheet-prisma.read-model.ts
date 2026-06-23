import { PrismaClient } from "@prisma/client";

import {
  IRenderableChordSheetReadModel,
  MusicLibraryRenderableChordSheetReadModel,
} from "../../../application/gateways/renderable-chord-sheet-read-model.interface";

export class RenderableChordSheetPrismaReadModel implements IRenderableChordSheetReadModel {
  constructor(private readonly prisma: PrismaClient) {}

  async getMusicLibraryById(
    id: string,
  ): Promise<MusicLibraryRenderableChordSheetReadModel | null> {
    const model = await this.prisma.musicLibrary.findUnique({
      where: { id },
      select: {
        id: true,
        musicianId: true,
        title: true,
        artist: true,
        renderable_chord_sheet: true,
        renderable_chord_sheet_version: true,
        updated_at: true,
      },
    });

    if (!model) return null;

    return {
      id: model.id,
      musicianId: model.musicianId,
      title: model.title,
      artist: model.artist,
      renderable_chord_sheet: model.renderable_chord_sheet as any,
      renderable_chord_sheet_version: model.renderable_chord_sheet_version ?? 0,
      updated_at: model.updated_at,
    };
  }
}
