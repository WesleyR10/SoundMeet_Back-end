import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { GetFollowSummaryUseCase } from "../../core/follow/application/use-cases/get-follow-summary/get-follow-summary.use-case";
import {
  AuthenticatedUser,
  AuthGuard,
  CurrentUser,
  CurrentUserContextGuard,
} from "../auth-module";
import { FollowTargetDto } from "./dto/follow-target.dto";
import { FollowSummaryPresenter } from "./follows.presenter";

/**
 * Contador de seguidores + "eu sigo?". Autenticada para todos os papéis: o
 * músico vê o próprio contador; o fã, o estado do botão.
 *
 * Controller separado de `AudienceFollowsController` porque aqui não há
 * `:audience_id` no path — quem pergunta vem do JWT, e só é usado quando é
 * um fã.
 */
@ApiTags("Follows")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, CurrentUserContextGuard)
@Controller("follows")
export class FollowsSummaryController {
  constructor(private readonly summaryUseCase: GetFollowSummaryUseCase) {}

  @Get("summary")
  @ApiOperation({
    summary: "Seguidores de um músico ou casa",
    description: "Só a contagem — a lista de quem segue não é exposta.",
  })
  @ApiResponse({ status: 200, type: FollowSummaryPresenter })
  async summary(
    @Query() query: FollowTargetDto,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const output = await this.summaryUseCase.execute({
      target_type: query.target_type,
      target_id: query.target_id,
      audience_id: currentUser?.roles.includes("audience")
        ? currentUser.userId
        : null,
    });
    return new FollowSummaryPresenter(output);
  }
}
