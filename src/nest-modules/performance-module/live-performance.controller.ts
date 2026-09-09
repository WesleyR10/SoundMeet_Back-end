import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { GetLivePerformanceUseCase } from "../../core/performance/application/use-cases/get-live-performance/get-live-performance.use-case";
import {
  AuthGuard,
  CurrentUserContextGuard,
  Roles,
  RolesGuard,
} from "../auth-module";
import { GetLivePerformanceQueryDto } from "./dto/performance.dto";
import { LivePerformancePresenter } from "./performance.presenter";

/**
 * "Tocando agora" — o lado do FÃ.
 *
 * ## Controller separado, de propósito
 *
 * `PerformanceController` é todo `@Roles("musician")` e trata de escrita.
 * Misturar aqui a única rota que `audience` pode chamar é como deixar um
 * `@Public()` solto numa classe com guards: funciona hoje e vaza na próxima
 * rota que alguém adicionar no lugar errado.
 *
 * ## `live` é rota literal, não `:performance_id`
 *
 * Por isso ela mora aqui, onde não existe rota paramétrica que a capture. No
 * outro controller, `@Get(":performance_id")` engoliria `live`, o
 * `ParseUUIDPipe` responderia 422 e a feature do fã simplesmente não
 * existiria — a mesma ordem que o `contract-module` documenta.
 *
 * ## Por que polling e não socket
 *
 * Uma música dura minutos; 20 segundos de defasagem é imperceptível. Um push
 * exigiria uma room `event:${id}` no `NotificationsGateway`, que hoje só entra
 * em rooms derivadas de claims do JWT — uma room que o cliente pede para entrar
 * é superfície de autorização nova, para ganhar segundos que ninguém percebe.
 */
@ApiTags("Performances")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("performances")
export class LivePerformanceController {
  @Inject(GetLivePerformanceUseCase)
  private getLiveUseCase: GetLivePerformanceUseCase;

  @Get("live")
  @Roles("audience", "musician", "establishment", "admin")
  @ApiOperation({
    summary: "O que o músico está tocando agora",
    description:
      "Devolve UMA música — a do momento. Nunca o set inteiro: o repertório é o diferencial que o músico monta, e entregá-lo a qualquer pessoa com o app aberto o daria de graça. Sem set aberto responde `is_live: false`, não 404: ninguém tocando é estado legítimo (intervalo, show que não começou), e um erro no caminho feliz piscaria falha na tela do fã.",
  })
  @ApiResponse({ status: 200, type: LivePerformancePresenter })
  async live(@Query() query: GetLivePerformanceQueryDto) {
    return new LivePerformancePresenter(
      await this.getLiveUseCase.execute({
        musician_id: query.musician_id,
        event_id: query.event_id,
      }),
    );
  }
}
