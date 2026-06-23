import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

import { ChordSheetOutput } from "../../core/synced-lyrics/application/use-cases/common/chord-sheet-output";
import { SyncedLyricsBulkJobOutput } from "../../core/synced-lyrics/application/use-cases/common/synced-lyrics-bulk-job-output";
import { SyncedLyricsOutput } from "../../core/synced-lyrics/application/use-cases/common/synced-lyrics-output";
import { MatchSyncedLyricsOnLrclibOutput } from "../../core/synced-lyrics/application/use-cases/match-synced-lyrics-on-lrclib/match-synced-lyrics-on-lrclib.use-case";
import { MaterializeChordSheetsOutput } from "../../core/synced-lyrics/application/use-cases/materialize-chord-sheets/materialize-chord-sheets.use-case";
import { MaterializeRenderableChordSheetsOutput } from "../../core/synced-lyrics/application/use-cases/materialize-renderable-chord-sheets/materialize-renderable-chord-sheets.use-case";
import { SearchSyncedLyricsOutput } from "../../core/synced-lyrics/application/use-cases/search-synced-lyrics/search-synced-lyrics.use-case";
import { CollectionPresenter } from "../shared-module/collection.presenter";

export class ChordSheetTokenPresenter {
  text: string;
  kind: "word" | "punct" | "space";
  normalized: string;
  @ApiProperty({ required: false })
  startMs?: number;
  @ApiProperty({ required: false })
  endMs?: number;

  constructor(
    output: ChordSheetOutput["lyrics"]["normalized"]["sections"][number]["lines"][number]["tokens"][number],
  ) {
    this.text = output.text;
    this.kind = output.kind;
    this.normalized = output.normalized;
    this.startMs = output.startMs;
    this.endMs = output.endMs;
  }
}

export class ChordSheetLinePresenter {
  @ApiProperty({ type: () => [ChordSheetTokenPresenter] })
  tokens: ChordSheetTokenPresenter[];

  constructor(
    output: ChordSheetOutput["lyrics"]["normalized"]["sections"][number]["lines"][number],
  ) {
    this.tokens = output.tokens.map((t) => new ChordSheetTokenPresenter(t));
  }
}

export class ChordSheetSectionPresenter {
  @ApiProperty({ required: false })
  label?: string;

  @ApiProperty({ required: false })
  startMs?: number;

  @ApiProperty({ required: false })
  endMs?: number;

  @ApiProperty({ required: false })
  confidence?: number;

  @ApiProperty({ type: () => [ChordSheetLinePresenter] })
  lines: ChordSheetLinePresenter[];

  constructor(
    output: ChordSheetOutput["lyrics"]["normalized"]["sections"][number],
  ) {
    this.label = output.label;
    this.startMs = output.startMs;
    this.endMs = output.endMs;
    this.confidence = output.confidence;
    this.lines = output.lines.map((l) => new ChordSheetLinePresenter(l));
  }
}

export class ChordSheetLyricsNormalizedPresenter {
  @ApiProperty({ type: () => [ChordSheetSectionPresenter] })
  sections: ChordSheetSectionPresenter[];

  constructor(output: ChordSheetOutput["lyrics"]["normalized"]) {
    this.sections = output.sections.map(
      (s) => new ChordSheetSectionPresenter(s),
    );
  }
}

export class ChordSheetLyricsPresenter {
  @ApiProperty({ type: () => ChordSheetLyricsNormalizedPresenter })
  normalized: ChordSheetLyricsNormalizedPresenter;

  constructor(output: ChordSheetOutput["lyrics"]) {
    this.normalized = new ChordSheetLyricsNormalizedPresenter(
      output.normalized,
    );
  }
}

export class ChordSheetChordTimelineItemPresenter {
  startMs: number;
  @ApiProperty({ required: false })
  endMs?: number;
  symbol: string;
  @ApiProperty({ required: false })
  confidence?: number;

  constructor(output: ChordSheetOutput["chords"]["timeline"][number]) {
    this.startMs = output.startMs;
    this.endMs = output.endMs;
    this.symbol = output.symbol;
    this.confidence = output.confidence;
  }
}

export class ChordSheetChordsPresenter {
  @ApiProperty({ type: () => [ChordSheetChordTimelineItemPresenter] })
  timeline: ChordSheetChordTimelineItemPresenter[];

  constructor(output: ChordSheetOutput["chords"]) {
    this.timeline = output.timeline.map(
      (t) => new ChordSheetChordTimelineItemPresenter(t),
    );
  }
}

export class ChordSheetAnchorPresenter {
  sectionIndex: number;
  lineIndex: number;
  tokenIndex: number;

  constructor(output: ChordSheetOutput["alignment"]["anchors"][string]) {
    this.sectionIndex = output.sectionIndex;
    this.lineIndex = output.lineIndex;
    this.tokenIndex = output.tokenIndex;
  }
}

export class ChordSheetAlignmentPresenter {
  @ApiProperty({ type: Object })
  anchors: Record<string, ChordSheetAnchorPresenter>;

  constructor(output: ChordSheetOutput["alignment"]) {
    this.anchors = Object.fromEntries(
      Object.entries(output.anchors).map(([k, v]) => [
        k,
        new ChordSheetAnchorPresenter(v),
      ]),
    );
  }
}

export class ChordSheetMetaPresenter {
  provider: string | null;
  pipelineVersion: number;
  @ApiProperty({ type: [String] })
  qualityFlags: string[];
  bpm: number | null;
  key: string | null;
  @ApiProperty({ required: false })
  matchScore?: number;

  constructor(output: ChordSheetOutput["meta"]) {
    this.provider = output.provider;
    this.pipelineVersion = output.pipelineVersion;
    this.qualityFlags = output.qualityFlags;
    this.bpm = output.bpm;
    this.key = output.key;
    this.matchScore = output.matchScore;
  }
}

export class ChordSheetPresenter {
  music_library_id: string;
  musician_id: string;
  title: string;
  artist: string;

  @ApiProperty({ type: () => ChordSheetLyricsPresenter })
  lyrics: ChordSheetLyricsPresenter;

  @ApiProperty({ type: () => ChordSheetChordsPresenter })
  chords: ChordSheetChordsPresenter;

  @ApiProperty({ type: () => ChordSheetAlignmentPresenter })
  alignment: ChordSheetAlignmentPresenter;

  @ApiProperty({ type: () => ChordSheetMetaPresenter })
  meta: ChordSheetMetaPresenter;

  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: ChordSheetOutput) {
    this.music_library_id = output.music_library_id;
    this.musician_id = output.musician_id;
    this.title = output.title;
    this.artist = output.artist;
    this.lyrics = new ChordSheetLyricsPresenter(output.lyrics);
    this.chords = new ChordSheetChordsPresenter(output.chords);
    this.alignment = new ChordSheetAlignmentPresenter(output.alignment);
    this.meta = new ChordSheetMetaPresenter(output.meta);
    this.updated_at = output.updated_at;
  }
}

export class SyncedLyricsPresenter {
  music_library_id: string;
  musician_id: string;
  title: string;
  artist: string;
  @ApiProperty({ required: false, nullable: true })
  lrc_raw?: string | null;
  lrc_provider: string | null;
  lrc_provider_meta: Record<string, unknown> | null;
  lrc_hash: string | null;
  lrc_version: number;
  lrc_pipeline_version: number;
  lrc_normalized: any;
  @ApiProperty({ type: [String] })
  lrc_quality_flags: string[];
  lrc_coverage_ms: number | null;
  lrc_has_word_timestamps: boolean;
  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  lrc_last_synced_at: Date | null;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: SyncedLyricsOutput) {
    this.music_library_id = output.music_library_id;
    this.musician_id = output.musician_id;
    this.title = output.title;
    this.artist = output.artist;
    this.lrc_raw = output.lrc_raw;
    this.lrc_provider = output.lrc_provider;
    this.lrc_provider_meta = output.lrc_provider_meta;
    this.lrc_hash = output.lrc_hash;
    this.lrc_version = output.lrc_version;
    this.lrc_pipeline_version = output.lrc_pipeline_version;
    this.lrc_normalized = output.lrc_normalized;
    this.lrc_quality_flags = output.lrc_quality_flags;
    this.lrc_coverage_ms = output.lrc_coverage_ms;
    this.lrc_has_word_timestamps = output.lrc_has_word_timestamps;
    this.lrc_last_synced_at = output.lrc_last_synced_at;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

export class MaterializeChordSheetsItemPresenter {
  music_library_id: string;
  status: "materialized" | "skipped" | "failed";
  @ApiProperty({ required: false })
  reason?: string;
  @ApiProperty({ required: false })
  updated?: boolean;

  constructor(output: MaterializeChordSheetsOutput["items"][number]) {
    this.music_library_id = output.music_library_id;
    this.status = output.status;
    this.reason = output.reason;
    this.updated = output.updated;
  }
}

export class MaterializeChordSheetsPresenter {
  musician_id: string;
  @ApiProperty({ type: () => [MaterializeChordSheetsItemPresenter] })
  items: MaterializeChordSheetsItemPresenter[];

  constructor(output: MaterializeChordSheetsOutput) {
    this.musician_id = output.musician_id;
    this.items = output.items.map(
      (i) => new MaterializeChordSheetsItemPresenter(i),
    );
  }
}

export class MaterializeRenderableChordSheetsItemPresenter {
  music_library_id: string;
  status: "materialized" | "skipped" | "failed";
  @ApiProperty({ required: false })
  reason?: string;
  @ApiProperty({ required: false })
  updated?: boolean;

  constructor(output: MaterializeRenderableChordSheetsOutput["items"][number]) {
    this.music_library_id = output.music_library_id;
    this.status = output.status;
    this.reason = output.reason;
    this.updated = output.updated;
  }
}

export class MaterializeRenderableChordSheetsPresenter {
  musician_id: string;
  @ApiProperty({ type: () => [MaterializeRenderableChordSheetsItemPresenter] })
  items: MaterializeRenderableChordSheetsItemPresenter[];

  constructor(output: MaterializeRenderableChordSheetsOutput) {
    this.musician_id = output.musician_id;
    this.items = output.items.map(
      (i) => new MaterializeRenderableChordSheetsItemPresenter(i),
    );
  }
}

export class SyncedLyricsCollectionPresenter extends CollectionPresenter {
  data: SyncedLyricsPresenter[];

  constructor(output: SearchSyncedLyricsOutput) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new SyncedLyricsPresenter(i));
  }
}

export class SyncedLyricsBulkJobPresenter {
  id: string;
  musician_id: string;
  status: string;
  total: number;
  processed: number;
  success: number;
  failed: number;
  error_summary: Record<string, number> | null;
  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  started_at: Date | null;
  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  finished_at: Date | null;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: SyncedLyricsBulkJobOutput) {
    this.id = output.id;
    this.musician_id = output.musician_id;
    this.status = output.status;
    this.total = output.total;
    this.processed = output.processed;
    this.success = output.success;
    this.failed = output.failed;
    this.error_summary = output.error_summary;
    this.started_at = output.started_at;
    this.finished_at = output.finished_at;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

export class LrcLibMatchItemPresenter {
  lrclib_id: number;
  track_name: string;
  artist_name: string;
  album_name: string;
  duration_seconds: number;
  has_synced: boolean;
  score: number;

  constructor(item: MatchSyncedLyricsOnLrclibOutput["items"][number]) {
    this.lrclib_id = item.lrclib_id;
    this.track_name = item.track_name;
    this.artist_name = item.artist_name;
    this.album_name = item.album_name;
    this.duration_seconds = item.duration_seconds;
    this.has_synced = item.has_synced;
    this.score = item.score;
  }
}

export class LrcLibMatchMetaPresenter {
  @ApiProperty({ enum: ["hit", "miss", "negative_hit"], example: "miss" })
  cache: "hit" | "miss" | "negative_hit";

  @ApiProperty({ example: "lrclib:match:artist:title:180000" })
  key: string;

  constructor(meta: MatchSyncedLyricsOnLrclibOutput["meta"]) {
    this.cache = meta.cache;
    this.key = meta.key;
  }
}

export class LrcLibMatchPresenter {
  @ApiProperty({ type: [LrcLibMatchItemPresenter] })
  items: LrcLibMatchItemPresenter[];

  @ApiProperty({ type: () => LrcLibMatchMetaPresenter })
  meta: LrcLibMatchMetaPresenter;

  constructor(output: MatchSyncedLyricsOnLrclibOutput) {
    this.items = output.items.map((i) => new LrcLibMatchItemPresenter(i));
    this.meta = new LrcLibMatchMetaPresenter(output.meta);
  }
}
