import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IRepertoireRepository, RepertoireSearchParams } from "../../../domain/repertoire.repository";
import { RepertoireOutput, RepertoireOutputMapper } from "../common/repertoire-output";

export type ListRepertoiresInput = {
  musician_id: string;
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: "asc" | "desc" | null;
  name?: string | null;
};

export type ListRepertoiresOutput = {
  items: RepertoireOutput[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
};

export class ListRepertoiresUseCase
  implements IUseCase<ListRepertoiresInput, ListRepertoiresOutput>
{
  constructor(private readonly repertoireRepo: IRepertoireRepository) {}

  async execute(input: ListRepertoiresInput): Promise<ListRepertoiresOutput> {
    const params = RepertoireSearchParams.create({
      page: input.page ?? 1,
      per_page: input.per_page ?? 20,
      sort: input.sort ?? "created_at",
      sort_dir: input.sort_dir ?? "desc",
      filter: {
        musician_id: input.musician_id,
        name: input.name ?? null,
      },
    });

    const result = await this.repertoireRepo.search(params);

    return {
      items: result.items.map((r) => RepertoireOutputMapper.toOutput(r)),
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
      last_page: Math.ceil(result.total / result.per_page),
    };
  }
}
