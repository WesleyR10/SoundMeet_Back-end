import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import {
  Repertoire,
  RepertoireId,
  RepertoireInvitee,
  RepertoireSong,
} from "../../../domain/repertoire.aggregate";
import {
  RepertoireInviteeModel,
  RepertoireModel,
  RepertoireSongModel,
} from "./repertoire-model";

export class RepertoireModelMapper {
  /** Converte aggregate → modelo Prisma (apenas campos do Repertoire, sem relations). */
  static toModel(entity: Repertoire): Omit<RepertoireModel, "songs" | "invitees"> {
    return {
      id: entity.repertoire_id.id,
      musician_id: entity.musician_id,
      name: entity.name,
      share_token: entity.share_token,
      share_token_expires_at: entity.share_token_expires_at,
      is_shared: entity.is_shared,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static songToModel(
    song: RepertoireSong,
    repertoire_id: string,
  ): RepertoireSongModel {
    return {
      id: song.song_id,
      repertoire_id,
      music_library_id: song.music_library_id,
      position: song.position,
      custom_notes: song.custom_notes,
      duration_override_seconds: song.duration_override_seconds,
      added_at: song.added_at,
    };
  }

  static inviteeToModel(
    invitee: RepertoireInvitee,
    repertoire_id: string,
  ): RepertoireInviteeModel {
    return {
      id: invitee.id,
      repertoire_id,
      musician_id: invitee.musician_id,
      invited_at: invitee.invited_at,
    };
  }

  /** Converte modelo Prisma (com songs e invitees) → aggregate. */
  static toEntity(model: RepertoireModel): Repertoire {
    const songs = (model.songs ?? []).map(
      (s) =>
        new RepertoireSong({
          song_id: s.id,
          music_library_id: s.music_library_id,
          position: s.position,
          custom_notes: s.custom_notes,
          duration_override_seconds: s.duration_override_seconds,
          added_at: s.added_at,
        }),
    );

    const invitees = (model.invitees ?? []).map(
      (i) =>
        new RepertoireInvitee({
          id: i.id,
          musician_id: i.musician_id,
          invited_at: i.invited_at,
        }),
    );

    const entity = new Repertoire({
      repertoire_id: new RepertoireId(model.id),
      musician_id: model.musician_id,
      name: model.name,
      songs,
      invitees,
      share_token: model.share_token,
      share_token_expires_at: model.share_token_expires_at,
      is_shared: model.is_shared,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });

    entity.validate();
    if (entity.notification.hasErrors()) {
      throw new LoadEntityError(entity.notification.toJSON());
    }

    return entity;
  }
}
