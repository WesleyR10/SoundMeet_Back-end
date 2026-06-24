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

import { ConfirmTipPaymentUseCase } from "../../core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case";
import { PaymentMethod } from "../../core/payment/domain/tip-enums";
import { TransactionStatus } from "../../core/payment/domain/transaction-enums";
import {
  ITransactionRepository,
} from "../../core/payment/domain/repositories";
import { Public } from "../auth-module/auth.decorators";
import { ConfigSchemaType } from "../config-module/config.schema";
import {
  AsaasWebhookBody,
} from "./dto/asaas-webhook.dto";
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
          JSON.stringify({ event: "asaas.webhook.unhandled", type: body.event }),
        );
    }

    return { received: true };
  }

  private validateToken(token: string): void {
    const expected = this.configService.get<string>("ASAAS_WEBHOOK_TOKEN");
    if (expected && token !== expected) {
      throw new ForbiddenException("Invalid webhook token");
    }
  }

  private async handlePaymentReceived(body: AsaasWebhookBody): Promise<void> {
    const payment = body.payment;
    if (!payment?.externalReference) {
      this.logger.warn(
        JSON.stringify({ event: "asaas.webhook.payment_received.no_ref", payment }),
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
          metadata: { asaas_payment_id: payment.id },
        },
      }),
    );
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
