import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { ChordSymbol } from "../../../../shared/domain/value-objects/chord-symbol.vo";
import { IPersonalChordSheetRepository } from "../../../domain/personal-chord-sheet.repository";
import {
  ChordEdit,
  type ChordEditType,
} from "../../../domain/value-objects/chord-edit.vo";
import type { ChordSheetViewSettings } from "../../../domain/value-objects/chord-sheet-view-settings.vo";
import { loadOwnedSheet } from "../common/load-owned-sheet";
import {
  PersonalChordSheetOutput,
  PersonalChordSheetOutputMapper,
} from "../common/personal-chord-sheet-output";

export type ChordEditInput = {
  type: ChordEditType;
  at_ms: number;
  to_ms?: number;
  from?: string;
  to?: string;
  symbol?: string;
  label?: string;
  text?: string;
};

export type ApplyChordEditsInput = {
  personal_chord_sheet_id: string;
  musician_id: string;
  edits: ChordEditInput[];
  /** "append" acrescenta; "replace" troca a lista inteira. */
  mode?: "append" | "replace";
};

export class ApplyChordEditsUseCase implements IUseCase<
  ApplyChordEditsInput,
  PersonalChordSheetOutput
> {
  constructor(private readonly repo: IPersonalChordSheetRepository) {}

  async execute(
    input: ApplyChordEditsInput,
  ): Promise<PersonalChordSheetOutput> {
    const sheet = await loadOwnedSheet(
      this.repo,
      input.personal_chord_sheet_id,
      input.musician_id,
    );

    const edits = input.edits.map((raw) =>
      toChordEdit(toBaseKey(raw, sheet.view)),
    );

    if ((input.mode ?? "append") === "replace") {
      sheet.replaceEdits(edits);
    } else {
      sheet.addEdits(edits);
    }

    await this.repo.update(sheet);
    return PersonalChordSheetOutputMapper.toOutput(sheet, true);
  }
}

/**
 * O cliente edita o que ESTÁ NA TELA; o overlay guarda no tom da cifra ORIGINAL.
 *
 * 🔴 O `ChordSheetOverlayApplier` aplica as edições sobre o timeline base e só
 * DEPOIS transpõe para exibição (transposição − capotraste). Sem esta
 * conversão, com a cifra transposta:
 *  - o `from` exibido ("A") não casava com o base ("G") → `symbol_mismatch`,
 *    e "corrigir"/"remover" não faziam nada;
 *  - o `to`/`symbol` escolhido no tom da tela era gravado como base e
 *    transposto DE NOVO na exibição → acorde errado na cifra.
 *
 * Usa a visualização ATUAL (é a que o músico está vendo ao editar). Com
 * deslocamento zero — o padrão — é identidade: edições antigas não mudam de
 * sentido. Símbolo que não parseia segue verbatim, como em todo o overlay.
 */
function toBaseKey(
  raw: ChordEditInput,
  view: ChordSheetViewSettings,
): ChordEditInput {
  const semitones = view.effectiveDisplaySemitones();
  if (semitones === 0) return raw;

  const preferred = view.preferred_accidental === "flat" ? "flat" : "sharp";
  const back = (symbol: string | undefined) => {
    if (!symbol) return symbol;
    const parsed = ChordSymbol.parse(symbol);
    return parsed ? parsed.transpose(-semitones, preferred).toString() : symbol;
  };

  return {
    ...raw,
    from: back(raw.from),
    to: back(raw.to),
    symbol: back(raw.symbol),
  };
}

/**
 * Constrói via factories do VO — é lá que mora a validação por tipo de edição.
 * Um DTO com campos soltos não pode virar ChordEdit direto: cada tipo exige
 * campos diferentes, e o VO é quem sabe quais.
 */
function toChordEdit(raw: ChordEditInput): ChordEdit {
  switch (raw.type) {
    case "replace_chord":
      return ChordEdit.replaceChord({
        at_ms: raw.at_ms,
        from: raw.from as string,
        to: raw.to as string,
      });
    case "insert_chord":
      return ChordEdit.insertChord({
        at_ms: raw.at_ms,
        symbol: raw.symbol as string,
      });
    case "delete_chord":
      return ChordEdit.deleteChord({
        at_ms: raw.at_ms,
        from: raw.from as string,
      });
    case "shift_chord":
      return ChordEdit.shiftChord({
        at_ms: raw.at_ms,
        to_ms: raw.to_ms as number,
        symbol: raw.symbol as string,
      });
    case "relabel_section":
      return ChordEdit.relabelSection({
        section_start_ms: raw.at_ms,
        label: raw.label as string,
      });
    case "annotate":
      return ChordEdit.annotate({
        at_ms: raw.at_ms,
        text: raw.text as string,
      });
    default:
      throw new EntityValidationError([
        { type: [`Tipo de edição desconhecido: "${raw.type}".`] },
      ]);
  }
}
