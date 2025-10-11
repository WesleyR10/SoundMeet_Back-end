import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { UserBadgeId } from "../../../domain/value-objects/gamification-id.vo";
import { IUserBadgeRepository } from "../../../domain/user-badge.repository";
import { UserBadge } from "../../../domain/user-badge.aggregate";
import {
  UserBadgeOutput,
  UserBadgeOutputMapper,
} from "../common/user-badge-output";
import { UpdateUserBadgeInput } from "./update-user-badge.input";

export class UpdateUserBadgeUseCase
  implements IUseCase<UpdateUserBadgeInput, UserBadgeOutput>
{
  constructor(private readonly userBadgeRepo: IUserBadgeRepository) {}

  async execute(input: UpdateUserBadgeInput): Promise<UserBadgeOutput> {
    const userBadgeId = new UserBadgeId(input.id);
    const entity = await this.userBadgeRepo.findById(userBadgeId);

    if (!entity) {
      throw new NotFoundError(input.id, UserBadge);
    }

    if (input.progress !== undefined) {
      entity.updateProgress(input.progress);
    }

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.userBadgeRepo.update(entity);

    return UserBadgeOutputMapper.toOutput(entity);
  }
}
