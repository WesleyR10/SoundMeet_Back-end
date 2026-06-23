import { SyncedLyrics } from "@core/synced-lyrics/domain";

import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import {
  IChordSheetReadModel,
  MusicLibraryChordSheetReadModel,
} from "../../../gateways/chord-sheet-read-model.interface";
import { GetChordSheetForMusicLibraryUseCase } from "../get-chord-sheet-for-music-library.use-case";

class ChordSheetReadModelStub implements IChordSheetReadModel {
  items: Record<string, MusicLibraryChordSheetReadModel> = {} as any;

  async getMusicLibraryById(
    id: string,
  ): Promise<MusicLibraryChordSheetReadModel | null> {
    return this.items[id] ?? null;
  }
}

describe("GetChordSheetForMusicLibraryUseCase Unit Tests", () => {
  let useCase: GetChordSheetForMusicLibraryUseCase;
  let readModel: ChordSheetReadModelStub;

  beforeEach(() => {
    readModel = new ChordSheetReadModelStub();
    useCase = new GetChordSheetForMusicLibraryUseCase(readModel);
  });

  it("should throw an error when input is invalid", async () => {
    await expect(() =>
      useCase.execute({
        musician_id: "",
        music_library_id: "",
      }),
    ).rejects.toThrow(EntityValidationError);
  });

  it("should throw NotFoundError when music library not found", async () => {
    const input = {
      musician_id: "550e8400-e29b-41d4-a716-446655440000",
      music_library_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(input.music_library_id, SyncedLyrics),
    );
  });

  it("should throw NotFoundError when musician mismatch", async () => {
    const input = {
      musician_id: "550e8400-e29b-41d4-a716-446655440000",
      music_library_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
    };

    readModel.items[input.music_library_id] = {
      id: input.music_library_id,
      musicianId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      title: "Song",
      artist: "Artist",
      bpm: 120,
      key: "C",
      chords: [],
      structure_segments: null,
      lrc_provider: "lrclib",
      lrc_provider_meta: null,
      lrc_pipeline_version: 1,
      lrc_version: 1,
      lrc_quality_flags: [],
      lrc_normalized: { lines: [] },
      updated_at: new Date(),
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(input.music_library_id, SyncedLyrics),
    );
  });

  it("should build chord sheet output", async () => {
    const input = {
      musician_id: "550e8400-e29b-41d4-a716-446655440000",
      music_library_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
    };

    const updatedAt = new Date("2026-01-01T00:00:00.000Z");

    readModel.items[input.music_library_id] = {
      id: input.music_library_id,
      musicianId: input.musician_id,
      title: "Hello",
      artist: "World",
      bpm: 120,
      key: "C",
      chords: {
        timeline: [
          { start_ms: 0, end_ms: 1000, chord: "C", confidence: 0.9 },
          { start_seconds: 1.2, chord: "G" },
        ],
      },
      structure_segments: [
        { start_seconds: 0, end_seconds: 1, label: "intro", confidence: 0.8 },
        { start_seconds: 1, end_seconds: 4, label: "verse", confidence: 0.9 },
      ],
      lrc_provider: "lrclib",
      lrc_provider_meta: { score: 0.88 },
      lrc_pipeline_version: 2,
      lrc_version: 3,
      lrc_quality_flags: ["HAS_WORD_TIMESTAMPS"],
      lrc_normalized: {
        lines: [
          { start_ms: 0, end_ms: 1000, text: "Hello, world" },
          { start_ms: 1000, end_ms: 2000, text: "Second line" },
        ],
      },
      updated_at: updatedAt,
    };

    const output = await useCase.execute(input);

    expect(output).toMatchObject({
      music_library_id: input.music_library_id,
      musician_id: input.musician_id,
      title: "Hello",
      artist: "World",
      lyrics: {
        normalized: {
          sections: [
            {
              label: "intro",
              lines: expect.arrayContaining([
                {
                  tokens: expect.any(Array),
                },
              ]),
            },
            {
              label: "verse",
              lines: expect.any(Array),
            },
          ],
        },
      },
      chords: {
        timeline: [
          expect.objectContaining({ startMs: 0, symbol: "C" }),
          expect.objectContaining({ startMs: 1200, symbol: "G" }),
        ],
      },
      alignment: {
        anchors: expect.any(Object),
      },
      meta: {
        provider: "lrclib",
        pipelineVersion: 2,
        qualityFlags: ["HAS_WORD_TIMESTAMPS"],
        bpm: 120,
        key: "C",
        matchScore: 0.88,
      },
    });

    expect(output.updated_at.toISOString()).toBe(updatedAt.toISOString());

    const firstLine = output.lyrics.normalized.sections[0].lines[0];
    const firstWord = firstLine.tokens.find((t) => t.kind === "word");
    expect(firstWord).toMatchObject({ startMs: 0 });
    expect(typeof firstWord?.endMs).toBe("number");
    expect((firstWord?.endMs as number) > 0).toBe(true);
  });

  it("should anchor chords using weighted fraction when only line timestamps exist", async () => {
    const input = {
      musician_id: "550e8400-e29b-41d4-a716-446655440000",
      music_library_id: "9366b7dc-2d71-4799-b91c-c64adb205105",
    };

    readModel.items[input.music_library_id] = {
      id: input.music_library_id,
      musicianId: input.musician_id,
      title: "Hello",
      artist: "World",
      bpm: 120,
      key: "C",
      chords: {
        timeline: [
          { start_ms: 1500, end_ms: 2000, chord: "G", confidence: 0.9 },
        ],
      },
      structure_segments: null,
      lrc_provider: "lrclib",
      lrc_provider_meta: { score: 0.88 },
      lrc_pipeline_version: 2,
      lrc_version: 1,
      lrc_quality_flags: [],
      lrc_normalized: {
        lines: [{ start_ms: 0, end_ms: 2000, text: "Hello world" }],
      },
      updated_at: new Date(),
    };

    const output = await useCase.execute(input);
    const anchor = output.alignment.anchors["0"];
    expect(anchor).toMatchObject({ sectionIndex: 0, lineIndex: 0 });

    const line = output.lyrics.normalized.sections[0].lines[0];
    expect(line.tokens[anchor.tokenIndex]).toMatchObject({
      kind: "word",
      text: "world",
    });
  });

  it("should filter out low-confidence out-of-key chords when key is available", async () => {
    const input = {
      musician_id: "550e8400-e29b-41d4-a716-446655440000",
      music_library_id: "9366b7dc-2d71-4799-b91c-c64adb205106",
    };

    readModel.items[input.music_library_id] = {
      id: input.music_library_id,
      musicianId: input.musician_id,
      title: "Hello",
      artist: "World",
      bpm: 120,
      key: "C",
      chords: {
        timeline: [
          { start_ms: 0, end_ms: 400, chord: "F#", confidence: 0.2 },
          { start_ms: 400, end_ms: 1800, chord: "F#", confidence: 0.9 },
          { start_ms: 1800, end_ms: 2400, chord: "G", confidence: 0.2 },
        ],
      },
      structure_segments: null,
      lrc_provider: "lrclib",
      lrc_provider_meta: { score: 0.88 },
      lrc_pipeline_version: 2,
      lrc_version: 1,
      lrc_quality_flags: [],
      lrc_normalized: {
        lines: [{ start_ms: 0, end_ms: 2400, text: "Hello world" }],
      },
      updated_at: new Date(),
    };

    const output = await useCase.execute(input);
    const symbols = output.chords.timeline.map((t) => t.symbol);
    expect(symbols).toEqual(["F#", "G"]);
  });

  it("should format maj/min worker labels into chord sheet symbols", async () => {
    const input = {
      musician_id: "550e8400-e29b-41d4-a716-446655440000",
      music_library_id: "9366b7dc-2d71-4799-b91c-c64adb205107",
    };

    readModel.items[input.music_library_id] = {
      id: input.music_library_id,
      musicianId: input.musician_id,
      title: "Hello",
      artist: "World",
      bpm: 120,
      key: "Bb",
      chords: {
        timeline: [
          { start_ms: 0, end_ms: 1000, chord: "A#:maj", confidence: 0.9 },
          { start_ms: 1000, end_ms: 2000, chord: "A#:min", confidence: 0.9 },
        ],
      },
      structure_segments: null,
      lrc_provider: "lrclib",
      lrc_provider_meta: null,
      lrc_pipeline_version: 2,
      lrc_version: 1,
      lrc_quality_flags: [],
      lrc_normalized: {
        lines: [{ start_ms: 0, end_ms: 2000, text: "Hello world" }],
      },
      updated_at: new Date(),
    };

    const output = await useCase.execute(input);
    const symbols = output.chords.timeline.map((t) => t.symbol);
    expect(symbols).toEqual(["Bb", "Bbm"]);
  });

  it("should format worker labels with extensions and slash bass", async () => {
    const input = {
      musician_id: "550e8400-e29b-41d4-a716-446655440000",
      music_library_id: "9366b7dc-2d71-4799-b91c-c64adb205108",
    };

    readModel.items[input.music_library_id] = {
      id: input.music_library_id,
      musicianId: input.musician_id,
      title: "Hello",
      artist: "World",
      bpm: 120,
      key: "Bb",
      chords: {
        timeline: [
          { start_ms: 0, end_ms: 1000, chord: "A#:maj7", confidence: 0.9 },
          { start_ms: 1000, end_ms: 2000, chord: "C:min7", confidence: 0.9 },
          { start_ms: 2000, end_ms: 3000, chord: "F:maj/A#", confidence: 0.9 },
        ],
      },
      structure_segments: null,
      lrc_provider: "lrclib",
      lrc_provider_meta: null,
      lrc_pipeline_version: 2,
      lrc_version: 1,
      lrc_quality_flags: [],
      lrc_normalized: {
        lines: [{ start_ms: 0, end_ms: 3000, text: "Hello world" }],
      },
      updated_at: new Date(),
    };

    const output = await useCase.execute(input);
    const symbols = output.chords.timeline.map((t) => t.symbol);
    expect(symbols).toEqual(["Bbmaj7", "Cm7", "F/Bb"]);
  });
});
