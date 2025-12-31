import { UserInteractionId } from "@core/gamification/domain/value-objects/gamification-id.vo";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { UserInteraction } from "../../../domain/user-interaction.aggregate";
import { IUserInteractionRepository } from "../../../domain/user-interaction.repository";
import {
  UserInteractionOutput,
  UserInteractionOutputMapper,
} from "../common/user-interaction-output";
import { UpdateUserInteractionInput } from "./update-user-interaction.input";

export class UpdateUserInteractionUseCase implements IUseCase<
  UpdateUserInteractionInput,
  UpdateUserInteractionOutput
> {
  constructor(
    private readonly userInteractionRepo: IUserInteractionRepository,
  ) {}

  async execute(
    input: UpdateUserInteractionInput,
  ): Promise<UpdateUserInteractionOutput> {
    const userInteractionId = new UserInteractionId(input.id);
    const entity = await this.userInteractionRepo.findById(userInteractionId);

    if (!entity) {
      throw new NotFoundError(input.id, UserInteraction);
    }

    if (input.interaction_type !== undefined) {
      entity.changeInteractionType(input.interaction_type);
    }

    if (input.target_id !== undefined) {
      entity.changeTargetId(input.target_id);
    }

    if (input.metadata !== undefined) {
      entity.updateMetadata(input.metadata);
    }

    if (input.points_earned !== undefined) {
      entity.updatePointsEarned(input.points_earned);
    }

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.userInteractionRepo.update(entity);

    return UserInteractionOutputMapper.toOutput(entity);
  }
}

export type UpdateUserInteractionOutput = UserInteractionOutput;
