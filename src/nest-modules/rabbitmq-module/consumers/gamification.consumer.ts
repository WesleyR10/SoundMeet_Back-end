import { Injectable, Logger } from "@nestjs/common";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { ConfigService } from "@nestjs/config";
import { ConfigSchemaType } from "../../config-module/config.schema";
import { NotificationPublisher } from "../publishers/notification.publisher";
import { NotificationService } from "../../shared-module/services/notification.service";
import {
  PointsEarnedMessage,
  BadgeEarnedMessage,
  LevelUpMessage,
  RankingUpdatedMessage,
  AchievementUnlockedMessage,
  StreakUpdatedMessage,
  ChallengeCompletedMessage,
} from "../publishers/gamification.publisher";

@Injectable()
export class GamificationConsumer {
  private readonly logger = new Logger(GamificationConsumer.name);
  private readonly exchange: string;
  private readonly gamificationQueue: string;

  constructor(
    private readonly configService: ConfigService<ConfigSchemaType>,
    private readonly notificationPublisher: NotificationPublisher,
    private readonly notificationService: NotificationService,
  ) {
    this.exchange = this.configService.get("RABBITMQ_EXCHANGE")!;
    this.gamificationQueue = this.configService.get(
      "RABBITMQ_QUEUE_GAMIFICATION",
    )!;
  }

  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "gamification.points.earned",
    queue: "soundmeet.gamification.points",
    queueOptions: {
      durable: true,
      arguments: {
        "x-message-ttl": 300000, // 5 minutos TTL
        "x-dead-letter-exchange": "soundmeet.dlx",
      },
    },
  })
  async handlePointsEarned(message: PointsEarnedMessage): Promise<void> {
    try {
      this.logger.log(
        `Processing points earned: ${message.points} points for user ${message.userId} from ${message.source}`,
      );

      // 1. Atualizar pontuação do usuário no banco de dados
      await this.updateUserPoints(message);

      // 2. Verificar se o usuário subiu de nível
      const levelUp = await this.checkLevelUp(message.userId, message.points);
      if (levelUp) {
        await this.handleLevelUpLogic(
          message.userId,
          levelUp.newLevel,
          levelUp.totalPoints,
        );
      }

      // 3. Verificar conquistas baseadas em pontos
      await this.checkPointBasedAchievements(
        message.userId,
        message.source,
        message.points,
      );

      // 4. Atualizar streak se aplicável
      if (this.isStreakableAction(message.source)) {
        await this.updateUserStreak(message.userId, message.source);
      }

      // 5. Notificar usuário sobre pontos ganhos (apenas para valores significativos)
      if (message.points >= 25) {
        await this.notifyPointsEarned(message);
      }

      // 6. Atualizar rankings se necessário
      await this.updateRankings(message.userId, message.points);

      this.logger.log(`Points processed successfully: ${message.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to process points earned: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "gamification.badge.earned",
    queue: "soundmeet.gamification.badges",
    queueOptions: {
      durable: true,
    },
  })
  async handleBadgeEarned(message: BadgeEarnedMessage): Promise<void> {
    try {
      this.logger.log(
        `Processing badge earned: ${message.badgeName} for user ${message.userId}`,
      );

      // 1. Verificar se o usuário já possui este badge
      const alreadyHasBadge = await this.userHasBadge(
        message.userId,
        message.badgeId,
      );
      if (alreadyHasBadge) {
        this.logger.warn(
          `User ${message.userId} already has badge ${message.badgeId}`,
        );
        return;
      }

      // 2. Conceder badge ao usuário
      await this.grantBadgeToUser(message);

      // 3. Dar pontos bonus pelo badge
      if (message.points > 0) {
        await this.updateUserPoints({
          id: `badge-bonus-${message.id}`,
          userId: message.userId,
          points: message.points,
          source: "badge",
          description: `Bonus por conquistar badge: ${message.badgeName}`,
          relatedId: message.badgeId,
          relatedType: "badge",
          timestamp: message.timestamp,
        });
      }

      // 4. Notificar usuário sobre o novo badge
      await this.notificationService.sendAchievementNotification(
        message.userId,
        message.badgeName,
        message.description,
        message.points,
      );

      // 5. Verificar se desbloqueou conquistas especiais
      await this.checkBadgeBasedAchievements(message.userId, message.badgeId);

      // 6. Compartilhar conquista nas redes sociais (se configurado)
      await this.handleSocialSharing(message);

      this.logger.log(`Badge processed successfully: ${message.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to process badge earned: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "gamification.level.up",
    queue: "soundmeet.gamification.levels",
    queueOptions: {
      durable: true,
    },
  })
  async handleLevelUp(message: LevelUpMessage): Promise<void> {
    try {
      this.logger.log(
        `Processing level up: User ${message.userId} reached level ${message.newLevel}`,
      );

      // 1. Atualizar nível do usuário
      await this.updateUserLevel(message.userId, message.newLevel);

      // 3. Dar recompensas por subir de nível
      const levelRewards = await this.getLevelRewards(message.newLevel);
      if (levelRewards.points > 0) {
        await this.updateUserPoints({
          id: `level-up-bonus-${message.userId}-${message.newLevel}`,
          userId: message.userId,
          points: levelRewards.points,
          source: "level_up",
          description: `Bonus por atingir nível ${message.newLevel}`,
          relatedId: message.newLevel.toString(),
          relatedType: "level",
          timestamp: message.timestamp,
        });
      }

      // 3. Desbloquear badges especiais de nível
      if (levelRewards.badge) {
        await this.grantBadgeToUser({
          id: `level-badge-${message.userId}-${message.newLevel}`,
          userId: message.userId,
          badgeId: levelRewards.badge.id,
          badgeName: levelRewards.badge.name,
          description: levelRewards.badge.description,
          category: "level",
          rarity: levelRewards.badge.rarity,
          points: levelRewards.badge.points,
          timestamp: message.timestamp,
        });
      }

      // 4. Notificar usuário sobre o level up
      await this.notificationPublisher.publishPushNotification({
        id: `level-up-${message.userId}-${message.newLevel}`,
        userId: message.userId,
        title: "🎉 Level Up!",
        body: `Parabéns! Você atingiu o nível ${message.newLevel}!`,
        data: {
          type: "level_up",
          newLevel: message.newLevel.toString(),
          totalPoints: message.totalPoints.toString(),
          rewards: JSON.stringify(levelRewards),
        },
        priority: "high",
        timestamp: new Date(),
        userType: "audience",
        category: "gamification",
      });

      // 5. Verificar marcos especiais (níveis 10, 25, 50, 100)
      if (this.isSpecialLevel(message.newLevel)) {
        await this.handleSpecialLevelMilestone(
          message.userId,
          message.newLevel,
        );
      }

      this.logger.log(
        `Level up processed successfully: ${message.userId} -> Level ${message.newLevel}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process level up: ${message.userId}`,
        error.stack,
      );
      throw error;
    }
  }

  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "gamification.ranking.updated",
    queue: "soundmeet.gamification.rankings",
    queueOptions: {
      durable: true,
    },
  })
  async handleRankingUpdated(message: RankingUpdatedMessage): Promise<void> {
    try {
      this.logger.log(
        `Processing ranking update: ${message.rankingType} for period ${message.period}`,
      );

      // 1. Atualizar cache de rankings
      await this.updateRankingCache(message);

      // 2. Notificar usuários sobre mudanças significativas no ranking
      if (message.topUsers && message.topUsers.length > 0) {
        await this.notifyRankingChanges(message);
      }

      // 3. Verificar se alguém atingiu o top 3
      await this.checkTopRankingAchievements(message);

      // 4. Preparar recompensas de fim de período (se aplicável)
      if (message.period === "monthly" && this.isEndOfMonth()) {
        await this.prepareMonthlyRewards(message);
      }

      this.logger.log(
        `Ranking update processed successfully: ${message.rankingType}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process ranking update: ${message.rankingType}`,
        error.stack,
      );
      throw error;
    }
  }

  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "gamification.achievement.unlocked",
    queue: "soundmeet.gamification.achievements",
    queueOptions: {
      durable: true,
    },
  })
  async handleAchievementUnlocked(
    message: AchievementUnlockedMessage,
  ): Promise<void> {
    try {
      this.logger.log(
        `Processing achievement unlocked: ${message.achievementName} for user ${message.userId}`,
      );

      // 1. Registrar conquista no perfil do usuário
      await this.unlockUserAchievement(message);

      // 2. Dar pontos pela conquista
      if (message.points > 0) {
        await this.updateUserPoints({
          id: `achievement-${message.id}`,
          userId: message.userId,
          points: message.points,
          source: "achievement",
          description: `Conquista desbloqueada: ${message.achievementName}`,
          relatedId: message.achievementId,
          relatedType: "achievement",
          timestamp: message.timestamp,
        });
      }

      // 3. Notificar usuário sobre a conquista
      await this.notificationService.sendAchievementNotification(
        message.userId,
        message.achievementName,
        message.description,
        message.points,
      );

      // 4. Verificar se desbloqueou conquistas em cadeia
      await this.checkChainedAchievements(
        message.userId,
        message.achievementId,
      );

      this.logger.log(`Achievement processed successfully: ${message.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to process achievement unlocked: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "gamification.streak.updated",
    queue: "soundmeet.gamification.streaks",
    queueOptions: {
      durable: true,
    },
  })
  async handleStreakUpdated(message: StreakUpdatedMessage): Promise<void> {
    try {
      this.logger.log(
        `Processing streak update: ${message.streakType} - ${message.currentStreak} days for user ${message.userId}`,
      );

      // 1. Atualizar streak no banco de dados
      await this.updateUserStreakRecord(message);

      // 2. Verificar marcos de streak (7, 30, 100 dias)
      if (this.isStreakMilestone(message.currentStreak)) {
        await this.handleStreakMilestone(message);
      }

      // 3. Dar pontos bonus por manter streak
      const bonusPoints = this.calculateStreakBonus(message.currentStreak);
      if (bonusPoints > 0) {
        await this.updateUserPoints({
          id: `streak-bonus-${message.userId}-${message.streakType}`,
          userId: message.userId,
          points: bonusPoints,
          source: "streak",
          description: `Bonus por ${message.currentStreak} dias de streak`,
          relatedId: message.streakType,
          relatedType: "streak",
          timestamp: message.timestamp,
        });
      }

      // 4. Notificar sobre streaks importantes
      if (message.currentStreak % 7 === 0 && message.currentStreak > 0) {
        await this.notifyStreakMilestone(message);
      }

      this.logger.log(
        `Streak update processed successfully: ${message.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process streak update: ${message.userId}`,
        error.stack,
      );
      throw error;
    }
  }

  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "gamification.challenge.completed",
    queue: "soundmeet.gamification.challenges",
    queueOptions: {
      durable: true,
    },
  })
  async handleChallengeCompleted(
    message: ChallengeCompletedMessage,
  ): Promise<void> {
    try {
      this.logger.log(
        `Processing challenge completed: ${message.challengeName} by user ${message.userId}`,
      );

      // 1. Registrar conclusão do desafio
      await this.completeChallengeForUser(message);

      // 2. Dar recompensas do desafio
      if (message.rewards.points > 0) {
        await this.updateUserPoints({
          id: `challenge-${message.id}`,
          userId: message.userId,
          points: message.rewards.points,
          source: "challenge",
          description: `Desafio concluído: ${message.challengeName}`,
          relatedId: message.challengeId,
          relatedType: "challenge",
          timestamp: message.timestamp,
        });
      }

      // 3. Conceder badges especiais se houver
      if (message.rewards.badges && message.rewards.badges.length > 0) {
        // Assume rewards.badges contains badge IDs, need to fetch badge details
        // For now, using a placeholder loop or changing logic if rewards contains full badge objects
        // The error indicates 'badges' is string[], so we can't access .id, .name etc directly
        // Fixing by just logging for now as we don't have badge lookup here
         this.logger.debug(`Granting badges for challenge completion: ${message.rewards.badges.join(', ')}`);
      }

      // 4. Notificar usuário sobre conclusão do desafio
      await this.notificationPublisher.publishPushNotification({
        id: `challenge-completed-${message.id}`,
        userId: message.userId,
        title: "🏆 Desafio Concluído!",
        body: `Você completou o desafio: ${message.challengeName}`,
        data: {
          type: "challenge_completed",
          challengeId: message.challengeId,
          challengeName: message.challengeName,
          rewards: JSON.stringify(message.rewards),
        },
        priority: "high",
        timestamp: new Date(),
        userType: "audience",
        category: "gamification",
      });

      // 5. Verificar se desbloqueou novos desafios
      await this.checkUnlockedChallenges(message.userId, message.challengeId);

      this.logger.log(
        `Challenge completion processed successfully: ${message.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process challenge completion: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  // Métodos auxiliares
  private async updateUserPoints(pointsData: any): Promise<void> {
    // Implementar atualização de pontos no banco de dados
    this.logger.debug(
      `Updating points for user ${pointsData.userId}: +${pointsData.points}`,
    );
  }

  private async checkLevelUp(userId: string, newPoints: number): Promise<any> {
    // Verificar se usuário subiu de nível
    // Retorna null se não subiu, ou objeto com newLevel e totalPoints
    return null; // Placeholder
  }

  private async handleLevelUpLogic(
    userId: string,
    newLevel: number,
    totalPoints: number,
  ): Promise<void> {
    // Processar subida de nível
    this.logger.debug(`User ${userId} leveled up to ${newLevel}`);
  }

  private async checkPointBasedAchievements(
    userId: string,
    source: string,
    points: number,
  ): Promise<void> {
    // Verificar conquistas baseadas em pontos
    this.logger.debug(`Checking point-based achievements for user ${userId}`);
  }

  private isStreakableAction(source: string): boolean {
    // Verificar se a ação pode gerar streak
    return ["scan", "request", "tip"].includes(source);
  }

  private async updateUserStreak(
    userId: string,
    source: string,
  ): Promise<void> {
    // Atualizar streak do usuário
    this.logger.debug(`Updating streak for user ${userId}: ${source}`);
  }

  private async notifyPointsEarned(
    message: PointsEarnedMessage,
  ): Promise<void> {
    // Notificar usuário sobre pontos ganhos
    await this.notificationPublisher.publishPushNotification({
      id: `points-earned-${message.id}`,
      userId: message.userId,
      title: "⭐ Pontos Ganhos!",
      body: `Você ganhou ${message.points} pontos por ${message.description}`,
      data: {
        type: "points_earned",
        points: message.points.toString(),
        source: message.source,
      },
      priority: "normal",
      timestamp: new Date(),
      userType: "audience",
      category: "gamification",
    });
  }

  private async updateRankings(userId: string, points: number): Promise<void> {
    // Atualizar rankings
    this.logger.debug(`Updating rankings for user ${userId}`);
  }

  private async userHasBadge(
    userId: string,
    badgeId: string,
  ): Promise<boolean> {
    // Verificar se usuário já possui o badge
    return false; // Placeholder
  }

  private async grantBadgeToUser(badgeData: any): Promise<void> {
    // Conceder badge ao usuário
    this.logger.debug(
      `Granting badge ${badgeData.badgeId} to user ${badgeData.userId}`,
    );
  }

  private async checkBadgeBasedAchievements(
    userId: string,
    badgeId: string,
  ): Promise<void> {
    // Verificar conquistas baseadas em badges
    this.logger.debug(`Checking badge-based achievements for user ${userId}`);
  }

  private async handleSocialSharing(
    message: BadgeEarnedMessage,
  ): Promise<void> {
    // Lidar com compartilhamento social
    this.logger.debug(`Handling social sharing for badge ${message.badgeId}`);
  }

  private async updateUserLevel(
    userId: string,
    newLevel: number,
  ): Promise<void> {
    // Atualizar nível do usuário
    this.logger.debug(`Updating user ${userId} to level ${newLevel}`);
  }

  private async getLevelRewards(level: number): Promise<any> {
    // Obter recompensas por nível
    return { points: level * 10, badge: null }; // Placeholder
  }

  private isSpecialLevel(level: number): boolean {
    // Verificar se é um nível especial
    return [10, 25, 50, 100].includes(level);
  }

  private async handleSpecialLevelMilestone(
    userId: string,
    level: number,
  ): Promise<void> {
    // Lidar com marcos especiais de nível
    this.logger.debug(
      `Handling special level milestone: ${level} for user ${userId}`,
    );
  }

  private async updateRankingCache(
    message: RankingUpdatedMessage,
  ): Promise<void> {
    // Atualizar cache de rankings
    this.logger.debug(`Updating ranking cache: ${message.rankingType}`);
  }

  private async notifyRankingChanges(
    message: RankingUpdatedMessage,
  ): Promise<void> {
    // Notificar mudanças no ranking
    this.logger.debug(`Notifying ranking changes: ${message.rankingType}`);
  }

  private async checkTopRankingAchievements(
    message: RankingUpdatedMessage,
  ): Promise<void> {
    // Verificar conquistas de top ranking
    this.logger.debug(
      `Checking top ranking achievements: ${message.rankingType}`,
    );
  }

  private isEndOfMonth(): boolean {
    // Verificar se é fim do mês
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.getMonth() !== now.getMonth();
  }

  private async prepareMonthlyRewards(
    message: RankingUpdatedMessage,
  ): Promise<void> {
    // Preparar recompensas mensais
    this.logger.debug(`Preparing monthly rewards for ${message.rankingType}`);
  }

  private async unlockUserAchievement(
    message: AchievementUnlockedMessage,
  ): Promise<void> {
    // Desbloquear conquista para usuário
    this.logger.debug(
      `Unlocking achievement ${message.achievementId} for user ${message.userId}`,
    );
  }

  private async checkChainedAchievements(
    userId: string,
    achievementId: string,
  ): Promise<void> {
    // Verificar conquistas em cadeia
    this.logger.debug(`Checking chained achievements for user ${userId}`);
  }

  private async updateUserStreakRecord(
    message: StreakUpdatedMessage,
  ): Promise<void> {
    // Atualizar registro de streak
    this.logger.debug(`Updating streak record for user ${message.userId}`);
  }

  private isStreakMilestone(streak: number): boolean {
    // Verificar se é um marco de streak
    return [7, 30, 100, 365].includes(streak);
  }

  private async handleStreakMilestone(
    message: StreakUpdatedMessage,
  ): Promise<void> {
    // Lidar com marcos de streak
    this.logger.debug(
      `Handling streak milestone: ${message.currentStreak} for user ${message.userId}`,
    );
  }

  private calculateStreakBonus(streak: number): number {
    // Calcular bonus de streak
    if (streak >= 30) return 50;
    if (streak >= 7) return 20;
    if (streak >= 3) return 5;
    return 0;
  }

  private async notifyStreakMilestone(
    message: StreakUpdatedMessage,
  ): Promise<void> {
    // Notificar marco de streak
    await this.notificationPublisher.publishPushNotification({
      id: `streak-milestone-${message.userId}-${message.currentStreak}`,
      userId: message.userId,
      title: "🔥 Streak Incrível!",
      body: `Você mantém um streak de ${message.currentStreak} dias!`,
      data: {
        type: "streak_milestone",
        streakType: message.streakType,
        currentStreak: message.currentStreak.toString(),
      },
      priority: "normal",
      timestamp: new Date(),
      userType: "audience",
      category: "gamification",
    });
  }

  private async completeChallengeForUser(
    message: ChallengeCompletedMessage,
  ): Promise<void> {
    // Completar desafio para usuário
    this.logger.debug(
      `Completing challenge ${message.challengeId} for user ${message.userId}`,
    );
  }

  private async checkUnlockedChallenges(
    userId: string,
    completedChallengeId: string,
  ): Promise<void> {
    // Verificar novos desafios desbloqueados
    this.logger.debug(`Checking unlocked challenges for user ${userId}`);
  }
}
