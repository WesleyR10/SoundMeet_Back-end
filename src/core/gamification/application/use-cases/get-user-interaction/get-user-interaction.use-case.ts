import { UserInteractionId } from "@core/gamification/domain/value-objects/gamification-id.vo";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { UserInteraction } from "../../../domain/user-interaction.aggregate";
import { IUserInteractionRepository } from "../../../domain/user-interaction.repository";
import {
  UserInteractionOutput,
  UserInteractionOutputMapper,
} from "../common/user-interaction-output";

export class GetUserInteractionUseCase
  implements IUseCase<GetUserInteractionInput, GetUserInteractionOutput>
{
  constructor(
    private readonly userInteractionRepo: IUserInteractionRepository,
  ) {}

  async execute(
    input: GetUserInteractionInput,
  ): Promise<GetUserInteractionOutput> {
    const userInteractionId = new UserInteractionId(input.id);
    const entity = await this.userInteractionRepo.findById(userInteractionId);

    if (!entity) {
      throw new NotFoundError(input.id, UserInteraction);
    }

    return UserInteractionOutputMapper.toOutput(entity);
  }
}

export type GetUserInteractionInput = {
  id: string;
};

export type GetUserInteractionOutput = UserInteractionOutput;
