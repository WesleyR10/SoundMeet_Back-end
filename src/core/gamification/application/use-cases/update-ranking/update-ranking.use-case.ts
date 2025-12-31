import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Ranking } from "../../../domain/ranking.aggregate";
import { IRankingRepository } from "../../../domain/ranking.repository";
import { RankingId } from "../../../domain/value-objects/gamification-id.vo";
import { RankingOutput, RankingOutputMapper } from "../common/ranking-output";
import { UpdateRankingInput } from "./update-ranking.input";

export class UpdateRankingUseCase implements IUseCase<
  UpdateRankingInput,
  RankingOutput
> {
  constructor(private readonly rankingRepo: IRankingRepository) {}

  async execute(input: UpdateRankingInput): Promise<RankingOutput> {
    const rankingId = new RankingId(input.id);
    const entity = await this.rankingRepo.findById(rankingId);

    if (!entity) {
      throw new NotFoundError(input.id, Ranking);
    }

    if (input.position !== undefined) {
      entity.updatePosition(input.position);
    }

    if (input.score !== undefined) {
      entity.updateScore(input.score);
    }

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.rankingRepo.update(entity);

    return RankingOutputMapper.toOutput(entity);
  }
}
