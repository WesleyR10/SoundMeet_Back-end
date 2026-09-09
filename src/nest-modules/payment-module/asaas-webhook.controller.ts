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

import { parseEscrowReference } from "../../core/payment/application/use-cases/common/booking-escrow-external-reference";
import { ConfirmTipPaymentUseCase } from "../../core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case";
import { MarkBookingEscrowHeldUseCase } from "../../core/payment/application/use-cases/mark-booking-escrow-held/mark-booking-escrow-held.use-case";
import { RefundFailedWithdrawUseCase } from "../../core/payment/application/use-cases/refund-failed-withdraw/refund-failed-withdraw.use-case";
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
    @Inject(MarkBookingEscrowHeldUseCase)
    private readonly markEscrowHeldUseCase: MarkBookingEscrowHeldUseCase,
    @Inject(RefundFailedWithdrawUseCase)
    private readonly refundFailedWithdrawUseCase: RefundFailedWithdrawUseCase,
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

    // Cachê de show em custódia (F1.3a) — prefixo "escrow:" no
    // externalReference. Precisa vir ANTES do caminho de gorjeta, que trata
    // qualquer referência restante como UUID de tip.
    const escrowId = parseEscrowReference(payment.externalReference);
    if (escrowId) {
      await this.handleEscrowPayment(body, escrowId);
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
        /*
         * Caminho legado: no Asaas a gorjeta entrava na conta da PLATAFORMA, que
         * passava a dever ao músico. Desde 19/ago/2026 a gorjeta roda no
         * Mercado Pago (liquidação direta), mas este handler continua correto
         * para cobranças antigas.
         */
        settlement: "platform",
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

  /**
   * O estabelecimento pagou o cachê: a custódia passa a `held`.
   *
   * 🔴 **O valor vem do NOSSO registro, nunca do corpo do webhook.** O
   * `MarkBookingEscrowHeldUseCase` retém o `net_amount` já congelado na criação
   * da custódia — `payment.value` não é lido aqui de propósito. Confiar no
   * corpo deixaria um POST forjado inflar o `held_balance` de qualquer músico,
   * que é a mesma razão pela qual o webhook do Mercado Pago consulta a API em
   * vez de acreditar na notificação.
   *
   * A idempotência é dupla: `processOnce` barra a reentrega do mesmo evento, e
   * `markHeld` com a mesma referência é no-op no agregado — porque webhook
   * duplicado é o caso normal, não a exceção.
   */
  private async handleEscrowPayment(
    body: AsaasWebhookBody,
    escrowId: string,
  ): Promise<void> {
    const payment = body.payment!;
    const idempotencyKey = `asaas:escrow_payment:${payment.id}`;

    await this.eventProcessing.processOnce(idempotencyKey, async () => {
      try {
        const result = await this.markEscrowHeldUseCase.execute({
          escrow_id: escrowId,
          external_id: payment.id,
        });

        this.logger.log(
          JSON.stringify({
            event: result.changed
              ? "asaas.webhook.escrow_held"
              : "asaas.webhook.escrow_already_held",
            payment_id: payment.id,
            escrow_id: result.escrow_id,
          }),
        );
      } catch (error) {
        /*
         * Custódia inexistente é o caso preocupante: houve uma cobrança paga
         * apontando para um registro que não existe aqui. Fica em `error`
         * porque é dinheiro real bloqueado sem ninguém para liberar — precisa
         * de intervenção, não de retry silencioso.
         */
        this.logger.error(
          JSON.stringify({
            event: "asaas.webhook.escrow_held.failed",
            payment_id: payment.id,
            escrow_id: escrowId,
            message: error instanceof Error ? error.message : "unknown",
          }),
        );
        throw error;
      }
    });
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

  /**
   * A transferência não saiu: a transação falha **e o valor volta à carteira**.
   *
   * 🔴 Até 26/ago/2026 este handler só marcava `failed`. O saldo continuava
   * debitado de um saque que o provedor recusou: o dinheiro não chegava na
   * conta do músico e também não voltava para a dele aqui — sumia, sem erro em
   * lugar nenhum, deixando como única pista um lançamento `failed` que ninguém
   * correlaciona com o saldo. O estorno é a outra metade do débito que
   * `WithdrawToPixUseCase` faz na reserva.
   *
   * A idempotência é dupla, e as duas camadas cobrem coisas diferentes:
   * `processOnce` barra a reentrega do mesmo evento; o `pending` conferido sob
   * o lock da carteira, dentro do use-case, barra a colisão com o caminho de
   * recusa do próprio saque — que pode estar estornando a mesma transação
   * neste instante.
   */
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

      const result = await this.refundFailedWithdrawUseCase.execute({
        transaction_id: tx.transaction_id.id,
        reason: transfer.failReason ?? "Transferência recusada pelo provedor",
      });

      this.logger.warn(
        JSON.stringify({
          event: result.changed
            ? "asaas.webhook.transfer_failed"
            : "asaas.webhook.transfer_failed_already_settled",
          transfer_id: transfer.id,
          transaction_id: tx.transaction_id.id,
          reason: transfer.failReason,
          wallet_balance: result.wallet_balance,
        }),
      );
    });
  }
}
