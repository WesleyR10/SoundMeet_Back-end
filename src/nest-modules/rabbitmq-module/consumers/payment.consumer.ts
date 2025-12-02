import { Injectable, Logger } from "@nestjs/common";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { ConfigService } from "@nestjs/config";
import { ConfigSchemaType } from "../../config-module/config.schema";
import { NotificationPublisher } from "../publishers/notification.publisher";
import { GamificationPublisher } from "../publishers/gamification.publisher";
import { NotificationService } from "../../shared-module/services/notification.service";
import {
  TipMessage,
  PaymentWebhookMessage,
  PayoutMessage,
  RefundMessage,
  SubscriptionMessage,
  WalletTransactionMessage,
} from "../publishers/payment.publisher";

@Injectable()
export class PaymentConsumer {
  private readonly logger = new Logger(PaymentConsumer.name);
  private readonly exchange: string;
  private readonly paymentQueue: string;

  constructor(
    private readonly configService: ConfigSchemaType,
    private readonly notificationPublisher: NotificationPublisher,
    private readonly gamificationPublisher: GamificationPublisher,
    private readonly notificationService: NotificationService,
  ) {
    this.exchange = this.configService.get("RABBITMQ_EXCHANGE")!;
    this.paymentQueue = this.configService.get("RABBITMQ_QUEUE_PAYMENTS")!;
  }

  @RabbitSubscribe({
    exchange: "soundmeet.exchange",
    routingKey: "payment.tip.created",
    queue: "soundmeet.payments.tips",
    queueOptions: {
      durable: true,
      arguments: {
        "x-message-ttl": 1800000, // 30 minutos TTL
        "x-dead-letter-exchange": "soundmeet.dlx",
      },
    },
  })
  async handleTipCreated(message: TipMessage): Promise<void> {
    try {
      this.logger.log(
        `Processing tip: ${message.id} - ${message.currency} ${message.amount} from ${message.senderId} to ${message.recipientId}`,
      );

      // 1. Notificar o músico sobre a gorjeta recebida
      await this.notificationService.sendTipNotification(
        message.recipientId,
        message.amount,
        message.fromUserName || "Anônimo", // Use fallback for fromUserName
        message.message,
      );

      // 2. Dar pontos para quem deu a gorjeta (1 ponto por real)
      await this.gamificationPublisher.publishTipPoints(
        message.senderId,
        message.id,
        message.amount,
      );

      // 3. Verificar se é uma gorjeta de alto valor (acima de R$ 50)
      if (message.amount >= 50) {
        await this.handleHighValueTip(message);
      }

      // 4. Atualizar wall de apoiadores se público
      // message.isPublic not in TipMessage, assuming public for now or handle accordingly
      // await this.updateSupportersWall(message);

      // 5. Processar divisão para bandas se necessário
      // message.bandMembers not in TipMessage - implementing fallback or removing if not needed
      // Assuming bandMembers would be in metadata if needed, or retrieved from DB
      if (message.metadata && message.metadata.bandMembers && Array.isArray(message.metadata.bandMembers)) {
         await this.processBandSplit(message, message.metadata.bandMembers);
      }

      // 6. Atualizar estatísticas financeiras
      await this.updateFinancialStats(message.recipientId, message.amount, "tip");

      this.logger.log(`Tip processed successfully: ${message.id}`);
    } catch (error) {
      this.logger.error(`Failed to process tip: ${message.id}`, error.stack);
      throw error;
    }
  }

  // Placeholder helper methods
  private async handleHighValueTip(message: TipMessage): Promise<void> {
    // Notificação especial para gorjetas de alto valor
    await this.notificationPublisher.publishPushNotification({
      id: `high-value-tip-${message.id}`,
      userId: message.recipientId, // Corrected from message.toUserId to message.recipientId
      title: "🎉 Gorjeta Especial!",
      body: `Você recebeu uma gorjeta de R$ ${message.amount.toFixed(2)}!`,
      data: {
        type: "high_value_tip",
        tipId: message.id,
        amount: message.amount.toString(),
      },
      priority: "high",
      timestamp: new Date(),
      userType: "musician",
      category: "tip",
    });

    // Verificar conquista de "Mecenas" para quem deu a gorjeta
    await this.gamificationPublisher.publishBadgeEarned({
      id: `mecenas-check-${message.senderId}`, // Corrected from message.fromUserId to message.senderId
      userId: message.senderId, // Corrected from message.fromUserId to message.senderId
      badgeId: "mecenas",
      badgeName: "Mecenas",
      // description: "Deu gorjetas de alto valor", // Removed description as it is not in BadgeEarnedMessage
      badgeCategory: "support",
      badgeRarity: "rare",
      points: 100,
      timestamp: new Date(),
      metadata: {
        description: "Deu gorjetas de alto valor", // Moved to metadata
        tipAmount: message.amount,
        tipId: message.id,
      },
    });
  }

  private async updateSupportersWall(message: TipMessage): Promise<void> {
    // Atualizar wall público de apoiadores
    // Esta lógica seria implementada no banco de dados
    this.logger.debug(`Updating supporters wall for tip: ${message.id}`);
  }

  private async processBandSplit(message: TipMessage, bandMembers: string[]): Promise<void> {
    // Dividir gorjeta entre membros da banda
    if (!bandMembers || bandMembers.length === 0) return;

    const splitAmount = message.amount / (bandMembers.length + 1); // +1 para incluir o líder

    for (const memberId of bandMembers) {
      // Criar transação de divisão para cada membro
      await this.createBandSplitTransaction(message.id, memberId, splitAmount);
    }
  }

  private async createBandSplitTransaction(
    originalTipId: string,
    memberId: string,
    amount: number,
  ): Promise<void> {
    // Implementar lógica de divisão de banda
    this.logger.debug(
      `Creating band split transaction: ${originalTipId} -> ${memberId}: R$ ${amount}`,
    );
  }

  private async updateFinancialStats(
    userId: string,
    amount: number,
    type: string,
  ): Promise<void> {
    // Atualizar estatísticas financeiras do usuário
    this.logger.debug(
      `Updating financial stats for user ${userId}: ${type} R$ ${amount}`,
    );
  }

  private async handlePaymentCompleted(
    message: PaymentWebhookMessage,
  ): Promise<void> {
    // Lógica para pagamento completado
    this.logger.debug(`Payment completed: ${message.externalId}`); // Corrected from message.transactionId to message.externalId
  }

  private async handlePaymentFailed(
    message: PaymentWebhookMessage,
  ): Promise<void> {
    // Lógica para pagamento falhado
    this.logger.debug(`Payment failed: ${message.externalId}`); // Corrected from message.transactionId to message.externalId
  }

  private async handlePaymentPending(
    message: PaymentWebhookMessage,
  ): Promise<void> {
    // Lógica para pagamento pendente
    this.logger.debug(`Payment pending: ${message.externalId}`); // Corrected from message.transactionId to message.externalId
  }

  private async handlePaymentCancelled(
    message: PaymentWebhookMessage,
  ): Promise<void> {
    // Lógica para pagamento cancelado
    this.logger.debug(`Payment cancelled: ${message.externalId}`); // Corrected from message.transactionId to message.externalId
  }

  private async validateUserBalance(
    userId: string,
    amount: number,
  ): Promise<boolean> {
    // Validar se usuário tem saldo suficiente
    // Esta lógica seria implementada consultando o banco de dados
    return true; // Placeholder
  }

  private async handleInsufficientBalance(
    message: PayoutMessage,
  ): Promise<void> {
    // Notificar sobre saldo insuficiente
    await this.notificationPublisher.publishPushNotification({
      id: `insufficient-balance-${message.id}`,
      userId: message.musicianId, // Corrected from message.userId to message.musicianId
      title: "❌ Saldo Insuficiente",
      body: `Saldo insuficiente para saque de R$ ${message.amount.toFixed(2)}`,
      data: {
        type: "insufficient_balance",
        payoutId: message.id,
        amount: message.amount.toString(),
      },
      priority: "normal",
      timestamp: new Date(),
      userType: "musician",
      category: "general", // "general" matches one of the allowed categories in PushNotificationMessage
    });
  }

  private async processPayoutTransaction(
    message: PayoutMessage,
  ): Promise<void> {
    // Processar transação de saque
    this.logger.debug(`Processing payout transaction: ${message.id}`);
  }

  private async processRefundTransaction(
    message: RefundMessage,
  ): Promise<void> {
    // Processar transação de estorno
    this.logger.debug(`Processing refund transaction: ${message.id}`);
  }

  private async revertGamificationPoints(transactionId: string): Promise<void> {
    // Reverter pontos de gamificação
    this.logger.debug(
      `Reverting gamification points for transaction: ${transactionId}`,
    );
  }

  private async handleSubscriptionActivated(
    message: SubscriptionMessage,
  ): Promise<void> {
    // Lógica para assinatura ativada
    this.logger.debug(`Subscription activated: ${message.id}`);
  }

  private async handleSubscriptionCancelled(
    message: SubscriptionMessage,
  ): Promise<void> {
    // Lógica para assinatura cancelada
    this.logger.debug(`Subscription cancelled: ${message.id}`);
  }

  private async handleSubscriptionExpired(
    message: SubscriptionMessage,
  ): Promise<void> {
    // Lógica para assinatura expirada
    this.logger.debug(`Subscription expired: ${message.id}`);
  }

  private async handleSubscriptionPaymentFailed(
    message: SubscriptionMessage,
  ): Promise<void> {
    // Lógica para falha no pagamento da assinatura
    this.logger.debug(`Subscription payment failed: ${message.id}`);
  }

  private async updateWalletBalance(
    message: WalletTransactionMessage,
  ): Promise<void> {
    // Atualizar saldo da carteira
    this.logger.debug(`Updating wallet balance: ${message.id}`);
  }

  private async checkWalletAchievements(
    userId: string,
    amount: number,
    type: string,
  ): Promise<void> {
    // Verificar conquistas relacionadas a carteira
    this.logger.debug(
      `Checking wallet achievements for user ${userId}: ${type} R$ ${amount}`,
    );
  }
}
