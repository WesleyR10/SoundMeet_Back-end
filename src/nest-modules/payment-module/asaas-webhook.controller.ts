import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import { timingSafeEqual } from "crypto";

import { ConfirmTipPaymentUseCase } from "../../core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case";
import { ITransactionRepository } from "../../core/payment/domain/repositories";
import { PaymentMethod } from "../../core/payment/domain/tip-enums";
import { TransactionStatus } from "../../core/payment/domain/transaction-enums";
import { ActivateSubscriptionFromPaymentUseCase } from "../../core/plans/application/use-cases/activate-subscription-from-payment/activate-subscription-from-payment.use-case";
import { isSubscriptionReference } from "../../core/plans/application/use-cases/common/subscription-external-reference";
import { Public } from "../auth-module/auth.decorators";
import { ConfigSchemaType } from "../config-module/config.schema";
import { AsaasWebhookBody } from "./dto/asaas-webhook.dto";
import { PaymentEventProcessingService } from "./payment-event-processing.service";

@ApiExcludeController()
@Public()
@Controller("webhooks/asaas")
export class AsaasWebhookController {
  private readonly logger = new Logger(AsaasWebhookController.name);

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigSchemaType,
    @Inject(ConfirmTipPaymentUseCase)
    private readonly confirmTipPaymentUseCase: ConfirmTipPaymentUseCase,
    @Inject(ActivateSubscriptionFromPaymentUseCase)
    private readonly activateSubscriptionUseCase: ActivateSubscriptionFromPaymentUseCase,
    @Inject("TransactionRepository")
    private readonly txRepo: ITransactionRepository,
    private readonly eventProcessing: PaymentEventProcessingService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleEvent(
    @Headers("asaas-access-token") token: string,
    @Body() body: AsaasWebhookBody,
  ): Promise<{ received: true }> {
    this.validateToken(token);

    switch (body.event) {
      case "PAYMENT_RECEIVED":
      case "PAYMENT_CONFIRMED":
        await this.handlePaymentReceived(body);
        break;
      case "TRANSFER_DONE":
        await this.handleTransferDone(body);
        break;
      case "TRANSFER_FAILED":
      case "TRANSFER_CANCELLED":
        await this.handleTransferFailed(body);
        break;
      default:
        this.logger.log(
          JSON.stringify({
            event: "asaas.webhook.unhandled",
            type: body.event,
          }),
        );
    }

    return { received: true };
  }

  // Fail-closed: sem token configurado o webhook não tem como ser autenticado,
  // então rejeita tudo (em produção o Joi já impede boot sem a var; isto cobre
  // dev/staging e NODE_ENV mal configurado). Comparação constant-time.
  private validateToken(token: string | undefined): void {
    const expected = this.configService.get<string>("ASAAS_WEBHOOK_TOKEN");
    if (!expected) {
      this.logger.warn(
        JSON.stringify({
          event: "asaas.webhook.rejected",
          reason: "token_not_configured",
        }),
      );
      throw new ForbiddenException("Webhook token not configured");
    }
    const received = Buffer.from(token ?? "");
    const wanted = Buffer.from(expected);
    if (
      received.length !== wanted.length ||
      !timingSafeEqual(received, wanted)
    ) {
      throw new ForbiddenException("Invalid webhook token");
    }
  }

  private async handlePaymentReceived(body: AsaasWebhookBody): Promise<void> {
    const payment = body.payment;
    if (!payment) {
      return;
    }

    // Pagamento de ASSINATURA recorrente (checkout de plano) — nunca é
    // gorjeta. Identificado por payment.subscription (id no gateway) ou pelo
    // prefixo "sub:" do externalReference herdado da assinatura.
    if (
      payment.subscription ||
      isSubscriptionReference(payment.externalReference)
    ) {
      await this.handleSubscriptionPayment(body);
      return;
    }

    if (!payment.externalReference) {
      // SM-016: nunca logar o payload inteiro do webhook (pode conter dados
      // do pagador) — só os campos não sensíveis, igual aos outros branches
      // deste controller.
      this.logger.warn(
        JSON.stringify({
          event: "asaas.webhook.payment_received.no_ref",
          payment_id: payment.id,
          status: payment.status,
        }),
      );
      return;
    }

    const tipId = payment.externalReference;
    const idempotencyKey = `asaas:payment_received:${payment.id}`;

    await this.eventProcessing.processOnce(idempotencyKey, () =>
      this.confirmTipPaymentUseCase.execute({
        tip_id: tipId,
        payment: {
          amount: payment.value,
          fee: payment.value - payment.netValue,
          payment_method: PaymentMethod.PIX,
          external_id: payment.id,
          metadata: { asaas_payment_id: payment.id },
        },
      }),
    );
  }

  private async handleSubscriptionPayment(
    body: AsaasWebhookBody,
  ): Promise<void> {
    const payment = body.payment!;
    const idempotencyKey = `asaas:subscription_payment:${payment.id}`;

    await this.eventProcessing.processOnce(idempotencyKey, async () => {
      const result = await this.activateSubscriptionUseCase.execute({
        gateway_subscription_id: payment.subscription ?? "",
        external_reference: payment.externalReference,
        gateway_customer_id: payment.customer,
      });

      const logPayload = JSON.stringify({
        event: "asaas.webhook.subscription_payment",
        payment_id: payment.id,
        gateway_subscription_id: payment.subscription,
        action: result.action,
        subscription_id: result.subscription_id,
      });
      if (result.action === "ignored") {
        this.logger.warn(logPayload);
      } else {
        this.logger.log(logPayload);
      }
    });
  }

  private async handleTransferDone(body: AsaasWebhookBody): Promise<void> {
    const transfer = body.transfer;
    if (!transfer) {
      return;
    }

    const idempotencyKey = `asaas:transfer_done:${transfer.id}`;

    await this.eventProcessing.processOnce(idempotencyKey, async () => {
      const tx = await this.txRepo.findByExternalId(transfer.id);
      if (!tx) {
        this.logger.warn(
          JSON.stringify({
            event: "asaas.webhook.transfer_done.not_found",
            transfer_id: transfer.id,
          }),
        );
        return;
      }

      if (tx.status !== TransactionStatus.PENDING) {
        return;
      }

      tx.complete();
      await this.txRepo.update(tx);

      this.logger.log(
        JSON.stringify({
          event: "asaas.webhook.transfer_done",
          transfer_id: transfer.id,
          transaction_id: tx.transaction_id.id,
        }),
      );
    });
  }

  private async handleTransferFailed(body: AsaasWebhookBody): Promise<void> {
    const transfer = body.transfer;
    if (!transfer) {
      return;
    }

    const idempotencyKey = `asaas:transfer_failed:${transfer.id}`;

    await this.eventProcessing.processOnce(idempotencyKey, async () => {
      const tx = await this.txRepo.findByExternalId(transfer.id);
      if (!tx) {
        return;
      }

      if (tx.status !== TransactionStatus.PENDING) {
        return;
      }

      tx.fail();
      await this.txRepo.update(tx);

      this.logger.warn(
        JSON.stringify({
          event: "asaas.webhook.transfer_failed",
          transfer_id: transfer.id,
          transaction_id: tx.transaction_id.id,
          reason: transfer.failReason,
        }),
      );
    });
  }
}
