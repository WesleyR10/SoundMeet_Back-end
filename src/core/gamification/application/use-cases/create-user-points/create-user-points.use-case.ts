import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { InvalidUuidError } from "../../../../shared/domain/value-objects/uuid.vo";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { UserPoints } from "../../../domain/user-points.aggregate";
import { IUserPointsRepository } from "../../../domain/user-points.repository";
import {
  UserPointsOutput,
  UserPointsOutputMapper,
} from "../common/user-points-output";
import { CreateUserPointsInput } from "./create-user-points.input";

export class CreateUserPointsUseCase implements IUseCase<
  CreateUserPointsInput,
  UserPointsOutput
> {
  constructor(private readonly userPointsRepo: IUserPointsRepository) {}

  async execute(input: CreateUserPointsInput): Promise<UserPointsOutput> {
    let userId: Uuid;
    try {
      userId = new Uuid(input.user_id);
    } catch (e) {
      if (e instanceof InvalidUuidError) {
        throw new EntityValidationError([{ user_id: [e.message] }]);
      }
      throw e;
    }

    const entity = UserPoints.create({
      user_id: userId,
      total_points: input.total_points,
      total_scans: input.total_scans,
      total_requests: input.total_requests,
      total_tips: input.total_tips,
      total_social_shares: input.total_social_shares,
      current_level: input.current_level,
      is_active: input.is_active,
    });

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.userPointsRepo.insert(entity);

    return UserPointsOutputMapper.toOutput(entity);
  }
}
