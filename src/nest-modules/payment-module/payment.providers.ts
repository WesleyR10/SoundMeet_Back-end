import { PrismaService } from "../database-module/prisma/prisma.service";
import { SendTipUseCase } from "../../core/payment/application/use-cases/send-tip.use-case";
import { ConfirmTipPaymentUseCase } from "../../core/payment/application/use-cases/confirm-tip-payment.use-case";
import { FailTipPaymentUseCase } from "../../core/payment/application/use-cases/fail-tip-payment.use-case";
import { GetMusicianTransactionsUseCase } from "../../core/payment/application/use-cases/get-musician-transactions.use-case";
import { WithdrawToPixUseCase } from "../../core/payment/application/use-cases/withdraw-to-pix.use-case";
import { TipPrismaRepository } from "../../core/payment/infra/db/prisma/tip-prisma.repository";
import { TransactionPrismaRepository } from "../../core/payment/infra/db/prisma/transaction-prisma.repository";
import { MusicianWalletPrismaRepository } from "../../core/payment/infra/db/prisma/musician-wallet-prisma.repository";
import { ITipRepository } from "../../core/payment/domain/repositories/tip.repository";
import { ITransactionRepository } from "../../core/payment/domain/repositories/transaction.repository";
import { IMusicianWalletRepository } from "../../core/payment/domain/musician-wallet.repository";
import { PixGatewayMock } from "../../core/payment/infra/gateways/pix-gateway.mock";
import { IPixGateway } from "../../core/payment/infra/gateways/pix-gateway.interface";

export const REPOSITORIES = {
  TIP_REPOSITORY: {
    provide: "TipRepository",
    useExisting: TipPrismaRepository,
  },
  TIP_PRISMA_REPOSITORY: {
    provide: TipPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new TipPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  TRANSACTION_REPOSITORY: {
    provide: "TransactionRepository",
    useExisting: TransactionPrismaRepository,
  },
  TRANSACTION_PRISMA_REPOSITORY: {
    provide: TransactionPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new TransactionPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  MUSICIAN_WALLET_REPOSITORY: {
    provide: "MusicianWalletRepository",
    useExisting: MusicianWalletPrismaRepository,
  },
  MUSICIAN_WALLET_PRISMA_REPOSITORY: {
    provide: MusicianWalletPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new MusicianWalletPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
};

export const GATEWAYS = {
  PIX_GATEWAY: {
    provide: "PixGateway",
    useClass: PixGatewayMock,
  },
};

export const USE_CASES = {
  SEND_TIP_USE_CASE: {
    provide: SendTipUseCase,
    useFactory: (tipRepo: ITipRepository, pixGateway: IPixGateway) => {
      return new SendTipUseCase(tipRepo, pixGateway);
    },
    inject: [REPOSITORIES.TIP_REPOSITORY.provide, GATEWAYS.PIX_GATEWAY.provide],
  },
  CONFIRM_TIP_PAYMENT_USE_CASE: {
    provide: ConfirmTipPaymentUseCase,
    useFactory: (
      tipRepo: ITipRepository,
      txRepo: ITransactionRepository,
      walletRepo: IMusicianWalletRepository
    ) => {
      return new ConfirmTipPaymentUseCase(tipRepo, txRepo, walletRepo);
    },
    inject: [
      REPOSITORIES.TIP_REPOSITORY.provide,
      REPOSITORIES.TRANSACTION_REPOSITORY.provide,
      REPOSITORIES.MUSICIAN_WALLET_REPOSITORY.provide,
    ],
  },
  FAIL_TIP_PAYMENT_USE_CASE: {
    provide: FailTipPaymentUseCase,
    useFactory: (tipRepo: ITipRepository) => {
      return new FailTipPaymentUseCase(tipRepo);
    },
    inject: [REPOSITORIES.TIP_REPOSITORY.provide],
  },
  GET_MUSICIAN_TRANSACTIONS_USE_CASE: {
    provide: GetMusicianTransactionsUseCase,
    useFactory: (txRepo: ITransactionRepository) => {
      return new GetMusicianTransactionsUseCase(txRepo);
    },
    inject: [REPOSITORIES.TRANSACTION_REPOSITORY.provide],
  },
  WITHDRAW_TO_PIX_USE_CASE: {
    provide: WithdrawToPixUseCase,
    useFactory: (
      walletRepo: IMusicianWalletRepository,
      txRepo: ITransactionRepository
    ) => {
      return new WithdrawToPixUseCase(walletRepo, txRepo);
    },
    inject: [
      REPOSITORIES.MUSICIAN_WALLET_REPOSITORY.provide,
      REPOSITORIES.TRANSACTION_REPOSITORY.provide,
    ],
  },
};

export const PAYMENT_PROVIDERS = {
  REPOSITORIES,
  GATEWAYS,
  USE_CASES,
};
