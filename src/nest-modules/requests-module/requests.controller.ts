import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
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
import { Throttle } from "@nestjs/throttler";

import { BatchRespondToRequestsUseCase } from "../../core/request/application/use-cases/batch-respond-to-requests/batch-respond-to-requests.use-case";
import { RequestOutput } from "../../core/request/application/use-cases/common/request-output";
import { CreateRequestUseCase } from "../../core/request/application/use-cases/create-request/create-request.use-case";
import { CreateRequestFeedbackUseCase } from "../../core/request/application/use-cases/create-request-feedback/create-request-feedback.use-case";
import { DeleteRequestInput } from "../../core/request/application/use-cases/delete-request/delete-request.input";
import { DeleteRequestUseCase } from "../../core/request/application/use-cases/delete-request/delete-request.use-case";
import { GetMusicianRequestsInput } from "../../core/request/application/use-cases/get-musician-requests/get-musician-requests.input";
import { GetMusicianRequestsUseCase } from "../../core/request/application/use-cases/get-musician-requests/get-musician-requests.use-case";
import { GetRequestInput } from "../../core/request/application/use-cases/get-request/get-request.input";
import { GetRequestUseCase } from "../../core/request/application/use-cases/get-request/get-request.use-case";
import { GetRequestBoostPaymentUseCase } from "../../core/request/application/use-cases/get-request-boost-payment/get-request-boost-payment.use-case";
import { GetRequestFeedbackUseCase } from "../../core/request/application/use-cases/get-request-feedback/get-request-feedback.use-case";
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
import {
  AuthenticatedUser,
  AuthGuard,
  CurrentUser,
  CurrentUserContextGuard,
  resolveParticipantIds,
  Roles,
  RolesGuard,
} from "../auth-module";
import { BatchRespondRequestsDto } from "./dto/batch-respond-requests.dto";
import { CreateRequestDto } from "./dto/create-request.dto";
import { CreateRequestFeedbackDto } from "./dto/create-request-feedback.dto";
import { GetMusicianRequestsDto } from "./dto/get-musician-requests.dto";
import { GetRequestSuggestionsDto } from "./dto/get-request-suggestions.dto";
import { MarkRequestPlayedDto } from "./dto/mark-request-played.dto";
import { RespondToRequestDto } from "./dto/respond-to-request.dto";
import { SearchRequestsDto } from "./dto/search-requests.dto";
import { UpdateRequestDto } from "./dto/update-request.dto";
import { VoteRequestDto } from "./dto/vote-request.dto";
import {
  MusicianRequestsPresenter,
  RequestBoostPaymentPresenter,
  RequestCollectionPresenter,
  RequestFeedbackPresenter,
  RequestPresenter,
  RequestSuggestionsPresenter,
} from "./request.presenter";

@ApiTags("Requests")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
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

  @Inject(BatchRespondToRequestsUseCase)
  private batchRespondUseCase: BatchRespondToRequestsUseCase;

  @Inject(GetMusicianRequestsUseCase)
  private getMusicianRequestsUseCase: GetMusicianRequestsUseCase;

  @Inject(GetRequestSuggestionsUseCase)
  private getRequestSuggestionsUseCase: GetRequestSuggestionsUseCase;

  @Inject(MarkRequestPlayedUseCase)
  private markRequestPlayedUseCase: MarkRequestPlayedUseCase;

  @Inject(VoteRequestUseCase)
  private voteRequestUseCase: VoteRequestUseCase;

  @Inject(CreateRequestFeedbackUseCase)
  private createFeedbackUseCase: CreateRequestFeedbackUseCase;

  @Inject(GetRequestFeedbackUseCase)
  private getFeedbackUseCase: GetRequestFeedbackUseCase;

  @Inject(GetRequestBoostPaymentUseCase)
  private getRequestBoostPaymentUseCase: GetRequestBoostPaymentUseCase;

  @Post()
  @Roles("audience", "musician", "admin")
  @ApiOperation({
    summary: "Criar pedido musical",
    description: "Cria um pedido musical com regras anti-spam e gamificação.",
  })
  @ApiResponse({ status: 201, type: RequestPresenter })
  async create(
    @Body() dto: CreateRequestDto,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const output = await this.createUseCase.execute({
      ...dto,
      audience_id: currentUser?.userId ?? "",
    });
    return RequestsController.serialize(output);
  }

  // Admin-only: a listagem global não tem escopo por participante. Músico usa
  // GET /requests/musicians/:musician_id; fã usa GET /requests/audiences/:audience_id.
  // Se o dashboard web de estabelecimento precisar disso, criar rota escopada
  // por evento com checagem de ownership — não reabrir esta.
  @Get()
  @Roles("admin")
  @ApiOperation({
    summary: "Listar pedidos musicais (admin)",
    description:
      "Lista pedidos musicais de toda a plataforma com paginação, ordenação e filtros. Restrito a admin.",
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
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    if (
      currentUser?.roles.includes("musician") &&
      !currentUser.roles.includes("admin") &&
      currentUser.userId !== musician_id
    ) {
      throw new ForbiddenException(
        "Você não tem permissão para ver pedidos de outro músico.",
      );
    }
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

  @Get("audiences/:audience_id")
  @Roles("audience", "admin")
  @ApiOperation({
    summary: "Listar pedidos do próprio fã",
    description:
      "Lista o histórico de pedidos musicais do fã autenticado (ou de qualquer fã, se admin).",
  })
  @ApiParam({ name: "audience_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: RequestCollectionPresenter })
  @ApiResponse({ status: 403, description: "Acesso negado" })
  async getAudienceRequests(
    @Param("audience_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    audience_id: string,
    @Query() query: SearchRequestsDto,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    if (
      currentUser?.roles.includes("audience") &&
      !currentUser.roles.includes("admin") &&
      currentUser.userId !== audience_id
    ) {
      throw new ForbiddenException(
        "Você não tem permissão para ver pedidos de outro fã.",
      );
    }
    const output = await this.listUseCase.execute({ ...query, audience_id });
    return new RequestCollectionPresenter(output);
  }

  @Post("batch-respond")
  @HttpCode(HttpStatus.OK)
  @Roles("musician", "admin")
  // Amplificação de escrita: 1 requisição vira até 50 respostas, cada uma com
  // transição de estado e evento de domínio (gamificação, push). O throttle
  // global conta requisições, não trabalho — por isso um teto próprio, mais
  // apertado. 6/min cobre com folga o uso real (voltar do intervalo).
  @Throttle({ default: { ttl: 60000, limit: 6 } })
  @ApiOperation({
    summary: "Responder vários pedidos de uma vez",
    description:
      "Aceita ou rejeita até 50 pedidos numa chamada — o músico volta do intervalo com a fila acumulada. BEST-EFFORT: um item que falha (já respondido, expirado, de outro músico) não anula os demais; a resposta traz `succeeded` e `failed` com o motivo por request_id. O músico é sempre o do token.",
  })
  @ApiResponse({ status: 200, description: "Relatório por pedido" })
  @ApiResponse({
    status: 422,
    description: "Lote vazio, acima de 50 ou com UUID inválido",
  })
  async batchRespond(
    @Body() dto: BatchRespondRequestsDto,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const output = await this.batchRespondUseCase.execute({
      request_ids: dto.request_ids,
      musician_id: currentUser?.userId ?? "",
      action: dto.action,
      rejection_reason: dto.rejection_reason,
    });

    return {
      succeeded: output.succeeded.map((r) => RequestsController.serialize(r)),
      failed: output.failed,
    };
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
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const input = new RespondToRequestInput({
      request_id: id,
      musician_id: currentUser?.userId ?? "",
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
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const input = new MarkRequestPlayedInput({
      request_id: id,
      played_at: dto.played_at,
      musician_id: currentUser?.roles.includes("admin")
        ? undefined
        : currentUser?.userId,
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
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const input = new VoteRequestInput({
      request_id: id,
      audience_id: currentUser?.userId ?? "",
      vote_type: dto.vote_type,
    });
    const output = await this.voteRequestUseCase.execute(input);
    return RequestsController.serialize(output);
  }

  /**
   * Cobrança do destaque pago.
   *
   * Vem ANTES de `@Get(":id")` por disciplina de ordem — aqui o caminho tem
   * três segmentos e não colidiria, mas rota de leitura declarada depois de um
   * `:id` é o defeito que não dá erro de compilação e some numa refatoração.
   *
   * `:id` (e não `:request_id`) para acompanhar o resto do controller: aqui não
   * há ownership guard resolvendo por parâmetro — quem confere a posse é
   * `assertRequestParticipant`, dentro do use-case —, então o nome do parâmetro
   * não autoriza nada.
   */
  @Get(":id/boost/payment")
  @Roles("audience", "admin")
  @ApiOperation({
    summary: "Cobrança do destaque pago de um pedido",
    description:
      "Devolve o QR PIX da gorjeta que destaca este pedido. A cobrança nasce quando o MÚSICO aceita — o fã normalmente não está na tela nesse instante, e é por isso que ela pode ser relida aqui. Em `promised` ainda não existe cobrança e em `cancelled` nunca vai existir: nesses casos o status volta preenchido e o QR nulo, para a UI explicar o estado em vez de mostrar erro.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: RequestBoostPaymentPresenter })
  @ApiResponse({ status: 403, description: "Você não participa deste pedido." })
  @ApiResponse({ status: 404, description: "Pedido ou destaque inexistente." })
  async getBoostPayment(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const output = await this.getRequestBoostPaymentUseCase.execute({
      request_id: id,
      requesting_participant_ids: currentUser
        ? resolveParticipantIds(currentUser)
        : undefined,
      is_admin: currentUser?.roles.includes("admin"),
    });
    return new RequestBoostPaymentPresenter(output);
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
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const input: GetRequestInput = {
      id,
      requesting_participant_ids: currentUser
        ? resolveParticipantIds(currentUser)
        : undefined,
      is_admin: currentUser?.roles.includes("admin"),
    };
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
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const input = new UpdateRequestInput({
      id,
      song_title: dto.song_title,
      artist: dto.artist,
      message: dto.message,
      requesting_audience_id: currentUser?.userId,
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
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const input = new DeleteRequestInput({
      id,
      requesting_audience_id: currentUser?.userId,
    });
    await this.deleteUseCase.execute(input);
  }

  @Post(":id/feedback")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Avaliar pedido musical",
    description:
      "Músico avalia o pedido após tocá-lo (rating 1-5, comentário opcional).",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: RequestFeedbackPresenter })
  @ApiResponse({ status: 404, description: "Pedido não encontrado" })
  async createFeedback(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: CreateRequestFeedbackDto,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const output = await this.createFeedbackUseCase.execute({
      request_id: id,
      rating: dto.rating,
      comment: dto.comment,
      musician_id: currentUser?.roles.includes("admin")
        ? undefined
        : currentUser?.userId,
    });
    return new RequestFeedbackPresenter(output);
  }

  @Get(":id/feedback")
  @Roles("musician", "establishment", "audience", "admin")
  @ApiOperation({
    summary: "Obter avaliação de um pedido",
    description: "Retorna a avaliação do pedido musical.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: RequestFeedbackPresenter })
  @ApiResponse({ status: 404, description: "Avaliação não encontrada" })
  async getFeedback(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const output = await this.getFeedbackUseCase.execute({
      request_id: id,
      requesting_participant_ids: currentUser
        ? resolveParticipantIds(currentUser)
        : undefined,
      is_admin: currentUser?.roles.includes("admin"),
    });
    return new RequestFeedbackPresenter(output);
  }

  static serialize(output: RequestOutput) {
    return new RequestPresenter(output);
  }
}
