import { IUserPointsRepository } from "@core/gamification/domain";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { UserPoints } from "../../../domain/user-points.aggregate";
import { PointsSourceEnum } from "../../../domain/value-objects/points-source.vo";

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

export class CalculatePointsUseCase
  implements IUseCase<CalculatePointsInput, CalculatePointsOutput>
{
  constructor(private readonly userPointsRepo: IUserPointsRepository) {}

  async execute(input: CalculatePointsInput): Promise<CalculatePointsOutput> {
    let userPoints = await this.userPointsRepo.findByUserId(input.user_id);

    if (!userPoints) {
      userPoints = UserPoints.create({
        user_id: input.user_id,
        total_points: 0,
        current_level: 1,
      });
      await this.userPointsRepo.insert(userPoints);
    }

    switch (input.source) {
      case PointsSourceEnum.SCAN_QR:
        userPoints.scanQr();
        break;
      case PointsSourceEnum.REQUEST:
        userPoints.makeMusicRequest();
        break;
      case PointsSourceEnum.TIP:
        userPoints.sendTip(input.metadata?.amount || 0);
        break;
      case PointsSourceEnum.SOCIAL_SHARE:
        userPoints.shareOnSocial();
        break;
      default:
        userPoints.addPoints(10);
    }

    await this.userPointsRepo.update(userPoints);

    return {
      user_id: userPoints.user_id.id,
      total_points: userPoints.total_points,
      current_level: userPoints.current_level,
    };
  }
}
