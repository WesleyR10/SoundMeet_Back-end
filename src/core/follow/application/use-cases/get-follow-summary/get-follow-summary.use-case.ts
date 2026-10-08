import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IFollowRepository } from "../../../domain/follow.repository";
import { FollowTargetType } from "../../../domain/follow-types";

export type GetFollowSummaryInput = {
  target_type: FollowTargetType;
  target_id: string;
  /** Quem pergunta. Ausente (músico/casa olhando o próprio perfil) → `is_following: false`. */
  audience_id?: string | null;
};

export type GetFollowSummaryOutput = {
  target_type: FollowTargetType;
  target_id: string;
  followers_count: number;
  is_following: boolean;
  follow_id: string | null;
  notifications_enabled: boolean | null;
};

/**
 * O botão "Seguir" e o contador. Só número — a lista de quem segue não sai.
 */
export class GetFollowSummaryUseCase implements IUseCase<
  GetFollowSummaryInput,
  GetFollowSummaryOutput
> {
  constructor(private readonly followRepo: IFollowRepository) {}

  async execute(input: GetFollowSummaryInput): Promise<GetFollowSummaryOutput> {
    const target = {
      target_type: input.target_type,
      target_id: input.target_id,
    };
    const [followers_count, mine] = await Promise.all([
      this.followRepo.countByTarget(target),
      input.audience_id
        ? this.followRepo.findByAudienceAndTarget({
            audience_id: input.audience_id,
            ...target,
          })
        : Promise.resolve(null),
    ]);

    return {
      ...target,
      followers_count,
      is_following: !!mine,
      follow_id: mine?.follow_id.id ?? null,
      notifications_enabled: mine?.notifications_enabled ?? null,
    };
  }
}
