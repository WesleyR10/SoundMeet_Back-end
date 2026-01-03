import { IUseCase } from "../../../../shared/application/use-case.interface";
import { ConflictError } from "../../../../shared/domain/errors/conflict.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { UserBadge } from "../../../domain/user-badge.aggregate";
import { IUserBadgeRepository } from "../../../domain/user-badge.repository";
import {
  UserBadgeOutput,
  UserBadgeOutputMapper,
} from "../common/user-badge-output";
import { AwardBadgeInput } from "./award-badge.input";

export class AwardBadgeUseCase implements IUseCase<
  AwardBadgeInput,
  UserBadgeOutput
> {
  constructor(private readonly userBadgeRepo: IUserBadgeRepository) {}

  async execute(input: AwardBadgeInput): Promise<UserBadgeOutput> {
    // Verificar se o usuário já possui este badge
    const existingBadge = await this.userBadgeRepo.findByUserAndBadgeType(
      input.user_id,
      input.badge_type.value,
    );

    if (existingBadge) {
      throw new ConflictError(
        `User already has badge of type ${input.badge_type.value}`,
      );
    }

    // Criar a entidade UserBadge
    const userBadge = UserBadge.create({
      user_id: new Uuid(input.user_id),
      badge_type: input.badge_type.value,
      progress: input.points_earned || 0,
      is_unlocked: true,
    });

    if (userBadge.notification.hasErrors()) {
      throw new EntityValidationError(userBadge.notification.toJSON());
    }

    await this.userBadgeRepo.insert(userBadge);

    return UserBadgeOutputMapper.toOutput(userBadge);
  }
}
