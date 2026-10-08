import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { ConflictError } from "../../../../shared/domain/errors/conflict.error";
import { GetChordSheetForMusicLibraryUseCase } from "../../../../synced-lyrics/application/use-cases/get-chord-sheet-for-music-library/get-chord-sheet-for-music-library.use-case";
import { PersonalChordSheet } from "../../../domain/personal-chord-sheet.aggregate";
import { IPersonalChordSheetRepository } from "../../../domain/personal-chord-sheet.repository";
import {
  CHORD_SHEET_FINGERPRINT_VERSION,
  computeChordSheetBaseFingerprint,
} from "../../services/chord-sheet-fingerprint";
import {
  PersonalChordSheetOutput,
  PersonalChordSheetOutputMapper,
} from "../common/personal-chord-sheet-output";

export type ForkChordSheetInput = {
  musician_id: string;
  music_library_id: string;
};

export type ForkChordSheetOutput = PersonalChordSheetOutput;

/**
 * Cria a versão pessoal de uma cifra.
 *
 * Não copia a cifra: grava só a âncora (fingerprint da análise vigente) e nasce
 * sem nenhuma edição. A cifra continua vindo do artefato canônico — o que este
 * agregado guarda daqui pra frente é o que o músico mudar.
 */
export class ForkChordSheetUseCase implements IUseCase<
  ForkChordSheetInput,
  ForkChordSheetOutput
> {
  constructor(
    private readonly repo: IPersonalChordSheetRepository,
    private readonly getChordSheetUseCase: GetChordSheetForMusicLibraryUseCase,
    private readonly planCheckService: PlanCheckService,
  ) {}

  async execute(input: ForkChordSheetInput): Promise<ForkChordSheetOutput> {
    // Valida posse da música E produz o base num passo só: o use-case base
    // lança NotFoundError se a linha de music_library não for deste músico.
    const base = await this.getChordSheetUseCase.execute({
      musician_id: input.musician_id,
      music_library_id: input.music_library_id,
    });

    const existing = await this.repo.findByMusicianAndMusicLibrary(
      input.musician_id,
      input.music_library_id,
    );
    if (existing) {
      throw new ConflictError(
        "Você já tem uma cifra pessoal para esta música.",
      );
    }

    // Grant-at-action: cobrado ao CRIAR, nunca ao ler. Vem depois da checagem
    // de duplicata de propósito — quem já tem o fork desta música recebe 409
    // (o estado real), não um 402 de upgrade que não resolveria nada.
    const currentCount = await this.repo.countByMusicianId(input.musician_id);
    await this.planCheckService.assertMusicianCanCreatePersonalChordSheet(
      input.musician_id,
      currentCount,
    );

    const sheet = PersonalChordSheet.create({
      musician_id: input.musician_id,
      music_library_id: input.music_library_id,
      base_fingerprint: computeChordSheetBaseFingerprint(
        base.chords?.timeline ?? [],
      ),
      base_pipeline_version: CHORD_SHEET_FINGERPRINT_VERSION,
    });

    // A checagem acima é o caminho feliz; o índice único
    // (musician_id, music_library_id) é o que segura dois POSTs simultâneos.
    // O P2002 vira ConflictError no mapPrismaErrorToDomainError.
    await this.repo.insert(sheet);

    return PersonalChordSheetOutputMapper.toOutput(sheet, true);
  }
}
