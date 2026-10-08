import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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

import { FollowTargetUseCase } from "../../core/follow/application/use-cases/follow-target/follow-target.use-case";
import { ListMyFollowsUseCase } from "../../core/follow/application/use-cases/list-my-follows/list-my-follows.use-case";
import { ToggleFollowNotificationsUseCase } from "../../core/follow/application/use-cases/toggle-follow-notifications/toggle-follow-notifications.use-case";
import { UnfollowTargetUseCase } from "../../core/follow/application/use-cases/unfollow-target/unfollow-target.use-case";
import {
  AudienceOwnershipGuard,
  AuthGuard,
  CurrentUserContextGuard,
  OwnershipParam,
  Roles,
  RolesGuard,
} from "../auth-module";
import { FollowTargetDto } from "./dto/follow-target.dto";
import { ListFollowsDto } from "./dto/list-follows.dto";
import { ToggleFollowNotificationsDto } from "./dto/toggle-follow-notifications.dto";
import {
  FollowCollectionPresenter,
  FollowPresenter,
} from "./follows.presenter";

/**
 * Quem o fã segue — músicos e casas, para saber dos próximos shows.
 *
 * 🔴 **`:audience_id` + `:follow_id`, nunca `:id`.** Um `:id` de sub-recurso
 * colide com o fallback do ownership guard (armadilha paga em
 * `personal-chord-sheet`). E o guard prova quem é o fã da URL, nunca de quem é
 * o vínculo: a posse do `follow_id` é conferida DENTRO do use-case.
 */
@ApiTags("Follows")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("audiences")
export class AudienceFollowsController {
  constructor(
    private readonly followUseCase: FollowTargetUseCase,
    private readonly unfollowUseCase: UnfollowTargetUseCase,
    private readonly listUseCase: ListMyFollowsUseCase,
    private readonly toggleUseCase: ToggleFollowNotificationsUseCase,
  ) {}

  @Get(":audience_id/follows")
  @Roles("audience", "admin")
  @UseGuards(AudienceOwnershipGuard)
  @OwnershipParam({ param: "audience_id" })
  @ApiOperation({
    summary: "Quem o fã segue",
    description: "Lista com nome e foto de cada alvo.",
  })
  @ApiParam({ name: "audience_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: FollowCollectionPresenter })
  async list(
    @Param("audience_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    audienceId: string,
    @Query() query: ListFollowsDto,
  ) {
    const output = await this.listUseCase.execute({
      ...query,
      // 🔴 Depois do spread: o escopo do dono não pode vir da query.
      audience_id: audienceId,
    });
    return new FollowCollectionPresenter(output);
  }

  @Post(":audience_id/follows")
  @Roles("audience", "admin")
  @UseGuards(AudienceOwnershipGuard)
  @OwnershipParam({ param: "audience_id" })
  @ApiOperation({
    summary: "Seguir músico ou casa",
    description:
      "Idempotente: seguir de novo devolve o vínculo existente. Músico só pode ser seguido se estiver aberto a contratações (mesma regra da busca).",
  })
  @ApiParam({ name: "audience_id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: FollowPresenter })
  async follow(
    @Param("audience_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    audienceId: string,
    @Body() dto: FollowTargetDto,
  ) {
    const output = await this.followUseCase.execute({
      ...dto,
      audience_id: audienceId,
    });
    return new FollowPresenter(output);
  }

  @Patch(":audience_id/follows/:follow_id/notifications")
  @Roles("audience", "admin")
  @UseGuards(AudienceOwnershipGuard)
  @OwnershipParam({ param: "audience_id" })
  @ApiOperation({ summary: "Ligar/desligar avisos de um vínculo" })
  @ApiParam({ name: "audience_id", required: true, format: "uuid" })
  @ApiParam({ name: "follow_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: FollowPresenter })
  async toggleNotifications(
    @Param("audience_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    audienceId: string,
    @Param("follow_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    followId: string,
    @Body() dto: ToggleFollowNotificationsDto,
  ) {
    const output = await this.toggleUseCase.execute({
      audience_id: audienceId,
      follow_id: followId,
      enabled: dto.enabled,
    });
    return new FollowPresenter(output);
  }

  @Delete(":audience_id/follows/:follow_id")
  @Roles("audience", "admin")
  @UseGuards(AudienceOwnershipGuard)
  @OwnershipParam({ param: "audience_id" })
  @HttpCode(204)
  @ApiOperation({ summary: "Deixar de seguir" })
  @ApiParam({ name: "audience_id", required: true, format: "uuid" })
  @ApiParam({ name: "follow_id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async unfollow(
    @Param("audience_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    audienceId: string,
    @Param("follow_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    followId: string,
  ) {
    await this.unfollowUseCase.execute({
      audience_id: audienceId,
      follow_id: followId,
    });
  }
}
