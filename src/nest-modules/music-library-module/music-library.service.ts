import { Injectable } from "@nestjs/common";

import { CreateMusicLibraryUseCase } from "../../core/music-library/application/use-cases/create-music-library/create-music-library.use-case";
import { GetMusicLibraryUseCase } from "../../core/music-library/application/use-cases/get-music-library/get-music-library.use-case";
import { ListMusicLibraryUseCase } from "../../core/music-library/application/use-cases/list-music-library/list-music-library.use-case";
import { UpdateMusicLibraryUseCase } from "../../core/music-library/application/use-cases/update-music-library/update-music-library.use-case";

@Injectable()
export class MusicLibraryCatalogService {
  constructor(
    private readonly createUseCase: CreateMusicLibraryUseCase,
    private readonly getUseCase: GetMusicLibraryUseCase,
    private readonly listUseCase: ListMusicLibraryUseCase,
    private readonly updateUseCase: UpdateMusicLibraryUseCase,
  ) {}

  async findOrCreateYoutube(input: {
    musician_id: string;
    title: string;
    artist: string;
    youtube_video_id: string;
  }) {
    const existing = await this.findYoutube(input);
    if (existing) {
      return { item: existing, reused: true };
    }

    const created = await this.createUseCase.execute({
      musician_id: input.musician_id,
      title: input.title,
      artist: input.artist,
      source: "youtube",
      source_id: input.youtube_video_id,
    });

    return { item: created, reused: false };
  }

  async updateCatalogSource(input: {
    id: string;
    musician_id: string;
    title?: string;
    artist?: string;
    source?: string | null;
    source_id?: string | null;
  }) {
    const existing = await this.getUseCase.execute({ id: input.id });
    if (existing.musician_id !== input.musician_id) {
      return null;
    }

    return this.updateUseCase.execute({
      id: input.id,
      title: input.title,
      artist: input.artist,
      source: input.source,
      source_id: input.source_id,
    });
  }

  private async findYoutube(input: {
    musician_id: string;
    youtube_video_id: string;
  }) {
    const result = await this.listUseCase.execute({
      page: 1,
      per_page: 100,
      filter: {
        musician_id: input.musician_id,
        source: "youtube",
      },
    });

    return (
      result.items.find((item) => item.source_id === input.youtube_video_id) ??
      null
    );
  }
}
