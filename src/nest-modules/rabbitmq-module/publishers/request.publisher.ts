import { Injectable, Logger } from "@nestjs/common";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { ConfigService } from "@nestjs/config";
import { ConfigSchemaType } from "../../config-module/config.schema";

export interface MusicRequestMessage {
  id: string;
  musicianId: string;
  userId: string;
  eventId?: string;
  songTitle: string;
  artist?: string;
  message?: string;
  priority: "low" | "normal" | "high";
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface RequestVoteMessage {
  requestId: string;
  userId: string;
  musicianId: string;
  eventId?: string;
  voteType: "up" | "down";
  timestamp: Date;
}

export interface RequestStatusMessage {
  requestId: string;
  musicianId: string;
  userId: string;
  eventId?: string;
  status: "pending" | "accepted" | "rejected" | "completed";
  response?: string;
  timestamp: Date;
}

export interface RequestFeedbackMessage {
  requestId: string;
  musicianId: string;
  userId: string;
  rating: number;
  comment?: string;
  timestamp: Date;
}

@Injectable()
export class RequestPublisher {
  private readonly logger = new Logger(RequestPublisher.name);
  private readonly exchange: string;

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly configService: ConfigSchemaType,
  ) {
    this.exchange = this.configService.get("RABBITMQ_EXCHANGE")!;
  }

  async publishMusicRequest(message: MusicRequestMessage): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        "request.music.created",
        message,
        {
          persistent: true,
          priority: this.getPriority(message.priority),
          timestamp: Date.now(),
          messageId: message.id,
          correlationId: `request-${message.id}`,
        },
      );

      this.logger.log(
        `Music request published: ${message.id} for musician ${message.musicianId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish music request: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishRequestVote(message: RequestVoteMessage): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        "request.vote.created",
        message,
        {
          persistent: true,
          timestamp: Date.now(),
          messageId: `vote-${message.requestId}-${message.userId}`,
          correlationId: `request-${message.requestId}`,
        },
      );

      this.logger.log(
        `Request vote published: ${message.requestId} by user ${message.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish request vote: ${message.requestId}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishRequestStatusUpdate(
    message: RequestStatusMessage,
  ): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        `request.status.${message.status}`,
        message,
        {
          persistent: true,
          priority: message.status === "accepted" ? 5 : 3,
          timestamp: Date.now(),
          messageId: `status-${message.requestId}`,
          correlationId: `request-${message.requestId}`,
        },
      );

      this.logger.log(
        `Request status update published: ${message.requestId} -> ${message.status}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish request status update: ${message.requestId}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishRequestFeedback(message: RequestFeedbackMessage): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        "request.feedback.created",
        message,
        {
          persistent: true,
          timestamp: Date.now(),
          messageId: `feedback-${message.requestId}`,
          correlationId: `request-${message.requestId}`,
        },
      );

      this.logger.log(
        `Request feedback published: ${message.requestId} with rating ${message.rating}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish request feedback: ${message.requestId}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishBulkRequestUpdate(
    requests: RequestStatusMessage[],
  ): Promise<void> {
    try {
      const promises = requests.map((request) =>
        this.publishRequestStatusUpdate(request),
      );

      await Promise.all(promises);

      this.logger.log(
        `Bulk request update published: ${requests.length} requests`,
      );
    } catch (error) {
      this.logger.error("Failed to publish bulk request update", error.stack);
      throw error;
    }
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
