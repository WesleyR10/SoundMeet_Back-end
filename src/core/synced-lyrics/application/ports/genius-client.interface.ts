export type GeniusFindPlainLyricsInput = {
  title: string;
  artist?: string | null;
};

export type GeniusPlainLyrics = {
  lyrics: string;
  meta: {
    song_id: number;
    url: string;
    full_title?: string;
    primary_artist_name?: string;
  };
};

export interface IGeniusClient {
  findPlainLyrics(
    input: GeniusFindPlainLyricsInput,
  ): Promise<GeniusPlainLyrics | null>;
}
