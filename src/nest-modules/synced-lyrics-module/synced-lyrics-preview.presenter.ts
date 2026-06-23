type RenderableChordSheetInput = {
  title: string;
  artist: string;
  renderable: unknown;
};

type RenderToken = {
  text?: unknown;
};

type RenderChord = {
  tokenIndex?: unknown;
  symbol?: unknown;
};

type RenderLine = {
  tokens?: unknown;
  chords?: unknown;
};

type RenderSection = {
  label?: unknown;
  lines?: unknown;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export class SyncedLyricsPreviewPresenter {
  static toHtml(input: RenderableChordSheetInput) {
    const renderable = toRecord(input.renderable);
    const renderModel = toRecord(renderable.renderModel);
    const sections = toArray<RenderSection>(renderModel.sections);

    const title = escapeHtml(`${input.title ?? ""}`.trim());
    const artist = escapeHtml(`${input.artist ?? ""}`.trim());
    const body: string[] = [];

    body.push(`<div class="header">`);
    if (title) body.push(`<div class="title">${title}</div>`);
    if (artist) body.push(`<div class="artist">${artist}</div>`);
    body.push(`</div>`);

    for (const section of sections) {
      const label = `${section?.label ?? ""}`.trim();
      if (label) {
        body.push(`<div class="section-label">[${escapeHtml(label)}]</div>`);
      }

      const lines = toArray<RenderLine>(section?.lines);
      for (const line of lines) {
        body.push(this.renderLine(line));
      }
    }

    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title || "Chord Sheet"}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding: 16px; color: #111; }
    .header { margin-bottom: 16px; }
    .title { font-size: 20px; font-weight: 700; }
    .artist { font-size: 14px; color: #555; margin-top: 2px; }
    .section-label { margin-top: 14px; margin-bottom: 6px; font-weight: 600; color: #444; }
    .line { margin: 6px 0; }
    .row { white-space: pre; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    .cell { display: inline-block; vertical-align: bottom; }
    .chord { color: #1e88e5; font-weight: 700; line-height: 1.1; }
    .lyric { color: #111; line-height: 1.2; }
  </style>
</head>
<body>
${body.join("\n")}
</body>
</html>`;
  }

  private static renderLine(line: RenderLine) {
    const tokens = toArray<RenderToken>(line?.tokens);
    const chords = toArray<RenderChord>(line?.chords);
    const chordsByToken = new Map<number, string[]>();

    for (const chord of chords) {
      const tokenIndex = Number(chord?.tokenIndex);
      const symbol = `${chord?.symbol ?? ""}`.trim();
      if (!Number.isFinite(tokenIndex) || !symbol) continue;
      const list = chordsByToken.get(tokenIndex) ?? [];
      list.push(symbol);
      chordsByToken.set(tokenIndex, list);
    }

    const chordRow: string[] = [];
    const lyricRow: string[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const text = `${tokens[i]?.text ?? ""}`;
      const width = Math.max(1, Array.from(text).length);
      const chordText = (chordsByToken.get(i) ?? []).join(" ");

      chordRow.push(
        `<span class="cell chord" style="width:${width}ch">${escapeHtml(
          chordText,
        )}</span>`,
      );
      lyricRow.push(
        `<span class="cell lyric" style="width:${width}ch">${escapeHtml(
          text,
        )}</span>`,
      );
    }

    const chordRowHtml = chordRow.join("");
    const lyricRowHtml = lyricRow.join("");
    return `<div class="line"><div class="row chords">${chordRowHtml}</div><div class="row lyrics">${lyricRowHtml}</div></div>`;
  }
}
