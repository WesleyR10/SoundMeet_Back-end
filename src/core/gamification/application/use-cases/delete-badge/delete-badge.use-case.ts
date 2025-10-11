import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Badge, BadgeId } from "../../../domain/badge.aggregate";
import { IBadgeRepository } from "../../../domain/badge.repository";

export class DeleteBadgeUseCase
  implements IUseCase<DeleteBadgeInput, DeleteBadgeOutput>
{
  constructor(private readonly badgeRepo: IBadgeRepository) {}

  async execute(input: DeleteBadgeInput): Promise<DeleteBadgeOutput> {
    const badgeId = new BadgeId(input.id);
    const entity = await this.badgeRepo.findById(badgeId);

    if (!entity) {
      throw new NotFoundError(input.id, Badge);
    }

    await this.badgeRepo.delete(badgeId);
  }
}

export type DeleteBadgeInput = {
  id: string;
};

export type DeleteBadgeOutput = void;
