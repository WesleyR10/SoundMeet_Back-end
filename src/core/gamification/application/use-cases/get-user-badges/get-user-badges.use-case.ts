import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IUserBadgeRepository } from "../../../domain/user-badge.repository";
import {
  UserBadgeOutput,
  UserBadgeOutputMapper,
} from "../common/user-badge-output";
import { GetUserBadgesInput } from "./get-user-badges.input";

export class GetUserBadgesUseCase implements IUseCase<
  GetUserBadgesInput,
  UserBadgeOutput[]
> {
  constructor(private readonly userBadgeRepo: IUserBadgeRepository) {}

  async execute(input: GetUserBadgesInput): Promise<UserBadgeOutput[]> {
    const userBadges = await this.userBadgeRepo.findByUserId(input.user_id);

    return userBadges.map((badge) => UserBadgeOutputMapper.toOutput(badge));
  }
}
