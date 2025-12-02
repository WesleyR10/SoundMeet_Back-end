import { Injectable, Logger } from "@nestjs/common";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { ConfigService } from "@nestjs/config";
import { ConfigSchemaType } from "../../config-module/config.schema";

export interface PointsEarnedMessage {
  id: string;
  userId: string;
  points: number;
  source:
    | "scan_qr"
    | "request"
    | "tip"
    | "share"
    | "accepted_request"
    | "vote"
    | "feedback";
  description: string;
  relatedId?: string; // ID do pedido, gorjeta, etc.
  relatedType?: "request" | "tip" | "vote" | "share" | "feedback";
  multiplier?: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface BadgeEarnedMessage {
  id: string;
  userId: string;
  badgeId: string;
  badgeName: string;
  badgeCategory: "engagement" | "support" | "discovery" | "social";
  badgeRarity: "common" | "rare" | "epic" | "legendary";
  points: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface LevelUpMessage {
  id: string;
  userId: string;
  previousLevel: number;
  newLevel: number;
  totalPoints: number;
  rewards?: {
    badges?: string[];
    perks?: string[];
    unlocks?: string[];
  };
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface RankingUpdateMessage {
  id: string;
  type: "monthly" | "weekly" | "all_time";
  category:
    | "top_fans"
    | "top_suggestions"
    | "top_supporters"
    | "top_discoverers";
  rankings: {
    userId: string;
    position: number;
    points: number;
    previousPosition?: number;
  }[];
  period: {
    start: Date;
    end: Date;
  };
  timestamp: Date;
}

export interface AchievementUnlockedMessage {
  id: string;
  userId: string;
  achievementId: string;
  achievementName: string;
  achievementType: "milestone" | "streak" | "special" | "seasonal";
  description: string;
  points: number;
  rewards?: {
    badges?: string[];
    perks?: string[];
    unlocks?: string[];
  };
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface StreakUpdateMessage {
  id: string;
  userId: string;
  streakType: "daily_scan" | "weekly_request" | "monthly_tip";
  currentStreak: number;
  bestStreak: number;
  isNewRecord: boolean;
  bonusPoints?: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ChallengeCompletedMessage {
  id: string;
  userId: string;
  challengeId: string;
  challengeName: string;
  challengeType: "daily" | "weekly" | "monthly" | "special";
  progress: {
    current: number;
    target: number;
    completed: boolean;
  };
  rewards: {
    points: number;
    badges?: string[];
    perks?: string[];
  };
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class GamificationPublisher {
  private readonly logger = new Logger(GamificationPublisher.name);
  private readonly exchange: string;

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly configService: ConfigSchemaType,
  ) {
    this.exchange = this.configService.get("RABBITMQ_EXCHANGE")!;
  }

  async publishPointsEarned(message: PointsEarnedMessage): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        `gamification.points.${message.source}`,
        message,
        {
          persistent: true,
          priority: 6,
          timestamp: Date.now(),
          messageId: message.id,
          correlationId: `points-${message.userId}`,
          headers: {
            userId: message.userId,
            source: message.source,
            points: message.points.toString(),
            relatedType: message.relatedType,
          },
        },
      );

      this.logger.log(
        `Points earned published: ${message.userId} earned ${message.points} points from ${message.source}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish points earned: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishBadgeEarned(message: BadgeEarnedMessage): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        `gamification.badge.${message.badgeCategory}`,
        message,
        {
          persistent: true,
          priority: 8, // Alta prioridade para badges
          timestamp: Date.now(),
          messageId: message.id,
          correlationId: `badge-${message.userId}`,
          headers: {
            userId: message.userId,
            badgeId: message.badgeId,
            badgeName: message.badgeName,
            badgeCategory: message.badgeCategory,
            badgeRarity: message.badgeRarity,
          },
        },
      );

      this.logger.log(
        `Badge earned published: ${message.userId} earned ${message.badgeName} (${message.badgeRarity})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish badge earned: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishLevelUp(message: LevelUpMessage): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        "gamification.level.up",
        message,
        {
          persistent: true,
          priority: 9, // Máxima prioridade para level up
          timestamp: Date.now(),
          messageId: message.id,
          correlationId: `level-${message.userId}`,
          headers: {
            userId: message.userId,
            previousLevel: message.previousLevel.toString(),
            newLevel: message.newLevel.toString(),
            totalPoints: message.totalPoints.toString(),
          },
        },
      );

      this.logger.log(
        `Level up published: ${message.userId} leveled up from ${message.previousLevel} to ${message.newLevel}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish level up: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishRankingUpdate(message: RankingUpdateMessage): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        `gamification.ranking.${message.category}`,
        message,
        {
          persistent: true,
          priority: 5,
          timestamp: Date.now(),
          messageId: message.id,
          headers: {
            type: message.type,
            category: message.category,
            rankingCount: message.rankings.length.toString(),
          },
        },
      );

      this.logger.log(
        `Ranking update published: ${message.category} (${message.type}) with ${message.rankings.length} entries`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish ranking update: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishAchievementUnlocked(
    message: AchievementUnlockedMessage,
  ): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        `gamification.achievement.${message.achievementType}`,
        message,
        {
          persistent: true,
          priority: 8,
          timestamp: Date.now(),
          messageId: message.id,
          correlationId: `achievement-${message.userId}`,
          headers: {
            userId: message.userId,
            achievementId: message.achievementId,
            achievementName: message.achievementName,
            achievementType: message.achievementType,
            points: message.points.toString(),
          },
        },
      );

      this.logger.log(
        `Achievement unlocked published: ${message.userId} unlocked ${message.achievementName}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish achievement unlocked: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishStreakUpdate(message: StreakUpdateMessage): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        `gamification.streak.${message.streakType}`,
        message,
        {
          persistent: true,
          priority: 6,
          timestamp: Date.now(),
          messageId: message.id,
          correlationId: `streak-${message.userId}`,
          headers: {
            userId: message.userId,
            streakType: message.streakType,
            currentStreak: message.currentStreak.toString(),
            isNewRecord: message.isNewRecord.toString(),
          },
        },
      );

      this.logger.log(
        `Streak update published: ${message.userId} has ${message.currentStreak} ${message.streakType} streak`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish streak update: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishChallengeCompleted(
    message: ChallengeCompletedMessage,
  ): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        `gamification.challenge.${message.challengeType}`,
        message,
        {
          persistent: true,
          priority: 7,
          timestamp: Date.now(),
          messageId: message.id,
          correlationId: `challenge-${message.userId}`,
          headers: {
            userId: message.userId,
            challengeId: message.challengeId,
            challengeName: message.challengeName,
            challengeType: message.challengeType,
            completed: message.progress.completed.toString(),
          },
        },
      );

      this.logger.log(
        `Challenge completed published: ${message.userId} completed ${message.challengeName}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish challenge completed: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  // Métodos de conveniência para casos específicos
  async publishQRScanPoints(userId: string, musicianId: string): Promise<void> {
    const message: PointsEarnedMessage = {
      id: `qr-scan-${userId}-${Date.now()}`,
      userId,
      points: 10,
      source: "scan_qr",
      description: "Escaneou QR code de músico",
      relatedId: musicianId,
      relatedType: "request",
      timestamp: new Date(),
      metadata: {
        musicianId,
      },
    };

    await this.publishPointsEarned(message);
  }

  async publishRequestPoints(userId: string, requestId: string): Promise<void> {
    const message: PointsEarnedMessage = {
      id: `request-${userId}-${Date.now()}`,
      userId,
      points: 25,
      source: "request",
      description: "Fez um pedido musical",
      relatedId: requestId,
      relatedType: "request",
      timestamp: new Date(),
      metadata: {
        requestId,
      },
    };

    await this.publishPointsEarned(message);
  }

  async publishTipPoints(
    userId: string,
    tipId: string,
    amount: number,
  ): Promise<void> {
    const points = Math.floor(amount); // 1 ponto por real
    const message: PointsEarnedMessage = {
      id: `tip-${userId}-${Date.now()}`,
      userId,
      points,
      source: "tip",
      description: `Enviou gorjeta de R$ ${amount.toFixed(2)}`,
      relatedId: tipId,
      relatedType: "tip",
      timestamp: new Date(),
      metadata: {
        tipId,
        amount,
      },
    };

    await this.publishPointsEarned(message);
  }

  async publishAcceptedRequestPoints(
    userId: string,
    requestId: string,
  ): Promise<void> {
    const message: PointsEarnedMessage = {
      id: `accepted-${userId}-${Date.now()}`,
      userId,
      points: 50,
      source: "accepted_request",
      description: "Pedido musical foi aceito",
      relatedId: requestId,
      relatedType: "request",
      timestamp: new Date(),
      metadata: {
        requestId,
      },
    };

    await this.publishPointsEarned(message);
  }

  async publishBulkPointsUpdate(
    pointsMessages: PointsEarnedMessage[],
  ): Promise<void> {
    try {
      const promises = pointsMessages.map((message) =>
        this.publishPointsEarned(message),
      );
      await Promise.all(promises);

      this.logger.log(
        `Bulk points update published: ${pointsMessages.length} point updates`,
      );
    } catch (error) {
      this.logger.error("Failed to publish bulk points update", error.stack);
      throw error;
    }
  }
}
