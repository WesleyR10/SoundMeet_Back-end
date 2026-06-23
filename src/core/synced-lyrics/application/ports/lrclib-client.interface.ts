export type LrcLibFindLyricsRequest = {
  track_name: string;
  artist_name?: string;
  album_name?: string;
  duration_seconds?: number;
  cached?: boolean;
};

export type LrcLibSearchLyricsRequest = {
  q?: string;
  track_name?: string;
  artist_name?: string;
  album_name?: string;
};

export type LrcLibLyrics = {
  id: number;
  name: string;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
  lang: string | null;
  isrc: string | null;
  spotifyId: string | null;
  releaseDate: string | null;
};

export interface ILrcLibClient {
  findLyrics(input: LrcLibFindLyricsRequest): Promise<LrcLibLyrics | null>;
  searchLyrics(input: LrcLibSearchLyricsRequest): Promise<LrcLibLyrics[]>;
}
