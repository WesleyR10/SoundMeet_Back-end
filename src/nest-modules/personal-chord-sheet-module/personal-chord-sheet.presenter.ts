import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import type {
  ChordEditOutput,
  PersonalChordSheetOutput,
  PersonalChordSheetSummaryOutput,
} from "../../core/personal-chord-sheet/application/use-cases/common/personal-chord-sheet-output";
import type {
  GetPersonalChordSheetViewOutput,
  ImportCommunityChordSheetOutput,
} from "../../core/personal-chord-sheet/application/use-cases/index";
import { PaginationOutput } from "../../core/shared/application/pagination-output";
import { CollectionPresenter } from "../shared-module/collection.presenter";
import { ChordSheetPresenter } from "../synced-lyrics-module/synced-lyrics.presenter";

export class ChordEditPresenter {
  @ApiProperty({ example: "uuid-v4" })
  edit_id: string;

  @ApiProperty({
    enum: [
      "replace_chord",
      "insert_chord",
      "delete_chord",
      "shift_chord",
      "relabel_section",
      "annotate",
    ],
  })
  type: string;

  @ApiProperty({ example: 2000 })
  at_ms: number;

  @ApiPropertyOptional({ nullable: true, example: 2200 })
  to_ms: number | null;

  @ApiPropertyOptional({ nullable: true, example: "Am" })
  from: string | null;

  @ApiPropertyOptional({ nullable: true, example: "Am7" })
  to: string | null;

  @ApiPropertyOptional({ nullable: true, example: "Dm" })
  symbol: string | null;

  @ApiPropertyOptional({ nullable: true, example: "Refrão" })
  label: string | null;

  @ApiPropertyOptional({ nullable: true, example: "aqui entra o solo" })
  text: string | null;

  @ApiProperty()
  created_at: string;

  constructor(output: ChordEditOutput) {
    this.edit_id = output.edit_id;
    this.type = output.type;
    this.at_ms = output.at_ms;
    this.to_ms = output.to_ms;
    this.from = output.from;
    this.to = output.to;
    this.symbol = output.symbol;
    this.label = output.label;
    this.text = output.text;
    this.created_at = output.created_at;
  }
}

export class ChordSheetViewSettingsPresenter {
  @ApiProperty({ example: 0 })
  transpose_semitones: number;

  @ApiProperty({ example: 0 })
  capo_fret: number;

  @ApiProperty({ enum: ["full", "simple", "basic"] })
  chord_complexity: string;

  @ApiProperty({
    enum: ["guitar", "guitar7", "ukulele", "cavaquinho", "bass", "keyboard"],
  })
  instrument: string;

  @ApiProperty()
  left_handed: boolean;

  @ApiProperty({ enum: ["sharp", "flat", "auto"] })
  preferred_accidental: string;

  @ApiProperty({ example: 1 })
  scroll_speed: number;

  constructor(output: PersonalChordSheetOutput["view"]) {
    this.transpose_semitones = output.transpose_semitones;
    this.capo_fret = output.capo_fret;
    this.chord_complexity = output.chord_complexity;
    this.instrument = output.instrument;
    this.left_handed = output.left_handed;
    this.preferred_accidental = output.preferred_accidental;
    this.scroll_speed = output.scroll_speed;
  }
}

/**
 * Resumo — o que a LISTAGEM devolve. Sem o array de edits de propósito: ele é o
 * campo caro do agregado e não serve para nada numa lista (ver
 * PersonalChordSheetSummaryOutput).
 */
export class PersonalChordSheetSummaryPresenter {
  @ApiProperty({ example: "uuid-v4" })
  personal_chord_sheet_id: string;

  @ApiProperty({ example: "uuid-v4" })
  music_library_id: string;

  @ApiProperty({ example: "uuid-v4" })
  musician_id: string;

  @ApiProperty({ example: 0 })
  base_version: number;

  @ApiProperty({
    description: "sha256 do timeline em que o fork foi ancorado.",
  })
  base_fingerprint: string;

  @ApiProperty({ example: 1 })
  base_pipeline_version: number;

  @ApiProperty({ example: 3, description: "Quantas correções o músico fez." })
  edit_count: number;

  @ApiProperty({ type: ChordSheetViewSettingsPresenter })
  view: ChordSheetViewSettingsPresenter;

  @ApiPropertyOptional({
    nullable: true,
    description: "null quando quem lê não é o dono.",
  })
  notes: string | null;

  @ApiProperty({ enum: ["private", "band", "community"] })
  share_scope: string;

  @ApiProperty()
  is_shared: boolean;

  @ApiPropertyOptional({ nullable: true })
  shared_at: Date | null;

  @ApiProperty({ enum: ["clean", "base_updated"] })
  reconcile_status: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;

  constructor(output: PersonalChordSheetSummaryOutput) {
    this.personal_chord_sheet_id = output.personal_chord_sheet_id;
    this.music_library_id = output.music_library_id;
    this.musician_id = output.musician_id;
    this.base_version = output.base_version;
    this.base_fingerprint = output.base_fingerprint;
    this.base_pipeline_version = output.base_pipeline_version;
    this.edit_count = output.edit_count;
    this.view = new ChordSheetViewSettingsPresenter(output.view);
    this.notes = output.notes;
    this.share_scope = output.share_scope;
    this.is_shared = output.is_shared;
    this.shared_at = output.shared_at;
    this.reconcile_status = output.reconcile_status;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

/** O fork completo — resumo + as correções. */
export class PersonalChordSheetPresenter extends PersonalChordSheetSummaryPresenter {
  @ApiProperty({ type: [ChordEditPresenter] })
  edits: ChordEditPresenter[];

  constructor(output: PersonalChordSheetOutput) {
    super(output);
    this.edits = output.edits.map((e) => new ChordEditPresenter(e));
  }
}

export class PersonalChordSheetCollectionPresenter extends CollectionPresenter {
  @ApiProperty({ type: [PersonalChordSheetSummaryPresenter] })
  data: PersonalChordSheetSummaryPresenter[];

  constructor(output: PaginationOutput<PersonalChordSheetSummaryOutput>) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new PersonalChordSheetSummaryPresenter(i));
  }
}

export class OverlayOutcomePresenter {
  @ApiProperty({ example: "uuid-v4" })
  edit_id: string;

  @ApiProperty()
  type: string;

  @ApiProperty({ enum: ["applied", "conflict"] })
  status: string;

  @ApiPropertyOptional({
    nullable: true,
    enum: [
      "anchor_not_found",
      "symbol_mismatch",
      "ambiguous_match",
      "unparseable_symbol",
      "out_of_range",
    ],
  })
  reason: string | null;

  @ApiPropertyOptional({ nullable: true, example: 2000 })
  matched_start_ms: number | null;

  constructor(output: GetPersonalChordSheetViewOutput["outcomes"][number]) {
    this.edit_id = output.edit_id;
    this.type = output.type;
    this.status = output.status;
    this.reason = output.reason ?? null;
    this.matched_start_ms = output.matched_start_ms ?? null;
  }
}

/**
 * A cifra pessoal renderizada. Reaproveita o ChordSheetPresenter do
 * synced-lyrics — o cliente não muda nada para ler a versão pessoal, é o mesmo
 * contrato do artefato canônico com as correções já aplicadas.
 */
export class PersonalChordSheetViewPresenter {
  @ApiProperty({ example: "uuid-v4" })
  personal_chord_sheet_id: string;

  @ApiProperty({ type: ChordSheetPresenter })
  sheet: ChordSheetPresenter;

  @ApiProperty({ type: [OverlayOutcomePresenter] })
  outcomes: OverlayOutcomePresenter[];

  @ApiProperty({ example: 0 })
  conflict_count: number;

  @ApiProperty({ enum: ["clean", "base_updated"] })
  reconcile_status: string;

  @ApiProperty({
    description: "true quando a IA re-analisou a música depois do fork.",
  })
  base_changed: boolean;

  constructor(output: GetPersonalChordSheetViewOutput) {
    this.personal_chord_sheet_id = output.personal_chord_sheet_id;
    this.sheet = new ChordSheetPresenter(output.sheet);
    this.outcomes = output.outcomes.map((o) => new OverlayOutcomePresenter(o));
    this.conflict_count = output.conflict_count;
    this.reconcile_status = output.reconcile_status;
    this.base_changed = output.base_changed;
  }
}

export class ImportedChordSheetPresenter {
  @ApiProperty({ type: PersonalChordSheetPresenter })
  personal_chord_sheet: PersonalChordSheetPresenter;

  @ApiProperty({ type: [OverlayOutcomePresenter] })
  outcomes: OverlayOutcomePresenter[];

  @ApiProperty({ example: 0 })
  conflict_count: number;

  @ApiProperty({
    description: "true quando a análise do importador difere da do autor.",
  })
  base_differs: boolean;

  constructor(output: ImportCommunityChordSheetOutput) {
    this.personal_chord_sheet = new PersonalChordSheetPresenter(
      output.personal_chord_sheet,
    );
    this.outcomes = output.outcomes.map((o) => new OverlayOutcomePresenter(o));
    this.conflict_count = output.conflict_count;
    this.base_differs = output.base_differs;
  }
}
