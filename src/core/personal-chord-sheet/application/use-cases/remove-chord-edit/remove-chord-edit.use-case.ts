import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IPersonalChordSheetRepository } from "../../../domain/personal-chord-sheet.repository";
import { loadOwnedSheet } from "../common/load-owned-sheet";
import {
  PersonalChordSheetOutput,
  PersonalChordSheetOutputMapper,
} from "../common/personal-chord-sheet-output";

export type RemoveChordEditInput = {
  personal_chord_sheet_id: string;
  musician_id: string;
  edit_id: string;
};

export class RemoveChordEditUseCase implements IUseCase<
  RemoveChordEditInput,
  PersonalChordSheetOutput
> {
  constructor(private readonly repo: IPersonalChordSheetRepository) {}

  async execute(
    input: RemoveChordEditInput,
  ): Promise<PersonalChordSheetOutput> {
    const sheet = await loadOwnedSheet(
      this.repo,
      input.personal_chord_sheet_id,
      input.musician_id,
    );

    sheet.removeEdit(input.edit_id);
    await this.repo.update(sheet);

    return PersonalChordSheetOutputMapper.toOutput(sheet, true);
  }
}
