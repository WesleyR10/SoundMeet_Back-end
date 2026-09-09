import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";

import { ConfirmTipPaymentUseCase } from "../../../core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case";
import { CreateBookingEscrowUseCase } from "../../../core/payment/application/use-cases/create-booking-escrow/create-booking-escrow.use-case";
import { GetMusicianEscrowsUseCase } from "../../../core/payment/application/use-cases/get-musician-escrows/get-musician-escrows.use-case";
import { GetMusicianTipsUseCase } from "../../../core/payment/application/use-cases/get-musician-tips/get-musician-tips.use-case";
import { GetMusicianWalletUseCase } from "../../../core/payment/application/use-cases/get-musician-wallet/get-musician-wallet.use-case";
import { MarkBookingEscrowHeldUseCase } from "../../../core/payment/application/use-cases/mark-booking-escrow-held/mark-booking-escrow-held.use-case";
import { ProcessDueEscrowReleasesUseCase } from "../../../core/payment/application/use-cases/process-due-escrow-releases/process-due-escrow-releases.use-case";
import { RefundFailedWithdrawUseCase } from "../../../core/payment/application/use-cases/refund-failed-withdraw/refund-failed-withdraw.use-case";
import { ReleaseBookingEscrowUseCase } from "../../../core/payment/application/use-cases/release-booking-escrow/release-booking-escrow.use-case";
import { SendTipUseCase } from "../../../core/payment/application/use-cases/send-tip/send-tip.use-case";
import { WithdrawToPixUseCase } from "../../../core/payment/application/use-cases/withdraw-to-pix/withdraw-to-pix.use-case";
import {
  PlanCheckService,
  SubscriptionInMemoryRepository,
} from "../../../core/plans";
import { DomainEventMediator } from "../../../core/shared/domain/events/domain-event-mediator";
import { PrismaEmailVerificationChecker } from "../../auth-module/prisma-email-verification.checker";
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
        /*
         * Gate de e-mail confirmado do saque PIX. Declarado no `PaymentModule`
         * em produção (só depende do PrismaService) — aqui entra pelo mesmo
         * motivo dos demais: o teste monta os providers à mão.
         */
        PrismaEmailVerificationChecker,
        /*
         * Vem do `SchedulingModule` em produção (`PaymentModule` o importa;
         * `SchedulingModule` não importa `PaymentModule`, então não há ciclo).
         * A liberação da custódia precisa do booking para conferir o check-in e
         * a contestação.
         */
        {
          provide: "BookingRepository",
          useValue: {},
        },
        {
          provide: DomainEventMediator,
          useValue: { publish: jest.fn(), publishIntegrationEvents: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            // TOKEN_ENCRYPTION_KEY precisa ficar undefined (não "mock_value")
            // para cair no fallback de chave efêmera do AesGcmEncryptionService
            // em vez de falhar a validação de 32 bytes base64 (SM-016).
            get: jest.fn((key: string) =>
              key === "TOKEN_ENCRYPTION_KEY" ? undefined : "mock_value",
            ),
          },
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
    expect(module.get(ReleaseBookingEscrowUseCase)).toBeInstanceOf(
      ReleaseBookingEscrowUseCase,
    );
    expect(module.get(ProcessDueEscrowReleasesUseCase)).toBeInstanceOf(
      ProcessDueEscrowReleasesUseCase,
    );
    expect(module.get(GetMusicianWalletUseCase)).toBeInstanceOf(
      GetMusicianWalletUseCase,
    );
    expect(module.get(WithdrawToPixUseCase)).toBeInstanceOf(
      WithdrawToPixUseCase,
    );
    // SM-023 — o estorno é injetado no saque E no webhook TRANSFER_FAILED.
    // Sem o provider registrado, o erro só apareceria no boot da aplicação.
    expect(module.get(RefundFailedWithdrawUseCase)).toBeInstanceOf(
      RefundFailedWithdrawUseCase,
    );
    expect(module.get(GetMusicianTipsUseCase)).toBeInstanceOf(
      GetMusicianTipsUseCase,
    );

    /*
     * Os três da custódia (F1.3a). `Create` e `MarkHeld` montam repositórios
     * TRANSACIONAIS na própria factory, em vez de receber os tokens padrão —
     * é justamente o tipo de wiring à mão que quebra em silêncio no boot, e
     * este teste é o que pega antes do container real.
     */
    expect(module.get(CreateBookingEscrowUseCase)).toBeInstanceOf(
      CreateBookingEscrowUseCase,
    );
    expect(module.get(MarkBookingEscrowHeldUseCase)).toBeInstanceOf(
      MarkBookingEscrowHeldUseCase,
    );
    expect(module.get(GetMusicianEscrowsUseCase)).toBeInstanceOf(
      GetMusicianEscrowsUseCase,
    );

    const confirmTipPayment = module.get<ConfirmTipPaymentUseCase>(
      ConfirmTipPaymentUseCase,
    );
    expect(confirmTipPayment).toBeInstanceOf(ConfirmTipPaymentUseCase);
  });
});
