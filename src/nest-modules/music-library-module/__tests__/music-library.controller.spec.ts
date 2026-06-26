import { MusicLibraryOutput } from "../../../core/music-library/application/use-cases/common/music-library-output";
import { CreateMusicLibraryDto } from "../dto/create-music-library.dto";
import { SearchMusicLibraryDto } from "../dto/search-music-library.dto";
import { UpdateMusicLibraryDto } from "../dto/update-music-library.dto";
import { MusicLibraryController } from "../music-library.controller";
import {
  MusicLibraryCollectionPresenter,
  MusicLibraryPresenter,
} from "../music-library.presenter";

function makeOutput(
  overrides: Partial<MusicLibraryOutput> = {},
): MusicLibraryOutput {
  const now = new Date("2025-01-01T00:00:00.000Z");
  return {
    id: "550e8400-e29b-41d4-a716-446655440001",
    musician_id: "550e8400-e29b-41d4-a716-446655440002",
    title: "Song",
    artist: "Artist",
    genre: null,
    key: null,
    bpm: null,
    lyrics: null,
    chords: null,
    structure_segments: null,
    chord_sheet: null,
    chord_sheet_version: 0,
    renderable_chord_sheet: null,
    renderable_chord_sheet_version: 0,
    notes: null,
    difficulty: 1,
    is_favorite: false,
    source: "youtube",
    source_id: "video-id",
    lrc_raw: null,
    lrc_normalized: null,
    lrc_provider: null,
    lrc_provider_meta: null,
    lrc_hash: null,
    lrc_version: 0,
    lrc_pipeline_version: 0,
    lrc_quality_flags: [],
    lrc_coverage_ms: null,
    lrc_has_word_timestamps: false,
    lrc_last_synced_at: null,
    created_at: now,
    updated_at: now,
    display_name: "Song - Artist",
    has_lyrics: false,
    has_chord_sheet: false,
    has_lrc: false,
    is_hard: false,
    ...overrides,
  };
}

const MUSICIAN_USER = {
  userId: "550e8400-e29b-41d4-a716-446655440002",
  roles: ["musician"],
  establishmentIds: [],
  bandIds: [],
  isAdmin: false,
};

describe("MusicLibraryController", () => {
  let controller: MusicLibraryController;

  beforeEach(() => {
    controller = new MusicLibraryController();
  });

  it("creates a music library item", async () => {
    const output = makeOutput();
    const useCase = { execute: jest.fn().mockResolvedValue(output) };
    (controller as any).createUseCase = useCase;
    const dto: CreateMusicLibraryDto = {
      title: output.title,
      artist: output.artist,
      source: output.source,
      source_id: output.source_id,
    } as CreateMusicLibraryDto;

    const presenter = await controller.create(dto, MUSICIAN_USER);

    expect(useCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ musician_id: MUSICIAN_USER.userId }),
    );
    expect(presenter).toStrictEqual(new MusicLibraryPresenter(output));
  });

  it("lists music library items", async () => {
    const output = {
      items: [makeOutput()],
      current_page: 1,
      last_page: 1,
      per_page: 10,
      total: 1,
    };
    const useCase = { execute: jest.fn().mockResolvedValue(output) };
    (controller as any).listUseCase = useCase;
    const query: SearchMusicLibraryDto = {
      source: "youtube",
      page: 1,
      per_page: 10,
    };

    const presenter = await controller.findAll(query, MUSICIAN_USER);

    expect(useCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        per_page: 10,
        filter: expect.objectContaining({
          musician_id: MUSICIAN_USER.userId,
          source: query.source,
        }),
      }),
    );
    expect(presenter).toStrictEqual(
      new MusicLibraryCollectionPresenter(output),
    );
  });

  it("gets a music library item", async () => {
    const output = makeOutput();
    const useCase = { execute: jest.fn().mockResolvedValue(output) };
    (controller as any).getUseCase = useCase;

    const presenter = await controller.findOne(output.id);

    expect(useCase.execute).toHaveBeenCalledWith({ id: output.id });
    expect(presenter).toStrictEqual(new MusicLibraryPresenter(output));
  });

  it("updates a music library item", async () => {
    const output = makeOutput({ title: "Updated" });
    const useCase = { execute: jest.fn().mockResolvedValue(output) };
    (controller as any).updateUseCase = useCase;
    const dto: UpdateMusicLibraryDto = { title: "Updated" };

    const presenter = await controller.update(output.id, dto, MUSICIAN_USER);

    expect(useCase.execute).toHaveBeenCalledWith({
      id: output.id,
      title: "Updated",
      requesting_musician_id: MUSICIAN_USER.userId,
      is_admin: false,
    });
    expect(presenter).toStrictEqual(new MusicLibraryPresenter(output));
  });

  it("removes a music library item", async () => {
    const useCase = { execute: jest.fn().mockResolvedValue(undefined) };
    (controller as any).deleteUseCase = useCase;

    await expect(
      controller.remove("550e8400-e29b-41d4-a716-446655440001", MUSICIAN_USER),
    ).resolves.toBeUndefined();
    expect(useCase.execute).toHaveBeenCalledWith({
      id: "550e8400-e29b-41d4-a716-446655440001",
      requesting_musician_id: MUSICIAN_USER.userId,
      is_admin: false,
    });
  });
});
