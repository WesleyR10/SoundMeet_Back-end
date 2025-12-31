import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IUserPointsRepository } from "../../../domain/user-points.repository";
import {
  UserPointsOutput,
  UserPointsOutputMapper,
} from "../common/user-points-output";
import { GetUserPointsInput } from "./get-user-points.input";

export class GetUserPointsUseCase implements IUseCase<
  GetUserPointsInput,
  UserPointsOutput | null
> {
  constructor(private readonly userPointsRepo: IUserPointsRepository) {}

  async execute(input: GetUserPointsInput): Promise<UserPointsOutput | null> {
    const userPoints = await this.userPointsRepo.findByUserId(input.user_id);

    if (!userPoints) {
      return null;
    }

    return UserPointsOutputMapper.toOutput(userPoints);
  }
}
