import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Follow, FollowId } from "../../../domain/follow.aggregate";
import { IFollowRepository } from "../../../domain/follow.repository";
import { FollowOutput, FollowOutputMapper } from "../common/follow-output";

export type ToggleFollowNotificationsInput = {
  audience_id: string;
  follow_id: string;
  enabled: boolean;
};

export class ToggleFollowNotificationsUseCase implements IUseCase<
  ToggleFollowNotificationsInput,
  FollowOutput
> {
  constructor(private readonly followRepo: IFollowRepository) {}

  async execute(input: ToggleFollowNotificationsInput): Promise<FollowOutput> {
    const follow = await this.followRepo.findById(
      new FollowId(input.follow_id),
    );
    // Posse no use-case — ver `UnfollowTargetUseCase`.
    if (!follow || follow.audience_id !== input.audience_id) {
      throw new NotFoundError(input.follow_id, Follow);
    }

    if (input.enabled) {
      follow.enableNotifications();
    } else {
      follow.disableNotifications();
    }
    await this.followRepo.update(follow);

    return FollowOutputMapper.toOutput(follow);
  }
}
