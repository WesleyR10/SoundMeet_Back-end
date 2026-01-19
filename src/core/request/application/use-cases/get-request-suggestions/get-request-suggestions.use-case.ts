import {
  IMusicianRepository,
  Musician,
  MusicianId,
  MusicianSearchParams,
} from "@core/musician/domain";
import { IRequestRepository } from "@core/request/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { GetRequestSuggestionsInput } from "./get-request-suggestions.input";

export type RequestSuggestion = {
  song_title: string;
  artist?: string;
  count: number;
};

export type GetRequestSuggestionsOutput = {
  musician_id: string;
  genres: string[];
  suggestions: RequestSuggestion[];
};

export class GetRequestSuggestionsUseCase implements IUseCase<
  GetRequestSuggestionsInput,
  GetRequestSuggestionsOutput
> {
  constructor(
    private requestRepo: IRequestRepository,
    private musicianRepo: IMusicianRepository,
  ) {}

  async execute(
    input: GetRequestSuggestionsInput,
  ): Promise<GetRequestSuggestionsOutput> {
    const musicianId = new MusicianId(input.musician_id);
    const musician = await this.musicianRepo.findById(musicianId);

    if (!musician) {
      throw new NotFoundError(input.musician_id, Musician);
    }

    const limit = input.limit ?? 10;
    const suggestionsMap = new Map<string, RequestSuggestion>();

    const addSuggestions = (items: RequestSuggestion[]) => {
      for (const item of items) {
        const key = `${item.song_title}::${item.artist ?? ""}`;
        const existing = suggestionsMap.get(key);
        if (existing) {
          suggestionsMap.set(key, {
            ...existing,
            count: existing.count + item.count,
          });
        } else {
          suggestionsMap.set(key, item);
        }
      }
    };

    const primary = await this.requestRepo.findPopularSongs(
      musician.musician_id.id,
      limit,
    );
    addSuggestions(primary);

    if (suggestionsMap.size < limit && musician.genres.length > 0) {
      const relatedMusiciansResult = await this.musicianRepo.search(
        MusicianSearchParams.create({
          page: 1,
          per_page: 10,
          filter: { genres: musician.genres },
        }),
      );

      const relatedIds = relatedMusiciansResult.items
        .map((item) => item.musician_id.id)
        .filter((id) => id !== musician.musician_id.id)
        .slice(0, 5);

      for (const relatedId of relatedIds) {
        const relatedSuggestions = await this.requestRepo.findPopularSongs(
          relatedId,
          limit,
        );
        addSuggestions(relatedSuggestions);
        if (suggestionsMap.size >= limit) {
          break;
        }
      }
    }

    const suggestions = Array.from(suggestionsMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return {
      musician_id: musician.musician_id.id,
      genres: musician.genres,
      suggestions,
    };
  }
}
