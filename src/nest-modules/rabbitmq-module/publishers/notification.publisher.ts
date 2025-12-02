import { Injectable, Logger } from "@nestjs/common";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { ConfigService } from "@nestjs/config";
import { ConfigSchemaType } from "../../config-module/config.schema";

export interface PushNotificationMessage {
  id: string;
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
  sound?: string;
  badge?: number;
  priority: "high" | "normal";
  timestamp: Date;
  userType: "musician" | "establishment" | "audience";
  category: "request" | "tip" | "gamification" | "event" | "general";
}

export interface BulkNotificationMessage {
  id?: string;
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  priority: "high" | "normal";
  timestamp: Date;
  userType?: "musician" | "establishment" | "audience";
  category: "request" | "tip" | "gamification" | "event" | "general";
}

export interface TopicNotificationMessage {
  id?: string;
  topic: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  priority: "high" | "normal";
  timestamp: Date;
  category: "request" | "tip" | "gamification" | "event" | "general";
}

export interface EmailNotificationMessage {
  id?: string;
  userId: string;
  email: string;
  subject: string;
  template: string;
  data: Record<string, any>;
  priority: "high" | "normal" | "low";
  timestamp: Date;
  category: "welcome" | "request" | "tip" | "event" | "marketing";
}

export interface SMSNotificationMessage {
  id?: string;
  userId: string;
  phoneNumber: string;
  message: string;
  priority: "high" | "normal";
  timestamp: Date;
  category: "verification" | "alert" | "reminder";
}

@Injectable()
export class NotificationPublisher {
  private readonly logger = new Logger(NotificationPublisher.name);
  private readonly exchange: string;

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly configService: ConfigSchemaType,
  ) {
    this.exchange = this.configService.get("RABBITMQ_EXCHANGE")!;
  }

  async publishPushNotification(
    message: PushNotificationMessage,
  ): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        `notification.push.${message.category}`,
        message,
        {
          persistent: true,
          priority: this.getPriority(message.priority),
          timestamp: Date.now(),
          messageId: message.id,
          correlationId: `notification-${message.id}`,
          headers: {
            userType: message.userType,
            category: message.category,
          },
        },
      );

      this.logger.log(
        `Push notification published: ${message.id} for user ${message.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish push notification: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishBulkNotification(
    message: BulkNotificationMessage,
  ): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        `notification.bulk.${message.category}`,
        message,
        {
          persistent: true,
          priority: this.getPriority(message.priority),
          timestamp: Date.now(),
          messageId: `bulk-${Date.now()}`,
          headers: {
            userType: message.userType,
            category: message.category,
            userCount: message.userIds.length,
          },
        },
      );

      this.logger.log(
        `Bulk notification published for ${message.userIds.length} users`,
      );
    } catch (error) {
      this.logger.error(`Failed to publish bulk notification`, error.stack);
      throw error;
    }
  }

  async publishTopicNotification(
    message: TopicNotificationMessage,
  ): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        `notification.topic.${message.category}`,
        message,
        {
          persistent: true,
          priority: this.getPriority(message.priority),
          timestamp: Date.now(),
          messageId: `topic-${message.topic}-${Date.now()}`,
          headers: {
            topic: message.topic,
            category: message.category,
          },
        },
      );

      this.logger.log(
        `Topic notification published for topic: ${message.topic}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish topic notification: ${message.topic}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishEmailNotification(
    message: EmailNotificationMessage,
  ): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        `notification.email.${message.category}`,
        message,
        {
          persistent: true,
          priority: this.getPriority(message.priority),
          timestamp: Date.now(),
          messageId: `email-${message.userId}-${Date.now()}`,
          correlationId: `user-${message.userId}`,
          headers: {
            category: message.category,
            template: message.template,
          },
        },
      );

      this.logger.log(
        `Email notification published: ${message.subject} for user ${message.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish email notification for user: ${message.userId}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishSMSNotification(message: SMSNotificationMessage): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        `notification.sms.${message.category}`,
        message,
        {
          persistent: true,
          priority: this.getPriority(message.priority),
          timestamp: Date.now(),
          messageId: `sms-${message.userId}-${Date.now()}`,
          correlationId: `user-${message.userId}`,
          headers: {
            category: message.category,
          },
        },
      );

      this.logger.log(`SMS notification published for user ${message.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish SMS notification for user: ${message.userId}`,
        error.stack,
      );
      throw error;
    }
  }

  // Métodos específicos para diferentes tipos de notificação
  async publishRequestNotification(
    userId: string,
    musicianName: string,
    songTitle: string,
    status: "accepted" | "rejected",
  ): Promise<void> {
    const message: PushNotificationMessage = {
      id: `request-${userId}-${Date.now()}`,
      userId,
      title: status === "accepted" ? "🎵 Pedido Aceito!" : "❌ Pedido Recusado",
      body:
        status === "accepted"
          ? `${musicianName} aceitou seu pedido: ${songTitle}`
          : `${musicianName} recusou seu pedido: ${songTitle}`,
      data: {
        type: "request_status",
        status,
        songTitle,
        musicianName,
      },
      priority: "high",
      timestamp: new Date(),
      userType: "audience",
      category: "request",
    };

    await this.publishPushNotification(message);
  }

  async publishTipNotification(
    musicianId: string,
    amount: number,
    senderName?: string,
  ): Promise<void> {
    const message: PushNotificationMessage = {
      id: `tip-${musicianId}-${Date.now()}`,
      userId: musicianId,
      title: "💰 Nova Gorjeta!",
      body: senderName
        ? `${senderName} enviou R$ ${amount.toFixed(2)} de gorjeta!`
        : `Você recebeu R$ ${amount.toFixed(2)} de gorjeta!`,
      data: {
        type: "tip_received",
        amount: amount.toString(),
        senderName: senderName || "Anônimo",
      },
      priority: "high",
      timestamp: new Date(),
      userType: "musician",
      category: "tip",
    };

    await this.publishPushNotification(message);
  }

  async publishGamificationNotification(
    userId: string,
    type: "badge" | "points" | "level",
    title: string,
    description: string,
    data?: Record<string, string>,
  ): Promise<void> {
    const message: PushNotificationMessage = {
      id: `gamification-${userId}-${Date.now()}`,
      userId,
      title,
      body: description,
      data: {
        type: `gamification_${type}`,
        ...data,
      },
      priority: "normal",
      timestamp: new Date(),
      userType: "audience",
      category: "gamification",
    };

    await this.publishPushNotification(message);
  }

  private getPriority(priority: string): number {
    switch (priority) {
      case "high":
        return 10;
      case "normal":
        return 5;
      case "low":
        return 1;
      default:
        return 5;
    }
  }
}
