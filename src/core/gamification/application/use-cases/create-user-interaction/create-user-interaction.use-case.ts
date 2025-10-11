import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { UserInteraction } from "../../../domain/user-interaction.aggregate";
import { IUserInteractionRepository } from "../../../domain/user-interaction.repository";
import {
  UserInteractionOutput,
  UserInteractionOutputMapper,
} from "../common/user-interaction-output";
import { CreateUserInteractionInput } from "./create-user-interaction.input";

export class CreateUserInteractionUseCase
  implements IUseCase<CreateUserInteractionInput, UserInteractionOutput>
{
  constructor(
    private readonly userInteractionRepo: IUserInteractionRepository,
  ) {}

  async execute(
    input: CreateUserInteractionInput,
  ): Promise<UserInteractionOutput> {
    const entity = UserInteraction.create({
      user_id: input.user_id,
      interaction_type: input.interaction_type,
      target_id: input.target_id,
      metadata: input.metadata,
      points_earned: input.points_earned,
    });

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.userInteractionRepo.insert(entity);

    return UserInteractionOutputMapper.toOutput(entity);
  }
}
