import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IPersonalChordSheetRepository } from "../../../domain/personal-chord-sheet.repository";
import { loadOwnedSheet } from "../common/load-owned-sheet";
import {
  PersonalChordSheetOutput,
  PersonalChordSheetOutputMapper,
} from "../common/personal-chord-sheet-output";

export type UpdatePersonalNotesInput = {
  personal_chord_sheet_id: string;
  musician_id: string;
  notes: string | null;
};

export class UpdatePersonalNotesUseCase implements IUseCase<
  UpdatePersonalNotesInput,
  PersonalChordSheetOutput
> {
  constructor(private readonly repo: IPersonalChordSheetRepository) {}

  async execute(
    input: UpdatePersonalNotesInput,
  ): Promise<PersonalChordSheetOutput> {
    const sheet = await loadOwnedSheet(
      this.repo,
      input.personal_chord_sheet_id,
      input.musician_id,
    );

    sheet.changeNotes(input.notes);
    await this.repo.update(sheet);

    return PersonalChordSheetOutputMapper.toOutput(sheet, true);
  }
}
