import { IUseCase } from "../../../../shared/application/use-case.interface";
import { ConflictError } from "../../../../shared/domain/errors/conflict.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Follow } from "../../../domain/follow.aggregate";
import { IFollowRepository } from "../../../domain/follow.repository";
import { FollowTargetType } from "../../../domain/follow-types";
import { FollowOutput, FollowOutputMapper } from "../common/follow-output";
import { FollowTargetReader } from "../common/follow-target-reader";

export type FollowTargetInput = {
  audience_id: string;
  target_type: FollowTargetType;
  target_id: string;
};

/**
 * Seguir um músico ou uma casa. Idempotente: seguir de novo devolve o vínculo
 * existente — o app manda o toque, não sabe (nem precisa saber) se já seguia.
 */
export class FollowTargetUseCase implements IUseCase<
  FollowTargetInput,
  FollowOutput
> {
  constructor(
    private readonly followRepo: IFollowRepository,
    private readonly targets: FollowTargetReader,
  ) {}

  async execute(input: FollowTargetInput): Promise<FollowOutput> {
    const target = {
      target_type: input.target_type,
      target_id: input.target_id,
    };

    const summary = await this.targets.findVisible(target);
    if (!summary) {
      throw new NotFoundError(input.target_id, Follow);
    }

    const existing = await this.followRepo.findByAudienceAndTarget({
      audience_id: input.audience_id,
      ...target,
    });
    if (existing) return FollowOutputMapper.toOutput(existing);

    const follow = Follow.create({ audience_id: input.audience_id, ...target });
    try {
      await this.followRepo.insert(follow);
    } catch (error) {
      // Dois toques simultâneos: o índice único barrou o segundo. O vínculo
      // existe — devolvê-lo é o resultado certo, não um 409.
      if (!(error instanceof ConflictError)) throw error;
      const raced = await this.followRepo.findByAudienceAndTarget({
        audience_id: input.audience_id,
        ...target,
      });
      if (!raced) throw error;
      return FollowOutputMapper.toOutput(raced);
    }

    return FollowOutputMapper.toOutput(follow);
  }
}
