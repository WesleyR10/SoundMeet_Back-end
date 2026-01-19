import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";

import { GetBadgeUseCase } from "../../core/gamification/application/use-cases/get-badge/get-badge.use-case";
import { GetLeaderboardUseCase } from "../../core/gamification/application/use-cases/get-leaderboard/get-leaderboard.use-case";
import { GetUserBadgesUseCase } from "../../core/gamification/application/use-cases/get-user-badges/get-user-badges.use-case";
import { GetUserPointsUseCase } from "../../core/gamification/application/use-cases/get-user-points/get-user-points.use-case";
import { ListBadgesUseCase } from "../../core/gamification/application/use-cases/list-badges/list-badges.use-case";
import { ListRankingsUseCase } from "../../core/gamification/application/use-cases/list-rankings/list-rankings.use-case";
import { GetLeaderboardDto } from "./dto/get-leaderboard.dto";
import { ListBadgesDto } from "./dto/list-badges.dto";
import { ListRankingsDto } from "./dto/list-rankings.dto";
import {
  BadgeCollectionPresenter,
  BadgePresenter,
  RankingCollectionPresenter,
  UserBadgePresenter,
  UserPointsPresenter,
} from "./gamification.presenter";

@ApiTags("Gamification")
@Controller("gamification")
export class GamificationController {
  @Inject(GetLeaderboardUseCase)
  private getLeaderboardUseCase: GetLeaderboardUseCase;

  @Inject(GetUserPointsUseCase)
  private getUserPointsUseCase: GetUserPointsUseCase;

  @Inject(GetUserBadgesUseCase)
  private getUserBadgesUseCase: GetUserBadgesUseCase;

  @Inject(ListBadgesUseCase)
  private listBadgesUseCase: ListBadgesUseCase;

  @Inject(GetBadgeUseCase)
  private getBadgeUseCase: GetBadgeUseCase;

  @Inject(ListRankingsUseCase)
  private listRankingsUseCase: ListRankingsUseCase;

  @Get("leaderboard")
  @ApiOperation({
    summary: "Consultar leaderboard",
    description: "Retorna o ranking geral de pontos (top usuários).",
  })
  @ApiResponse({ status: 200, type: [UserPointsPresenter] })
  async leaderboard(@Query() query: GetLeaderboardDto) {
    const output = await this.getLeaderboardUseCase.execute(query);
    return output.map((i) => new UserPointsPresenter(i));
  }

  @Get("users/:user_id/points")
  @ApiOperation({
    summary: "Consultar pontos do usuário",
    description: "Retorna o resumo de pontos e nível atual do usuário.",
  })
  @ApiParam({ name: "user_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: UserPointsPresenter })
  async getUserPoints(
    @Param("user_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    user_id: string,
  ) {
    const output = await this.getUserPointsUseCase.execute({ user_id });
    return output ? new UserPointsPresenter(output) : null;
  }

  @Get("users/:user_id/badges")
  @ApiOperation({
    summary: "Consultar badges do usuário",
    description: "Retorna a lista de badges e progresso do usuário.",
  })
  @ApiParam({ name: "user_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: [UserBadgePresenter] })
  async getUserBadges(
    @Param("user_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    user_id: string,
  ) {
    const output = await this.getUserBadgesUseCase.execute({ user_id });
    return output.map((i) => new UserBadgePresenter(i));
  }

  @Get("badges")
  @ApiOperation({
    summary: "Listar badges",
    description: "Lista badges cadastrados com paginação e filtros.",
  })
  @ApiResponse({ status: 200, type: BadgeCollectionPresenter })
  async listBadges(@Query() query: ListBadgesDto) {
    const output = await this.listBadgesUseCase.execute(query);
    return new BadgeCollectionPresenter(output);
  }

  @Get("badges/:id")
  @ApiOperation({
    summary: "Buscar badge por ID",
    description: "Retorna os detalhes de um badge.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: BadgePresenter })
  async getBadge(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.getBadgeUseCase.execute({ id });
    return new BadgePresenter(output);
  }

  @Get("rankings")
  @ApiOperation({
    summary: "Listar rankings",
    description: "Lista rankings por período e tipo.",
  })
  @ApiResponse({ status: 200, type: RankingCollectionPresenter })
  async listRankings(@Query() query: ListRankingsDto) {
    const output = await this.listRankingsUseCase.execute(query);
    return new RankingCollectionPresenter(output);
  }
}
