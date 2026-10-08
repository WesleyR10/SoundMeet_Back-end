import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Follow, FollowId } from "../../../domain/follow.aggregate";
import { IFollowRepository } from "../../../domain/follow.repository";

export type UnfollowTargetInput = {
  audience_id: string;
  follow_id: string;
};

/**
 * Deixar de seguir. A posse é checada AQUI: o guard prova quem é o fã da URL,
 * nunca de quem é o vínculo — `follow_id` de outra pessoa responde como
 * inexistente (mesma lição do `personal-chord-sheet`).
 */
export class UnfollowTargetUseCase implements IUseCase<
  UnfollowTargetInput,
  void
> {
  constructor(private readonly followRepo: IFollowRepository) {}

  async execute(input: UnfollowTargetInput): Promise<void> {
    const follow = await this.followRepo.findById(
      new FollowId(input.follow_id),
    );
    if (!follow || follow.audience_id !== input.audience_id) {
      throw new NotFoundError(input.follow_id, Follow);
    }
    await this.followRepo.delete(follow.follow_id);
  }
}
