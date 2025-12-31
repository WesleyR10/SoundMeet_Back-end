import { IUseCase } from "../../../../shared/application/use-case.interface";
import { Ranking } from "../../../domain/ranking.aggregate";
import { IRankingRepository } from "../../../domain/ranking.repository";
import { IUserScoreRepository } from "../../../domain/user-score.repository";
import {
  RankingPeriodEnum,
  RankingTypeEnum,
} from "../../../domain/value-objects/ranking-type.vo";
import { RankingOutput, RankingOutputMapper } from "../common/ranking-output";
import { CalculateRankingInput } from "./calculate-ranking.input";

function startEndOfMonth(month: number, year: number) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  return { start, end };
}

export class CalculateRankingUseCase implements IUseCase<
  CalculateRankingInput,
  RankingOutput[]
> {
  constructor(
    private readonly rankingRepo: IRankingRepository,
    private readonly userScoreRepo: IUserScoreRepository,
  ) {}

  async execute(input: CalculateRankingInput): Promise<RankingOutput[]> {
    const today = new Date();
    const month = input.month ?? today.getUTCMonth() + 1; // 1-12
    const year = input.year ?? today.getUTCFullYear();
    const { start, end } = startEndOfMonth(month, year);

    // Coletar todos os UserScores e filtrar pelo período
    const allScores = await this.userScoreRepo.findAll();
    const periodScores = allScores.filter(
      (s) => s.created_at >= start && s.created_at <= end,
    );

    // Agregar por usuário conforme o tipo de ranking
    const totalsByUser = new Map<string, number>();

    const accumulate = (userId: string, points: number) => {
      totalsByUser.set(userId, (totalsByUser.get(userId) ?? 0) + points);
    };

    for (const score of periodScores) {
      const userId = (score.user_id as any).id ?? score.user_id;
      switch (input.type) {
        case RankingTypeEnum.TOP_FAS:
          // Soma todos os pontos do período
          accumulate(userId, score.points);
          break;
        case RankingTypeEnum.TOP_APOIADORES:
          // Considera apenas pontos provenientes de TIP_GIVEN
          if (
            String(score.score_type?.value ?? score.score_type) === "tip_given"
          ) {
            accumulate(userId, score.points);
          }
          break;
        case RankingTypeEnum.TOP_SUGESTOES:
          // Considera REQUEST_SENT e REQUEST_ACCEPTED
          if (
            ["request_sent", "request_accepted"].includes(
              String(score.score_type?.value ?? score.score_type),
            )
          ) {
            accumulate(userId, score.points);
          }
          break;
        default:
          // Outros tipos podem ser expandidos futuramente
          accumulate(userId, score.points);
          break;
      }
    }

    // Ordenar e criar entidades Ranking
    const sorted = Array.from(totalsByUser.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([user_id, total], index) => ({
        user_id,
        total,
        position: index + 1,
      }));

    const entities: Ranking[] = sorted.map((row) =>
      Ranking.create({
        user_id: row.user_id,
        ranking_type: input.type,
        period: input.period ?? RankingPeriodEnum.MONTHLY,
        position: row.position,
        score: row.total,
        period_start: start,
        period_end: end,
      }),
    );

    // Persistir
    if (entities.length) {
      await this.rankingRepo.bulkInsert(entities);
    }

    return entities.map(RankingOutputMapper.toOutput);
  }
}
