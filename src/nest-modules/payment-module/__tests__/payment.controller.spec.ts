import { PaymentMethod } from "../../../core/payment/domain/tip-enums";
import { PaymentController } from "../payment.controller";
import {
  ConfirmTipPaymentPresenter,
  MusicianWalletPresenter,
  SendTipPresenter,
  WithdrawToPixPresenter,
} from "../payment.presenter";

describe("PaymentController", () => {
  let controller: PaymentController;

  beforeEach(() => {
    controller = new PaymentController();
  });

  it("creates a tip", async () => {
    const output = {
      id: "11111111-1111-4111-8111-111111111111",
      status: "pending",
      platform_fee_percentage: 8,
      qr_code: "qr",
      copy_paste_code: "copy",
    };
    const useCase = { execute: jest.fn().mockResolvedValue(output) };
    (controller as any).sendTipUseCase = useCase;
    const dto = {
      musician_id: "33333333-3333-4333-8333-333333333333",
      amount: 10,
      payment_method: PaymentMethod.PIX,
    };
    const currentUser = {
      userId: "22222222-2222-4222-8222-222222222222",
      roles: ["audience"],
      establishmentIds: [],
      bandIds: [],
      isAdmin: false,
    };

    const presenter = await controller.sendTip(dto, currentUser);

    expect(useCase.execute).toHaveBeenCalledWith({
      ...dto,
      audience_id: currentUser.userId,
    });
    expect(presenter).toStrictEqual(new SendTipPresenter(output));
  });

  it("confirms a tip payment", async () => {
    const tipId = "11111111-1111-4111-8111-111111111111";
    const output = {
      tip_id: tipId,
      transaction_id: "22222222-2222-4222-8222-222222222222",
      wallet_balance: 100,
    };
    const useCase = { execute: jest.fn().mockResolvedValue(output) };
    (controller as any).confirmTipPaymentUseCase = useCase;

    const presenter = await controller.confirmTipPayment(tipId, {
      amount: 100,
      fee: 5,
      payment_method: PaymentMethod.PIX,
      user_id: "33333333-3333-4333-8333-333333333333",
      metadata: { provider: "pix" },
    });

    expect(useCase.execute).toHaveBeenCalledWith({
      tip_id: tipId,
      // Confirmação manual pressupõe valor na conta da plataforma — é o único
      // caso em que faz sentido confirmar à mão.
      settlement: "platform",
      payment: {
        amount: 100,
        fee: 5,
        payment_method: PaymentMethod.PIX,
        user_id: "33333333-3333-4333-8333-333333333333",
        metadata: { provider: "pix" },
      },
    });
    expect(presenter).toStrictEqual(new ConfirmTipPaymentPresenter(output));
  });

  it("gets a musician wallet", async () => {
    const musicianId = "11111111-1111-4111-8111-111111111111";
    const now = new Date("2026-06-19T00:00:00.000Z");
    const output = {
      id: "22222222-2222-4222-8222-222222222222",
      musician_id: musicianId,
      balance: 100,
      total_earned: 150,
      total_withdrawn: 50,
      pix_key: "pix@example.com",
      bank_account: null,
      is_active: true,
      held_balance: 0,
      mp_linked: false,
      min_withdrawal_amount_brl: 110,
      withdrawal_days: 5,
      created_at: now,
      updated_at: now,
    };
    const useCase = { execute: jest.fn().mockResolvedValue(output) };
    (controller as any).getMusicianWalletUseCase = useCase;

    const presenter = await controller.getMusicianWallet(musicianId);

    expect(useCase.execute).toHaveBeenCalledWith({ musician_id: musicianId });
    expect(presenter).toStrictEqual(new MusicianWalletPresenter(output));
  });

  it("withdraws wallet balance to pix", async () => {
    const musicianId = "11111111-1111-4111-8111-111111111111";
    const output = {
      transaction_id: "22222222-2222-4222-8222-222222222222",
      wallet_balance: 50,
      status: "completed",
      min_withdrawal_amount_brl: 110,
      withdrawal_days: 5,
    };
    const useCase = { execute: jest.fn().mockResolvedValue(output) };
    (controller as any).withdrawToPixUseCase = useCase;

    const presenter = await controller.withdrawToPix(musicianId, {
      amount: 50,
    });

    expect(useCase.execute).toHaveBeenCalledWith({
      musician_id: musicianId,
      amount: 50,
      idempotency_key: null,
    });
    expect(presenter).toStrictEqual(new WithdrawToPixPresenter(output));
  });

  // SM-023 — a chave chega por header, e chega ao use-case. Um header presente
  // mas em branco tem de virar `null`: string vazia gravada na coluna UNIQUE
  // faria o PRIMEIRO saque em branco bloquear todos os outros.
  it.each([
    ["req-abc", "req-abc"],
    ["  req-abc  ", "req-abc"],
    ["   ", null],
    [undefined, null],
  ])(
    "repassa o header Idempotency-Key %p como %p",
    async (header, expected) => {
      const musicianId = "11111111-1111-4111-8111-111111111111";
      const useCase = {
        execute: jest.fn().mockResolvedValue({
          transaction_id: "22222222-2222-4222-8222-222222222222",
          wallet_balance: 50,
          status: "pending",
          min_withdrawal_amount_brl: 110,
          withdrawal_days: 5,
        }),
      };
      (controller as any).withdrawToPixUseCase = useCase;

      await controller.withdrawToPix(
        musicianId,
        { amount: 50 },
        header as string | undefined,
      );

      expect(useCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ idempotency_key: expected }),
      );
    },
  );
});
