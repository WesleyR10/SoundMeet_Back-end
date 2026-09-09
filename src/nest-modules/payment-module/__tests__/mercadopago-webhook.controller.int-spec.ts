import { createHmac } from "node:crypto";

import { ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";

import { ConfirmTipPaymentUseCase } from "../../../core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case";
import { MusicianWallet } from "../../../core/payment/domain/musician-wallet.aggregate";
import { MusicianWalletInMemoryRepository } from "../../../core/payment/infra/db/in-memory/musician-wallet-in-memory.repository";
import {
  IMercadoPagoPaymentReader,
  MercadoPagoPayment,
} from "../../../core/payment/infra/gateways/mercadopago-oauth.gateway";
import { MercadoPagoWebhookController } from "../mercadopago-webhook.controller";
import { PaymentEventProcessingService } from "../payment-event-processing.service";

const MUSICIAN_ID = "22222222-2222-4222-8222-222222222222";
const MP_USER_ID = "MP-555";
const PAYMENT_ID = "1234567890";
const REQUEST_ID = "req-abc";
const SECRET = "webhook-secret-de-teste";
const TIP_ID = "33333333-3333-4333-8333-333333333333";

function assinar(paymentId = PAYMENT_ID, requestId = REQUEST_ID): string {
  const ts = "1700000000";
  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", SECRET).update(manifest).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

class FakePaymentReader implements IMercadoPagoPaymentReader {
  next: MercadoPagoPayment = {
    id: PAYMENT_ID,
    status: "approved",
    transaction_amount: 20,
    fee_amount: 0.2,
    metadata: { tip_id: TIP_ID },
  };
  calls: { paymentId: string; accessToken: string }[] = [];

  async getPayment(
    paymentId: string,
    accessToken: string,
  ): Promise<MercadoPagoPayment> {
    this.calls.push({ paymentId, accessToken });
    return this.next;
  }
}

/**
 * O webhook que confirma a gorjeta.
 *
 * O que importa aqui é a FRONTEIRA: a notificação chega sem autenticação de
 * usuário, carregando só ids. Se a assinatura não for verificada, ou se o valor
 * vier do corpo, qualquer um confirma uma gorjeta de R$1.000 com um POST.
 */
describe("MercadoPagoWebhookController (int)", () => {
  let controller: MercadoPagoWebhookController;
  let walletRepo: MusicianWalletInMemoryRepository;
  let reader: FakePaymentReader;
  let confirmSpy: jest.Mock;

  beforeEach(async () => {
    walletRepo = new MusicianWalletInMemoryRepository();
    reader = new FakePaymentReader();
    confirmSpy = jest.fn().mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      controllers: [MercadoPagoWebhookController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === "MERCADOPAGO_WEBHOOK_SECRET" ? SECRET : undefined,
          },
        },
        {
          provide: ConfirmTipPaymentUseCase,
          useValue: { execute: confirmSpy },
        },
        { provide: "MusicianWalletRepository", useValue: walletRepo },
        { provide: "MercadoPagoPaymentReader", useValue: reader },
        {
          provide: PaymentEventProcessingService,
          // `processOnce` real é exercitado nos testes do Asaas; aqui interessa
          // o caminho de dentro.
          useValue: {
            processOnce: (_key: string, work: () => Promise<unknown>) => work(),
          },
        },
      ],
    }).compile();

    controller = module.get(MercadoPagoWebhookController);

    const wallet = MusicianWallet.create({ musician_id: MUSICIAN_ID });
    wallet.linkMercadoPago({
      mp_user_id: MP_USER_ID,
      access_token: "APP_USR-do-musico",
      refresh_token: "TG-r",
      expires_at: new Date("2027-01-01T00:00:00Z"),
    });
    await walletRepo.insert(wallet);
  });

  function body(overrides: Record<string, unknown> = {}) {
    return {
      type: "payment",
      action: "payment.updated",
      user_id: MP_USER_ID,
      data: { id: PAYMENT_ID },
      ...overrides,
    } as any;
  }

  it("confirma a gorjeta com o valor lido da API, não do corpo", async () => {
    await controller.handleEvent(
      assinar(),
      REQUEST_ID,
      undefined,
      // Corpo mentindo um valor alto: tem de ser ignorado.
      body({ transaction_amount: 100000 }),
    );

    expect(reader.calls).toEqual([
      { paymentId: PAYMENT_ID, accessToken: "APP_USR-do-musico" },
    ]);
    expect(confirmSpy).toHaveBeenCalledWith({
      tip_id: TIP_ID,
      /*
       * 🔴 O dinheiro NÃO passou pela plataforma — liquidou na conta do músico.
       * `"platform"` aqui criaria saldo sacável de valor que já é dele, e o
       * saque sairia do nosso caixa.
       */
      settlement: "beneficiary",
      payment: expect.objectContaining({ amount: 20, fee: 0.2 }),
    });
  });

  it("🔴 recusa assinatura inválida", async () => {
    await expect(
      controller.handleEvent(
        "ts=1700000000,v1=forjado",
        REQUEST_ID,
        undefined,
        body(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("🔴 recusa assinatura de OUTRO payment_id — manifesto amarra o id", async () => {
    // Sem o id no manifesto, uma assinatura válida capturada valeria para
    // qualquer cobrança.
    await expect(
      controller.handleEvent(assinar("999"), REQUEST_ID, undefined, body()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("🔴 recusa quando não há segredo configurado (fail-closed)", async () => {
    const module = await Test.createTestingModule({
      controllers: [MercadoPagoWebhookController],
      providers: [
        { provide: ConfigService, useValue: { get: () => undefined } },
        {
          provide: ConfirmTipPaymentUseCase,
          useValue: { execute: confirmSpy },
        },
        { provide: "MusicianWalletRepository", useValue: walletRepo },
        { provide: "MercadoPagoPaymentReader", useValue: reader },
        {
          provide: PaymentEventProcessingService,
          useValue: {
            processOnce: (_k: string, w: () => Promise<unknown>) => w(),
          },
        },
      ],
    }).compile();

    await expect(
      module
        .get(MercadoPagoWebhookController)
        .handleEvent(assinar(), REQUEST_ID, undefined, body()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("ignora pagamento não aprovado", async () => {
    reader.next = { ...reader.next, status: "pending" };

    await controller.handleEvent(assinar(), REQUEST_ID, undefined, body());

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("ignora vendedor desconhecido sem estourar — senão o MP reenviaria para sempre", async () => {
    await controller.handleEvent(
      assinar(),
      REQUEST_ID,
      undefined,
      body({ user_id: "MP-DESCONHECIDO" }),
    );

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(reader.calls).toHaveLength(0);
  });

  it("ignora cobrança sem tip_id na metadata", async () => {
    reader.next = { ...reader.next, metadata: {} };

    await controller.handleEvent(assinar(), REQUEST_ID, undefined, body());

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("ignora notificação que não é de pagamento", async () => {
    await controller.handleEvent(
      assinar(),
      REQUEST_ID,
      undefined,
      body({ type: "plan" }),
    );

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("tópico order (Orders API) responde 200 e não confirma gorjeta", async () => {
    // O painel assina payment + order. Confirmar no tópico errado leria um
    // order_id como payment_id. 200 evita o MP reenviar para sempre.
    await controller.handleEvent(
      assinar(),
      REQUEST_ID,
      undefined,
      body({ type: "order", action: "order.updated" }),
    );

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(reader.calls).toHaveLength(0);
  });
});
