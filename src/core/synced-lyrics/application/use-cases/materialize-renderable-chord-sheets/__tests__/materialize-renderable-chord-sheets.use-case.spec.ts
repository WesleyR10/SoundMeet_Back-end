import { MaterializeRenderableChordSheetsUseCase } from "../materialize-renderable-chord-sheets.use-case";

describe("MaterializeRenderableChordSheetsUseCase Unit Tests", () => {
  it("should persist renderModel with per-line chord anchors", async () => {
    const musicianId = "11111111-1111-4111-8111-111111111111";
    const musicLibraryId = "22222222-2222-4222-8222-222222222222";

    const getChordSheetUseCase = {
      execute: jest.fn().mockResolvedValue({
        music_library_id: musicLibraryId,
        musician_id: musicianId,
        title: "Song",
        artist: "Artist",
        lyrics: {
          normalized: {
            sections: [
              {
                label: "Verse",
                lines: [
                  {
                    tokens: [
                      {
                        kind: "word",
                        text: "Hello",
                        normalized: "hello",
                        startMs: 0,
                        endMs: 500,
                      },
                      {
                        kind: "space",
                        text: " ",
                        normalized: " ",
                      },
                      {
                        kind: "word",
                        text: "world",
                        normalized: "world",
                        startMs: 520,
                        endMs: 900,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
        chords: {
          timeline: [
            {
              startMs: 0,
              symbol: "C",
              confidence: 0.9,
            },
          ],
        },
        alignment: {
          anchors: {
            "0": { sectionIndex: 0, lineIndex: 0, tokenIndex: 0 },
          },
        },
        meta: {
          provider: "ai-cifra",
          pipelineVersion: 1,
          qualityFlags: [],
          bpm: null,
          key: null,
        },
        updated_at: new Date("2026-01-01T00:00:00.000Z"),
      }),
    } as any;

    const writeModel = {
      upsertRenderableChordSheetForMusicLibrary: jest
        .fn()
        .mockResolvedValue({ updated: true, skipped: false }),
    } as any;

    const useCase = new MaterializeRenderableChordSheetsUseCase(
      getChordSheetUseCase,
      writeModel,
    );

    const out = await useCase.execute({
      musician_id: musicianId,
      music_library_ids: [musicLibraryId],
      force: true,
    });

    expect(out.items[0].status).toBe("materialized");
    expect(
      writeModel.upsertRenderableChordSheetForMusicLibrary,
    ).toHaveBeenCalledTimes(1);

    const arg =
      writeModel.upsertRenderableChordSheetForMusicLibrary.mock.calls[0][0];

    expect(arg.renderable_chord_sheet.schemaVersion).toBe(1);
    expect(typeof arg.renderable_chord_sheet.chordSheet.updated_at).toBe(
      "string",
    );
    expect(arg.renderable_chord_sheet.renderHints.anchoredChords).toHaveLength(
      1,
    );
    expect(
      arg.renderable_chord_sheet.renderModel.sections[0].lines[0].chords,
    ).toEqual([
      {
        chordIndex: 0,
        startMs: 0,
        symbol: "C",
        confidence: 0.9,
        tokenIndex: 0,
      },
    ]);
  });
});
