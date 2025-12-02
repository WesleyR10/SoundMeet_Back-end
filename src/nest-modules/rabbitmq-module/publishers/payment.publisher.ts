import { Injectable, Logger } from "@nestjs/common";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { ConfigService } from "@nestjs/config";
import { ConfigSchemaType } from "../../config-module/config.schema";

export interface TipMessage {
  id: string;
  senderId: string;
  recipientId: string;
  amount: number;
  currency: string;
  message?: string;
  fromUserName?: string;
  eventId?: string;
  requestId?: string;
  paymentMethod: "pix" | "credit_card" | "wallet";
  status: "pending" | "processing" | "completed" | "failed" | "refunded";
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PaymentWebhookMessage {
  id: string;
  externalId: string;
  provider: string;
  type: "tip" | "subscription" | "purchase";
  status: "pending" | "approved" | "rejected" | "cancelled" | "refunded";
  amount: number;
  currency: string;
  userId: string;
  recipientId?: string;
  timestamp: Date;
  rawData: Record<string, any>;
}

export interface PayoutMessage {
  id: string;
  musicianId: string;
  amount: number;
  currency: string;
  bankAccount: {
    bank: string;
    agency: string;
    account: string;
    accountType: "checking" | "savings";
    pixKey?: string;
  };
  status: "pending" | "processing" | "completed" | "failed";
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface RefundMessage {
  id: string;
  originalPaymentId: string;
  amount: number;
  currency: string;
  reason: string;
  requestedBy: string;
  status: "pending" | "processing" | "completed" | "failed";
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SubscriptionMessage {
  id: string;
  userId: string;
  planId: string;
  status: "active" | "cancelled" | "expired" | "suspended";
  amount: number;
  currency: string;
  billingCycle: "monthly" | "yearly";
  nextBillingDate?: Date;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface WalletTransactionMessage {
  id: string;
  userId: string;
  type: "credit" | "debit";
  amount: number;
  currency: string;
  description: string;
  relatedId?: string; // ID da transação relacionada (tip, payout, etc.)
  relatedType?: "tip" | "payout" | "refund" | "subscription";
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class PaymentPublisher {
  private readonly logger = new Logger(PaymentPublisher.name);
  private readonly exchange: string;

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly configService: ConfigSchemaType,
  ) {
    this.exchange = this.configService.get("RABBITMQ_EXCHANGE")!;
  }

  async publishTipCreated(message: TipMessage): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        "payment.tip.created",
        message,
        {
          persistent: true,
          priority: 8, // Alta prioridade para gorjetas
          timestamp: Date.now(),
          messageId: message.id,
          correlationId: `tip-${message.id}`,
          headers: {
            paymentMethod: message.paymentMethod,
            amount: message.amount.toString(),
            currency: message.currency,
          },
        },
      );

      this.logger.log(
        `Tip created published: ${message.id} - ${message.amount} ${message.currency}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish tip created: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishTipStatusUpdate(message: TipMessage): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        `payment.tip.${message.status}`,
        message,
        {
          persistent: true,
          priority: message.status === "completed" ? 9 : 7,
          timestamp: Date.now(),
          messageId: `${message.id}-${message.status}`,
          correlationId: `tip-${message.id}`,
          headers: {
            status: message.status,
            amount: message.amount.toString(),
            currency: message.currency,
          },
        },
      );

      this.logger.log(
        `Tip status update published: ${message.id} -> ${message.status}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish tip status update: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishPaymentWebhook(message: PaymentWebhookMessage): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        `payment.webhook.${message.provider}`,
        message,
        {
          persistent: true,
          priority: 9, // Máxima prioridade para webhooks
          timestamp: Date.now(),
          messageId: message.id,
          correlationId: `webhook-${message.externalId}`,
          headers: {
            provider: message.provider,
            type: message.type,
            status: message.status,
            externalId: message.externalId,
          },
        },
      );

      this.logger.log(
        `Payment webhook published: ${message.id} from ${message.provider}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish payment webhook: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishPayoutRequest(message: PayoutMessage): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        "payment.payout.requested",
        message,
        {
          persistent: true,
          priority: 7,
          timestamp: Date.now(),
          messageId: message.id,
          correlationId: `payout-${message.id}`,
          headers: {
            musicianId: message.musicianId,
            amount: message.amount.toString(),
            currency: message.currency,
          },
        },
      );

      this.logger.log(
        `Payout request published: ${message.id} for musician ${message.musicianId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish payout request: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishPayoutStatusUpdate(message: PayoutMessage): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        `payment.payout.${message.status}`,
        message,
        {
          persistent: true,
          priority: message.status === "completed" ? 8 : 6,
          timestamp: Date.now(),
          messageId: `${message.id}-${message.status}`,
          correlationId: `payout-${message.id}`,
          headers: {
            status: message.status,
            musicianId: message.musicianId,
            amount: message.amount.toString(),
          },
        },
      );

      this.logger.log(
        `Payout status update published: ${message.id} -> ${message.status}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish payout status update: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishRefundRequest(message: RefundMessage): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        "payment.refund.requested",
        message,
        {
          persistent: true,
          priority: 8,
          timestamp: Date.now(),
          messageId: message.id,
          correlationId: `refund-${message.id}`,
          headers: {
            originalPaymentId: message.originalPaymentId,
            amount: message.amount.toString(),
            reason: message.reason,
          },
        },
      );

      this.logger.log(
        `Refund request published: ${message.id} for payment ${message.originalPaymentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish refund request: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishSubscriptionUpdate(message: SubscriptionMessage): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        `payment.subscription.${message.status}`,
        message,
        {
          persistent: true,
          priority: 6,
          timestamp: Date.now(),
          messageId: message.id,
          correlationId: `subscription-${message.id}`,
          headers: {
            userId: message.userId,
            planId: message.planId,
            status: message.status,
            billingCycle: message.billingCycle,
          },
        },
      );

      this.logger.log(
        `Subscription update published: ${message.id} -> ${message.status}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish subscription update: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishWalletTransaction(
    message: WalletTransactionMessage,
  ): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        `payment.wallet.${message.type}`,
        message,
        {
          persistent: true,
          priority: 5,
          timestamp: Date.now(),
          messageId: message.id,
          correlationId: `wallet-${message.userId}`,
          headers: {
            userId: message.userId,
            type: message.type,
            amount: message.amount.toString(),
            relatedType: message.relatedType,
          },
        },
      );

      this.logger.log(
        `Wallet transaction published: ${message.id} - ${message.type} ${message.amount}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish wallet transaction: ${message.id}`,
        error.stack,
      );
      throw error;
    }
  }

  // Métodos de conveniência para casos específicos
  async publishTipCompleted(
    tipId: string,
    senderId: string,
    recipientId: string,
    amount: number,
    message?: string,
  ): Promise<void> {
    const tipMessage: TipMessage = {
      id: tipId,
      senderId,
      recipientId,
      amount,
      currency: "BRL",
      message,
      paymentMethod: "pix",
      status: "completed",
      timestamp: new Date(),
    };

    await this.publishTipStatusUpdate(tipMessage);
  }

  async publishBulkPayouts(payouts: PayoutMessage[]): Promise<void> {
    try {
      const promises = payouts.map((payout) =>
        this.publishPayoutRequest(payout),
      );
      await Promise.all(promises);

      this.logger.log(`Bulk payouts published: ${payouts.length} payouts`);
    } catch (error) {
      this.logger.error("Failed to publish bulk payouts", error.stack);
      throw error;
    }
  }
}
