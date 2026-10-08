import { IUseCase } from "../../../../shared/application/use-case.interface";
import type { PersonalChordSheetReconcileStatus } from "../../../domain/personal-chord-sheet.aggregate";
import { IPersonalChordSheetReadModel } from "../../gateways/personal-chord-sheet-read-model.interface";
import {
  PersonalChordSheetOutputMapper,
  PersonalChordSheetSummaryOutput,
} from "../common/personal-chord-sheet-output";

export type ListPersonalChordSheetsInput = {
  musician_id: string;
  music_library_id?: string | null;
  reconcile_status?: PersonalChordSheetReconcileStatus | null;
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: "asc" | "desc" | null;
};

export type ListPersonalChordSheetsOutput = {
  items: PersonalChordSheetSummaryOutput[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
};

/**
 * Usa o READ-MODEL, não o repositório: a listagem não precisa dos edits, e
 * carregá-los seria trazer até 60 KB de JSON por linha só para contar quantos
 * são. Ver IPersonalChordSheetReadModel.
 */
export class ListPersonalChordSheetsUseCase implements IUseCase<
  ListPersonalChordSheetsInput,
  ListPersonalChordSheetsOutput
> {
  constructor(private readonly readModel: IPersonalChordSheetReadModel) {}

  async execute(
    input: ListPersonalChordSheetsInput,
  ): Promise<ListPersonalChordSheetsOutput> {
    const page = input.page ?? 1;
    const per_page = input.per_page ?? 20;

    const result = await this.readModel.searchSummaries({
      // Escopo do músico é obrigatório e vem sempre do token, nunca da query.
      musician_id: input.musician_id,
      music_library_id: input.music_library_id ?? null,
      reconcile_status: input.reconcile_status ?? null,
      page,
      per_page,
      sort: input.sort ?? "updated_at",
      sort_dir: input.sort_dir ?? "desc",
    });

    return {
      // É a listagem do próprio músico: as anotações são dele.
      items: result.items.map((row) =>
        PersonalChordSheetOutputMapper.toSummaryOutput(row, true),
      ),
      total: result.total,
      current_page: page,
      per_page,
      last_page: Math.ceil(result.total / per_page),
    };
  }
}
