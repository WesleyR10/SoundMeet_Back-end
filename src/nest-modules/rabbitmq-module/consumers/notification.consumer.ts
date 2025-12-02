import { Injectable, Logger } from "@nestjs/common";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { ConfigService } from "@nestjs/config";
import { ConfigSchemaType } from "../../config-module/config.schema";
import { NotificationService } from "../../shared-module/services/notification.service";
import {
  PushNotificationMessage,
  BulkNotificationMessage,
  TopicNotificationMessage,
  EmailNotificationMessage,
  SMSNotificationMessage,
} from "../publishers/notification.publisher";

@Injectable()
export class NotificationConsumer {
  private readonly logger = new Logger(NotificationConsumer.name);
  private readonly exchange: string;
  private readonly notificationQueue: string;

  constructor(
    private readonly configService: ConfigService<ConfigSchemaType>,
    private readonly notificationService: NotificationService,
  ) {
    this.exchange = this.configService.get("RABBITMQ_EXCHANGE")!;
    this.notificationQueue = this.configService.get(
      "RABBITMQ_QUEUE_NOTIFICATIONS",
    )!;
  }

  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "notification.push.send",
    queue: "soundmeet.notifications",
    queueOptions: {
      durable: true,
      arguments: {
        "x-message-ttl": 600000, // 10 minutos TTL
        "x-dead-letter-exchange": "soundmeet.dlx",
      },
    },
  })
  async handlePushNotification(
    message: PushNotificationMessage,
  ): Promise<void> {
    try {
      this.logger.log(
        `Processing push notification: ${message.id} for user ${message.userId}`,
      );

      // Enviar notificação push baseada no tipo de usuário
      switch (message.userType) {
        case "musician":
          await this.sendMusicianNotification(message);
          break;
        case "establishment":
          await this.sendEstablishmentNotification(message);
          break;
        case "audience":
          await this.sendAudienceNotification(message);
          break;
        default:
          await this.sendGenericNotification(message);
      }

      this.logger.log(`Push notification sent successfully: ${message.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to send push notification: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "notification.bulk.send",
    queue: "soundmeet.notifications.bulk",
    queueOptions: {
      durable: true,
      arguments: {
        "x-message-ttl": 1800000, // 30 minutos TTL para bulk
      },
    },
  })
  async handleBulkNotification(
    message: BulkNotificationMessage,
  ): Promise<void> {
    try {
      this.logger.log(
        `Processing bulk notification: ${message.id || "unknown"} for ${message.userIds.length} users`,
      );

      // Processar em lotes para evitar sobrecarga
      const batchSize = 100;
      const batches = this.chunkArray(message.userIds, batchSize);

      for (const batch of batches) {
        const promises = batch.map((userId) =>
          this.notificationService.sendPushNotification(
            userId,
            message.title,
            message.body,
            message.data,
          ),
        );

        await Promise.allSettled(promises);

        // Pequena pausa entre lotes para não sobrecarregar o sistema
        await this.delay(100);
      }

      this.logger.log(
        `Bulk notification processed successfully: ${message.id || "unknown"}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process bulk notification: ${message.id || "unknown"}`,
        error.stack,
      );
      throw error;
    }
  }

  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "notification.topic.send",
    queue: "soundmeet.notifications.topic",
    queueOptions: {
      durable: true,
    },
  })
  async handleTopicNotification(
    message: TopicNotificationMessage,
  ): Promise<void> {
    try {
      this.logger.log(
        `Processing topic notification: ${message.id || "unknown"} for topic ${message.topic}`,
      );

      await this.notificationService.sendTopicNotification(
        message.topic,
        message.title,
        message.body,
        message.data,
      );

      this.logger.log(`Topic notification sent successfully: ${message.id || "unknown"}`);
    } catch (error) {
      this.logger.error(
        `Failed to send topic notification: ${message.id || "unknown"}`,
        error.stack,
      );
      throw error;
    }
  }

  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "notification.email.send",
    queue: "soundmeet.notifications.email",
    queueOptions: {
      durable: true,
      arguments: {
        "x-message-ttl": 3600000, // 1 hora TTL para emails
      },
    },
  })
  async handleEmailNotification(
    message: EmailNotificationMessage,
  ): Promise<void> {
    try {
      this.logger.log(
        `Processing email notification: ${message.userId} to ${message.email}`,
      );

      // Aqui você integraria com um serviço de email como SendGrid, SES, etc.
      await this.sendEmail(message);

      this.logger.log(`Email notification sent successfully: ${message.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email notification: ${message.userId}`,
        error.stack,
      );
      throw error;
    }
  }

  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "notification.sms.send",
    queue: "soundmeet.notifications.sms",
    queueOptions: {
      durable: true,
      arguments: {
        "x-message-ttl": 1800000, // 30 minutos TTL para SMS
      },
    },
  })
  async handleSMSNotification(message: SMSNotificationMessage): Promise<void> {
    try {
      this.logger.log(
        `Processing SMS notification: ${message.userId} to ${message.phoneNumber}`,
      );

      // Aqui você integraria com um serviço de SMS como Twilio, AWS SNS, etc.
      // Use message.message instead of message.body
      // For now we just log
      this.logger.log(`SMS content: ${message.message}`);
      
      await this.sendSMS(message);

      this.logger.log(`SMS notification sent successfully: ${message.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send SMS notification: ${message.userId}`,
        error.stack,
      );
      throw error;
    }
  }

  // Métodos específicos por tipo de usuário
  private async sendMusicianNotification(
    message: PushNotificationMessage,
  ): Promise<void> {
    // Lógica específica para músicos
    const customData: Record<string, string> = {
      ...message.data,
      userType: "musician",
      soundIcon: "true", // Músicos podem ter sons personalizados
    };

    await this.notificationService.sendPushNotification(
      message.userId,
      message.title,
      message.body,
      customData,
    );
  }

  private async sendEstablishmentNotification(
    message: PushNotificationMessage,
  ): Promise<void> {
    // Lógica específica para estabelecimentos
    const customData: Record<string, string> = {
      ...message.data,
      userType: "establishment",
      businessHours: "true", // Respeitar horário comercial
    };

    await this.notificationService.sendPushNotification(
      message.userId,
      message.title,
      message.body,
      customData,
    );
  }

  private async sendAudienceNotification(
    message: PushNotificationMessage,
  ): Promise<void> {
    // Lógica específica para público
    const customData: Record<string, string> = {
      ...message.data,
      userType: "audience",
      eventBased: "true", // Notificações baseadas em eventos
    };

    await this.notificationService.sendPushNotification(
      message.userId,
      message.title,
      message.body,
      customData,
    );
  }

  private async sendGenericNotification(
    message: PushNotificationMessage,
  ): Promise<void> {
    // Notificação genérica
    await this.notificationService.sendPushNotification(
      message.userId,
      message.title,
      message.body,
      message.data,
    );
  }

  // Métodos auxiliares
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async sendEmail(message: EmailNotificationMessage): Promise<void> {
    // Implementar integração com serviço de email
    // Por exemplo: SendGrid, AWS SES, Nodemailer, etc.
    this.logger.debug(`Sending email to ${message.email}: ${message.subject}`); // Use message.email

    // Exemplo de implementação:
    // await this.emailService.send({
    //   to: message.email,
    //   subject: message.subject,
    //   html: message.template, // message.template is available in EmailNotificationMessage
    //   // data: message.data
    // });
  }

  private async sendSMS(message: SMSNotificationMessage): Promise<void> {
    // Implementar integração com serviço de SMS
    // Por exemplo: Twilio, AWS SNS, etc.
    this.logger.debug(
      `Sending SMS to ${message.phoneNumber}: ${message.message}`,
    );

    // Exemplo de implementação:
    // await this.smsService.send({
    //   to: message.phoneNumber,
    //   message: message.message,
    //   from: message.from,
    // });
  }

  // Handlers para notificações específicas do domínio
  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "notification.request.new",
    queue: "soundmeet.notifications.requests",
    queueOptions: {
      durable: true,
    },
  })
  async handleNewRequestNotification(data: {
    musicianId: string;
    songTitle: string;
    artist: string;
    message?: string;
    userId: string;
    userName: string;
  }): Promise<void> {
    try {
      await this.notificationService.sendMusicRequestNotification(
        data.musicianId,
        data.userName, // Use userName as requesterName
        data.songTitle,
        data.artist || "Desconhecido", // Use artist as establishmentName placeholder or fix parameter
      );
    } catch (error) {
      this.logger.error("Failed to send new request notification", error.stack);
      throw error;
    }
  }

  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "notification.tip.received",
    queue: "soundmeet.notifications.tips",
    queueOptions: {
      durable: true,
    },
  })
  async handleTipNotification(data: {
    musicianId: string;
    amount: number;
    message?: string;
    tipper: string;
  }): Promise<void> {
    try {
      await this.notificationService.sendTipNotification(
        data.musicianId,
        data.amount,
        data.tipper,
        data.message,
      );
    } catch (error) {
      this.logger.error("Failed to send tip notification", error.stack);
      throw error;
    }
  }

  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "notification.achievement.unlocked",
    queue: "soundmeet.notifications.achievements",
    queueOptions: {
      durable: true,
    },
  })
  async handleAchievementNotification(data: {
    userId: string;
    badgeName: string;
    description: string;
    points: number;
  }): Promise<void> {
    try {
      await this.notificationService.sendAchievementNotification(
        data.userId,
        data.badgeName,
        data.description,
        data.points,
      );
    } catch (error) {
      this.logger.error("Failed to send achievement notification", error.stack);
      throw error;
    }
  }
}
