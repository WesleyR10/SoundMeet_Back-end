export type ChordSheetTokenOutput = {
  text: string;
  kind: "word" | "punct" | "space";
  normalized: string;
  startMs?: number;
  endMs?: number;
};

export type ChordSheetLyricsLineOutput = {
  tokens: ChordSheetTokenOutput[];
};

export type ChordSheetLyricsSectionOutput = {
  label?: string;
  startMs?: number;
  endMs?: number;
  confidence?: number;
  lines: ChordSheetLyricsLineOutput[];
};

export type ChordSheetLyricsOutput = {
  normalized: {
    sections: ChordSheetLyricsSectionOutput[];
  };
};

export type ChordSheetChordTimelineItemOutput = {
  startMs: number;
  endMs?: number;
  symbol: string;
  confidence?: number;
};

export type ChordSheetChordsOutput = {
  timeline: ChordSheetChordTimelineItemOutput[];
};

export type ChordSheetAnchorOutput = {
  sectionIndex: number;
  lineIndex: number;
  tokenIndex: number;
};

export type ChordSheetAlignmentOutput = {
  anchors: Record<string, ChordSheetAnchorOutput>;
};

export type ChordSheetMetaOutput = {
  provider: string | null;
  matchScore?: number;
  pipelineVersion: number;
  modelVersion?: string;
  qualityFlags: string[];
  bpm: number | null;
  key: string | null;
};

export type ChordSheetOutput = {
  music_library_id: string;
  musician_id: string;
  title: string;
  artist: string;
  lyrics: ChordSheetLyricsOutput;
  chords: ChordSheetChordsOutput;
  alignment: ChordSheetAlignmentOutput;
  meta: ChordSheetMetaOutput;
  updated_at: Date;
};
