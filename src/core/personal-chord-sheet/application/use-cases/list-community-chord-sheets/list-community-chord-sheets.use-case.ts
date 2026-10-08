import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IPersonalChordSheetReadModel } from "../../gateways/personal-chord-sheet-read-model.interface";
import {
  PersonalChordSheetOutputMapper,
  PersonalChordSheetSummaryOutput,
} from "../common/personal-chord-sheet-output";

export type ListCommunityChordSheetsInput = {
  music_library_id?: string | null;
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: "asc" | "desc" | null;
};

export type ListCommunityChordSheetsOutput = {
  items: PersonalChordSheetSummaryOutput[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
};

/**
 * Versões que outros músicos compartilharam com a comunidade.
 *
 * O escopo `community` é FIXO na consulta, nunca vem do cliente: sem isso, um
 * `?share_scope=private` na query devolveria os forks privados de todo mundo.
 */
export class ListCommunityChordSheetsUseCase implements IUseCase<
  ListCommunityChordSheetsInput,
  ListCommunityChordSheetsOutput
> {
  constructor(private readonly readModel: IPersonalChordSheetReadModel) {}

  async execute(
    input: ListCommunityChordSheetsInput,
  ): Promise<ListCommunityChordSheetsOutput> {
    const page = input.page ?? 1;
    const per_page = input.per_page ?? 20;

    const result = await this.readModel.searchSummaries({
      share_scope: "community",
      music_library_id: input.music_library_id ?? null,
      page,
      per_page,
      sort: input.sort ?? "shared_at",
      sort_dir: input.sort_dir ?? "desc",
    });

    return {
      // isOwner=false: as anotações pessoais do autor não vão para a comunidade.
      items: result.items.map((row) =>
        PersonalChordSheetOutputMapper.toSummaryOutput(row, false),
      ),
      total: result.total,
      current_page: page,
      per_page,
      last_page: Math.ceil(result.total / per_page),
    };
  }
}
