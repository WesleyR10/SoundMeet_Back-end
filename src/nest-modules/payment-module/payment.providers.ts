import { ConfigService } from "@nestjs/config";

import { IBandRepository } from "../../core/musician/domain/band.repository";
import { ConfirmTipPaymentUseCase } from "../../core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case";
import { GetMusicianWalletUseCase } from "../../core/payment/application/use-cases/get-musician-wallet/get-musician-wallet.use-case";
import { SendTipUseCase } from "../../core/payment/application/use-cases/send-tip/send-tip.use-case";
import { PlanCheckService } from "../../core/plans";
import { WithdrawToPixUseCase } from "../../core/payment/application/use-cases/withdraw-to-pix/withdraw-to-pix.use-case";
import {
  IMusicianWalletRepository,
  ITipRepository,
  ITransactionRepository,
} from "../../core/payment/domain/repositories";
import {
  MusicianWalletPrismaRepository,
  TipPrismaRepository,
  TransactionPrismaRepository,
} from "../../core/payment/infra/db/prisma";
import { AsaasGatewayAdapter } from "../../core/payment/infra/gateways/asaas-gateway.adapter";
import { IPixGateway } from "../../core/payment/infra/gateways/pix-gateway.interface";
import { PixGatewayMock } from "../../core/payment/infra/gateways/pix-gateway.mock";
import { IPixWithdrawGateway } from "../../core/payment/infra/gateways/pix-withdraw-gateway.interface";
import { DomainEventMediator } from "../../core/shared/domain/events/domain-event-mediator";
import { PrismaUnitOfWork } from "../../core/shared/infra/db/prisma/prisma-unit-of-work";
import { PrismaService } from "../database-module/prisma/prisma.service";
import { EnvConfig } from "../config-module/config.schema";

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

export const INFRA_PROVIDERS = {
  PIX_GATEWAY: {
    provide: "PixGateway",
    useClass: PixGatewayMock,
  },
  ASAAS_PIX_WITHDRAW_GATEWAY: {
    provide: "AsaasPixWithdrawGateway",
    useFactory: (configService: ConfigService<EnvConfig>): IPixWithdrawGateway => {
      const apiUrl = configService.get<string>("ASAAS_API_URL")!;
      const apiKey = configService.get<string>("ASAAS_API_KEY") ?? "";
      return new AsaasGatewayAdapter(apiUrl, apiKey);
    },
    inject: [ConfigService],
  },
};

export const USE_CASES = {
  SEND_TIP_USE_CASE: {
    provide: SendTipUseCase,
    useFactory: (
      tipRepo: ITipRepository,
      planCheckService: PlanCheckService,
      pixGateway: IPixGateway,
    ) => {
      return new SendTipUseCase(tipRepo, planCheckService, pixGateway);
    },
    inject: [
      REPOSITORIES.TIP_REPOSITORY.provide,
      PlanCheckService,
      INFRA_PROVIDERS.PIX_GATEWAY.provide,
    ],
  },
  CONFIRM_TIP_PAYMENT_USE_CASE: {
    provide: ConfirmTipPaymentUseCase,
    useFactory: (
      prismaService: PrismaService,
      bandRepo: IBandRepository,
      domainEventMediator: DomainEventMediator,
    ) => {
      const uow = new PrismaUnitOfWork(prismaService);
      const tipRepo = new TipPrismaRepository(prismaService, uow);
      const txRepo = new TransactionPrismaRepository(prismaService, uow);
      const walletRepo = new MusicianWalletPrismaRepository(prismaService, uow);

      return new ConfirmTipPaymentUseCase(
        tipRepo,
        txRepo,
        walletRepo,
        bandRepo,
        uow,
        domainEventMediator,
      );
    },
    inject: [PrismaService, "BandRepository", DomainEventMediator],
  },
  GET_MUSICIAN_WALLET_USE_CASE: {
    provide: GetMusicianWalletUseCase,
    useFactory: (walletRepo: IMusicianWalletRepository) => {
      return new GetMusicianWalletUseCase(walletRepo);
    },
    inject: [REPOSITORIES.MUSICIAN_WALLET_REPOSITORY.provide],
  },
  WITHDRAW_TO_PIX_USE_CASE: {
    provide: WithdrawToPixUseCase,
    useFactory: (
      walletRepo: IMusicianWalletRepository,
      txRepo: ITransactionRepository,
      pixWithdrawGateway: IPixWithdrawGateway,
      planCheckService: PlanCheckService,
    ) => {
      return new WithdrawToPixUseCase(walletRepo, txRepo, pixWithdrawGateway, planCheckService);
    },
    inject: [
      REPOSITORIES.MUSICIAN_WALLET_REPOSITORY.provide,
      REPOSITORIES.TRANSACTION_REPOSITORY.provide,
      INFRA_PROVIDERS.ASAAS_PIX_WITHDRAW_GATEWAY.provide,
      PlanCheckService,
    ],
  },
};

export const PAYMENT_PROVIDERS = {
  REPOSITORIES,
  INFRA_PROVIDERS,
  USE_CASES,
};
