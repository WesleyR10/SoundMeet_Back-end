import { PrismaClient } from "@prisma/client";

import {
  IChordSheetReadModel,
  MusicLibraryChordSheetReadModel,
} from "../../../application/gateways/chord-sheet-read-model.interface";

export class ChordSheetPrismaReadModel implements IChordSheetReadModel {
  constructor(private readonly prisma: PrismaClient) {}

  async getMusicLibraryById(
    id: string,
  ): Promise<MusicLibraryChordSheetReadModel | null> {
    const model = await this.prisma.musicLibrary.findUnique({
      where: { id },
      select: {
        id: true,
        musicianId: true,
        title: true,
        artist: true,
        bpm: true,
        key: true,
        chords: true,
        structure_segments: true,
        lrc_provider: true,
        lrc_provider_meta: true,
        lrc_pipeline_version: true,
        lrc_version: true,
        lrc_quality_flags: true,
        lrc_normalized: true,
        updated_at: true,
      },
    });

    if (!model) return null;

    return {
      id: model.id,
      musicianId: model.musicianId,
      title: model.title,
      artist: model.artist,
      bpm: model.bpm,
      key: model.key,
      chords: model.chords,
      structure_segments: model.structure_segments,
      lrc_provider: model.lrc_provider,
      lrc_provider_meta: model.lrc_provider_meta as any,
      lrc_pipeline_version: model.lrc_pipeline_version,
      lrc_version: model.lrc_version,
      lrc_quality_flags: model.lrc_quality_flags,
      lrc_normalized: model.lrc_normalized as any,
      updated_at: model.updated_at,
    };
  }
}
