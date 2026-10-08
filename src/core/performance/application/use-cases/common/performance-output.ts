import {
  Performance,
  PerformedSong,
} from "../../../domain/performance.aggregate";

export type PerformedSongOutput = {
  id: string;
  music_library_id: string | null;
  request_id: string | null;
  title: string;
  artist: string;
  /** Faixa no Spotify — `null` quando não resolvida ou fora do catálogo. */
  spotify_track_id: string | null;
  /** Link pronto para abrir no app do fã. `null` junto com o id. */
  spotify_url: string | null;
  position: number;
  started_at: Date;
  ended_at: Date | null;
  /** `null` quando a música nunca foi fechada — não se inventa duração. */
  duration_seconds: number | null;
  is_playing: boolean;
};

export type PerformanceOutput = {
  id: string;
  event_id: string;
  establishment_id: string;
  musician_id: string;
  band_id: string | null;
  /** A setlist programada (repertório do músico). `null` = improviso. */
  repertoire_id: string | null;
  status: string;
  started_at: Date;
  ended_at: Date | null;
  songs: PerformedSongOutput[];
  songs_count: number;
  duration_seconds: number | null;
  current_song: PerformedSongOutput | null;
  /**
   * Público com check-in no evento. Só a leitura do DONO do set preenche
   * (`GetPerformanceUseCase`); nas demais saídas é `null` — "não perguntado",
   * nunca zero. O número é agregado: nenhum nome de fã sai daqui.
   */
  attendees_count: number | null;
};

export class PerformanceOutputMapper {
  static songToOutput(song: PerformedSong): PerformedSongOutput {
    return {
      id: song.performed_song_id,
      music_library_id: song.music_library_id,
      request_id: song.request_id,
      title: song.title,
      artist: song.artist,
      spotify_track_id: song.spotify_track_id,
      // A URL é montada aqui, não guardada: o formato é do Spotify, e um dia
      // que ele mude não deve exigir migration numa coluna de texto.
      spotify_url: song.spotify_track_id
        ? `https://open.spotify.com/track/${song.spotify_track_id}`
        : null,
      position: song.position,
      started_at: song.started_at,
      ended_at: song.ended_at,
      duration_seconds: song.duration_seconds,
      is_playing: song.is_playing,
    };
  }

  static toOutput(entity: Performance): PerformanceOutput {
    const current = entity.current_song;

    return {
      id: entity.performance_id.id,
      event_id: entity.event_id.id,
      establishment_id: entity.establishment_id.id,
      musician_id: entity.musician_id.id,
      band_id: entity.band_id?.id ?? null,
      repertoire_id: entity.repertoire_id?.id ?? null,
      status: entity.status.value,
      started_at: entity.started_at,
      ended_at: entity.ended_at,
      songs: entity.songs.map((s) => this.songToOutput(s)),
      songs_count: entity.songs_count,
      duration_seconds: entity.duration_seconds,
      current_song: current ? this.songToOutput(current) : null,
      attendees_count: null,
    };
  }
}
