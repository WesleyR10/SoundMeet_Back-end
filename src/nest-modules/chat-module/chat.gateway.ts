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
import { Injectable, Logger } from "@nestjs/common";
import { Server, Socket } from "socket.io";

import { AuthJwtVerifier } from "../auth-module/auth-jwt.verifier";

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

  constructor(private readonly authJwtVerifier: AuthJwtVerifier) {}

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
      const userId = payload.sub as string;
      client.data.userId = userId;
      this.logger.debug(`Chat connected: user=${userId} socket=${client.id}`);
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
    if (!client.data.userId) {
      client.disconnect();
      return;
    }
    await client.join(`conversation:${data.conversation_id}`);
    client.emit("joined_conversation", {
      conversation_id: data.conversation_id,
    });
  }

  @SubscribeMessage("leave_conversation")
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversation_id: string },
  ): Promise<void> {
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
