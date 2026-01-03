import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { UserPoints } from "../../../domain/user-points.aggregate";
import { IUserPointsRepository } from "../../../domain/user-points.repository";
import { PointsSourceEnum } from "../../../domain/value-objects/points-source.vo";
import {
  UserPointsOutput,
  UserPointsOutputMapper,
} from "../common/user-points-output";
import { AddPointsInput } from "./add-points.input";

export class AddPointsUseCase implements IUseCase<
  AddPointsInput,
  UserPointsOutput
> {
  constructor(private readonly userPointsRepo: IUserPointsRepository) {}

  async execute(input: AddPointsInput): Promise<UserPointsOutput> {
    let userPoints = await this.userPointsRepo.findByUserId(input.user_id);

    if (!userPoints) {
      // Criar novo registro de pontos para o usuário
      userPoints = UserPoints.create({
        user_id: new Uuid(input.user_id),
        total_points: 0,
        total_scans: 0,
        total_requests: 0,
        total_tips: 0,
        total_social_shares: 0,
        current_level: 1,
      });
    }

    // Adicionar pontos baseado na fonte
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
      case PointsSourceEnum.ACCEPTED_REQUEST:
        userPoints.acceptedMusicRequest();
        break;
      default:
        // Para outros tipos de pontos, usar valor padrão
        userPoints.addPoints(10);
    }

    if (userPoints.notification.hasErrors()) {
      throw new EntityValidationError(userPoints.notification.toJSON());
    }

    await this.userPointsRepo.update(userPoints);

    return UserPointsOutputMapper.toOutput(userPoints);
  }
}
