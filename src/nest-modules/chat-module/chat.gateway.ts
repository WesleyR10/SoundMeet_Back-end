import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { validate as isUuid } from "uuid";

import { AssertConversationParticipantUseCase } from "../../core/chat/application/use-cases";
import { AuthJwtVerifier } from "../auth-module/auth-jwt.verifier";
import {
  resolveParticipantIds,
  toAuthenticatedUser,
} from "../auth-module/authenticated-user.mapper";
import { AuthenticatedUser } from "../auth-module/interfaces/authenticated-user.interface";

@Injectable()
@WebSocketGateway({
  namespace: "/chat",
  transports: ["websocket"],
  cors: { origin: "*" },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly authJwtVerifier: AuthJwtVerifier,
    @Inject(AssertConversationParticipantUseCase)
    private readonly assertParticipantUseCase: AssertConversationParticipantUseCase,
  ) {}

  afterInit(): void {
    this.logger.log("ChatGateway initialized");
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = await this.authJwtVerifier.verify(token);
      // Identidade sai SEMPRE dos claims — mesma derivação do lado HTTP.
      const currentUser = toAuthenticatedUser(payload as never);
      client.data.currentUser = currentUser;
      this.logger.debug(
        `Chat connected: user=${currentUser.userId} socket=${client.id}`,
      );
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Chat disconnected: socket=${client.id}`);
  }

  @SubscribeMessage("join_conversation")
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversation_id: string },
  ): Promise<void> {
    const currentUser = client.data.currentUser as
      | AuthenticatedUser
      | undefined;
    if (!currentUser) {
      client.disconnect();
      return;
    }

    const conversationId = data?.conversation_id;
    if (typeof conversationId !== "string" || !isUuid(conversationId)) {
      client.emit("join_conversation_error", {
        conversation_id: conversationId ?? null,
        reason: "invalid_conversation_id",
      });
      return;
    }

    try {
      await this.assertParticipantUseCase.execute({
        conversation_id: conversationId,
        participant_ids: resolveParticipantIds(currentUser),
        is_admin: currentUser.isAdmin,
      });
    } catch {
      // Resposta idêntica para "não existe" e "não é participante": diferenciar
      // permitiria enumerar conversas alheias por tentativa e erro.
      this.logger.warn(
        JSON.stringify({
          event: "chat.join_denied",
          user_id: currentUser.userId,
          conversation_id: conversationId,
        }),
      );
      client.emit("join_conversation_error", {
        conversation_id: conversationId,
        reason: "forbidden",
      });
      return;
    }

    await client.join(`conversation:${conversationId}`);
    client.emit("joined_conversation", { conversation_id: conversationId });
  }

  @SubscribeMessage("leave_conversation")
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversation_id: string },
  ): Promise<void> {
    // Sair de uma room só afeta o próprio socket — não precisa de policy.
    await client.leave(`conversation:${data.conversation_id}`);
  }

  emitNewMessage(conversation_id: string, message: object): void {
    this.server
      .to(`conversation:${conversation_id}`)
      .emit("message.new", message);
  }

  emitMessagesRead(conversation_id: string, reader_id: string): void {
    this.server
      .to(`conversation:${conversation_id}`)
      .emit("messages.read", { conversation_id, reader_id });
  }
}
