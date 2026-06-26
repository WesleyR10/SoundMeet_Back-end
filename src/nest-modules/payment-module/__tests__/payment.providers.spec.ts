import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";

import { ConfirmTipPaymentUseCase } from "../../../core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case";
import { GetMusicianWalletUseCase } from "../../../core/payment/application/use-cases/get-musician-wallet/get-musician-wallet.use-case";
import { SendTipUseCase } from "../../../core/payment/application/use-cases/send-tip/send-tip.use-case";
import { WithdrawToPixUseCase } from "../../../core/payment/application/use-cases/withdraw-to-pix/withdraw-to-pix.use-case";
import {
  PlanCheckService,
  SubscriptionInMemoryRepository,
} from "../../../core/plans";
import { DomainEventMediator } from "../../../core/shared/domain/events/domain-event-mediator";
import { PrismaService } from "../../database-module/prisma/prisma.service";
import { PAYMENT_PROVIDERS } from "../payment.providers";

describe("Payment providers", () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        ...Object.values(PAYMENT_PROVIDERS.REPOSITORIES),
        ...Object.values(PAYMENT_PROVIDERS.INFRA_PROVIDERS),
        ...Object.values(PAYMENT_PROVIDERS.USE_CASES),
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
          },
        },
        {
          provide: "BandRepository",
          useValue: {},
        },
        {
          provide: DomainEventMediator,
          useValue: { publish: jest.fn(), publishIntegrationEvents: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue("mock_value") },
        },
        {
          provide: PlanCheckService,
          useValue: new PlanCheckService(new SubscriptionInMemoryRepository()),
        },
      ],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it("wires payment use cases", () => {
    expect(module.get(SendTipUseCase)).toBeInstanceOf(SendTipUseCase);
    expect(module.get(GetMusicianWalletUseCase)).toBeInstanceOf(
      GetMusicianWalletUseCase,
    );
    expect(module.get(WithdrawToPixUseCase)).toBeInstanceOf(
      WithdrawToPixUseCase,
    );

    const confirmTipPayment = module.get<ConfirmTipPaymentUseCase>(
      ConfirmTipPaymentUseCase,
    );
    expect(confirmTipPayment).toBeInstanceOf(ConfirmTipPaymentUseCase);
  });
});
