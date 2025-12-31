import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Badge, BadgeId } from "../../../domain/badge.aggregate";
import { IBadgeRepository } from "../../../domain/badge.repository";
import { BadgeOutput, BadgeOutputMapper } from "../common/badge-output";
import { UpdateBadgeInput } from "./update-badge.input";

export class UpdateBadgeUseCase implements IUseCase<
  UpdateBadgeInput,
  UpdateBadgeOutput
> {
  constructor(private readonly badgeRepo: IBadgeRepository) {}

  async execute(input: UpdateBadgeInput): Promise<UpdateBadgeOutput> {
    const badgeId = new BadgeId(input.id);
    const entity = await this.badgeRepo.findById(badgeId);

    if (!entity) {
      throw new NotFoundError(input.id, Badge);
    }

    // Atualizar apenas os campos fornecidos
    input.name !== undefined && entity.changeName(input.name);
    input.description !== undefined &&
      entity.changeDescription(input.description);
    input.icon !== undefined && entity.changeIcon(input.icon);
    input.category !== undefined && entity.changeCategory(input.category);
    input.requirement !== undefined &&
      entity.changeRequirement(input.requirement);
    input.points !== undefined && entity.changePoints(input.points);
    input.rarity !== undefined && entity.changeRarity(input.rarity);

    if (input.is_active !== undefined) {
      if (input.is_active) {
        entity.activate();
      } else {
        entity.deactivate();
      }
    }

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.badgeRepo.update(entity);

    return BadgeOutputMapper.toOutput(entity);
  }
}

export type UpdateBadgeOutput = BadgeOutput;
