import { Injectable, Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

import { AuthJwtVerifier } from "../auth-module/auth-jwt.verifier";
import { toAuthenticatedUser } from "../auth-module/authenticated-user.mapper";
import {
  BookingUpdatePayload,
  ChatMessageNewPayload,
  InquiryUpdatePayload,
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
      // Mesma leitura de claims do HTTP — `toAuthenticatedUser` é a fonte
      // única; duplicar aqui abriria espaço para um transporte aceitar o que o
      // outro recusa.
      const user = toAuthenticatedUser(payload as never);
      const userId = user.userId;

      client.data.userId = userId;
      await client.join(`user:${userId}`);

      // Bloco 9.5 — o estabelecimento NÃO é o `sub`: uma conta pode operar até
      // 3 unidades, e quem diz quais é o claim `establishment_ids`. Sem estas
      // rooms não há como empurrar nada para o dashboard web.
      client.data.establishmentIds = user.establishmentIds;
      for (const establishmentId of user.establishmentIds) {
        await client.join(`establishment:${establishmentId}`);
      }

      this.logger.debug(
        `Connected: user=${userId} establishments=${user.establishmentIds.length} socket=${client.id}`,
      );
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

  /** Músico: room pessoal (`Musician.id === sub`). */
  notifyBookingUpdate(userId: string, payload: BookingUpdatePayload): void {
    this.server.to(`user:${userId}`).emit("booking.updated", payload);
  }

  /** Estabelecimento: room por unidade, derivada do claim no connect. */
  notifyEstablishmentBookingUpdate(
    establishmentId: string,
    payload: BookingUpdatePayload,
  ): void {
    this.server
      .to(`establishment:${establishmentId}`)
      .emit("booking.updated", payload);
  }

  notifyInquiryUpdate(userId: string, payload: InquiryUpdatePayload): void {
    this.server.to(`user:${userId}`).emit("inquiry.updated", payload);
  }

  notifyEstablishmentInquiryUpdate(
    establishmentId: string,
    payload: InquiryUpdatePayload,
  ): void {
    this.server
      .to(`establishment:${establishmentId}`)
      .emit("inquiry.updated", payload);
  }
}
