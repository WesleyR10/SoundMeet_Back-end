import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { UserBadge } from "../../../domain/user-badge.aggregate";
import { IUserBadgeRepository } from "../../../domain/user-badge.repository";
import { UserBadgeId } from "../../../domain/value-objects/gamification-id.vo";
import {
  UserBadgeOutput,
  UserBadgeOutputMapper,
} from "../common/user-badge-output";
import { GetUserBadgeInput } from "./get-user-badge.input";

export class GetUserBadgeUseCase implements IUseCase<
  GetUserBadgeInput,
  UserBadgeOutput
> {
  constructor(private userBadgeRepository: IUserBadgeRepository) {}

  async execute(input: GetUserBadgeInput): Promise<UserBadgeOutput> {
    const userBadgeId = new UserBadgeId(input.id);
    const userBadge = await this.userBadgeRepository.findById(userBadgeId);
    if (!userBadge) {
      throw new NotFoundError(input.id, UserBadge);
    }

    return UserBadgeOutputMapper.toOutput(userBadge);
  }
}
