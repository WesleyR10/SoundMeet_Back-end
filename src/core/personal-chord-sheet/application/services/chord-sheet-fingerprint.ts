import { createHash } from "crypto";

import type { ChordSheetChordTimelineItemOutput } from "../../../synced-lyrics/application/use-cases/common/chord-sheet-output";

/**
 * Versão do ALGORITMO de fingerprint, não do conteúdo.
 *
 * Incrementar isto invalida o fingerprint de todos os forks do sistema de uma
 * vez. É por isso que ele é persistido separado (base_pipeline_version): quando
 * só o nosso normalizador muda, a reconciliação roda em silêncio; o músico só é
 * avisado quando a FONTE mudou — quando a IA de fato re-analisou a música.
 */
export const CHORD_SHEET_FINGERPRINT_VERSION = 1;

/**
 * Hash determinístico do timeline de acordes já normalizado.
 *
 * É o sinal REAL de "a IA re-analisou esta música". MusicLibrary.chord_sheet_version
 * não serve para isso: `updateChords()` não o incrementa — só `updateChordSheet()`
 * incrementa, e essa é a materialização do blob, não a análise. Um fork que
 * confiasse na versão deixaria passar re-análises e o músico tocaria uma cifra
 * desatualizada sem nenhum aviso.
 *
 * Hasheia o timeline PÓS-buildChords (startMs/symbol), não o Json cru de
 * MusicLibrary.chords: os edits são ancorados em (at_ms, símbolo) desse espaço
 * de coordenadas normalizado. Hashear o cru daria falso positivo a cada troca de
 * shape (start_seconds vs startMs, chord vs symbol).
 *
 * `confidence` fica de fora de propósito — é float, oscila entre execuções do
 * mesmo modelo, e nenhum edit ancora nele.
 */
export function computeChordSheetBaseFingerprint(
  timeline: readonly ChordSheetChordTimelineItemOutput[],
): string {
  const canonical =
    `v${CHORD_SHEET_FINGERPRINT_VERSION}|` +
    (timeline ?? [])
      .map(
        (chord) =>
          `${normalizeMs(chord?.startMs)}:${normalizeOptionalMs(chord?.endMs)}:${normalizeSymbol(chord?.symbol)}`,
      )
      .join(";");

  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * String canônica explícita em vez de JSON.stringify: buildChords monta os
 * objetos com spreads condicionais, então chaves opcionais entram e saem
 * conforme os dados e a ordem de inserção vira ordem de serialização. Uma
 * reordenação inocente do literal mudaria o hash de todo mundo.
 */
function normalizeMs(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? String(Math.round(value))
    : "";
}

function normalizeOptionalMs(value: unknown): string {
  return normalizeMs(value);
}

function normalizeSymbol(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
