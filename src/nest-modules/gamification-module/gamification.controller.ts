import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { AwardBadgeUseCase } from "../../core/gamification/application/use-cases/award-badge/award-badge.use-case";
import { CreateBadgeUseCase } from "../../core/gamification/application/use-cases/create-badge/create-badge.use-case";
import { DeleteBadgeUseCase } from "../../core/gamification/application/use-cases/delete-badge/delete-badge.use-case";
import { GetBadgeUseCase } from "../../core/gamification/application/use-cases/get-badge/get-badge.use-case";
import { GetLeaderboardUseCase } from "../../core/gamification/application/use-cases/get-leaderboard/get-leaderboard.use-case";
import { GetUserBadgesUseCase } from "../../core/gamification/application/use-cases/get-user-badges/get-user-badges.use-case";
import { GetUserPointsUseCase } from "../../core/gamification/application/use-cases/get-user-points/get-user-points.use-case";
import { ListBadgesUseCase } from "../../core/gamification/application/use-cases/list-badges/list-badges.use-case";
import { ListRankingsUseCase } from "../../core/gamification/application/use-cases/list-rankings/list-rankings.use-case";
import { UpdateBadgeUseCase } from "../../core/gamification/application/use-cases/update-badge/update-badge.use-case";
import {
  AuthGuard,
  AuthenticatedUser,
  CurrentUser,
  CurrentUserContextGuard,
  Public,
  Roles,
  RolesGuard,
} from "../auth-module";
import { AwardBadgeDto } from "./dto/award-badge.dto";
import { CreateBadgeDto } from "./dto/create-badge.dto";
import { GetLeaderboardDto } from "./dto/get-leaderboard.dto";
import { ListBadgesDto } from "./dto/list-badges.dto";
import { ListRankingsDto } from "./dto/list-rankings.dto";
import { UpdateBadgeDto } from "./dto/update-badge.dto";
import {
  BadgeCollectionPresenter,
  BadgePresenter,
  RankingCollectionPresenter,
  UserBadgePresenter,
  UserPointsPresenter,
} from "./gamification.presenter";

@ApiTags("Gamification")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Roles("audience", "musician", "establishment", "admin")
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

  @Inject(CreateBadgeUseCase)
  private createBadgeUseCase: CreateBadgeUseCase;

  @Inject(UpdateBadgeUseCase)
  private updateBadgeUseCase: UpdateBadgeUseCase;

  @Inject(DeleteBadgeUseCase)
  private deleteBadgeUseCase: DeleteBadgeUseCase;

  @Inject(AwardBadgeUseCase)
  private awardBadgeUseCase: AwardBadgeUseCase;

  @Get("leaderboard")
  @Public()
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
    description: "Retorna o resumo de pontos e nível atual do usuário. Requer autenticação; usuário só pode consultar os próprios pontos (admin pode consultar qualquer um).",
  })
  @ApiParam({ name: "user_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: UserPointsPresenter })
  @ApiResponse({ status: 403, description: "Acesso negado" })
  async getUserPoints(
    @Param("user_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    user_id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    if (!currentUser.isAdmin && currentUser.userId !== user_id) {
      throw new ForbiddenException(
        "Você só pode consultar seus próprios pontos.",
      );
    }
    const output = await this.getUserPointsUseCase.execute({ user_id });
    return output ? new UserPointsPresenter(output) : null;
  }

  @Get("users/:user_id/badges")
  @ApiOperation({
    summary: "Consultar badges do usuário",
    description: "Retorna a lista de badges e progresso do usuário. Requer autenticação; usuário só pode consultar os próprios badges (admin pode consultar qualquer um).",
  })
  @ApiParam({ name: "user_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: [UserBadgePresenter] })
  @ApiResponse({ status: 403, description: "Acesso negado" })
  async getUserBadges(
    @Param("user_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    user_id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    if (!currentUser.isAdmin && currentUser.userId !== user_id) {
      throw new ForbiddenException(
        "Você só pode consultar seus próprios badges.",
      );
    }
    const output = await this.getUserBadgesUseCase.execute({ user_id });
    return output.map((i) => new UserBadgePresenter(i));
  }

  @Get("badges")
  @Public()
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
  @Public()
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
  @Public()
  @ApiOperation({
    summary: "Listar rankings",
    description: "Lista rankings por período e tipo.",
  })
  @ApiResponse({ status: 200, type: RankingCollectionPresenter })
  async listRankings(@Query() query: ListRankingsDto) {
    const output = await this.listRankingsUseCase.execute(query);
    return new RankingCollectionPresenter(output);
  }

  // ── Admin endpoints ──────────────────────────────────────────────────

  @Post("badges")
  @Roles("admin")
  @ApiOperation({
    summary: "[Admin] Criar badge",
    description: "Cria um novo badge no catálogo. Requer role admin.",
  })
  @ApiResponse({ status: 201, type: BadgePresenter })
  @ApiResponse({ status: 403, description: "Acesso negado" })
  async createBadge(@Body() dto: CreateBadgeDto) {
    const output = await this.createBadgeUseCase.execute(dto);
    return new BadgePresenter(output);
  }

  @Patch("badges/:id")
  @Roles("admin")
  @ApiOperation({
    summary: "[Admin] Atualizar badge",
    description: "Atualiza campos de um badge existente. Requer role admin.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: BadgePresenter })
  @ApiResponse({ status: 403, description: "Acesso negado" })
  @ApiResponse({ status: 404, description: "Badge não encontrado" })
  async updateBadge(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: UpdateBadgeDto,
  ) {
    const output = await this.updateBadgeUseCase.execute({ ...dto, id });
    return new BadgePresenter(output);
  }

  @Delete("badges/:id")
  @Roles("admin")
  @HttpCode(204)
  @ApiOperation({
    summary: "[Admin] Remover badge",
    description: "Remove um badge do catálogo. Requer role admin.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 204, description: "Badge removido" })
  @ApiResponse({ status: 403, description: "Acesso negado" })
  @ApiResponse({ status: 404, description: "Badge não encontrado" })
  async deleteBadge(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    await this.deleteBadgeUseCase.execute({ id });
  }

  @Post("users/:user_id/badges")
  @Roles("admin")
  @ApiOperation({
    summary: "[Admin] Conceder badge manualmente",
    description: "Concede um badge a um usuário de forma manual. Requer role admin.",
  })
  @ApiParam({ name: "user_id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: UserBadgePresenter })
  @ApiResponse({ status: 403, description: "Acesso negado" })
  @ApiResponse({ status: 409, description: "Usuário já possui este badge" })
  async awardBadge(
    @Param("user_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    user_id: string,
    @Body() dto: AwardBadgeDto,
  ) {
    const output = await this.awardBadgeUseCase.execute({ ...dto, user_id });
    return new UserBadgePresenter(output);
  }
}
