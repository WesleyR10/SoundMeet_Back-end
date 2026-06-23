import { MaterializeRenderableChordSheetsUseCase } from "../../src/core/synced-lyrics/application/use-cases/materialize-renderable-chord-sheets/materialize-renderable-chord-sheets.use-case";
import { ConfigModuleRoot } from "../../src/nest-modules/config-module/config-module.module";
import { PrismaService } from "../../src/nest-modules/database-module/prisma/prisma.service";
import { startApp } from "../../src/nest-modules/shared-module/testing/helpers";
import { SyncedLyricsModule } from "../../src/nest-modules/synced-lyrics-module/synced-lyrics.module";

describe("Materialize Renderable Chord Sheets (e2e)", () => {
  const appHelper = startApp({
    imports: [ConfigModuleRoot.forRoot(), SyncedLyricsModule],
  });

  it("materializa JSON renderizável a partir de LRC e chords.timeline", async () => {
    const prisma = appHelper.app.get(PrismaService);
    const useCase = appHelper.app.get(MaterializeRenderableChordSheetsUseCase);

    const musician_id = "3d2f7f8a-20f4-4d6a-9dbe-f5a76c0bfe61";
    await prisma.musician.upsert({
      where: { id: musician_id },
      update: {},
      create: {
        id: musician_id,
        email: `e2e+renderable+${musician_id}@soundmeet.local`,
        name: "E2E Renderable",
      },
    });

    const created = await prisma.musicLibrary.create({
      data: {
        musicianId: musician_id,
        title: "E2E Song",
        artist: "E2E Artist",
        lrc_normalized: {
          lines: [
            { start_ms: 0, end_ms: 5000, text: "Hello world" },
            { start_ms: 5000, end_ms: 9000, text: "Second line" },
          ],
          meta: { has_word_timestamps: false },
        },
        chords: {
          timeline: [
            { startMs: 1000, endMs: 2500, symbol: "C", confidence: 0.9 },
            { startMs: 6500, endMs: 7500, symbol: "G", confidence: 0.8 },
          ],
        },
      },
      select: { id: true },
    });

    const output = await useCase.execute({
      musician_id,
      music_library_ids: [created.id],
    });

    expect(output.musician_id).toBe(musician_id);
    expect(output.items).toHaveLength(1);
    expect(output.items[0].status).toBe("materialized");

    const persisted = await prisma.musicLibrary.findUnique({
      where: { id: created.id },
      select: {
        renderable_chord_sheet_version: true,
        renderable_chord_sheet: true,
      },
    });

    expect(persisted?.renderable_chord_sheet_version).toBeGreaterThan(0);

    const sheet = persisted?.renderable_chord_sheet as any;
    expect(sheet?.schemaVersion).toBe(1);
    expect(typeof sheet?.generatedAt).toBe("string");
    expect(sheet?.chordSheet?.title).toBe("E2E Song");
    expect(sheet?.chordSheet?.artist).toBe("E2E Artist");
    expect(typeof sheet?.chordSheet?.updated_at).toBe("string");

    const anchored = Array.isArray(sheet?.renderHints?.anchoredChords)
      ? sheet.renderHints.anchoredChords
      : [];
    expect(anchored.length).toBeGreaterThan(0);
    expect(anchored[0]?.symbol).toBeDefined();
    expect(anchored.some((c: any) => c.symbol === "C")).toBe(true);
    expect(anchored.some((c: any) => c.symbol === "G")).toBe(true);
  });
});
