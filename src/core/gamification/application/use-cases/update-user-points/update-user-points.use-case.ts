import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  UserPoints,
  UserPointsId,
} from "../../../domain/user-points.aggregate";
import { IUserPointsRepository } from "../../../domain/user-points.repository";
import {
  UserPointsOutput,
  UserPointsOutputMapper,
} from "../common/user-points-output";
import { UpdateUserPointsInput } from "./update-user-points.input";

export class UpdateUserPointsUseCase implements IUseCase<
  UpdateUserPointsInput,
  UpdateUserPointsOutput
> {
  constructor(private readonly userPointsRepo: IUserPointsRepository) {}

  async execute(input: UpdateUserPointsInput): Promise<UpdateUserPointsOutput> {
    const userPointsId = new UserPointsId(input.id);
    const entity = await this.userPointsRepo.findById(userPointsId);

    if (!entity) {
      throw new NotFoundError(input.id, UserPoints);
    }

    if (input.total_points !== undefined) {
      entity.updateTotalPoints(input.total_points);
    }
    if (input.total_scans !== undefined) {
      entity.updateTotalScans(input.total_scans);
    }
    if (input.total_requests !== undefined) {
      entity.updateTotalRequests(input.total_requests);
    }
    if (input.total_tips !== undefined) {
      entity.updateTotalTips(input.total_tips);
    }
    if (input.total_social_shares !== undefined) {
      entity.updateTotalSocialShares(input.total_social_shares);
    }
    if (input.current_level !== undefined) {
      entity.updateCurrentLevel(input.current_level);
    }

    if (input.is_active === true) {
      entity.activate();
    }
    if (input.is_active === false) {
      entity.deactivate();
    }

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.userPointsRepo.update(entity);

    return UserPointsOutputMapper.toOutput(entity);
  }
}

export type UpdateUserPointsOutput = UserPointsOutput;
