import {
  Body,
  Controller,
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

import {
  GetConversationUseCase,
  ListConversationsUseCase,
  MarkAsReadUseCase,
  SendMessageUseCase,
} from "../../core/chat/application/use-cases";
import { SenderType } from "../../core/chat/domain/message.aggregate";
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
    return this.listConversationsUseCase.execute({
      participant_id: sender_id,
    });
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
