import "reflect-metadata";

import { randomUUID } from "crypto";

import { MaterializeRenderableChordSheetsUseCase } from "../core/synced-lyrics/application/use-cases/materialize-renderable-chord-sheets/materialize-renderable-chord-sheets.use-case";

async function bootstrap() {
  const chordCount = Number(process.env.BENCH_CHORDS ?? 5000);
  const music_library_id = randomUUID();
  const musician_id = randomUUID();

  const chordTimeline = Array.from({ length: chordCount }).map((_, idx) => ({
    startMs: idx * 200,
    endMs: idx * 200 + 180,
    symbol: idx % 2 === 0 ? "C" : "G",
    confidence: 0.9,
  }));

  const anchors: Record<string, any> = {};
  for (let i = 0; i < chordCount; i++) {
    anchors[String(i)] = { sectionIndex: 0, lineIndex: 0, tokenIndex: i % 10 };
  }

  const sheet: any = {
    music_library_id,
    musician_id,
    title: "Bench Song",
    artist: "Bench Artist",
    lyrics: {
      normalized: {
        sections: [
          {
            lines: [
              {
                tokens: Array.from({ length: 50 }).map((_, i) => ({
                  kind: i % 2 === 0 ? "word" : "space",
                  text: i % 2 === 0 ? "la" : " ",
                  normalized: i % 2 === 0 ? "la" : " ",
                  startMs: 0,
                  endMs: 1000,
                })),
              },
            ],
          },
        ],
      },
    },
    chords: { timeline: chordTimeline },
    alignment: { anchors },
    meta: {},
    updated_at: new Date(),
  };

  const getChordSheetUseCase: any = {
    execute: async () => sheet,
  };
  const writeModel: any = {
    upsertRenderableChordSheetForMusicLibrary: async () => ({ updated: true }),
  };

  const useCase = new MaterializeRenderableChordSheetsUseCase(
    getChordSheetUseCase,
    writeModel,
  );

  const start = process.hrtime.bigint();
  const out = await useCase.execute({
    musician_id,
    music_library_ids: [music_library_id],
    force: true,
  });
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;

  console.log(
    JSON.stringify(
      {
        status: "ok",
        chords: chordCount,
        elapsed_ms: Math.round(elapsedMs * 100) / 100,
        result: out.items[0]?.status,
      },
      null,
      2,
    ),
  );
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
