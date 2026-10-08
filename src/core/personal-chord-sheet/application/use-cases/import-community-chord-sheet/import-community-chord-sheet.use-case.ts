import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { ConflictError } from "../../../../shared/domain/errors/conflict.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { GetChordSheetForMusicLibraryUseCase } from "../../../../synced-lyrics/application/use-cases/get-chord-sheet-for-music-library/get-chord-sheet-for-music-library.use-case";
import {
  PersonalChordSheet,
  PersonalChordSheetId,
} from "../../../domain/personal-chord-sheet.aggregate";
import { IPersonalChordSheetRepository } from "../../../domain/personal-chord-sheet.repository";
import {
  CHORD_SHEET_FINGERPRINT_VERSION,
  computeChordSheetBaseFingerprint,
} from "../../services/chord-sheet-fingerprint";
import {
  ChordSheetOverlayApplier,
  type OverlayEditOutcome,
} from "../../services/chord-sheet-overlay-applier";
import {
  PersonalChordSheetOutput,
  PersonalChordSheetOutputMapper,
} from "../common/personal-chord-sheet-output";

export type ImportCommunityChordSheetInput = {
  /** Fork da comunidade que serve de origem. */
  source_personal_chord_sheet_id: string;
  /** Quem está importando. */
  musician_id: string;
  /** A cópia DELE da música — a linha de music_library do importador. */
  target_music_library_id: string;
};

export type ImportCommunityChordSheetOutput = {
  personal_chord_sheet: PersonalChordSheetOutput;
  /** Como cada correção importada se comportou contra a análise do importador. */
  outcomes: OverlayEditOutcome[];
  conflict_count: number;
  /** true quando a análise do importador difere da do autor original. */
  base_differs: boolean;
};

/**
 * Traz as correções de um fork da comunidade para a cifra do próprio músico.
 *
 * Sem isto a comunidade seria só vitrine: `MusicLibrary.musicianId` é
 * obrigatório, então o fork compartilhado é derivado da linha do AUTOR, que o
 * leitor não possui — ele veria a versão do outro e não conseguiria usá-la.
 *
 * Como as duas análises podem divergir (áudios diferentes, versões diferentes
 * do modelo), as edições são reancoradas contra a análise do importador e os
 * conflitos são devolvidos explicitamente, em vez de aplicadas às cegas.
 */
export class ImportCommunityChordSheetUseCase implements IUseCase<
  ImportCommunityChordSheetInput,
  ImportCommunityChordSheetOutput
> {
  constructor(
    private readonly repo: IPersonalChordSheetRepository,
    private readonly getChordSheetUseCase: GetChordSheetForMusicLibraryUseCase,
    private readonly applier: ChordSheetOverlayApplier,
    private readonly planCheckService: PlanCheckService,
  ) {}

  async execute(
    input: ImportCommunityChordSheetInput,
  ): Promise<ImportCommunityChordSheetOutput> {
    const source = await this.repo.findById(
      new PersonalChordSheetId(input.source_personal_chord_sheet_id),
    );
    if (!source) {
      throw new NotFoundError(
        input.source_personal_chord_sheet_id,
        PersonalChordSheet,
      );
    }
    if (source.share_scope !== "community") {
      throw new NotFoundError(
        input.source_personal_chord_sheet_id,
        PersonalChordSheet,
      );
    }

    const existing = await this.repo.findByMusicianAndMusicLibrary(
      input.musician_id,
      input.target_music_library_id,
    );
    if (existing) {
      throw new ConflictError(
        "Você já tem uma cifra pessoal para esta música. Remova-a antes de importar outra versão.",
      );
    }

    // Importar também CRIA um fork, então conta para o mesmo limite do plano —
    // senão a comunidade viraria a porta dos fundos do gate do fork.
    const currentCount = await this.repo.countByMusicianId(input.musician_id);
    await this.planCheckService.assertMusicianCanCreatePersonalChordSheet(
      input.musician_id,
      currentCount,
    );

    // Base do IMPORTADOR: valida de quebra que a música é dele.
    const targetBase = await this.getChordSheetUseCase.execute({
      musician_id: input.musician_id,
      music_library_id: input.target_music_library_id,
    });

    const targetFingerprint = computeChordSheetBaseFingerprint(
      targetBase.chords?.timeline ?? [],
    );
    const base_differs = targetFingerprint !== source.base_fingerprint;

    // Reancora as correções do autor contra a análise do importador. As que não
    // acharem lugar viram conflito visível, nunca são aplicadas no lugar errado.
    const { outcomes, conflict_count } = this.applier.apply(targetBase, {
      edits: source.edits,
      view: source.view,
    });

    const appliedEditIds = new Set(
      outcomes.filter((o) => o.status === "applied").map((o) => o.edit_id),
    );

    const imported = PersonalChordSheet.create({
      musician_id: input.musician_id,
      music_library_id: input.target_music_library_id,
      base_fingerprint: targetFingerprint,
      base_pipeline_version: CHORD_SHEET_FINGERPRINT_VERSION,
    });

    // Só as correções que ancoraram entram. Importar um edit conflitante seria
    // guardar uma edição que nunca vai aparecer na cifra.
    imported.replaceEdits(
      source.edits.filter((e) => appliedEditIds.has(e.edit_id)),
    );
    // A view (tom, capô, complexidade) vem junto: é a intenção de execução do
    // autor e não depende de ancoragem nenhuma.
    imported.changeView(source.view);

    await this.repo.insert(imported);

    return {
      personal_chord_sheet: PersonalChordSheetOutputMapper.toOutput(
        imported,
        true,
      ),
      outcomes,
      conflict_count,
      base_differs,
    };
  }
}
