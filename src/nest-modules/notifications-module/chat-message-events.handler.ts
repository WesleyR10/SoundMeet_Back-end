import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { ConversationId } from "../../core/chat/domain/conversation.aggregate";
import { IConversationRepository } from "../../core/chat/domain/conversation.repository";
import { MessageSentEvent } from "../../core/chat/domain/events/message-sent.event";
import { MusicianId } from "../../core/musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { NotificationsGateway } from "./notifications.gateway";
import { PushNotificationService } from "./push-notification.service";

// Handler distinto de chat-module/chat-events.handler.ts (que abre a
// conversa a partir de InquiryCreatedEvent — outra responsabilidade, outro
// módulo). Este vive em notifications-module, mesmo padrão de
// NotificationsPaymentEventsHandler/RequestEventsHandler — escuta evento de
// domínio de outro módulo via @OnEvent e traduz pra gateway/push.
@Injectable()
export class NotificationsChatEventsHandler {
  private readonly logger = new Logger(NotificationsChatEventsHandler.name);

  constructor(
    private readonly gateway: NotificationsGateway,
    @Inject("IConversationRepository")
    private readonly convRepo: IConversationRepository,
    @Inject("MusicianRepository")
    private readonly musicianRepo: IMusicianRepository,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  @OnEvent(MessageSentEvent.name)
  async handleMessageSent(event: MessageSentEvent): Promise<void> {
    try {
      const conversation = await this.convRepo.findById(
        new ConversationId(event.conversation_id),
      );
      if (!conversation) return;

      // Recipiente = participante músico da conversa, só se NÃO foi quem
      // enviou (auto-eco). Conversas só-banda (sem musician_id) não geram
      // push no MVP — mobile não tem login de banda ainda, mesmo corte de
      // escopo de "establishment é web-only".
      const recipientMusicianId =
        conversation.musician_id && conversation.musician_id !== event.sender_id
          ? conversation.musician_id
          : null;
      if (!recipientMusicianId) return;

      this.gateway.notifyChatMessage(recipientMusicianId, {
        conversation_id: event.conversation_id,
        sender_id: event.sender_id,
        occurred_at: event.occurred_on.toISOString(),
      });

      const musician = await this.musicianRepo.findById(
        new MusicianId(recipientMusicianId),
      );

      if (musician?.push_token) {
        // Sem preview de conteúdo na notificação (decisão de produto,
        // seguindo a própria recomendação do chat-design-debate.md contra
        // vazar dados de negociação numa tela de bloqueio).
        await this.pushNotificationService.send(musician.push_token, {
          title: "Nova mensagem 💬",
          body: "Você recebeu uma nova mensagem",
          data: {
            type: "chat.message.new",
            conversation_id: event.conversation_id,
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to notify message.sent for message=${event.aggregate_id.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
