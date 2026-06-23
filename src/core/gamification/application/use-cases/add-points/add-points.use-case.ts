import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { UserPoints } from "../../../domain/user-points.aggregate";
import { IUserPointsRepository } from "../../../domain/user-points.repository";
import { UserScore } from "../../../domain/user-score.aggregate";
import { IUserScoreRepository } from "../../../domain/user-score.repository";
import { PointsSourceEnum } from "../../../domain/value-objects/points-source.vo";
import {
  applyPointsProjection,
  getLedgerDescription,
  getLedgerReferenceId,
  resolveLedgerPoints,
  scoreTypeFromPointsSource,
} from "../common/points-ledger";
import {
  UserPointsOutput,
  UserPointsOutputMapper,
} from "../common/user-points-output";
import { AddPointsInput } from "./add-points.input";

export class AddPointsUseCase implements IUseCase<
  AddPointsInput,
  UserPointsOutput
> {
  constructor(
    private readonly userPointsRepo: IUserPointsRepository,
    private readonly userScoreRepo: IUserScoreRepository,
  ) {}

  async execute(input: AddPointsInput): Promise<UserPointsOutput> {
    const userId = new Uuid(input.user_id);
    const ledgerPoints = resolveLedgerPoints(input.source, input.metadata);
    const userScore = UserScore.create({
      user_id: userId,
      score_type: scoreTypeFromPointsSource(input.source),
      points: ledgerPoints,
      reference_id: getLedgerReferenceId(input.metadata),
      description: getLedgerDescription(input.source, input.metadata),
    });

    if (userScore.notification.hasErrors()) {
      throw new EntityValidationError(userScore.notification.toJSON());
    }
    await this.userScoreRepo.insert(userScore);

    let userPoints = await this.userPointsRepo.findByUserId(input.user_id);
    const isNew = !userPoints;

    if (!userPoints) {
      // Criar novo registro de resumo de pontos para o usuário
      userPoints = UserPoints.create({
        user_id: userId,
        total_points: 0,
        total_scans: 0,
        total_requests: 0,
        total_tips: 0,
        total_social_shares: 0,
        current_level: 1,
      });
    }

    applyPointsProjection(
      userPoints,
      input.source,
      input.metadata,
      ledgerPoints,
    );

    if (userPoints.notification.hasErrors()) {
      throw new EntityValidationError(userPoints.notification.toJSON());
    }

    if (isNew) {
      await this.userPointsRepo.insert(userPoints);
    } else {
      await this.userPointsRepo.update(userPoints);
    }

    return UserPointsOutputMapper.toOutput(userPoints);
  }
}
