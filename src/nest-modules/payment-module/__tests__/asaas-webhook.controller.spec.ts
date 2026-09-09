import { ForbiddenException } from "@nestjs/common";

import { AsaasWebhookController } from "../asaas-webhook.controller";

// processOnce sem cache real — roda o work direto (equivalente a "primeira vez").
class FakeEventProcessingService {
  async processOnce<T>(_key: string, work: () => Promise<T>): Promise<T> {
    return work();
  }
}

describe("AsaasWebhookController — validação de token", () => {
  const makeController = (configuredToken: string | undefined) => {
    const configService = {
      get: jest
        .fn()
        .mockImplementation((key: string) =>
          key === "ASAAS_WEBHOOK_TOKEN" ? configuredToken : undefined,
        ),
    };
    return new AsaasWebhookController(
      configService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      new FakeEventProcessingService() as never,
    );
  };

  const unhandledBody = { event: "UNHANDLED_TEST_EVENT" } as never;

  it("rejeita TUDO quando o token não está configurado (fail-closed)", async () => {
    const controller = makeController(undefined);

    await expect(
      controller.handleEvent("qualquer-token", unhandledBody),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejeita quando o token configurado é string vazia", async () => {
    const controller = makeController("");

    await expect(
      controller.handleEvent("qualquer-token", unhandledBody),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejeita token incorreto", async () => {
    const controller = makeController("token-secreto");

    await expect(
      controller.handleEvent("token-errado!!", unhandledBody),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejeita token ausente no header", async () => {
    const controller = makeController("token-secreto");

    await expect(
      controller.handleEvent(undefined as never, unhandledBody),
    ).rejects.toThrow(ForbiddenException);
  });

  it("aceita token correto e responde received:true para evento não tratado", async () => {
    const controller = makeController("token-secreto");

    await expect(
      controller.handleEvent("token-secreto", unhandledBody),
    ).resolves.toEqual({ received: true });
  });
});

describe("AsaasWebhookController — roteamento PAYMENT_RECEIVED (assinatura vs gorjeta)", () => {
  const TOKEN = "token-secreto";
  let configService: { get: jest.Mock };
  let confirmTipPaymentUseCase: { execute: jest.Mock };
  let activateSubscriptionUseCase: { execute: jest.Mock };
  let txRepo: { findByExternalId: jest.Mock; update: jest.Mock };
  let markEscrowHeldUseCase: { execute: jest.Mock };
  let refundFailedWithdrawUseCase: { execute: jest.Mock };
  let controller: AsaasWebhookController;

  beforeEach(() => {
    configService = {
      get: jest
        .fn()
        .mockImplementation((key: string) =>
          key === "ASAAS_WEBHOOK_TOKEN" ? TOKEN : undefined,
        ),
    };
    confirmTipPaymentUseCase = { execute: jest.fn().mockResolvedValue({}) };
    activateSubscriptionUseCase = {
      execute: jest.fn().mockResolvedValue({ action: "activated" }),
    };
    txRepo = { findByExternalId: jest.fn(), update: jest.fn() };
    refundFailedWithdrawUseCase = {
      execute: jest.fn().mockResolvedValue({
        transaction_id: "t1",
        changed: true,
        wallet_balance: 200,
      }),
    };
    markEscrowHeldUseCase = {
      execute: jest
        .fn()
        .mockResolvedValue({ escrow_id: "e1", status: "held", changed: true }),
    };

    controller = new AsaasWebhookController(
      configService as never,
      confirmTipPaymentUseCase as never,
      activateSubscriptionUseCase as never,
      markEscrowHeldUseCase as never,
      refundFailedWithdrawUseCase as never,
      txRepo as never,
      new FakeEventProcessingService() as never,
    );
  });

  it("payment.subscription presente → roteia para ActivateSubscriptionFromPaymentUseCase, NUNCA confirma gorjeta", async () => {
    await controller.handleEvent(TOKEN, {
      event: "PAYMENT_RECEIVED",
      payment: {
        id: "pay_1",
        subscription: "asaas_sub_1",
        externalReference: "sub:musician:m1:essential:monthly",
        customer: "cus_1",
        value: 34.9,
        netValue: 34.55,
        billingType: "PIX",
        status: "RECEIVED",
      },
    } as never);

    expect(activateSubscriptionUseCase.execute).toHaveBeenCalledWith({
      gateway_subscription_id: "asaas_sub_1",
      external_reference: "sub:musician:m1:essential:monthly",
      gateway_customer_id: "cus_1",
    });
    expect(confirmTipPaymentUseCase.execute).not.toHaveBeenCalled();
  });

  it("externalReference com prefixo sub: sem payment.subscription também roteia para assinatura", async () => {
    await controller.handleEvent(TOKEN, {
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: "pay_2",
        externalReference: "sub:establishment:e1:growth:annual",
        value: 300,
        netValue: 297,
        billingType: "PIX",
        status: "CONFIRMED",
      },
    } as never);

    expect(activateSubscriptionUseCase.execute).toHaveBeenCalledTimes(1);
    expect(confirmTipPaymentUseCase.execute).not.toHaveBeenCalled();
  });

  it("pagamento de gorjeta (sem subscription, referência é UUID cru) continua confirmando o tip", async () => {
    await controller.handleEvent(TOKEN, {
      event: "PAYMENT_RECEIVED",
      payment: {
        id: "pay_3",
        externalReference: "tip-uuid-123",
        value: 20,
        netValue: 19.8,
        billingType: "PIX",
        status: "RECEIVED",
      },
    } as never);

    expect(confirmTipPaymentUseCase.execute).toHaveBeenCalledWith({
      tip_id: "tip-uuid-123",
      // Caminho legado: no Asaas a gorjeta entrava na conta da PLATAFORMA.
      settlement: "platform",
      payment: expect.objectContaining({ amount: 20 }),
    });
    expect(activateSubscriptionUseCase.execute).not.toHaveBeenCalled();
  });

  it("externalReference com prefixo escrow: retém a custódia do cachê", async () => {
    await controller.handleEvent(TOKEN, {
      event: "PAYMENT_RECEIVED",
      payment: {
        id: "pay_escrow_1",
        externalReference: "escrow:44444444-4444-4444-8444-444444444444",
        value: 1500,
        netValue: 1485,
        billingType: "PIX",
        status: "RECEIVED",
      },
    } as never);

    expect(markEscrowHeldUseCase.execute).toHaveBeenCalledWith({
      escrow_id: "44444444-4444-4444-8444-444444444444",
      external_id: "pay_escrow_1",
    });
    // Cachê nunca pode cair no caminho da gorjeta — a referência seria lida
    // como UUID de tip e confirmaria uma gorjeta que não existe.
    expect(confirmTipPaymentUseCase.execute).not.toHaveBeenCalled();
    expect(activateSubscriptionUseCase.execute).not.toHaveBeenCalled();
  });

  it("🔴 NÃO usa o valor do corpo do webhook para reter", async () => {
    // O valor retido é o `net_amount` congelado na criação da custódia. Ler
    // `payment.value` deixaria um POST forjado inflar o held_balance.
    await controller.handleEvent(TOKEN, {
      event: "PAYMENT_RECEIVED",
      payment: {
        id: "pay_escrow_2",
        externalReference: "escrow:55555555-5555-4555-8555-555555555555",
        value: 999_999,
        netValue: 999_999,
        billingType: "PIX",
        status: "RECEIVED",
      },
    } as never);

    const [[input]] = markEscrowHeldUseCase.execute.mock.calls;
    expect(input).not.toHaveProperty("amount");
    expect(input).not.toHaveProperty("value");
    expect(Object.keys(input).sort()).toEqual(["escrow_id", "external_id"]);
  });
});
