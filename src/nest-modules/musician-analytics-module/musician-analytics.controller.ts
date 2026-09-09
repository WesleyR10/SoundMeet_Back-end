import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { GetMusicianAnalyticsUseCase } from "../../core/musician/application/use-cases/get-musician-analytics/get-musician-analytics.use-case";
import {
  AuthGuard,
  CurrentUserContextGuard,
  MusicianOwnershipGuard,
  Roles,
  RolesGuard,
} from "../auth-module";

@ApiTags("Musicians")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("musicians")
export class MusicianAnalyticsController {
  @Inject(GetMusicianAnalyticsUseCase)
  private getMusicianAnalyticsUseCase: GetMusicianAnalyticsUseCase;

  @Get(":id/analytics")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Analytics do músico",
    description:
      "Retorna dados analíticos do músico (nota média, pedidos aceitos/rejeitados, total de gorjetas recebidas, músicas mais pedidas — todos all-time/global, sem escopo por evento). Exige ESSENTIAL ou PRO: o plano FREE recebe 402 (gate 9.7a).",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200 })
  @ApiResponse({
    status: 402,
    description:
      "Plano FREE — `realtime_analytics` exige ESSENTIAL ou PRO (gate 9.7a).",
  })
  async getAnalytics(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    return this.getMusicianAnalyticsUseCase.execute({ musician_id: id });
  }
}
