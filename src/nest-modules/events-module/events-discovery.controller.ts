import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { ListEventsUseCase } from "../../core/events/application/use-cases/list-events/list-events.use-case";
import {
  AuthGuard,
  CurrentUserContextGuard,
  Public,
  RolesGuard,
} from "../auth-module";
import { SearchEventsDto } from "./dto/search-events.dto";
import { EventCollectionPresenter } from "./event.presenter";

// Descoberta cross-establishment (7.13b) — GET /events, distinto da rota
// aninhada establishments/:id/events (EventsController). Sem establishment_id
// pinado, ListEventsUseCase força is_public: true internamente.
@ApiTags("Events")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("events")
export class EventsDiscoveryController {
  @Inject(ListEventsUseCase)
  private listEventsUseCase: ListEventsUseCase;

  @Get()
  @Public()
  @ApiOperation({
    summary: "Buscar eventos por proximidade",
    description:
      "Lista eventos públicos cross-establishment com filtro geográfico (lat, lng, radius_km) e por data (date_gte/date_lte para 'hoje à noite').",
  })
  @ApiResponse({ status: 200, type: EventCollectionPresenter })
  async findAll(@Query() query: SearchEventsDto) {
    const output = await this.listEventsUseCase.execute({
      page: query.page,
      per_page: query.per_page,
      sort: query.sort,
      sort_dir: query.sort_dir,
      filter: query.filter,
    });
    return new EventCollectionPresenter(output);
  }
}
