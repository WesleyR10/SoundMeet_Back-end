import { UserInteractionId } from "@core/gamification/domain/value-objects/gamification-id.vo";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { UserInteraction } from "../../../domain/user-interaction.aggregate";
import { IUserInteractionRepository } from "../../../domain/user-interaction.repository";

export class DeleteUserInteractionUseCase implements IUseCase<
  DeleteUserInteractionInput,
  DeleteUserInteractionOutput
> {
  constructor(
    private readonly userInteractionRepo: IUserInteractionRepository,
  ) {}

  async execute(
    input: DeleteUserInteractionInput,
  ): Promise<DeleteUserInteractionOutput> {
    const userInteractionId = new UserInteractionId(input.id);
    const entity = await this.userInteractionRepo.findById(userInteractionId);

    if (!entity) {
      throw new NotFoundError(input.id, UserInteraction);
    }

    await this.userInteractionRepo.delete(userInteractionId);
  }
}

export type DeleteUserInteractionInput = {
  id: string;
};

export type DeleteUserInteractionOutput = void;
