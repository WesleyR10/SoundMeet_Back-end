import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { UserScore } from "../../../domain/user-score.aggregate";
import { IUserScoreRepository } from "../../../domain/user-score.repository";
import {
  UserScoreOutput,
  UserScoreOutputMapper,
} from "../common/user-score-output";
import { CreateUserScoreInput } from "./create-user-score.input";

export class CreateUserScoreUseCase
  implements IUseCase<CreateUserScoreInput, UserScoreOutput>
{
  constructor(private readonly userScoreRepo: IUserScoreRepository) {}

  async execute(input: CreateUserScoreInput): Promise<UserScoreOutput> {
    const entity = UserScore.create({
      user_id: input.user_id,
      score_type: input.score_type,
      points: input.points,
      reference_id: input.reference_id,
      description: input.description,
    });

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.userScoreRepo.insert(entity);

    return UserScoreOutputMapper.toOutput(entity);
  }
}
