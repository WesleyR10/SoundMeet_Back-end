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

import { RequestOutput } from "../../core/request/application/use-cases/common/request-output";
import { CreateRequestUseCase } from "../../core/request/application/use-cases/create-request/create-request.use-case";
import { DeleteRequestInput } from "../../core/request/application/use-cases/delete-request/delete-request.input";
import { DeleteRequestUseCase } from "../../core/request/application/use-cases/delete-request/delete-request.use-case";
import { GetMusicianRequestsInput } from "../../core/request/application/use-cases/get-musician-requests/get-musician-requests.input";
import { GetMusicianRequestsUseCase } from "../../core/request/application/use-cases/get-musician-requests/get-musician-requests.use-case";
import { GetRequestInput } from "../../core/request/application/use-cases/get-request/get-request.input";
import { GetRequestUseCase } from "../../core/request/application/use-cases/get-request/get-request.use-case";
import { GetRequestSuggestionsInput } from "../../core/request/application/use-cases/get-request-suggestions/get-request-suggestions.input";
import { GetRequestSuggestionsUseCase } from "../../core/request/application/use-cases/get-request-suggestions/get-request-suggestions.use-case";
import { ListRequestsUseCase } from "../../core/request/application/use-cases/list-requests/list-requests.use-case";
import { MarkRequestPlayedInput } from "../../core/request/application/use-cases/mark-request-played/mark-request-played.input";
import { MarkRequestPlayedUseCase } from "../../core/request/application/use-cases/mark-request-played/mark-request-played.use-case";
import { RespondToRequestInput } from "../../core/request/application/use-cases/respond-to-request/respond-to-request.input";
import { RespondToRequestUseCase } from "../../core/request/application/use-cases/respond-to-request/respond-to-request.use-case";
import { UpdateRequestInput } from "../../core/request/application/use-cases/update-request/update-request.input";
import { UpdateRequestUseCase } from "../../core/request/application/use-cases/update-request/update-request.use-case";
import { VoteRequestInput } from "../../core/request/application/use-cases/vote-request/vote-request.input";
import { VoteRequestUseCase } from "../../core/request/application/use-cases/vote-request/vote-request.use-case";
import { AuthGuard, Roles, RolesGuard } from "../auth-module";
import { CreateRequestDto } from "./dto/create-request.dto";
import { GetMusicianRequestsDto } from "./dto/get-musician-requests.dto";
import { GetRequestSuggestionsDto } from "./dto/get-request-suggestions.dto";
import { MarkRequestPlayedDto } from "./dto/mark-request-played.dto";
import { RespondToRequestDto } from "./dto/respond-to-request.dto";
import { SearchRequestsDto } from "./dto/search-requests.dto";
import { UpdateRequestDto } from "./dto/update-request.dto";
import { VoteRequestDto } from "./dto/vote-request.dto";
import {
  MusicianRequestsPresenter,
  RequestCollectionPresenter,
  RequestPresenter,
  RequestSuggestionsPresenter,
} from "./request.presenter";

@ApiTags("Requests")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard)
@Controller("requests")
export class RequestsController {
  @Inject(CreateRequestUseCase)
  private createUseCase: CreateRequestUseCase;

  @Inject(ListRequestsUseCase)
  private listUseCase: ListRequestsUseCase;

  @Inject(GetRequestUseCase)
  private getUseCase: GetRequestUseCase;

  @Inject(UpdateRequestUseCase)
  private updateUseCase: UpdateRequestUseCase;

  @Inject(DeleteRequestUseCase)
  private deleteUseCase: DeleteRequestUseCase;

  @Inject(RespondToRequestUseCase)
  private respondUseCase: RespondToRequestUseCase;

  @Inject(GetMusicianRequestsUseCase)
  private getMusicianRequestsUseCase: GetMusicianRequestsUseCase;

  @Inject(GetRequestSuggestionsUseCase)
  private getRequestSuggestionsUseCase: GetRequestSuggestionsUseCase;

  @Inject(MarkRequestPlayedUseCase)
  private markRequestPlayedUseCase: MarkRequestPlayedUseCase;

  @Inject(VoteRequestUseCase)
  private voteRequestUseCase: VoteRequestUseCase;

  @Post()
  @Roles("audience", "musician", "admin")
  @ApiOperation({
    summary: "Criar pedido musical",
    description: "Cria um pedido musical com regras anti-spam e gamificação.",
  })
  @ApiResponse({ status: 201, type: RequestPresenter })
  async create(@Body() dto: CreateRequestDto) {
    const output = await this.createUseCase.execute(dto);
    return RequestsController.serialize(output);
  }

  @Get()
  @Roles("musician", "establishment", "admin")
  @ApiOperation({
    summary: "Listar pedidos musicais",
    description: "Lista pedidos musicais com paginação, ordenação e filtros.",
  })
  @ApiResponse({ status: 200, type: RequestCollectionPresenter })
  async findAll(@Query() query: SearchRequestsDto) {
    const output = await this.listUseCase.execute(query);
    return new RequestCollectionPresenter(output);
  }

  @Get("musicians/:musician_id/suggestions")
  @Roles("audience", "musician", "admin")
  @ApiOperation({
    summary: "Sugerir músicas por estilo do músico",
    description:
      "Retorna sugestões baseadas no estilo do músico e histórico de pedidos.",
  })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: RequestSuggestionsPresenter })
  async getSuggestions(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @Query() query: GetRequestSuggestionsDto,
  ) {
    const input = new GetRequestSuggestionsInput({
      musician_id,
      limit: query.limit,
    });
    const output = await this.getRequestSuggestionsUseCase.execute(input);
    return new RequestSuggestionsPresenter(output);
  }

  @Get("musicians/:musician_id")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Listar pedidos musicais de um músico",
    description:
      "Lista pedidos musicais de um músico com paginação, filtros e contagem de pendentes.",
  })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: MusicianRequestsPresenter })
  async getMusicianRequests(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @Query() query: GetMusicianRequestsDto,
  ) {
    const input = new GetMusicianRequestsInput({
      musician_id,
      status: query.status,
      page: query.page,
      per_page: query.per_page,
      limit: query.limit,
    });
    const output = await this.getMusicianRequestsUseCase.execute(input);
    return new MusicianRequestsPresenter(output);
  }

  @Patch(":id/respond")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Responder pedido musical",
    description:
      "Permite ao músico aceitar ou rejeitar um pedido musical pendente.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: RequestPresenter })
  async respond(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: RespondToRequestDto,
  ) {
    const input = new RespondToRequestInput({
      request_id: id,
      musician_id: dto.musician_id,
      action: dto.action,
      rejection_reason: dto.rejection_reason,
    });
    const output = await this.respondUseCase.execute(input);
    return RequestsController.serialize(output);
  }

  @Patch(":id/played")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Marcar pedido como tocado",
    description: "Marca um pedido aceito como tocado e registra a execução.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: RequestPresenter })
  async markAsPlayed(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: MarkRequestPlayedDto,
  ) {
    const input = new MarkRequestPlayedInput({
      request_id: id,
      played_at: dto.played_at,
    });
    const output = await this.markRequestPlayedUseCase.execute(input);
    return RequestsController.serialize(output);
  }

  @Post(":id/votes")
  @Roles("audience", "admin")
  @ApiOperation({
    summary: "Votar em pedido musical",
    description:
      "Registra ou atualiza o voto da audiência no pedido e recalcula a contagem canônica.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: RequestPresenter })
  async vote(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: VoteRequestDto,
  ) {
    const input = new VoteRequestInput({
      request_id: id,
      audience_id: dto.audience_id,
      vote_type: dto.vote_type,
    });
    const output = await this.voteRequestUseCase.execute(input);
    return RequestsController.serialize(output);
  }

  @Get(":id")
  @Roles("audience", "musician", "establishment", "admin")
  @ApiOperation({
    summary: "Buscar pedido musical por ID",
    description: "Retorna os detalhes de um pedido musical.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: RequestPresenter })
  async findOne(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const input: GetRequestInput = { id };
    const output = await this.getUseCase.execute(input);
    return RequestsController.serialize(output);
  }

  @Patch(":id")
  @Roles("audience", "admin")
  @ApiOperation({
    summary: "Atualizar pedido musical",
    description: "Atualiza os dados de um pedido musical pendente.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: RequestPresenter })
  async update(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: UpdateRequestDto,
  ) {
    const input = new UpdateRequestInput({
      id,
      song_title: dto.song_title,
      artist: dto.artist,
      message: dto.message,
    });
    const output = await this.updateUseCase.execute(input);
    return RequestsController.serialize(output);
  }

  @HttpCode(204)
  @Delete(":id")
  @Roles("audience", "admin")
  @ApiOperation({
    summary: "Remover pedido musical",
    description: "Remove um pedido musical.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async remove(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const input: DeleteRequestInput = { id };
    await this.deleteUseCase.execute(input);
  }

  static serialize(output: RequestOutput) {
    return new RequestPresenter(output);
  }
}
