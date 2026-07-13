import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Logger,
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

import {
  GetConversationUseCase,
  ListConversationsUseCase,
  MarkAsReadUseCase,
  SendMessageUseCase,
} from "../../core/chat/application/use-cases";
import { ConversationListItem } from "../../core/chat/application/use-cases/list-conversations/list-conversations.use-case";
import { SenderType } from "../../core/chat/domain/message.aggregate";
import { Establishment, EstablishmentId } from "../../core/establishment/domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../core/establishment/domain/establishment.repository";
import {
  AuthGuard,
  CurrentUserContextGuard,
  RolesGuard,
} from "../auth-module";
import { CurrentUser } from "../auth-module/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth-module/interfaces/authenticated-user.interface";
import { ListMessagesDto } from "./dto/list-messages.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { ChatGateway } from "./chat.gateway";

function resolveSender(user: AuthenticatedUser): {
  sender_id: string;
  sender_type: SenderType;
} {
  if (user.roles.includes("musician")) {
    return { sender_id: user.userId, sender_type: "musician" };
  }
  if (user.roles.includes("band")) {
    return {
      sender_id: user.bandIds[0] ?? user.userId,
      sender_type: "band",
    };
  }
  // establishment or default
  return {
    sender_id: user.establishmentIds[0] ?? user.userId,
    sender_type: "establishment",
  };
}

@ApiTags("Chat")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("conversations")
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  @Inject(SendMessageUseCase)
  private sendMessageUseCase: SendMessageUseCase;

  @Inject(GetConversationUseCase)
  private getConversationUseCase: GetConversationUseCase;

  @Inject(ListConversationsUseCase)
  private listConversationsUseCase: ListConversationsUseCase;

  @Inject(MarkAsReadUseCase)
  private markAsReadUseCase: MarkAsReadUseCase;

  @Inject(ChatGateway)
  private chatGateway: ChatGateway;

  @Inject("EstablishmentRepository")
  private establishmentRepo: IEstablishmentRepository;

  @Post(":id/messages")
  @ApiOperation({
    summary: "Enviar mensagem",
    description: "Envia uma mensagem em uma conversa.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201 })
  async sendMessage(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const { sender_id, sender_type } = resolveSender(currentUser);
    const message = await this.sendMessageUseCase.execute({
      conversation_id: id,
      sender_id,
      sender_type,
      content: dto.content,
    });
    this.chatGateway.emitNewMessage(id, message);
    return message;
  }

  @Get(":id/messages")
  @ApiOperation({
    summary: "Listar mensagens",
    description: "Retorna mensagens de uma conversa com cursor pagination.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200 })
  async getConversation(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    id: string,
    @Query() query: ListMessagesDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const { sender_id } = resolveSender(currentUser);
    return this.getConversationUseCase.execute({
      conversation_id: id,
      requester_id: sender_id,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Get()
  @ApiOperation({
    summary: "Listar conversas",
    description: "Retorna todas as conversas do usuário autenticado.",
  })
  @ApiResponse({ status: 200 })
  async listConversations(@CurrentUser() currentUser: AuthenticatedUser) {
    const { sender_id } = resolveSender(currentUser);
    const { conversations } = await this.listConversationsUseCase.execute({
      participant_id: sender_id,
    });

    return {
      conversations: await this.enrichWithEstablishment(conversations),
    };
  }

  // Enriquecimento cross-context (nome/avatar do estabelecimento) fica aqui,
  // não dentro de core/chat — mesma fronteira DDD já seguida por
  // RequestOutput/TipOutput, que nunca alcançam outro bounded context de
  // dentro do core. Extraído em métodos próprios (em vez de inline no
  // handler HTTP) pra poder ser unit-testado sem precisar da stack HTTP
  // completa, e pra isolar as duas falhas reais que esse enriquecimento
  // pode sofrer sem derrubar a listagem inteira (ver loadEstablishments).
  private async enrichWithEstablishment(
    conversations: ConversationListItem[],
  ): Promise<Array<ConversationListItem & { establishment: { id: string; name: string; avatar: string | null } | null }>> {
    const byId = await this.loadEstablishments(
      conversations.map((c) => c.establishment_id),
    );

    return conversations.map((c) => {
      const establishment = byId.get(c.establishment_id);
      return {
        ...c,
        establishment: establishment
          ? {
              id: establishment.establishment_id.id,
              name: establishment.name,
              avatar: establishment.avatar,
            }
          : null,
      };
    });
  }

  // Duas falhas reais e independentes são possíveis aqui, nenhuma das quais
  // deve derrubar GET /conversations (os dados de chat em si estão íntegros
  // mesmo se o enriquecimento falhar — degrada pra establishment: null,
  // mesma tolerância já esperada pelo mobile em ConversationListItem.tsx):
  // (1) um establishment_id que não é UUID estritamente RFC4122 faz `new
  // EstablishmentId(id)` lançar InvalidUuidError — já aconteceu de verdade
  // com um fixture de teste durante esta revisão; (2) o repositório pode
  // falhar (timeout de DB, etc). Ambas são contidas aqui, uma por
  // establishment_id malformado (só aquele é pulado) e uma pro lookup
  // inteiro (todos os establishments ficam null nesse request).
  private async loadEstablishments(
    establishmentIds: string[],
  ): Promise<Map<string, Establishment>> {
    const validIds: EstablishmentId[] = [];
    for (const id of new Set(establishmentIds)) {
      try {
        validIds.push(new EstablishmentId(id));
      } catch {
        this.logger.warn(
          `Skipping malformed establishment_id in conversation enrichment: ${id}`,
        );
      }
    }

    if (!validIds.length) return new Map();

    try {
      const establishments = await this.establishmentRepo.findByIds(validIds);
      return new Map(establishments.map((e) => [e.establishment_id.id, e]));
    } catch (error) {
      this.logger.error(
        `Failed to load establishments for conversation enrichment: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return new Map();
    }
  }

  @HttpCode(200)
  @Patch(":id/read")
  @ApiOperation({
    summary: "Marcar mensagens como lidas",
    description: "Marca todas as mensagens não lidas da conversa como lidas.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200 })
  async markAsRead(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const { sender_id } = resolveSender(currentUser);
    await this.markAsReadUseCase.execute({
      conversation_id: id,
      reader_id: sender_id,
    });
    this.chatGateway.emitMessagesRead(id, sender_id);
    return { ok: true };
  }
}
