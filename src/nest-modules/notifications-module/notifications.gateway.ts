import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Injectable, Logger } from "@nestjs/common";
import { Server, Socket } from "socket.io";

import { AuthJwtVerifier } from "../auth-module/auth-jwt.verifier";
import {
  ChatMessageNewPayload,
  NewRequestPayload,
  RequestStatusChangedPayload,
  TipReceivedPayload,
} from "./dto/notification.payloads";

@Injectable()
@WebSocketGateway({
  namespace: "/notifications",
  transports: ["websocket"],
  cors: { origin: "*" },
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly authJwtVerifier: AuthJwtVerifier) {}

  afterInit(): void {
    this.logger.log("NotificationsGateway initialized");
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
      await client.join(`user:${userId}`);
      this.logger.debug(`Connected: user=${userId} socket=${client.id}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Disconnected: socket=${client.id}`);
  }

  notifyRequestStatusChanged(
    audienceId: string,
    payload: RequestStatusChangedPayload,
  ): void {
    this.server
      .to(`user:${audienceId}`)
      .emit("request.status_changed", payload);
  }

  notifyNewRequest(musicianId: string, payload: NewRequestPayload): void {
    this.server.to(`user:${musicianId}`).emit("request.new", payload);
  }

  notifyTipReceived(musicianId: string, payload: TipReceivedPayload): void {
    this.server.to(`user:${musicianId}`).emit("tip.received", payload);
  }

  // Reaproveita a mesma room `user:${musicianId}` já usada por
  // request.new/tip.received — é o que permite ao mobile atualizar a lista
  // de conversas (badge/preview) sem abrir uma segunda conexão persistente
  // pro namespace /chat, que é screen-scoped (ver ChatGateway).
  notifyChatMessage(musicianId: string, payload: ChatMessageNewPayload): void {
    this.server.to(`user:${musicianId}`).emit("chat.message.new", payload);
  }
}
