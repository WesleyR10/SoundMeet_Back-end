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
import { RequestStatusChangedPayload } from "./dto/notification.payloads";

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
}
