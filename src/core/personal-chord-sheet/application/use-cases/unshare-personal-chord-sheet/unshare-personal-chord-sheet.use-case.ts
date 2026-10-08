import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IPersonalChordSheetRepository } from "../../../domain/personal-chord-sheet.repository";
import { loadOwnedSheet } from "../common/load-owned-sheet";
import {
  PersonalChordSheetOutput,
  PersonalChordSheetOutputMapper,
} from "../common/personal-chord-sheet-output";

export type UnsharePersonalChordSheetInput = {
  personal_chord_sheet_id: string;
  musician_id: string;
};

export class UnsharePersonalChordSheetUseCase implements IUseCase<
  UnsharePersonalChordSheetInput,
  PersonalChordSheetOutput
> {
  constructor(private readonly repo: IPersonalChordSheetRepository) {}

  async execute(
    input: UnsharePersonalChordSheetInput,
  ): Promise<PersonalChordSheetOutput> {
    const sheet = await loadOwnedSheet(
      this.repo,
      input.personal_chord_sheet_id,
      input.musician_id,
    );

    // Volta a privado imediatamente — descompartilhar não pode ter carência.
    sheet.unshare();
    await this.repo.update(sheet);

    return PersonalChordSheetOutputMapper.toOutput(sheet, true);
  }
}
