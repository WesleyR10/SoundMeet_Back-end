import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IPersonalChordSheetRepository } from "../../../domain/personal-chord-sheet.repository";
import type { ChordSheetViewSettingsProps } from "../../../domain/value-objects/chord-sheet-view-settings.vo";
import { loadOwnedSheet } from "../common/load-owned-sheet";
import {
  PersonalChordSheetOutput,
  PersonalChordSheetOutputMapper,
} from "../common/personal-chord-sheet-output";

export type UpdateViewSettingsInput = {
  personal_chord_sheet_id: string;
  musician_id: string;
  view: ChordSheetViewSettingsProps;
};

export class UpdateViewSettingsUseCase implements IUseCase<
  UpdateViewSettingsInput,
  PersonalChordSheetOutput
> {
  constructor(private readonly repo: IPersonalChordSheetRepository) {}

  async execute(
    input: UpdateViewSettingsInput,
  ): Promise<PersonalChordSheetOutput> {
    const sheet = await loadOwnedSheet(
      this.repo,
      input.personal_chord_sheet_id,
      input.musician_id,
    );

    // PATCH parcial: `with` preserva o que não veio no corpo.
    sheet.changeView(sheet.view.with(input.view));
    await this.repo.update(sheet);

    return PersonalChordSheetOutputMapper.toOutput(sheet, true);
  }
}
