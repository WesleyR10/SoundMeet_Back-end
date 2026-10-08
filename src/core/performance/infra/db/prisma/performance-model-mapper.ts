import { Uuid } from "../../../../shared/domain";
import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import {
  Performance,
  PerformanceId,
  PerformedSong,
} from "../../../domain/performance.aggregate";
import { PerformanceStatus } from "../../../domain/value-objects/performance-status.vo";
import { PerformanceModel, PerformedSongModel } from "./performance-model";

/**
 * Reconcilia o snake_case do domínio com o camelCase do Prisma.
 *
 * `title`/`artist` atravessam sem transformação de propósito: são snapshot do
 * que foi anunciado no palco (ver o agregado), então normalizar aqui — trim,
 * capitalização — reescreveria o histórico na leitura.
 */
export class PerformanceModelMapper {
  /** Aggregate → modelo, só os campos da raiz (sem a relação `songs`). */
  static toModel(entity: Performance): Omit<PerformanceModel, "songs"> {
    return {
      id: entity.performance_id.id,
      eventId: entity.event_id.id,
      establishmentId: entity.establishment_id.id,
      musicianId: entity.musician_id.id,
      bandId: entity.band_id?.id ?? null,
      repertoireId: entity.repertoire_id?.id ?? null,
      status: entity.status.value,
      startedAt: entity.started_at,
      endedAt: entity.ended_at,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static songToModel(
    song: PerformedSong,
    performanceId: string,
  ): PerformedSongModel {
    return {
      id: song.performed_song_id,
      performanceId,
      libraryId: song.music_library_id,
      requestId: song.request_id,
      title: song.title,
      artist: song.artist,
      spotifyTrackId: song.spotify_track_id,
      position: song.position,
      startedAt: song.started_at,
      endedAt: song.ended_at,
      created_at: song.started_at,
    };
  }

  static toEntity(model: PerformanceModel): Performance {
    const songs = (model.songs ?? []).map(
      (s) =>
        new PerformedSong({
          performed_song_id: s.id,
          music_library_id: s.libraryId,
          request_id: s.requestId,
          title: s.title,
          artist: s.artist,
          spotify_track_id: s.spotifyTrackId,
          position: s.position,
          started_at: s.startedAt,
          ended_at: s.endedAt,
        }),
    );

    const entity = new Performance({
      performance_id: new PerformanceId(model.id),
      event_id: new Uuid(model.eventId),
      establishment_id: new Uuid(model.establishmentId),
      musician_id: new Uuid(model.musicianId),
      band_id: model.bandId ? new Uuid(model.bandId) : null,
      repertoire_id: model.repertoireId ? new Uuid(model.repertoireId) : null,
      status: PerformanceStatus.create(model.status),
      started_at: model.startedAt,
      ended_at: model.endedAt,
      songs,
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
