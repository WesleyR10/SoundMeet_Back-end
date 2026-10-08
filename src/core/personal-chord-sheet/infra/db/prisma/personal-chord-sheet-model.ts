import type { Prisma } from "@prisma/client";

export type PersonalChordSheetModel = {
  id: string;
  musician_id: string;
  music_library_id: string;
  base_version: number;
  base_fingerprint: string;
  base_pipeline_version: number;
  /** ChordEdit[] serializado — leitura sempre tolerante (ver mapper). */
  edits: Prisma.JsonValue | null;
  /** ChordSheetViewSettings serializado. */
  view: Prisma.JsonValue | null;
  notes: string | null;
  share_scope: string;
  shared_at: Date | null;
  reconcile_status: string;
  created_at: Date;
  updated_at: Date;
};
