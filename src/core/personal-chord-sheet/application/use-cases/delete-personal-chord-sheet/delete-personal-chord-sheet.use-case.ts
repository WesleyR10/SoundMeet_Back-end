import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IPersonalChordSheetRepository } from "../../../domain/personal-chord-sheet.repository";
import { loadOwnedSheet } from "../common/load-owned-sheet";

export type DeletePersonalChordSheetInput = {
  personal_chord_sheet_id: string;
  /** undefined = admin: moderação pode remover qualquer fork. */
  requesting_musician_id?: string;
};

export class DeletePersonalChordSheetUseCase implements IUseCase<
  DeletePersonalChordSheetInput,
  void
> {
  constructor(private readonly repo: IPersonalChordSheetRepository) {}

  async execute(input: DeletePersonalChordSheetInput): Promise<void> {
    const sheet = await loadOwnedSheet(
      this.repo,
      input.personal_chord_sheet_id,
      input.requesting_musician_id,
    );

    await this.repo.delete(sheet.personal_chord_sheet_id);
  }
}
