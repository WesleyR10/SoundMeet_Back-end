import { IUseCase } from "../../../../shared/application/use-case.interface";
import { Notification } from "../../../../shared/domain/validators/notification";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { IRenderableChordSheetWriteModel } from "../../gateways/renderable-chord-sheet-write-model.interface";
import { ChordSheetOutput } from "../common/chord-sheet-output";
import { GetChordSheetForMusicLibraryUseCase } from "../get-chord-sheet-for-music-library/get-chord-sheet-for-music-library.use-case";
import {
  MaterializeRenderableChordSheetsInput,
  MaterializeRenderableChordSheetsInputConstructorProps,
  ValidateMaterializeRenderableChordSheetsInput,
} from "./materialize-renderable-chord-sheets.input";

export type MaterializeRenderableChordSheetsItemOutput = {
  music_library_id: string;
  status: "materialized" | "skipped" | "failed";
  reason?: string;
  updated?: boolean;
};

export type MaterializeRenderableChordSheetsOutput = {
  musician_id: string;
  items: MaterializeRenderableChordSheetsItemOutput[];
};

export class MaterializeRenderableChordSheetsUseCase implements IUseCase<
  MaterializeRenderableChordSheetsInput,
  MaterializeRenderableChordSheetsOutput
> {
  constructor(
    private readonly getChordSheetUseCase: GetChordSheetForMusicLibraryUseCase,
    private readonly writeModel: IRenderableChordSheetWriteModel,
  ) {}

  async execute(
    input:
      | MaterializeRenderableChordSheetsInput
      | MaterializeRenderableChordSheetsInputConstructorProps,
  ): Promise<MaterializeRenderableChordSheetsOutput> {
    const validatedInput =
      input instanceof MaterializeRenderableChordSheetsInput
        ? input
        : new MaterializeRenderableChordSheetsInput(input);

    const errors =
      ValidateMaterializeRenderableChordSheetsInput.validate(validatedInput);
    if (errors.length) {
      const notification = new Notification();
      for (const error of errors as any[]) {
        const field = String(error?.property ?? "");
        const constraints = error?.constraints;
        if (constraints && typeof constraints === "object") {
          for (const message of Object.values(constraints)) {
            notification.addError(String(message), field || undefined);
          }
          continue;
        }
        notification.addError("Validation failed", field || undefined);
      }
      throw new EntityValidationError(notification.toJSON());
    }

    const ids = Array.from(
      new Set(
        (validatedInput.music_library_ids ?? [])
          .map((id) => `${id}`.trim())
          .filter(Boolean),
      ),
    );
    if (!ids.length) {
      const notification = new Notification();
      notification.addError(
        "music_library_ids deve ter ao menos 1 id",
        "music_library_ids",
      );
      throw new EntityValidationError(notification.toJSON());
    }

    const items: MaterializeRenderableChordSheetsItemOutput[] = [];
    for (const musicLibraryId of ids) {
      try {
        const sheet = await this.getChordSheetUseCase.execute({
          musician_id: validatedInput.musician_id,
          music_library_id: musicLibraryId,
        });

        if (!this.isRenderable(sheet)) {
          items.push({
            music_library_id: musicLibraryId,
            status: "skipped",
            reason: "Sheet sem chords/lyrics suficientes",
          });
          continue;
        }

        const anchoredChords = this.buildAnchoredChords(sheet);
        const renderable_chord_sheet = RenderableChordSheetBuilder.build({
          sheet,
          anchoredChords,
          generatedAt: new Date().toISOString(),
        });

        const persisted =
          await this.writeModel.upsertRenderableChordSheetForMusicLibrary({
            music_library_id: musicLibraryId,
            musician_id: validatedInput.musician_id,
            renderable_chord_sheet,
            force: validatedInput.force === true,
          });

        items.push({
          music_library_id: musicLibraryId,
          status: persisted.updated
            ? "materialized"
            : persisted.skipped
              ? "skipped"
              : "failed",
          updated: persisted.updated,
          ...(persisted.updated
            ? {}
            : persisted.skipped
              ? { reason: "Já materializado (use force=true para recriar)" }
              : { reason: "MusicLibrary não encontrada para o musician_id" }),
        });
      } catch (e: any) {
        items.push({
          music_library_id: musicLibraryId,
          status: "failed",
          reason: e?.message ? String(e.message) : "Erro ao materializar",
        });
      }
    }

    return {
      musician_id: validatedInput.musician_id,
      items,
    };
  }

  private isRenderable(sheet: ChordSheetOutput): boolean {
    const hasChords = (sheet.chords?.timeline ?? []).length > 0;
    const sections = sheet.lyrics?.normalized?.sections ?? [];
    const hasAnyToken = sections.some((s) =>
      (s.lines ?? []).some((l) =>
        (l.tokens ?? []).some((t) => t.kind !== "space"),
      ),
    );
    return hasChords && hasAnyToken;
  }

  private buildAnchoredChords(sheet: ChordSheetOutput) {
    const anchors = sheet.alignment?.anchors ?? {};
    const chordTimeline = sheet.chords?.timeline ?? [];

    const out: Array<{
      chordIndex: number;
      startMs: number;
      endMs?: number;
      symbol: string;
      confidence?: number;
      sectionIndex: number;
      lineIndex: number;
      tokenIndex: number;
    }> = [];

    for (const [chordIndexStr, anchor] of Object.entries(anchors)) {
      const chordIndex = Number(chordIndexStr);
      if (!Number.isFinite(chordIndex)) continue;
      const chord = chordTimeline[chordIndex];
      if (!chord) continue;
      const symbol = `${chord.symbol ?? ""}`.trim();
      if (!symbol) continue;

      out.push({
        chordIndex,
        startMs: chord.startMs,
        ...(typeof chord.endMs === "number" ? { endMs: chord.endMs } : {}),
        symbol,
        ...(typeof chord.confidence === "number"
          ? { confidence: chord.confidence }
          : {}),
        sectionIndex: anchor.sectionIndex,
        lineIndex: anchor.lineIndex,
        tokenIndex: anchor.tokenIndex,
      });
    }

    out.sort((a, b) => a.startMs - b.startMs);
    return out;
  }
}

type RenderableChordSheetAnchoredChord = {
  chordIndex: number;
  startMs: number;
  endMs?: number;
  symbol: string;
  confidence?: number;
  sectionIndex: number;
  lineIndex: number;
  tokenIndex: number;
};

class RenderableChordSheetBuilder {
  static build(input: {
    sheet: ChordSheetOutput;
    anchoredChords: RenderableChordSheetAnchoredChord[];
    generatedAt: string;
  }) {
    const { sheet, anchoredChords, generatedAt } = input;
    return {
      schemaVersion: 1,
      generatedAt,
      chordSheet: {
        ...sheet,
        updated_at: sheet.updated_at?.toISOString?.() ?? sheet.updated_at,
      },
      renderModel: this.buildRenderModel(sheet, anchoredChords),
      renderHints: {
        anchoredChords,
      },
    };
  }

  private static buildRenderModel(
    sheet: ChordSheetOutput,
    anchoredChords: RenderableChordSheetAnchoredChord[],
  ) {
    const byLine = new Map<string, RenderableChordSheetAnchoredChord[]>();
    for (const a of anchoredChords ?? []) {
      const key = `${a.sectionIndex}:${a.lineIndex}`;
      const list = byLine.get(key) ?? [];
      list.push(a);
      byLine.set(key, list);
    }
    for (const list of byLine.values()) {
      list.sort((a, b) => {
        if (a.startMs !== b.startMs) return a.startMs - b.startMs;
        return a.tokenIndex - b.tokenIndex;
      });
    }

    const sections = sheet.lyrics?.normalized?.sections ?? [];
    return {
      sections: sections.map((s, sectionIndex) => {
        const lines = (s.lines ?? []).map((l, lineIndex) => {
          const key = `${sectionIndex}:${lineIndex}`;
          const chords = (byLine.get(key) ?? []).map((c) => {
            return {
              chordIndex: c.chordIndex,
              startMs: c.startMs,
              ...(typeof c.endMs === "number" ? { endMs: c.endMs } : {}),
              symbol: c.symbol,
              ...(typeof c.confidence === "number"
                ? { confidence: c.confidence }
                : {}),
              tokenIndex: c.tokenIndex,
            };
          });

          const starts = (l.tokens ?? [])
            .map((t) => t.startMs)
            .filter((n): n is number => typeof n === "number");
          const ends = (l.tokens ?? [])
            .map((t) => t.endMs)
            .filter((n): n is number => typeof n === "number");

          const startMs = starts.length ? Math.min(...starts) : undefined;
          const endMs = ends.length ? Math.max(...ends) : undefined;

          return {
            ...(typeof startMs === "number" ? { startMs } : {}),
            ...(typeof endMs === "number" ? { endMs } : {}),
            tokens: l.tokens ?? [],
            chords,
          };
        });

        return {
          ...(typeof s.label === "string" && s.label.trim()
            ? { label: s.label }
            : {}),
          ...(typeof s.startMs === "number" ? { startMs: s.startMs } : {}),
          ...(typeof s.endMs === "number" ? { endMs: s.endMs } : {}),
          ...(typeof s.confidence === "number"
            ? { confidence: s.confidence }
            : {}),
          lines,
        };
      }),
    };
  }
}
