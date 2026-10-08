import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import type { ChordSheetOutput } from "../../../../synced-lyrics/application/use-cases/common/chord-sheet-output";
import { GetChordSheetForMusicLibraryUseCase } from "../../../../synced-lyrics/application/use-cases/get-chord-sheet-for-music-library/get-chord-sheet-for-music-library.use-case";
import {
  PersonalChordSheet,
  PersonalChordSheetId,
  type PersonalChordSheetReconcileStatus,
} from "../../../domain/personal-chord-sheet.aggregate";
import { IPersonalChordSheetRepository } from "../../../domain/personal-chord-sheet.repository";
import type { ChordSheetViewSettingsProps } from "../../../domain/value-objects/chord-sheet-view-settings.vo";
import {
  CHORD_SHEET_FINGERPRINT_VERSION,
  computeChordSheetBaseFingerprint,
} from "../../services/chord-sheet-fingerprint";
import {
  ChordSheetOverlayApplier,
  type OverlayEditOutcome,
} from "../../services/chord-sheet-overlay-applier";

export type GetPersonalChordSheetViewInput = {
  personal_chord_sheet_id: string;
  /** Dono do fork — resolvido pelo controller/CheckAccess, não pelo token. */
  owner_musician_id: string;
  /** Prévia efêmera de transposição, sem persistir nada. */
  view_override?: ChordSheetViewSettingsProps;
};

export type GetPersonalChordSheetViewOutput = {
  personal_chord_sheet_id: string;
  sheet: ChordSheetOutput;
  outcomes: OverlayEditOutcome[];
  conflict_count: number;
  reconcile_status: PersonalChordSheetReconcileStatus;
  /** true quando a IA re-analisou a música depois do fork. */
  base_changed: boolean;
};

/**
 * A cifra do músico já com as correções dele, no tom que ele toca.
 *
 * É um WRAPPER sobre GetChordSheetForMusicLibraryUseCase — precedente exato de
 * MaterializeChordSheetsUseCase. O use-case base (~840 linhas, consumido por 3
 * rotas) não é tocado em nenhuma linha; o overlay só é alcançável por aqui.
 *
 * ⚠️ Nunca injete ESTE use-case onde se espera o base: Materialize* persiste o
 * resultado em music_library.chord_sheet, que é o artefato canônico servido a
 * todos. Edições pessoais de um músico vazariam para o catálogo inteiro.
 */
export class GetPersonalChordSheetViewUseCase implements IUseCase<
  GetPersonalChordSheetViewInput,
  GetPersonalChordSheetViewOutput
> {
  constructor(
    private readonly repo: IPersonalChordSheetRepository,
    private readonly getChordSheetUseCase: GetChordSheetForMusicLibraryUseCase,
    private readonly applier: ChordSheetOverlayApplier,
  ) {}

  async execute(
    input: GetPersonalChordSheetViewInput,
  ): Promise<GetPersonalChordSheetViewOutput> {
    const sheet = await this.repo.findById(
      new PersonalChordSheetId(input.personal_chord_sheet_id),
    );
    if (!sheet) {
      throw new NotFoundError(
        input.personal_chord_sheet_id,
        PersonalChordSheet,
      );
    }

    // O base é sempre buscado com o id do DONO: a linha de music_library
    // pertence a ele, e o use-case base lança NotFoundError se o musician_id
    // não bater. Passar o id de quem está lendo quebraria a rota da comunidade.
    const base = await this.getChordSheetUseCase.execute({
      musician_id: input.owner_musician_id,
      music_library_id: sheet.music_library_id,
    });

    const currentFingerprint = computeChordSheetBaseFingerprint(
      base.chords?.timeline ?? [],
    );
    const base_changed = !sheet.matchesBase(
      currentFingerprint,
      CHORD_SHEET_FINGERPRINT_VERSION,
    );

    const view = input.view_override
      ? sheet.view.with(input.view_override)
      : sheet.view;

    const {
      sheet: rendered,
      outcomes,
      conflict_count,
    } = this.applier.apply(base, { edits: sheet.edits, view });

    return {
      personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
      sheet: rendered,
      outcomes,
      conflict_count,
      // Leitura NÃO escreve: reconciliar é ato explícito do músico. Nenhum
      // use-case do projeto faz write-on-read, e fazer aqui significaria
      // reescrever o fork de todo mundo assim que o modelo fosse atualizado.
      reconcile_status: base_changed ? "base_updated" : sheet.reconcile_status,
      base_changed,
    };
  }
}
