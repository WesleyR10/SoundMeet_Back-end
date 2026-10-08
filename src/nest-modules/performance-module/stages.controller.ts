import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import {
  ListStagesUseCase,
  StagesWindow,
} from "../../core/performance/application/use-cases/list-stages/list-stages.use-case";
import {
  AuthGuard,
  CurrentUserContextGuard,
  Roles,
  RolesGuard,
} from "../auth-module";
import { ListStagesQueryDto } from "./dto/performance.dto";
import { StagesPresenter } from "./performance.presenter";

/**
 * Os palcos da noite — a leitura que alimenta a Home do fã.
 *
 * ## Por que `/events/...` e mora no `performance-module`
 *
 * Para quem consome, é uma pergunta sobre EVENTOS ("o que está rolando?").
 * Para responder, precisa juntar eventos, casas, músicos, bandas e sets — e
 * só o `PerformanceModule`, nó-folha, enxerga os cinco sem fechar ciclo de
 * import. O `EventsDiscoveryController` (`GET /events`) só declara `@Get()`,
 * então as rotas literais daqui não disputam casamento com nada.
 *
 * ## Autenticada, não `@Public()`
 *
 * O cartaz carrega "quem está tocando o quê, onde, agora" de todo o país numa
 * resposta só — `@Public()` a transformaria num feed raspável. Quem abre a
 * Home do app já tem sessão.
 */
@ApiTags("Events")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("events")
export class StagesController {
  @Inject(ListStagesUseCase)
  private listStagesUseCase: ListStagesUseCase;

  @Get("live-now")
  @Roles("audience", "musician", "establishment", "admin")
  @ApiOperation({
    summary: "Palcos acesos agora",
    description:
      "Shows públicos em andamento pelo RELÓGIO (início ≤ agora < fim), com casa, line-up confirmado e a música do momento de cada ato com set aberto. Palco tocando vem primeiro, depois o mais perto (com lat/lng/radius_km), depois o mais cheio. Sem cachê, sem set inteiro, sem dedicatória.",
  })
  @ApiResponse({ status: 200, type: StagesPresenter })
  async liveNow(@Query() query: ListStagesQueryDto) {
    return this.list("live", query);
  }

  @Get("up-next")
  @Roles("audience", "musician", "establishment", "admin")
  @ApiOperation({
    summary: "Próximos palcos (7 dias)",
    description:
      "Shows públicos que começam depois de agora e nos próximos 7 dias, em ordem de horário, com casa e line-up confirmado.",
  })
  @ApiResponse({ status: 200, type: StagesPresenter })
  async upNext(@Query() query: ListStagesQueryDto) {
    return this.list("upcoming", query);
  }

  private async list(window: StagesWindow, query: ListStagesQueryDto) {
    return new StagesPresenter(
      await this.listStagesUseCase.execute({
        window,
        lat: query.lat,
        lng: query.lng,
        radius_km: query.radius_km,
        limit: query.limit,
      }),
    );
  }
}
