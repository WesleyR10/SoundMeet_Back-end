import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";

import { IBandRepository } from "../../core/musician/domain/band.repository";
import { ConfirmTipPaymentUseCase } from "../../core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case";
import { GetMusicianTipsUseCase } from "../../core/payment/application/use-cases/get-musician-tips/get-musician-tips.use-case";
import { GetMusicianWalletUseCase } from "../../core/payment/application/use-cases/get-musician-wallet/get-musician-wallet.use-case";
import { SendTipUseCase } from "../../core/payment/application/use-cases/send-tip/send-tip.use-case";
import { UpdateMusicianPixKeyUseCase } from "../../core/payment/application/use-cases/update-musician-pix-key/update-musician-pix-key.use-case";
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
import { PlanCheckService } from "../../core/plans";
import { IEncryptionService } from "../../core/shared/domain/encryption.service";
import { DomainEventMediator } from "../../core/shared/domain/events/domain-event-mediator";
import { AesGcmEncryptionService } from "../../core/shared/infra/crypto/aes-gcm-encryption.service";
import { PrismaUnitOfWork } from "../../core/shared/infra/db/prisma/prisma-unit-of-work";
import { EnvConfig } from "../config-module/config.schema";
import { PrismaService } from "../database-module/prisma/prisma.service";

export const INFRA_PROVIDERS = {
  // SM-016: cifra pix_key/bank_account em repouso (AES-256-GCM). Mesmo token
  // "EncryptionService" e mesma TOKEN_ENCRYPTION_KEY do GoogleCalendarModule
  // (google-calendar.providers.ts) — não importamos aquele módulo aqui para
  // não criar dependência cruzada entre domínios; a chave é infra genérica.
  ENCRYPTION_SERVICE: {
    provide: "EncryptionService",
    useFactory: (
      configService: ConfigService<EnvConfig>,
    ): IEncryptionService => {
      const key = configService.get<string>("TOKEN_ENCRYPTION_KEY");
      if (key && key.trim()) {
        return new AesGcmEncryptionService(key);
      }
      new Logger("PaymentModule").warn(
        "TOKEN_ENCRYPTION_KEY ausente — usando chave efêmera de desenvolvimento (pix key/dados bancários cifrados não sobrevivem a restart)",
      );
      return new AesGcmEncryptionService(randomBytes(32).toString("base64"));
    },
    inject: [ConfigService],
  },
  PIX_GATEWAY: {
    provide: "PixGateway",
    useClass: PixGatewayMock,
  },
  ASAAS_PIX_WITHDRAW_GATEWAY: {
    provide: "AsaasPixWithdrawGateway",
    useFactory: (
      configService: ConfigService<EnvConfig>,
    ): IPixWithdrawGateway => {
      const apiUrl = configService.get<string>("ASAAS_API_URL")!;
      const apiKey = configService.get<string>("ASAAS_API_KEY") ?? "";
      return new AsaasGatewayAdapter(apiUrl, apiKey);
    },
    inject: [ConfigService],
  },
};

export const REPOSITORIES = {
  TIP_REPOSITORY: {
    provide: "TipRepository",
    useExisting: TipPrismaRepository,
  },
  TIP_PRISMA_REPOSITORY: {
    provide: TipPrismaRepository,
    useFactory: (
      prismaService: PrismaService,
      encryption: IEncryptionService,
    ) => {
      return new TipPrismaRepository(prismaService, undefined, encryption);
    },
    inject: [PrismaService, INFRA_PROVIDERS.ENCRYPTION_SERVICE.provide],
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
    useFactory: (
      prismaService: PrismaService,
      encryption: IEncryptionService,
    ) => {
      return new MusicianWalletPrismaRepository(
        prismaService,
        undefined,
        encryption,
      );
    },
    inject: [PrismaService, INFRA_PROVIDERS.ENCRYPTION_SERVICE.provide],
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
      encryption: IEncryptionService,
    ) => {
      const uow = new PrismaUnitOfWork(prismaService);
      const tipRepo = new TipPrismaRepository(prismaService, uow, encryption);
      const txRepo = new TransactionPrismaRepository(prismaService, uow);
      const walletRepo = new MusicianWalletPrismaRepository(
        prismaService,
        uow,
        encryption,
      );

      return new ConfirmTipPaymentUseCase(
        tipRepo,
        txRepo,
        walletRepo,
        bandRepo,
        uow,
        domainEventMediator,
      );
    },
    inject: [
      PrismaService,
      "BandRepository",
      DomainEventMediator,
      INFRA_PROVIDERS.ENCRYPTION_SERVICE.provide,
    ],
  },
  GET_MUSICIAN_WALLET_USE_CASE: {
    provide: GetMusicianWalletUseCase,
    useFactory: (
      walletRepo: IMusicianWalletRepository,
      planCheckService: PlanCheckService,
    ) => {
      return new GetMusicianWalletUseCase(walletRepo, planCheckService);
    },
    inject: [REPOSITORIES.MUSICIAN_WALLET_REPOSITORY.provide, PlanCheckService],
  },
  GET_MUSICIAN_TIPS_USE_CASE: {
    provide: GetMusicianTipsUseCase,
    useFactory: (tipRepo: ITipRepository) => {
      return new GetMusicianTipsUseCase(tipRepo);
    },
    inject: [REPOSITORIES.TIP_REPOSITORY.provide],
  },
  UPDATE_MUSICIAN_PIX_KEY_USE_CASE: {
    provide: UpdateMusicianPixKeyUseCase,
    useFactory: (
      walletRepo: IMusicianWalletRepository,
      planCheckService: PlanCheckService,
    ) => {
      return new UpdateMusicianPixKeyUseCase(walletRepo, planCheckService);
    },
    inject: [REPOSITORIES.MUSICIAN_WALLET_REPOSITORY.provide, PlanCheckService],
  },
  WITHDRAW_TO_PIX_USE_CASE: {
    provide: WithdrawToPixUseCase,
    useFactory: (
      walletRepo: IMusicianWalletRepository,
      txRepo: ITransactionRepository,
      pixWithdrawGateway: IPixWithdrawGateway,
      planCheckService: PlanCheckService,
    ) => {
      return new WithdrawToPixUseCase(
        walletRepo,
        txRepo,
        pixWithdrawGateway,
        planCheckService,
      );
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
