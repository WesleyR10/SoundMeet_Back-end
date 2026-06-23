import { Prisma, PrismaClient } from "@prisma/client";

import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  IRenderableChordSheetWriteModel,
  UpsertRenderableChordSheetForMusicLibraryInput,
  UpsertRenderableChordSheetForMusicLibraryOutput,
} from "../../../application/gateways/renderable-chord-sheet-write-model.interface";

export class RenderableChordSheetPrismaWriteModel implements IRenderableChordSheetWriteModel {
  constructor(private readonly prisma: PrismaClient) {}

  private toPrismaOptionalJson(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    if (value === null) {
      return Prisma.DbNull;
    }
    return value as Prisma.InputJsonValue;
  }

  async upsertRenderableChordSheetForMusicLibrary(
    input: UpsertRenderableChordSheetForMusicLibraryInput,
  ): Promise<UpsertRenderableChordSheetForMusicLibraryOutput> {
    const musicLibraryId = `${input.music_library_id}`.trim();
    const musicianId = `${input.musician_id}`.trim();
    const force = input.force === true;

    try {
      const result = await this.prisma.musicLibrary.updateMany({
        where: {
          id: musicLibraryId,
          musicianId,
          ...(force ? {} : { renderable_chord_sheet_version: 0 }),
        },
        data: {
          renderable_chord_sheet: this.toPrismaOptionalJson(
            input.renderable_chord_sheet,
          ),
          renderable_chord_sheet_version: { increment: 1 },
        } as any,
      });

      if (result.count > 0) {
        return { updated: true };
      }

      if (!force) {
        const exists = await this.prisma.musicLibrary.findFirst({
          where: { id: musicLibraryId, musicianId },
          select: { id: true, renderable_chord_sheet_version: true },
        });
        if (exists && (exists.renderable_chord_sheet_version ?? 0) > 0) {
          return { updated: false, skipped: true };
        }
      }

      return { updated: false };
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        id: musicLibraryId,
        operation: "musicLibrary.updateMany(renderable-chord-sheet-upsert)",
      });
    }
  }
}
