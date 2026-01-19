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
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";

import { ActivateEventUseCase } from "../../core/events/application/use-cases/activate-event/activate-event.use-case";
import { AddEventAttendeeUseCase } from "../../core/events/application/use-cases/add-event-attendee/add-event-attendee.use-case";
import { AddEventPerformerUseCase } from "../../core/events/application/use-cases/add-event-performer/add-event-performer.use-case";
import { CancelEventUseCase } from "../../core/events/application/use-cases/cancel-event/cancel-event.use-case";
import { CreateEventUseCase } from "../../core/events/application/use-cases/create-event/create-event.use-case";
import { DeleteEventUseCase } from "../../core/events/application/use-cases/delete-event/delete-event.use-case";
import { FinishEventUseCase } from "../../core/events/application/use-cases/finish-event/finish-event.use-case";
import { GetEventUseCase } from "../../core/events/application/use-cases/get-event/get-event.use-case";
import { ListEventsUseCase } from "../../core/events/application/use-cases/list-events/list-events.use-case";
import { RemoveEventAttendeeUseCase } from "../../core/events/application/use-cases/remove-event-attendee/remove-event-attendee.use-case";
import { RemoveEventPerformerUseCase } from "../../core/events/application/use-cases/remove-event-performer/remove-event-performer.use-case";
import { UpdateEventUseCase } from "../../core/events/application/use-cases/update-event/update-event.use-case";
import { AddEventAttendeeDto } from "./dto/add-event-attendee.dto";
import { AddEventPerformerDto } from "./dto/add-event-performer.dto";
import { CreateEventDto } from "./dto/create-event.dto";
import { SearchEventsDto } from "./dto/search-events.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { EventCollectionPresenter, EventPresenter } from "./event.presenter";

@ApiTags("Events")
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

  @Post()
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
    const output = await this.createEventUseCase.execute({
      ...(dto as any),
      establishment_id: id,
    });
    return new EventPresenter(output);
  }

  @Get()
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
      ...(query as any),
    });
    return new EventCollectionPresenter(output);
  }

  @Get(":event_id")
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
    const output = await this.updateEventUseCase.execute({
      ...(dto as any),
      id: event_id,
      establishment_id: id,
    });
    return new EventPresenter(output);
  }

  @HttpCode(204)
  @Delete(":event_id")
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
  @ApiOperation({
    summary: "Adicionar attendee",
    description: "Registra presença (incrementa capacidade atual).",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiParam({ name: "event_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EventPresenter })
  async addAttendee(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Param("event_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    event_id: string,
    @Body() dto: AddEventAttendeeDto,
  ) {
    const output = await this.addEventAttendeeUseCase.execute({
      establishment_id: id,
      event_id,
      audience_id: dto.audience_id,
    });
    return new EventPresenter(output);
  }

  @Delete(":event_id/attendees/:audience_id")
  @ApiOperation({
    summary: "Remover attendee",
    description: "Remove presença (decrementa capacidade atual).",
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
  ) {
    const output = await this.removeEventAttendeeUseCase.execute({
      establishment_id: id,
      event_id,
      audience_id,
    });
    return new EventPresenter(output);
  }

  @HttpCode(204)
  @Post(":event_id/performers")
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
      ...(dto as any),
    });
  }

  @HttpCode(204)
  @Delete(":event_id/performers/:event_musician_id")
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
}
