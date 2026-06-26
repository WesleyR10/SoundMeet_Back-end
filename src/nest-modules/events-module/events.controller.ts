import {
  Body,
  Controller,
  Delete,
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

import { ActivateEventUseCase } from "../../core/events/application/use-cases/activate-event/activate-event.use-case";
import { AddEventAttendeeUseCase } from "../../core/events/application/use-cases/add-event-attendee/add-event-attendee.use-case";
import { AddEventPerformerUseCase } from "../../core/events/application/use-cases/add-event-performer/add-event-performer.use-case";
import { CancelEventUseCase } from "../../core/events/application/use-cases/cancel-event/cancel-event.use-case";
import { CreateEventInput } from "../../core/events/application/use-cases/create-event/create-event.input";
import { CreateEventUseCase } from "../../core/events/application/use-cases/create-event/create-event.use-case";
import { DeleteEventUseCase } from "../../core/events/application/use-cases/delete-event/delete-event.use-case";
import { FinishEventUseCase } from "../../core/events/application/use-cases/finish-event/finish-event.use-case";
import { GetEventUseCase } from "../../core/events/application/use-cases/get-event/get-event.use-case";
import { ListEventAttendeesUseCase } from "../../core/events/application/use-cases/list-event-attendees/list-event-attendees.use-case";
import { ListEventMusiciansUseCase } from "../../core/events/application/use-cases/list-event-musicians/list-event-musicians.use-case";
import { ListEventsUseCase } from "../../core/events/application/use-cases/list-events/list-events.use-case";
import { RemoveEventAttendeeUseCase } from "../../core/events/application/use-cases/remove-event-attendee/remove-event-attendee.use-case";
import { RemoveEventPerformerUseCase } from "../../core/events/application/use-cases/remove-event-performer/remove-event-performer.use-case";
import { UpdateEventMusicianStatusUseCase } from "../../core/events/application/use-cases/update-event-musician-status/update-event-musician-status.use-case";
import { UpdateEventInput } from "../../core/events/application/use-cases/update-event/update-event.input";
import { UpdateEventUseCase } from "../../core/events/application/use-cases/update-event/update-event.use-case";
import {
  AuthGuard,
  AuthenticatedUser,
  CurrentUser,
  CurrentUserContextGuard,
  EstablishmentOwnershipGuard,
  Public,
  Roles,
  RolesGuard,
} from "../auth-module";
import { AddEventAttendeeDto } from "./dto/add-event-attendee.dto";
import { AddEventPerformerDto } from "./dto/add-event-performer.dto";
import { CreateEventDto } from "./dto/create-event.dto";
import { SearchEventsDto } from "./dto/search-events.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { UpdateEventMusicianStatusDto } from "./dto/update-event-musician-status.dto";
import {
  EventAttendeeCollectionPresenter,
  EventCollectionPresenter,
  EventMusicianCollectionPresenter,
  EventMusicianPresenter,
  EventPresenter,
} from "./event.presenter";

@ApiTags("Events")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("establishments/:id/events")
export class EventsController {
  @Inject(CreateEventUseCase)
  private createEventUseCase: CreateEventUseCase;

  @Inject(UpdateEventUseCase)
  private updateEventUseCase: UpdateEventUseCase;

  @Inject(GetEventUseCase)
  private getEventUseCase: GetEventUseCase;

  @Inject(ListEventsUseCase)
  private listEventsUseCase: ListEventsUseCase;

  @Inject(DeleteEventUseCase)
  private deleteEventUseCase: DeleteEventUseCase;

  @Inject(ActivateEventUseCase)
  private activateEventUseCase: ActivateEventUseCase;

  @Inject(CancelEventUseCase)
  private cancelEventUseCase: CancelEventUseCase;

  @Inject(FinishEventUseCase)
  private finishEventUseCase: FinishEventUseCase;

  @Inject(AddEventAttendeeUseCase)
  private addEventAttendeeUseCase: AddEventAttendeeUseCase;

  @Inject(RemoveEventAttendeeUseCase)
  private removeEventAttendeeUseCase: RemoveEventAttendeeUseCase;

  @Inject(AddEventPerformerUseCase)
  private addEventPerformerUseCase: AddEventPerformerUseCase;

  @Inject(RemoveEventPerformerUseCase)
  private removeEventPerformerUseCase: RemoveEventPerformerUseCase;

  @Inject(ListEventAttendeesUseCase)
  private listEventAttendeesUseCase: ListEventAttendeesUseCase;

  @Inject(ListEventMusiciansUseCase)
  private listEventMusiciansUseCase: ListEventMusiciansUseCase;

  @Inject(UpdateEventMusicianStatusUseCase)
  private updateEventMusicianStatusUseCase: UpdateEventMusicianStatusUseCase;

  @Post()
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Criar evento",
    description: "Cria um evento para o estabelecimento.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: EventPresenter })
  async createEvent(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: CreateEventDto,
  ) {
    const output = await this.createEventUseCase.execute(
      new CreateEventInput({
        establishment_id: id,
        name: dto.name,
        description: dto.description,
        start_at: dto.start_at,
        end_at: dto.end_at,
        max_capacity: dto.max_capacity,
        is_public: dto.is_public,
        cover_charge: dto.cover_charge,
      }),
    );
    return new EventPresenter(output);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: "Listar eventos do estabelecimento",
    description:
      "Lista eventos do estabelecimento com paginação, ordenação e filtros.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EventCollectionPresenter })
  async listEvents(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Query() query: SearchEventsDto,
  ) {
    const output = await this.listEventsUseCase.execute({
      establishment_id: id,
      page: query.page,
      per_page: query.per_page,
      sort: query.sort,
      sort_dir: query.sort_dir,
      filter: query.filter,
    });
    return new EventCollectionPresenter(output);
  }

  @Get(":event_id")
  @Public()
  @ApiOperation({
    summary: "Buscar evento por ID",
    description: "Retorna os detalhes do evento do estabelecimento.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiParam({ name: "event_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EventPresenter })
  async getEvent(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Param("event_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    event_id: string,
  ) {
    const output = await this.getEventUseCase.execute({
      establishment_id: id,
      event_id,
    });
    return new EventPresenter(output);
  }

  @Patch(":event_id")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Atualizar evento",
    description: "Atualiza dados do evento.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiParam({ name: "event_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EventPresenter })
  async updateEvent(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Param("event_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    event_id: string,
    @Body() dto: UpdateEventDto,
  ) {
    const output = await this.updateEventUseCase.execute(
      new UpdateEventInput({
        id: event_id,
        establishment_id: id,
        name: dto.name,
        description: dto.description,
        start_at: dto.start_at,
        end_at: dto.end_at,
        max_capacity: dto.max_capacity,
        is_public: dto.is_public,
        cover_charge: dto.cover_charge,
      }),
    );
    return new EventPresenter(output);
  }

  @HttpCode(204)
  @Delete(":event_id")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Remover evento",
    description: "Remove o evento.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiParam({ name: "event_id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async deleteEvent(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Param("event_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    event_id: string,
  ) {
    await this.deleteEventUseCase.execute({
      establishment_id: id,
      event_id,
    });
  }

  @Post(":event_id/activate")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Ativar evento",
    description: "Ativa um evento (scheduled -> active).",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiParam({ name: "event_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EventPresenter })
  async activateEvent(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Param("event_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    event_id: string,
  ) {
    const output = await this.activateEventUseCase.execute({
      establishment_id: id,
      event_id,
    });
    return new EventPresenter(output);
  }

  @Post(":event_id/cancel")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Cancelar evento",
    description: "Cancela um evento.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiParam({ name: "event_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EventPresenter })
  async cancelEvent(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Param("event_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    event_id: string,
  ) {
    const output = await this.cancelEventUseCase.execute({
      establishment_id: id,
      event_id,
    });
    return new EventPresenter(output);
  }

  @Post(":event_id/finish")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Finalizar evento",
    description: "Finaliza um evento (active -> completed).",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiParam({ name: "event_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EventPresenter })
  async finishEvent(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Param("event_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    event_id: string,
  ) {
    const output = await this.finishEventUseCase.execute({
      establishment_id: id,
      event_id,
    });
    return new EventPresenter(output);
  }

  @Post(":event_id/attendees")
  @Roles("audience", "establishment", "admin")
  @ApiOperation({
    summary: "Adicionar attendee",
    description:
      "Registra presença. Audiences são registrados pelo próprio JWT; establishment/admin podem especificar audience_id no body.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiParam({ name: "event_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EventPresenter })
  async addAttendee(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Param("event_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    event_id: string,
    @Body() dto: AddEventAttendeeDto,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const audienceId =
      currentUser?.roles.includes("audience")
        ? currentUser.userId
        : (dto.audience_id ?? "");
    const output = await this.addEventAttendeeUseCase.execute({
      establishment_id: id,
      event_id,
      audience_id: audienceId,
    });
    return new EventPresenter(output);
  }

  @Delete(":event_id/attendees/:audience_id")
  @Roles("audience", "establishment", "admin")
  @ApiOperation({
    summary: "Remover attendee",
    description:
      "Remove presença. Audiences só podem remover a si mesmos (audience_id do URL é ignorado e substituído pelo JWT).",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiParam({ name: "event_id", required: true, format: "uuid" })
  @ApiParam({ name: "audience_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EventPresenter })
  async removeAttendee(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Param("event_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    event_id: string,
    @Param("audience_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    audience_id: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const resolvedAudienceId =
      currentUser?.roles.includes("audience")
        ? currentUser.userId
        : audience_id;
    const output = await this.removeEventAttendeeUseCase.execute({
      establishment_id: id,
      event_id,
      audience_id: resolvedAudienceId,
    });
    return new EventPresenter(output);
  }

  @HttpCode(204)
  @Post(":event_id/performers")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Adicionar performer",
    description: "Adiciona músico/banda no evento.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiParam({ name: "event_id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async addPerformer(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Param("event_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    event_id: string,
    @Body() dto: AddEventPerformerDto,
  ) {
    await this.addEventPerformerUseCase.execute({
      establishment_id: id,
      event_id,
      musician_id: dto.musician_id,
      band_id: dto.band_id,
      fee: dto.fee,
      status: dto.status,
      start_at: dto.start_at,
      end_at: dto.end_at,
    });
  }

  @HttpCode(204)
  @Delete(":event_id/performers/:event_musician_id")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Remover performer",
    description: "Remove músico/banda do evento.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiParam({ name: "event_id", required: true, format: "uuid" })
  @ApiParam({ name: "event_musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async removePerformer(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Param("event_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    event_id: string,
    @Param("event_musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    event_musician_id: string,
  ) {
    await this.removeEventPerformerUseCase.execute({
      establishment_id: id,
      event_id,
      event_musician_id,
    });
  }

  @Get(":event_id/attendees")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Listar attendees do evento",
    description: "Lista todos os participantes registrados no evento.",
  })
  @ApiResponse({ status: 403, description: "Acesso negado" })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiParam({ name: "event_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EventAttendeeCollectionPresenter })
  async listAttendees(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Param("event_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    event_id: string,
    @Query() query: SearchEventsDto,
  ) {
    const output = await this.listEventAttendeesUseCase.execute({
      establishment_id: id,
      event_id,
      page: query.page,
      per_page: query.per_page,
      sort: query.sort,
      sort_dir: query.sort_dir,
    });
    return new EventAttendeeCollectionPresenter(output);
  }

  @Get(":event_id/performers")
  @Public()
  @ApiOperation({
    summary: "Listar performers do evento",
    description: "Lista músicos e bandas escalados para o evento.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiParam({ name: "event_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EventMusicianCollectionPresenter })
  async listPerformers(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Param("event_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    event_id: string,
    @Query() query: SearchEventsDto,
  ) {
    const output = await this.listEventMusiciansUseCase.execute({
      establishment_id: id,
      event_id,
      page: query.page,
      per_page: query.per_page,
      sort: query.sort,
      sort_dir: query.sort_dir,
    });
    return new EventMusicianCollectionPresenter(output);
  }

  @Patch(":event_id/performers/:event_musician_id/status")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Atualizar status do performer",
    description: "Confirma ou cancela a participação de um músico/banda no evento.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiParam({ name: "event_id", required: true, format: "uuid" })
  @ApiParam({ name: "event_musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EventMusicianPresenter })
  async updatePerformerStatus(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Param("event_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    event_id: string,
    @Param(
      "event_musician_id",
      new ParseUUIDPipe({ errorHttpStatusCode: 422 }),
    )
    event_musician_id: string,
    @Body() dto: UpdateEventMusicianStatusDto,
  ) {
    const output = await this.updateEventMusicianStatusUseCase.execute({
      establishment_id: id,
      event_id,
      event_musician_id,
      action: dto.action,
    });
    return new EventMusicianPresenter(output);
  }
}
