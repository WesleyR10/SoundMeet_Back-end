import { createHmac, timingSafeEqual } from "node:crypto";

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
  Query,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";

import { ConfirmTipPaymentUseCase } from "../../core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case";
import { IMusicianWalletRepository } from "../../core/payment/domain/repositories/musician-wallet.repository";
import { PaymentMethod } from "../../core/payment/domain/tip-enums";
import { IMercadoPagoPaymentReader } from "../../core/payment/infra/gateways/mercadopago-oauth.gateway";
import { Public } from "../auth-module/auth.decorators";
import { ConfigSchemaType } from "../config-module/config.schema";
import { MercadoPagoWebhookBody } from "./dto/mercadopago-webhook.dto";
import { PaymentEventProcessingService } from "./payment-event-processing.service";

/**
 * Confirmação da gorjeta pelo Mercado Pago.
 *
 * ## O caminho, e por que ele tem esse formato
 *
 * A notificação traz **só** `user_id` (o músico) e `data.id` (a cobrança).
 * Então: `user_id` → carteira → token dele → consulta a cobrança na API → lê
 * `metadata.tip_id` → confirma a gorjeta. O valor **nunca** vem da notificação;
 * confiar nele deixaria qualquer um confirmar uma gorjeta de R$1.000 mandando
 * um POST.
 *
 * ## Idempotência
 *
 * O MP **reenvia** a mesma notificação — é comportamento documentado, não
 * exceção. `processOnce` sobre o ledger `ProcessedEvent` (Postgres) transforma
 * "já processei isto?" numa decisão atômica; Redis não serve, porque um
 * reinício perderia a resposta.
 */
@ApiExcludeController()
@Public()
@Controller("webhooks/mercadopago")
export class MercadoPagoWebhookController {
  private readonly logger = new Logger(MercadoPagoWebhookController.name);

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigSchemaType,
    @Inject(ConfirmTipPaymentUseCase)
    private readonly confirmTipPaymentUseCase: ConfirmTipPaymentUseCase,
    @Inject("MusicianWalletRepository")
    private readonly walletRepo: IMusicianWalletRepository,
    @Inject("MercadoPagoPaymentReader")
    private readonly payments: IMercadoPagoPaymentReader,
    private readonly eventProcessing: PaymentEventProcessingService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleEvent(
    @Headers("x-signature") signature: string | undefined,
    @Headers("x-request-id") requestId: string | undefined,
    @Query("data.id") queryDataId: string | undefined,
    @Body() body: MercadoPagoWebhookBody,
  ): Promise<{ received: true }> {
    const paymentId = String(body?.data?.id ?? queryDataId ?? "");

    this.validateSignature(signature, requestId, paymentId);

    if (body.type !== "payment" || !paymentId || !body.user_id) {
      this.logger.log(
        JSON.stringify({
          event: "mercadopago.webhook.unhandled",
          type: body.type,
          action: body.action,
        }),
      );
      return { received: true };
    }

    await this.eventProcessing.processOnce(
      `mercadopago:payment:${paymentId}`,
      () => this.confirmTip(String(body.user_id), paymentId),
    );

    return { received: true };
  }

  private async confirmTip(mpUserId: string, paymentId: string): Promise<void> {
    const wallet = await this.walletRepo.findByMercadoPagoUserId(mpUserId);

    if (!wallet?.hasMercadoPagoLink) {
      /*
       * Notificação de uma conta que não conhecemos (ou que desvinculou). Não é
       * erro nosso — logar e seguir. Estourar aqui faria o MP reenviar para
       * sempre uma notificação que nunca vai ser processável.
       */
      this.logger.warn(
        JSON.stringify({
          event: "mercadopago.webhook.unknown_seller",
          mp_user_id: mpUserId,
          payment_id: paymentId,
        }),
      );
      return;
    }

    const payment = await this.payments.getPayment(
      paymentId,
      wallet.mp_access_token!,
    );

    if (payment.status !== "approved") {
      this.logger.log(
        JSON.stringify({
          event: "mercadopago.webhook.payment_not_approved",
          payment_id: paymentId,
          status: payment.status,
        }),
      );
      return;
    }

    const tipId = payment.metadata?.tip_id;
    if (!tipId) {
      // Cobrança criada fora do fluxo de gorjeta. SM-016: nunca logar o payload
      // inteiro — só os campos não sensíveis.
      this.logger.warn(
        JSON.stringify({
          event: "mercadopago.webhook.payment_without_tip",
          payment_id: paymentId,
        }),
      );
      return;
    }

    await this.confirmTipPaymentUseCase.execute({
      tip_id: String(tipId),
      /*
       * 🔴 O dinheiro NÃO passou pela plataforma: o split criou a cobrança na
       * conta do próprio músico. Marcar `"platform"` aqui criaria saldo sacável
       * de valor que já é dele — e o saque sairia do nosso caixa.
       */
      settlement: "beneficiary",
      payment: {
        amount: payment.transaction_amount,
        fee: payment.fee_amount,
        payment_method: PaymentMethod.PIX,
        external_id: payment.id,
        metadata: { mercadopago_payment_id: payment.id },
      },
    });
  }

  /**
   * Assinatura `x-signature` do Mercado Pago.
   *
   * O manifesto é `id:{data.id};request-id:{x-request-id};ts:{ts};` e a
   * comparação é constant-time — comparar HMAC com `===` vaza o prefixo correto
   * pelo tempo de resposta.
   *
   * 🔴 **Fail-closed:** sem segredo configurado, o webhook não tem como ser
   * autenticado e qualquer POST confirmaria gorjetas. Recusar tudo é o único
   * comportamento seguro — mesmo padrão do webhook do Asaas.
   */
  private validateSignature(
    signature: string | undefined,
    requestId: string | undefined,
    paymentId: string,
  ): void {
    const secret = this.configService.get<string>("MERCADOPAGO_WEBHOOK_SECRET");

    if (!secret) {
      this.logger.warn(
        JSON.stringify({
          event: "mercadopago.webhook.rejected",
          reason: "secret_not_configured",
        }),
      );
      throw new ForbiddenException("Webhook secret not configured");
    }

    const parts = Object.fromEntries(
      (signature ?? "")
        .split(",")
        .map((part) => part.split("=").map((piece) => piece.trim()))
        .filter((pair) => pair.length === 2),
    );

    const ts = parts["ts"];
    const received = parts["v1"];
    if (!ts || !received) {
      throw new ForbiddenException("Invalid webhook signature");
    }

    const manifest = `id:${paymentId};request-id:${requestId ?? ""};ts:${ts};`;
    const expected = createHmac("sha256", secret)
      .update(manifest)
      .digest("hex");

    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(received, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      this.logger.warn(
        JSON.stringify({
          event: "mercadopago.webhook.rejected",
          reason: "signature_mismatch",
          payment_id: paymentId,
        }),
      );
      throw new ForbiddenException("Invalid webhook signature");
    }
  }
}
