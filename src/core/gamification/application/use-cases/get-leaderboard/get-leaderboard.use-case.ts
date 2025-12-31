import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IUserPointsRepository } from "../../../domain/user-points.repository";
import {
  UserPointsOutput,
  UserPointsOutputMapper,
} from "../common/user-points-output";
import { GetLeaderboardInput } from "./get-leaderboard.input";

export class GetLeaderboardUseCase implements IUseCase<
  GetLeaderboardInput,
  UserPointsOutput[]
> {
  constructor(private readonly userPointsRepo: IUserPointsRepository) {}

  async execute(input: GetLeaderboardInput): Promise<UserPointsOutput[]> {
    const topUsers = await this.userPointsRepo.findTopUsers(input.limit || 10);

    return topUsers.map((userPoints) =>
      UserPointsOutputMapper.toOutput(userPoints),
    );
  }
}
