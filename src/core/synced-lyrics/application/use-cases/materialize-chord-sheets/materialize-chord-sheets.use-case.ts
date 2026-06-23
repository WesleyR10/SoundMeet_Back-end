import { IUseCase } from "../../../../shared/application/use-case.interface";
import { Notification } from "../../../../shared/domain/validators/notification";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { IChordSheetWriteModel } from "../../gateways/chord-sheet-write-model.interface";
import { ChordSheetOutput } from "../common/chord-sheet-output";
import { GetChordSheetForMusicLibraryUseCase } from "../get-chord-sheet-for-music-library/get-chord-sheet-for-music-library.use-case";
import {
  MaterializeChordSheetsInput,
  MaterializeChordSheetsInputConstructorProps,
  ValidateMaterializeChordSheetsInput,
} from "./materialize-chord-sheets.input";

export type MaterializeChordSheetsItemOutput = {
  music_library_id: string;
  status: "materialized" | "skipped" | "failed";
  reason?: string;
  updated?: boolean;
};

export type MaterializeChordSheetsOutput = {
  musician_id: string;
  items: MaterializeChordSheetsItemOutput[];
};

export class MaterializeChordSheetsUseCase implements IUseCase<
  MaterializeChordSheetsInput,
  MaterializeChordSheetsOutput
> {
  constructor(
    private readonly getChordSheetUseCase: GetChordSheetForMusicLibraryUseCase,
    private readonly writeModel: IChordSheetWriteModel,
  ) {}

  async execute(
    input:
      | MaterializeChordSheetsInput
      | MaterializeChordSheetsInputConstructorProps,
  ): Promise<MaterializeChordSheetsOutput> {
    const validatedInput =
      input instanceof MaterializeChordSheetsInput
        ? input
        : new MaterializeChordSheetsInput(input);

    const errors = ValidateMaterializeChordSheetsInput.validate(validatedInput);
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

    const items: MaterializeChordSheetsItemOutput[] = [];
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

        const chordpro = this.renderChordPro(sheet);
        const html = this.renderHtml(chordpro);

        const chord_sheet = {
          schemaVersion: 1,
          generatedAt: new Date().toISOString(),
          chordSheet: this.toJsonSafeChordSheet(sheet),
          renderings: {
            chordpro,
            html,
          },
        };

        const persisted = await this.writeModel.upsertChordSheetForMusicLibrary(
          {
            music_library_id: musicLibraryId,
            musician_id: validatedInput.musician_id,
            chord_sheet,
            force: validatedInput.force === true,
          },
        );

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

  private toJsonSafeChordSheet(sheet: ChordSheetOutput) {
    return {
      ...sheet,
      updated_at: sheet.updated_at?.toISOString?.() ?? sheet.updated_at,
    };
  }

  private renderHtml(chordpro: string): string {
    const escaped = chordpro
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<pre>${escaped}</pre>`;
  }

  private renderChordPro(sheet: ChordSheetOutput): string {
    const lines: string[] = [];
    const title = `${sheet.title ?? ""}`.trim();
    const artist = `${sheet.artist ?? ""}`.trim();

    if (title) lines.push(`{title: ${title}}`);
    if (artist) lines.push(`{artist: ${artist}}`);
    if (sheet.meta?.key) lines.push(`{key: ${sheet.meta.key}}`);
    if (typeof sheet.meta?.bpm === "number") {
      lines.push(`{tempo: ${sheet.meta.bpm}}`);
    }
    if (lines.length) lines.push("");

    const anchors = sheet.alignment?.anchors ?? {};
    const chordTimeline = sheet.chords?.timeline ?? [];
    const anchored = new Map<string, number[]>();
    for (const [chordIndexStr, anchor] of Object.entries(anchors)) {
      const chordIndex = Number(chordIndexStr);
      if (!Number.isFinite(chordIndex)) continue;
      const key = `${anchor.sectionIndex}:${anchor.lineIndex}:${anchor.tokenIndex}`;
      const list = anchored.get(key) ?? [];
      list.push(chordIndex);
      anchored.set(key, list);
    }
    for (const [k, list] of anchored.entries()) {
      list.sort((a, b) => {
        const aa = chordTimeline[a]?.startMs ?? 0;
        const bb = chordTimeline[b]?.startMs ?? 0;
        return aa - bb;
      });
      anchored.set(k, list);
    }

    const sections = sheet.lyrics?.normalized?.sections ?? [];
    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
      const section = sections[sectionIndex];
      const label = `${section.label ?? ""}`.trim();
      if (label) {
        lines.push(`{comment: ${label}}`);
      }

      const sectionLines = section.lines ?? [];
      for (let lineIndex = 0; lineIndex < sectionLines.length; lineIndex++) {
        const line = sectionLines[lineIndex];
        const tokens = line.tokens ?? [];

        const out: string[] = [];
        for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
          const key = `${sectionIndex}:${lineIndex}:${tokenIndex}`;
          const chordIndexes = anchored.get(key) ?? [];
          for (const chordIndex of chordIndexes) {
            const symbol = `${chordTimeline[chordIndex]?.symbol ?? ""}`.trim();
            if (!symbol) continue;
            out.push(`[${symbol}]`);
          }
          out.push(tokens[tokenIndex].text);
        }

        lines.push(out.join("").replace(/\s+$/g, ""));
      }

      if (sectionIndex < sections.length - 1) {
        lines.push("");
      }
    }

    return `${lines.join("\n").trim()}\n`;
  }
}
