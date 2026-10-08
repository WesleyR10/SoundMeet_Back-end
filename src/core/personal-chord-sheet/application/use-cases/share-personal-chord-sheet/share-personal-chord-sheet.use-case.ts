import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IPersonalChordSheetRepository } from "../../../domain/personal-chord-sheet.repository";
import { loadOwnedSheet } from "../common/load-owned-sheet";
import {
  PersonalChordSheetOutput,
  PersonalChordSheetOutputMapper,
} from "../common/personal-chord-sheet-output";

export type SharePersonalChordSheetInput = {
  personal_chord_sheet_id: string;
  musician_id: string;
  scope: "band" | "community";
};

export class SharePersonalChordSheetUseCase implements IUseCase<
  SharePersonalChordSheetInput,
  PersonalChordSheetOutput
> {
  constructor(
    private readonly repo: IPersonalChordSheetRepository,
    private readonly planCheckService: PlanCheckService,
  ) {}

  async execute(
    input: SharePersonalChordSheetInput,
  ): Promise<PersonalChordSheetOutput> {
    const sheet = await loadOwnedSheet(
      this.repo,
      input.personal_chord_sheet_id,
      input.musician_id,
    );

    // Só a publicação na COMUNIDADE é paga. Compartilhar com a própria banda é
    // core em todos os tiers — é o compartilhamento que nenhum concorrente
    // consegue oferecer, e cobrar por ele mataria a razão de ele existir.
    if (input.scope === "community") {
      await this.planCheckService.assertMusicianFeature(
        sheet.musician_id,
        "chord_sheet_community_sharing",
      );
    }

    sheet.share(input.scope);
    await this.repo.update(sheet);

    return PersonalChordSheetOutputMapper.toOutput(sheet, true);
  }
}
