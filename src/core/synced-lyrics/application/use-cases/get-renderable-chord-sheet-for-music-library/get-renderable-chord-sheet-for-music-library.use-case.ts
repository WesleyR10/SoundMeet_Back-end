import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Notification } from "../../../../shared/domain/validators/notification";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { SyncedLyrics } from "../../../domain";
import { IRenderableChordSheetReadModel } from "../../gateways/renderable-chord-sheet-read-model.interface";
import {
  GetRenderableChordSheetForMusicLibraryInput,
  GetRenderableChordSheetForMusicLibraryInputConstructorProps,
  ValidateGetRenderableChordSheetForMusicLibraryInput,
} from "./get-renderable-chord-sheet-for-music-library.input";

export type RenderableChordSheetOutput = {
  music_library_id: string;
  musician_id: string;
  title: string;
  artist: string;
  renderable_chord_sheet: unknown;
  updated_at: Date;
};

export class GetRenderableChordSheetForMusicLibraryUseCase implements IUseCase<
  GetRenderableChordSheetForMusicLibraryInput,
  RenderableChordSheetOutput
> {
  constructor(private readonly readModel: IRenderableChordSheetReadModel) {}

  async execute(
    input:
      | GetRenderableChordSheetForMusicLibraryInput
      | GetRenderableChordSheetForMusicLibraryInputConstructorProps,
  ): Promise<RenderableChordSheetOutput> {
    const validatedInput =
      input instanceof GetRenderableChordSheetForMusicLibraryInput
        ? input
        : new GetRenderableChordSheetForMusicLibraryInput(input);

    const errors =
      ValidateGetRenderableChordSheetForMusicLibraryInput.validate(
        validatedInput,
      );

    if (errors.length) {
      const notification = new Notification();

      for (const error of errors as any[]) {
        const field = String(error?.property ?? "");
        const constraints = error?.constraints;
        if (constraints && typeof constraints === "object") {
          for (const message of Object.values(constraints)) {
            notification.addError(String(message), field || undefined);
          }
          continue;
        }
        notification.addError("Validation failed", field || undefined);
      }

      throw new EntityValidationError(notification.toJSON());
    }

    const item = await this.readModel.getMusicLibraryById(
      validatedInput.music_library_id,
    );

    if (!item || item.musicianId !== validatedInput.musician_id) {
      throw new NotFoundError(validatedInput.music_library_id, SyncedLyrics);
    }

    if (!item.renderable_chord_sheet) {
      throw new NotFoundError(validatedInput.music_library_id, SyncedLyrics);
    }

    return {
      music_library_id: item.id,
      musician_id: item.musicianId,
      title: item.title,
      artist: item.artist,
      renderable_chord_sheet: item.renderable_chord_sheet,
      updated_at: item.updated_at,
    };
  }
}
