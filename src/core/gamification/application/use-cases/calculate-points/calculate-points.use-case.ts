import {
  IUserPointsRepository,
  IUserScoreRepository,
} from "@core/gamification/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { UserPoints } from "../../../domain/user-points.aggregate";
import { UserScore } from "../../../domain/user-score.aggregate";
import { PointsSourceEnum } from "../../../domain/value-objects/points-source.vo";
import {
  applyPointsProjection,
  getLedgerDescription,
  getLedgerReferenceId,
  resolveLedgerPoints,
  scoreTypeFromPointsSource,
} from "../common/points-ledger";

export type CalculatePointsInput = {
  user_id: string;
  source: PointsSourceEnum;
  metadata?: Record<string, any>;
};

export type CalculatePointsOutput = {
  user_id: string;
  total_points: number;
  current_level: number;
};

export class CalculatePointsUseCase implements IUseCase<
  CalculatePointsInput,
  CalculatePointsOutput
> {
  constructor(
    private readonly userPointsRepo: IUserPointsRepository,
    private readonly userScoreRepo: IUserScoreRepository,
  ) {}

  async execute(input: CalculatePointsInput): Promise<CalculatePointsOutput> {
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
      userPoints = UserPoints.create({
        user_id: userId,
        total_points: 0,
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

    return {
      user_id: userPoints.user_id.id,
      total_points: userPoints.total_points,
      current_level: userPoints.current_level,
    };
  }
}
