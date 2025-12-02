import { Injectable, Logger } from "@nestjs/common";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { ConfigService } from "@nestjs/config";
import { ConfigSchemaType } from "../../config-module/config.schema";
import { NotificationPublisher } from "../publishers/notification.publisher";
import { GamificationPublisher } from "../publishers/gamification.publisher";
import { NotificationService } from "../../shared-module/services/notification.service";
import {
  MusicRequestMessage,
  RequestVoteMessage,
  RequestStatusMessage,
  RequestFeedbackMessage,
} from "../publishers/request.publisher";

@Injectable()
export class RequestConsumer {
  private readonly logger = new Logger(RequestConsumer.name);
  private readonly exchange: string;
  private readonly requestQueue: string;

  constructor(
    private readonly configService: ConfigSchemaType,
    private readonly notificationPublisher: NotificationPublisher,
    private readonly gamificationPublisher: GamificationPublisher,
    private readonly notificationService: NotificationService,
  ) {
    this.exchange = this.configService.get("RABBITMQ_EXCHANGE")!;
    this.requestQueue = this.configService.get("RABBITMQ_QUEUE_REQUESTS")!;
  }

  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "request.music.created",
    queue: "soundmeet.requests",
    queueOptions: {
      durable: true,
      arguments: {
        "x-message-ttl": 300000, // 5 minutos TTL
        "x-dead-letter-exchange": "soundmeet.dlx",
      },
    },
  })
  async handleMusicRequestCreated(message: MusicRequestMessage): Promise<void> {
    try {
      this.logger.log(
        `Processing music request: ${message.id} for musician ${message.musicianId}`,
      );

      // 1. Notificar o músico sobre o novo pedido
      await this.notificationService.sendMusicRequestNotification(
        message.musicianId,
        message.songTitle, // Use songTitle for requesterName placeholder as it's not in MusicRequestMessage
        message.songTitle,
        message.artist || "Desconhecido", // Fallback for optional artist
      );

      // 2. Dar pontos para o usuário que fez o pedido
      await this.gamificationPublisher.publishRequestPoints(
        message.userId,
        message.id,
      );

      // 3. Verificar se é um pedido de alta prioridade
      if (message.priority === "high") {
        await this.notificationPublisher.publishPushNotification({
          id: `urgent-request-${message.id}`,
          userId: message.musicianId,
          title: "🔥 Pedido Urgente!",
          body: `Pedido especial: ${message.songTitle}`,
          data: {
            type: "urgent_request",
            requestId: message.id,
            songTitle: message.songTitle,
          },
          priority: "high",
          timestamp: new Date(),
          userType: "musician",
          category: "request",
        });
      }

      this.logger.log(`Music request processed successfully: ${message.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to process music request: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "request.vote.created",
    queue: "soundmeet.requests",
    queueOptions: {
      durable: true,
    },
  })
  async handleRequestVote(message: RequestVoteMessage): Promise<void> {
    try {
      this.logger.log(
        `Processing request vote: ${message.requestId} by user ${message.userId}`,
      );

      // 1. Dar pontos para o usuário que votou
      await this.gamificationPublisher.publishPointsEarned({
        id: `vote-${message.requestId}-${message.userId}`,
        userId: message.userId,
        points: 5,
        source: "vote",
        description: `Votou em pedido musical`,
        relatedId: message.requestId,
        relatedType: "vote",
        timestamp: new Date(),
        metadata: {
          requestId: message.requestId,
          voteType: message.voteType,
        },
      });

      // 2. Notificar o músico sobre votos populares (apenas para votos positivos)
      if (message.voteType === "up") {
        // Aqui você poderia verificar se o pedido atingiu um threshold de votos
        // e notificar o músico sobre a popularidade do pedido
        await this.checkVoteThreshold(message.requestId, message.musicianId);
      }

      // 3. Atualizar estatísticas do evento
      if (message.eventId) {
        await this.updateEventStatistics(message.eventId, "vote_cast");
      }

      this.logger.log(
        `Request vote processed successfully: ${message.requestId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process request vote: ${message.requestId}`,
        error.stack,
      );
      throw error;
    }
  }

  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "request.status.accepted",
    queue: "soundmeet.requests",
    queueOptions: {
      durable: true,
    },
  })
  async handleRequestAccepted(message: RequestStatusMessage): Promise<void> {
    try {
      this.logger.log(`Processing accepted request: ${message.requestId}`);

      // 1. Notificar o usuário que fez o pedido
      await this.notificationService.sendRequestStatusNotification(
        message.userId,
        "accepted",
        "Your request has been accepted", // songTitle placeholder since it's not in RequestStatusMessage
        "The Musician", // musicianName placeholder since it's not in RequestStatusMessage
      );

      // 2. Dar pontos bonus para o usuário
      await this.gamificationPublisher.publishAcceptedRequestPoints(
        message.userId,
        message.requestId,
      );

      // 3. Verificar conquistas relacionadas a pedidos aceitos
      await this.checkRequestAchievements(message.userId, "accepted");

      // 4. Atualizar estatísticas do evento
      if (message.eventId) {
        await this.updateEventStatistics(message.eventId, "request_accepted");
      }

      this.logger.log(
        `Accepted request processed successfully: ${message.requestId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process accepted request: ${message.requestId}`,
        error.stack,
      );
      throw error;
    }
  }

  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "request.status.rejected",
    queue: "soundmeet.requests",
    queueOptions: {
      durable: true,
    },
  })
  async handleRequestRejected(message: RequestStatusMessage): Promise<void> {
    try {
      this.logger.log(`Processing rejected request: ${message.requestId}`);

      // 1. Notificar o usuário que fez o pedido
      await this.notificationService.sendRequestStatusNotification(
        message.userId,
        "rejected",
        "Your request has been rejected", // songTitle placeholder
        "The Musician", // musicianName placeholder
      );

      // 2. Não remover pontos, mas não dar bonus
      // Opcional: dar pontos de consolação menores
      await this.gamificationPublisher.publishPointsEarned({
        id: `rejected-consolation-${message.requestId}`,
        userId: message.userId,
        points: 5,
        source: "request",
        description: "Pedido recusado - pontos de participação",
        relatedId: message.requestId,
        relatedType: "request",
        timestamp: new Date(),
      });

      // 3. Atualizar estatísticas do evento
      if (message.eventId) {
        await this.updateEventStatistics(message.eventId, "request_rejected");
      }

      this.logger.log(
        `Rejected request processed successfully: ${message.requestId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process rejected request: ${message.requestId}`,
        error.stack,
      );
      throw error;
    }
  }

  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "request.feedback.created",
    queue: "soundmeet.requests",
    queueOptions: {
      durable: true,
    },
  })
  async handleRequestFeedback(message: RequestFeedbackMessage): Promise<void> {
    try {
      this.logger.log(`Processing request feedback: ${message.requestId}`);

      // 1. Dar pontos para feedback
      await this.gamificationPublisher.publishPointsEarned({
        id: `feedback-${message.requestId}`,
        userId: message.userId,
        points: 10,
        source: "feedback",
        description: "Avaliou pedido musical",
        relatedId: message.requestId,
        relatedType: "feedback",
        timestamp: new Date(),
        metadata: {
          rating: message.rating,
        },
      });

      // 2. Notificar o músico sobre feedback positivo (rating >= 4)
      if (message.rating >= 4) {
        await this.notificationPublisher.publishPushNotification({
          id: `positive-feedback-${message.requestId}`,
          userId: message.musicianId,
          title: "⭐ Feedback Positivo!",
          body: `Você recebeu ${message.rating} estrelas em um pedido`,
          data: {
            type: "positive_feedback",
            requestId: message.requestId,
            rating: message.rating.toString(),
          },
          priority: "normal",
          timestamp: new Date(),
          userType: "musician",
          category: "request",
        });
      }

      this.logger.log(
        `Request feedback processed successfully: ${message.requestId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process request feedback: ${message.requestId}`,
        error.stack,
      );
      throw error;
    }
  }

  // Métodos auxiliares
  private async checkVoteThreshold(
    requestId: string,
    musicianId: string,
  ): Promise<void> {
    // Implementar lógica para verificar se o pedido atingiu threshold de votos
    // Por exemplo, se atingiu 10 votos positivos, notificar o músico
    // Esta lógica seria implementada consultando o banco de dados
  }

  private async checkRequestAchievements(
    userId: string,
    status: string,
  ): Promise<void> {
    // Implementar lógica para verificar conquistas relacionadas a pedidos
    // Por exemplo: "Primeiro pedido aceito", "10 pedidos aceitos", etc.
  }

  private async updateEventStatistics(
    eventId: string,
    action: string,
  ): Promise<void> {
    // Implementar lógica para atualizar estatísticas do evento em tempo real
    // Isso poderia ser feito via Redis ou banco de dados
    this.logger.debug(`Updating event ${eventId} statistics: ${action}`);
  }
}
