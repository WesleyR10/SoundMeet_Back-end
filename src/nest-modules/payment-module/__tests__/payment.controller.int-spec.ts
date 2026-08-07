import { Test, TestingModule } from "@nestjs/testing";

import { BandInMemoryRepository } from "../../../core/musician/infra/db/in-memory/band-in-memory.repository";
import { ConfirmTipPaymentUseCase } from "../../../core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case";
import { GetMusicianTipsUseCase } from "../../../core/payment/application/use-cases/get-musician-tips/get-musician-tips.use-case";
import { GetMusicianWalletUseCase } from "../../../core/payment/application/use-cases/get-musician-wallet/get-musician-wallet.use-case";
import { SendTipUseCase } from "../../../core/payment/application/use-cases/send-tip/send-tip.use-case";
import {
  PlanCheckService,
  SubscriptionInMemoryRepository,
} from "../../../core/plans";
import { UpdateMusicianPixKeyUseCase } from "../../../core/payment/application/use-cases/update-musician-pix-key/update-musician-pix-key.use-case";
import { WithdrawToPixUseCase } from "../../../core/payment/application/use-cases/withdraw-to-pix/withdraw-to-pix.use-case";
import { MusicianWallet } from "../../../core/payment/domain/musician-wallet.aggregate";
import { Tip } from "../../../core/payment/domain/tip.aggregate";
import {
  PaymentMethod,
  TipStatus,
} from "../../../core/payment/domain/tip-enums";
import { MusicianWalletInMemoryRepository } from "../../../core/payment/infra/db/in-memory/musician-wallet-in-memory.repository";
import { TipInMemoryRepository } from "../../../core/payment/infra/db/in-memory/tip-in-memory.repository";
import { TransactionInMemoryRepository } from "../../../core/payment/infra/db/in-memory/transaction-in-memory.repository";
import { PixGatewayMock } from "../../../core/payment/infra/gateways/pix-gateway.mock";
import { AuthGuard } from "../../auth-module/auth.guard";
import { RolesGuard } from "../../auth-module/roles.guard";
import { PaymentController } from "../payment.controller";
import {
  ConfirmTipPaymentPresenter,
  MusicianWalletPresenter,
  SendTipPresenter,
  TipsListPresenter,
  WithdrawToPixPresenter,
} from "../payment.presenter";

describe("PaymentController Integration Tests", () => {
  let controller: PaymentController;
  let tipRepo: TipInMemoryRepository;
  let txRepo: TransactionInMemoryRepository;
  let walletRepo: MusicianWalletInMemoryRepository;
  let bandRepo: BandInMemoryRepository;
  let pixGateway: PixGatewayMock;

  const MUSICIAN_ID = "11111111-1111-4111-8111-111111111111";
  const AUDIENCE_ID = "22222222-2222-4222-8222-222222222222";

  const AUDIENCE_USER = {
    userId: AUDIENCE_ID,
    roles: ["audience"],
    establishmentIds: [],
    bandIds: [],
    isAdmin: false,
  };

  beforeEach(async () => {
    tipRepo = new TipInMemoryRepository();
    txRepo = new TransactionInMemoryRepository();
    walletRepo = new MusicianWalletInMemoryRepository();
    bandRepo = new BandInMemoryRepository();
    pixGateway = new PixGatewayMock();

    const passGuard = { canActivate: () => true };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: SendTipUseCase,
          useValue: new SendTipUseCase(
            tipRepo,
            new PlanCheckService(new SubscriptionInMemoryRepository()),
            pixGateway,
          ),
        },
        {
          provide: ConfirmTipPaymentUseCase,
          useValue: new ConfirmTipPaymentUseCase(
            tipRepo,
            txRepo,
            walletRepo,
            bandRepo,
            { do: async (fn: (uow: any) => any) => fn(null) } as any,
            { publish: jest.fn(), publishIntegrationEvents: jest.fn() } as any,
          ),
        },
        {
          provide: GetMusicianWalletUseCase,
          useValue: new GetMusicianWalletUseCase(walletRepo),
        },
        {
          provide: WithdrawToPixUseCase,
          useValue: new WithdrawToPixUseCase(walletRepo, txRepo),
        },
        {
          provide: UpdateMusicianPixKeyUseCase,
          useValue: new UpdateMusicianPixKeyUseCase(walletRepo),
        },
        {
          provide: GetMusicianTipsUseCase,
          useValue: new GetMusicianTipsUseCase(tipRepo),
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(passGuard)
      .overrideGuard(RolesGuard)
      .useValue(passGuard)
      .compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("sendTip", () => {
    it("should create a pending PIX tip and return qr_code", async () => {
      const dto = {
        musician_id: MUSICIAN_ID,
        amount: 20,
        payment_method: PaymentMethod.PIX,
      };

      const result = await controller.sendTip(dto as any, AUDIENCE_USER);

      expect(result).toBeInstanceOf(SendTipPresenter);
      expect(result.status).toBe(TipStatus.PENDING);
      expect(result.qr_code).toBe("mock_qr_code_base64");
      expect(result.copy_paste_code).toBe("mock_copy_paste_code");
      expect(typeof result.id).toBe("string");

      const tips = await tipRepo.findAll();
      expect(tips).toHaveLength(1);
      expect(tips[0].amount.amount).toBe(20);
      expect(tips[0].musician_id?.id).toBe(MUSICIAN_ID);
    });

    it("should create a pending tip without qr_code for non-PIX payment", async () => {
      const dto = {
        musician_id: MUSICIAN_ID,
        amount: 15,
        payment_method: PaymentMethod.WALLET,
      };

      const result = await controller.sendTip(dto as any, AUDIENCE_USER);

      expect(result.status).toBe(TipStatus.PENDING);
      expect(result.qr_code).toBeUndefined();
      expect(result.copy_paste_code).toBeUndefined();
    });

    it("should create multiple tips independently", async () => {
      await controller.sendTip({
        musician_id: MUSICIAN_ID,
        amount: 10,
        payment_method: PaymentMethod.PIX,
      } as any, AUDIENCE_USER);

      await controller.sendTip({
        musician_id: MUSICIAN_ID,
        amount: 25,
        payment_method: PaymentMethod.PIX,
      } as any, AUDIENCE_USER);

      const tips = await tipRepo.findAll();
      expect(tips).toHaveLength(2);
    });
  });

  describe("confirmTipPayment", () => {
    let pendingTip: Tip;

    beforeEach(async () => {
      pendingTip = Tip.create({
        audience_id: AUDIENCE_ID,
        musician_id: MUSICIAN_ID,
        amount: 30,
        payment_method: PaymentMethod.PIX,
      });
      await tipRepo.insert(pendingTip);
    });

    it("should confirm a tip, credit the musician wallet, and return wallet balance", async () => {
      const tipId = pendingTip.tip_id.id;

      const result = await controller.confirmTipPayment(tipId, {
        amount: 30,
        fee: 1.5,
        payment_method: PaymentMethod.PIX,
        user_id: AUDIENCE_ID,
        metadata: { provider: "pix_mock" },
      } as any);

      expect(result).toBeInstanceOf(ConfirmTipPaymentPresenter);
      expect(result.tip_id).toBe(tipId);
      expect(typeof result.transaction_id).toBe("string");
      expect(result.wallet_balance).toBeGreaterThanOrEqual(0);

      const transactions = await txRepo.findAll();
      expect(transactions).toHaveLength(1);
      expect(transactions[0].amount.amount).toBe(30);

      const wallet = await walletRepo.findByMusicianId(MUSICIAN_ID);
      expect(wallet).not.toBeNull();
      expect(wallet!.total_earned.amount).toBeGreaterThan(0);
    });

    it("should throw NotFoundError when tip does not exist", async () => {
      const unknownId = "00000000-0000-4000-8000-000000000000";

      await expect(
        controller.confirmTipPayment(unknownId, {
          amount: 10,
          fee: 0,
          payment_method: PaymentMethod.PIX,
        } as any),
      ).rejects.toThrow();
    });
  });

  describe("getMusicianWallet", () => {
    it("should return wallet for an existing musician", async () => {
      const wallet = MusicianWallet.create({ musician_id: MUSICIAN_ID });
      wallet.receiveFunds(100);
      await walletRepo.insert(wallet);

      const result = await controller.getMusicianWallet(MUSICIAN_ID);

      expect(result).toBeInstanceOf(MusicianWalletPresenter);
      expect(result.musician_id).toBe(MUSICIAN_ID);
      expect(result.balance).toBe(100);
      expect(result.total_earned).toBe(100);
      expect(result.total_withdrawn).toBe(0);
      expect(result.is_active).toBe(true);
    });

    it("should throw NotFoundError when wallet does not exist", async () => {
      const unknownMusicianId = "00000000-0000-4000-8000-000000000000";

      await expect(
        controller.getMusicianWallet(unknownMusicianId),
      ).rejects.toThrow();
    });
  });

  describe("getMusicianTips", () => {
    it("should list tips for the musician, paginated", async () => {
      await tipRepo.insert(
        Tip.create({
          audience_id: AUDIENCE_ID,
          musician_id: MUSICIAN_ID,
          amount: 10,
          payment_method: PaymentMethod.PIX,
        }),
      );
      await tipRepo.insert(
        Tip.create({
          audience_id: AUDIENCE_ID,
          musician_id: MUSICIAN_ID,
          amount: 20,
          payment_method: PaymentMethod.PIX,
        }),
      );
      await tipRepo.insert(
        Tip.create({
          audience_id: AUDIENCE_ID,
          musician_id: "33333333-3333-4333-8333-333333333333",
          amount: 99,
          payment_method: PaymentMethod.PIX,
        }),
      );

      const result = await controller.getMusicianTips(MUSICIAN_ID, {
        page: 1,
        per_page: 15,
      } as any);

      expect(result).toBeInstanceOf(TipsListPresenter);
      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items.every((tip) => tip.status === TipStatus.PENDING)).toBe(
        true,
      );
    });

    it("should filter tips by status", async () => {
      const tip = Tip.create({
        audience_id: AUDIENCE_ID,
        musician_id: MUSICIAN_ID,
        amount: 15,
        payment_method: PaymentMethod.PIX,
      });
      tip.complete("tx-123");
      await tipRepo.insert(tip);
      await tipRepo.insert(
        Tip.create({
          audience_id: AUDIENCE_ID,
          musician_id: MUSICIAN_ID,
          amount: 5,
          payment_method: PaymentMethod.PIX,
        }),
      );

      const result = await controller.getMusicianTips(MUSICIAN_ID, {
        page: 1,
        per_page: 15,
        status: TipStatus.COMPLETED,
      } as any);

      expect(result.total).toBe(1);
      expect(result.items[0].status).toBe(TipStatus.COMPLETED);
    });
  });

  describe("updatePixKey", () => {
    it("should create the wallet lazily and set the pix key when none exists", async () => {
      const result = await controller.updatePixKey(MUSICIAN_ID, {
        pix_key: "52998224725",
        pix_key_type: "cpf",
      } as any);

      expect(result).toBeInstanceOf(MusicianWalletPresenter);
      expect(result.musician_id).toBe(MUSICIAN_ID);
      // SM-016: o presenter nunca devolve a pix key completa, nem no eco de
      // confirmação — só o sufixo mascarado (a chave crua fica só no banco).
      expect(result.pix_key).toBe("*******4725");
      expect(result.pix_key).not.toContain("52998224725");

      const wallet = await walletRepo.findByMusicianId(MUSICIAN_ID);
      expect(wallet?.pix_key?.key).toBe("52998224725");
    });

    it("should update the pix key of an existing wallet", async () => {
      const wallet = MusicianWallet.create({ musician_id: MUSICIAN_ID });
      await walletRepo.insert(wallet);

      const result = await controller.updatePixKey(MUSICIAN_ID, {
        pix_key: "musico@pix.com",
        pix_key_type: "email",
      } as any);

      expect(result.pix_key).toBe("**********.com");
      expect(result.pix_key).not.toContain("musico@pix.com");
    });

    it("should reject an invalid pix key for the given type", async () => {
      await expect(
        controller.updatePixKey(MUSICIAN_ID, {
          pix_key: "not-a-cpf",
          pix_key_type: "cpf",
        } as any),
      ).rejects.toThrow();
    });
  });

  describe("withdrawToPix", () => {
    it("should withdraw funds, create a completed transaction, and return updated balance", async () => {
      const wallet = MusicianWallet.create({ musician_id: MUSICIAN_ID });
      wallet.receiveFunds(200);
      await walletRepo.insert(wallet);

      const result = await controller.withdrawToPix(MUSICIAN_ID, {
        amount: 110,
        pix_key: { key: "musician@pix.com", type: "email" },
      } as any);

      expect(result).toBeInstanceOf(WithdrawToPixPresenter);
      expect(result.wallet_balance).toBe(90);
      expect(result.status).toBe("completed");
      expect(typeof result.transaction_id).toBe("string");

      const updatedWallet = await walletRepo.findByMusicianId(MUSICIAN_ID);
      expect(updatedWallet!.balance.amount).toBe(90);
      expect(updatedWallet!.total_withdrawn.amount).toBe(110);

      const transactions = await txRepo.findAll();
      expect(transactions).toHaveLength(1);
    });

    it("should throw NotFoundError when wallet does not exist", async () => {
      await expect(
        controller.withdrawToPix(MUSICIAN_ID, {
          amount: 50,
          pix_key: { key: "test@pix.com", type: "email" },
        } as any),
      ).rejects.toThrow();
    });

    it("should throw when withdrawing more than available balance", async () => {
      const wallet = MusicianWallet.create({ musician_id: MUSICIAN_ID });
      wallet.receiveFunds(50);
      await walletRepo.insert(wallet);

      await expect(
        controller.withdrawToPix(MUSICIAN_ID, {
          amount: 100,
          pix_key: { key: "test@pix.com", type: "email" },
        } as any),
      ).rejects.toThrow();
    });
  });
});
