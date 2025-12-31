import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Badge } from "../../../domain/badge.aggregate";
import { IBadgeRepository } from "../../../domain/badge.repository";
import { BadgeOutput, BadgeOutputMapper } from "../common/badge-output";
import { CreateBadgeInput } from "./create-badge.input";

export class CreateBadgeUseCase implements IUseCase<
  CreateBadgeInput,
  CreateBadgeOutput
> {
  constructor(private readonly badgeRepo: IBadgeRepository) {}

  async execute(input: CreateBadgeInput): Promise<CreateBadgeOutput> {
    const entity = Badge.create({
      name: input.name,
      description: input.description,
      icon: input.icon,
      category: input.category,
      requirement: input.requirement,
      points: input.points,
      rarity: input.rarity,
      is_active: input.is_active,
    });

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.badgeRepo.insert(entity);

    return BadgeOutputMapper.toOutput(entity);
  }
}

export type CreateBadgeOutput = BadgeOutput;
