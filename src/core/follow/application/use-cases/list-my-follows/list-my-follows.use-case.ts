import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  FollowSearchParams,
  IFollowRepository,
} from "../../../domain/follow.repository";
import { FollowTargetType } from "../../../domain/follow-types";
import { FollowOutput, FollowOutputMapper } from "../common/follow-output";
import { FollowTargetReader } from "../common/follow-target-reader";

export type ListMyFollowsInput = {
  audience_id: string;
  target_type?: FollowTargetType | null;
  page?: number;
  per_page?: number;
};

export type ListMyFollowsOutput = {
  items: FollowOutput[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
};

/**
 * "Seguindo" do fã. O alvo vem enriquecido (nome e foto) para a lista não
 * precisar de uma requisição por linha. Alvo que deixou de ser visível
 * (desativado, ou músico que fechou `open_to_gigs`) volta com `target: null`
 * — o vínculo continua do fã, e ele pode desfazê-lo.
 */
export class ListMyFollowsUseCase implements IUseCase<
  ListMyFollowsInput,
  ListMyFollowsOutput
> {
  constructor(
    private readonly followRepo: IFollowRepository,
    private readonly targets: FollowTargetReader,
  ) {}

  async execute(input: ListMyFollowsInput): Promise<ListMyFollowsOutput> {
    const result = await this.followRepo.search(
      FollowSearchParams.create({
        filter: {
          audience_id: input.audience_id,
          target_type: input.target_type ?? null,
        },
        page: input.page,
        per_page: input.per_page,
        sort: "created_at",
        sort_dir: "desc",
      }),
    );

    const summaries = await this.targets.findVisibleMany(
      result.items.map((f) => ({
        target_type: f.target_type,
        target_id: f.target_id,
      })),
    );

    return {
      items: result.items.map((f) =>
        FollowOutputMapper.toOutput(
          f,
          summaries.get(FollowTargetReader.key(f)) ?? null,
        ),
      ),
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
      last_page: result.last_page,
    };
  }
}
