import { IUseCase } from "../../../../shared/application/use-case.interface";
import { PeriodType } from "../../../domain/ranking.aggregate";
import { IRankingRepository } from "../../../domain/ranking.repository";
import { RankingOutput, RankingOutputMapper } from "../common/ranking-output";

export class GetRankingUseCase implements IUseCase<
  GetRankingInput,
  GetRankingOutput
> {
  constructor(private readonly rankingRepo: IRankingRepository) {}

  async execute(input: GetRankingInput): Promise<GetRankingOutput> {
    let rankings;

    if (input.user_id) {
      // Buscar ranking específico do usuário
      const ranking = await this.rankingRepo.findByUserAndEstablishment(
        input.user_id,
        input.establishment_id,
        input.period_type,
      );
      rankings = ranking ? [ranking] : [];
    } else {
      // Buscar top rankings
      rankings = await this.rankingRepo.findTopRankings(
        input.establishment_id,
        input.period_type,
        input.limit || 10,
      );
    }

    return rankings.map((ranking) => RankingOutputMapper.toOutput(ranking));
  }
}

export type GetRankingInput = {
  establishment_id: string;
  period_type: PeriodType;
  limit?: number;
  user_id?: string;
};

export type GetRankingOutput = RankingOutput[];
