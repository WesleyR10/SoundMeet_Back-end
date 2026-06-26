import { Repertoire, RepertoireSong } from "../../../domain/repertoire.aggregate";

export type RepertoireSongOutput = {
  song_id: string;
  music_library_id: string;
  position: number;
  title: string;
  artist: string;
  custom_notes: string | null;
  duration_override_seconds: number | null;
  duration_seconds: number | null;
  effective_duration_seconds: number | null;
  added_at: Date;
};

export type RepertoireInviteeOutput = {
  id: string;
  musician_id: string;
  invited_at: Date;
};

export type RepertoireOutput = {
  repertoire_id: string;
  musician_id: string;
  name: string;
  songs: RepertoireSongOutput[];
  song_count: number;
  estimated_show_duration_minutes: number | null;
  is_shared: boolean;
  share_token: string | null;
  share_token_expires_at: Date | null;
  invitees: RepertoireInviteeOutput[];
  created_at: Date;
  updated_at: Date;
};

export type MusicLibraryBasicData = {
  id: string;
  title: string;
  artist: string;
  duration_seconds: number | null;
};

export class RepertoireOutputMapper {
  static toOutput(
    repertoire: Repertoire,
    musicLibraryMap: Map<string, MusicLibraryBasicData> = new Map(),
    isOwner = true,
  ): RepertoireOutput {
    const libraryDurations = new Map<string, number | null>();
    for (const [id, data] of musicLibraryMap.entries()) {
      libraryDurations.set(id, data.duration_seconds);
    }

    const songs: RepertoireSongOutput[] = repertoire.songs.map((song) => {
      const lib = musicLibraryMap.get(song.music_library_id);
      const duration_seconds = lib?.duration_seconds ?? null;
      const effective = song.effectiveDuration(duration_seconds);
      return {
        song_id: song.song_id,
        music_library_id: song.music_library_id,
        position: song.position,
        title: lib?.title ?? "",
        artist: lib?.artist ?? "",
        custom_notes: song.custom_notes,
        duration_override_seconds: song.duration_override_seconds,
        duration_seconds,
        effective_duration_seconds: effective,
        added_at: song.added_at,
      };
    });

    const estimated = repertoire.getEstimatedShowDuration(libraryDurations);

    return {
      repertoire_id: repertoire.repertoire_id.id,
      musician_id: repertoire.musician_id,
      name: repertoire.name,
      songs,
      song_count: repertoire.songs.length,
      estimated_show_duration_minutes: estimated,
      is_shared: repertoire.is_shared,
      share_token: isOwner ? repertoire.share_token : null,
      share_token_expires_at: isOwner ? repertoire.share_token_expires_at : null,
      invitees: isOwner
        ? repertoire.invitees.map((i) => ({ id: i.id, musician_id: i.musician_id, invited_at: i.invited_at }))
        : [],
      created_at: repertoire.created_at,
      updated_at: repertoire.updated_at,
    };
  }
}
