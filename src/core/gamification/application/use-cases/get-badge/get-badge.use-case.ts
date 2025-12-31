import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Badge, BadgeId } from "../../../domain/badge.aggregate";
import { IBadgeRepository } from "../../../domain/badge.repository";
import { BadgeOutput, BadgeOutputMapper } from "../common/badge-output";

export class GetBadgeUseCase implements IUseCase<
  GetBadgeInput,
  GetBadgeOutput
> {
  constructor(private readonly badgeRepo: IBadgeRepository) {}

  async execute(input: GetBadgeInput): Promise<GetBadgeOutput> {
    const badgeId = new BadgeId(input.id);
    const entity = await this.badgeRepo.findById(badgeId);

    if (!entity) {
      throw new NotFoundError(input.id, Badge);
    }

    return BadgeOutputMapper.toOutput(entity);
  }
}

export type GetBadgeInput = {
  id: string;
};

export type GetBadgeOutput = BadgeOutput;
