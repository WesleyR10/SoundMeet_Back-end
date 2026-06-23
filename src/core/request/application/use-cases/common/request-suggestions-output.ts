export type RequestSuggestionOutput = {
  song_title: string;
  artist: string | null;
  count: number;
};

export type GetRequestSuggestionsOutput = {
  musician_id: string;
  genres: string[];
  suggestions: RequestSuggestionOutput[];
};

export class RequestSuggestionsOutputMapper {
  static toOutput(props: {
    musician_id: string;
    genres: string[];
    suggestions: {
      song_title: string;
      artist?: string | null;
      count: number;
    }[];
  }): GetRequestSuggestionsOutput {
    return {
      musician_id: props.musician_id,
      genres: props.genres,
      suggestions: props.suggestions.map((s) => ({
        song_title: s.song_title,
        artist: s.artist ?? null,
        count: s.count,
      })),
    };
  }
}
