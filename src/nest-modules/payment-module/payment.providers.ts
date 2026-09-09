import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";

import { IBandRepository } from "../../core/musician/domain/band.repository";
import { ConfirmTipPaymentUseCase } from "../../core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case";
import { CompleteMercadoPagoConnectionUseCase } from "../../core/payment/application/use-cases/connect-mercadopago/complete-mercadopago-connection.use-case";
import { ConnectMercadoPagoUseCase } from "../../core/payment/application/use-cases/connect-mercadopago/connect-mercadopago.use-case";
import { DisconnectMercadoPagoUseCase } from "../../core/payment/application/use-cases/connect-mercadopago/disconnect-mercadopago.use-case";
import { CreateBookingEscrowUseCase } from "../../core/payment/application/use-cases/create-booking-escrow/create-booking-escrow.use-case";
import { GetMusicianEscrowsUseCase } from "../../core/payment/application/use-cases/get-musician-escrows/get-musician-escrows.use-case";
import { GetMusicianTipsUseCase } from "../../core/payment/application/use-cases/get-musician-tips/get-musician-tips.use-case";
import { GetMusicianWalletUseCase } from "../../core/payment/application/use-cases/get-musician-wallet/get-musician-wallet.use-case";
import { GetTipUseCase } from "../../core/payment/application/use-cases/get-tip/get-tip.use-case";
import { MarkBookingEscrowHeldUseCase } from "../../core/payment/application/use-cases/mark-booking-escrow-held/mark-booking-escrow-held.use-case";
import { ProcessDueEscrowReleasesUseCase } from "../../core/payment/application/use-cases/process-due-escrow-releases/process-due-escrow-releases.use-case";
import { RefreshMercadoPagoTokensUseCase } from "../../core/payment/application/use-cases/refresh-mercadopago-tokens/refresh-mercadopago-tokens.use-case";
import { RefundFailedWithdrawUseCase } from "../../core/payment/application/use-cases/refund-failed-withdraw/refund-failed-withdraw.use-case";
import { ReleaseBookingEscrowUseCase } from "../../core/payment/application/use-cases/release-booking-escrow/release-booking-escrow.use-case";
import { SendTipUseCase } from "../../core/payment/application/use-cases/send-tip/send-tip.use-case";
import { UpdateMusicianPixKeyUseCase } from "../../core/payment/application/use-cases/update-musician-pix-key/update-musician-pix-key.use-case";
import { WithdrawToPixUseCase } from "../../core/payment/application/use-cases/withdraw-to-pix/withdraw-to-pix.use-case";
import {
  IBookingEscrowRepository,
  IMusicianWalletRepository,
  ITipRepository,
  ITransactionRepository,
} from "../../core/payment/domain/repositories";
import {
  BookingEscrowPrismaRepository,
  MusicianWalletPrismaRepository,
  TipPrismaRepository,
  TransactionPrismaRepository,
} from "../../core/payment/infra/db/prisma";
import { AsaasEscrowAdapter } from "../../core/payment/infra/gateways/asaas-escrow.adapter";
import { AsaasGatewayAdapter } from "../../core/payment/infra/gateways/asaas-gateway.adapter";
import { AsaasSubaccountAdapter } from "../../core/payment/infra/gateways/asaas-subaccount.adapter";
import { IBookingEscrowGateway } from "../../core/payment/infra/gateways/booking-escrow-gateway.interface";
import { MercadoPagoOAuthAdapter } from "../../core/payment/infra/gateways/mercadopago-oauth.adapter";
import { IMercadoPagoOAuthGateway } from "../../core/payment/infra/gateways/mercadopago-oauth.gateway";
import { MercadoPagoPixGateway } from "../../core/payment/infra/gateways/mercadopago-pix.gateway";
import { IPixGateway } from "../../core/payment/infra/gateways/pix-gateway.interface";
import { PixGatewayMock } from "../../core/payment/infra/gateways/pix-gateway.mock";
import { IPixWithdrawGateway } from "../../core/payment/infra/gateways/pix-withdraw-gateway.interface";
import { ISubaccountGateway } from "../../core/payment/infra/gateways/subaccount-gateway.interface";
import { WalletMercadoPagoAccountResolver } from "../../core/payment/infra/gateways/wallet-mercadopago-account.resolver";
import { PlanCheckService } from "../../core/plans";
import { IBookingRepository } from "../../core/scheduling/domain/booking.repository";
import { IEncryptionService } from "../../core/shared/domain/encryption.service";
import { DomainEventMediator } from "../../core/shared/domain/events/domain-event-mediator";
import { AesGcmEncryptionService } from "../../core/shared/infra/crypto/aes-gcm-encryption.service";
import { OAuthStateService } from "../../core/shared/infra/crypto/oauth-state.service";
import { PrismaUnitOfWork } from "../../core/shared/infra/db/prisma/prisma-unit-of-work";
import { PrismaEmailVerificationChecker } from "../auth-module/prisma-email-verification.checker";
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
  /**
   * Gateway da GORJETA — roteado por vértice.
   *
   * Mercado Pago quando configurado (0,99% **sem piso**, cobrança criada na
   * conta do próprio músico via OAuth), com fallback para o mock em
   * desenvolvimento. O Asaas **não** entra aqui: R$1,99 fixos dão prejuízo em
   * toda gorjeta abaixo de R$22 no plano FREE. Ver
   * `Docs/payment-gateway-research-2026-08.md`.
   *
   * O fallback é para o mock, e não para o Asaas, de propósito: cair
   * silenciosamente num gateway que perde dinheiro por transação é pior que
   * cair num mock que grita "isso não é real".
   */
  PIX_GATEWAY: {
    provide: "PixGateway",
    useFactory: (
      configService: ConfigService<EnvConfig>,
      walletRepo: IMusicianWalletRepository,
    ): IPixGateway => {
      const apiUrl = configService.get<string>("MERCADOPAGO_API_URL");

      if (!apiUrl?.trim()) {
        new Logger("PaymentModule").warn(
          "MERCADOPAGO_API_URL ausente — gorjetas usando PixGatewayMock (nenhum pagamento real será processado)",
        );
        return new PixGatewayMock();
      }

      return new MercadoPagoPixGateway(
        apiUrl,
        new WalletMercadoPagoAccountResolver(walletRepo),
      );
    },
    inject: [ConfigService, "MusicianWalletRepository"],
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

  /**
   * Custódia do cachê (F1.3a).
   *
   * Mesmas credenciais do adapter de saque de propósito: é o mesmo provedor, e
   * duas configurações separadas para a mesma conta é o começo de uma
   * divergir da outra num deploy.
   */
  ASAAS_ESCROW_GATEWAY: {
    provide: "BookingEscrowGateway",
    useFactory: (
      configService: ConfigService<EnvConfig>,
    ): IBookingEscrowGateway => {
      const apiUrl = configService.get<string>("ASAAS_API_URL")!;
      const apiKey = configService.get<string>("ASAAS_API_KEY") ?? "";
      return new AsaasEscrowAdapter(apiUrl, apiKey);
    },
    inject: [ConfigService],
  },

  /**
   * Leitura de cobrança no MP — usada pelo webhook.
   *
   * `useExisting` sobre o mesmo adapter: é o mesmo cliente HTTP e as mesmas
   * credenciais. Duas instâncias seriam duas configurações para o mesmo
   * provedor, e é assim que uma diverge da outra num deploy.
   */
  MERCADOPAGO_PAYMENT_READER: {
    provide: "MercadoPagoPaymentReader",
    useExisting: "MercadoPagoOAuthGateway",
  },

  /** Fluxo OAuth que vincula a conta Mercado Pago do músico. */
  MERCADOPAGO_OAUTH_GATEWAY: {
    provide: "MercadoPagoOAuthGateway",
    useFactory: (
      configService: ConfigService<EnvConfig>,
    ): IMercadoPagoOAuthGateway =>
      new MercadoPagoOAuthAdapter({
        apiUrl:
          configService.get<string>("MERCADOPAGO_API_URL") ??
          "https://api.mercadopago.com",
        authUrl: "https://auth.mercadopago.com.br/authorization",
        clientId: configService.get<string>("MERCADOPAGO_CLIENT_ID") ?? "",
        clientSecret:
          configService.get<string>("MERCADOPAGO_CLIENT_SECRET") ?? "",
        redirectUri:
          configService.get<string>("MERCADOPAGO_REDIRECT_URI") ?? "",
      }),
    inject: [ConfigService],
  },

  /**
   * Assinatura do `state` do OAuth (defesa CSRF).
   *
   * O `purpose` `mp_connect` é o que impede um `state` emitido no fluxo do
   * Google Calendar de ser aceito aqui — e vincular uma conta que RECEBE
   * DINHEIRO num fluxo que o usuário achou que era de agenda.
   *
   * Reaproveita o `JWT_SECRET`, como o fluxo do calendário já faz: é segredo de
   * servidor, e um segundo segredo só para isto seria mais uma coisa para
   * rotacionar e esquecer.
   */
  MERCADOPAGO_OAUTH_STATE: {
    provide: "MercadoPagoOAuthState",
    useFactory: (configService: ConfigService<EnvConfig>) =>
      new OAuthStateService(
        configService.get<string>("JWT_SECRET")!,
        "mp_connect",
      ),
    inject: [ConfigService],
  },

  /** Subconta do músico na instituição de pagamento (F1.0). */
  ASAAS_SUBACCOUNT_GATEWAY: {
    provide: "SubaccountGateway",
    useFactory: (
      configService: ConfigService<EnvConfig>,
    ): ISubaccountGateway => {
      const apiUrl = configService.get<string>("ASAAS_API_URL")!;
      const apiKey = configService.get<string>("ASAAS_API_KEY") ?? "";
      return new AsaasSubaccountAdapter(apiUrl, apiKey);
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
  BOOKING_ESCROW_REPOSITORY: {
    provide: "BookingEscrowRepository",
    useExisting: BookingEscrowPrismaRepository,
  },
  BOOKING_ESCROW_PRISMA_REPOSITORY: {
    provide: BookingEscrowPrismaRepository,
    useFactory: (prismaService: PrismaService) =>
      new BookingEscrowPrismaRepository(prismaService),
    inject: [PrismaService],
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
  CONNECT_MERCADOPAGO_USE_CASE: {
    provide: ConnectMercadoPagoUseCase,
    useFactory: (oauth: IMercadoPagoOAuthGateway, state: OAuthStateService) =>
      new ConnectMercadoPagoUseCase(oauth, state),
    inject: [
      INFRA_PROVIDERS.MERCADOPAGO_OAUTH_GATEWAY.provide,
      INFRA_PROVIDERS.MERCADOPAGO_OAUTH_STATE.provide,
    ],
  },
  COMPLETE_MERCADOPAGO_CONNECTION_USE_CASE: {
    provide: CompleteMercadoPagoConnectionUseCase,
    useFactory: (
      walletRepo: IMusicianWalletRepository,
      oauth: IMercadoPagoOAuthGateway,
      state: OAuthStateService,
    ) => new CompleteMercadoPagoConnectionUseCase(walletRepo, oauth, state),
    inject: [
      "MusicianWalletRepository",
      INFRA_PROVIDERS.MERCADOPAGO_OAUTH_GATEWAY.provide,
      INFRA_PROVIDERS.MERCADOPAGO_OAUTH_STATE.provide,
    ],
  },
  DISCONNECT_MERCADOPAGO_USE_CASE: {
    provide: DisconnectMercadoPagoUseCase,
    useFactory: (walletRepo: IMusicianWalletRepository) =>
      new DisconnectMercadoPagoUseCase(walletRepo),
    inject: ["MusicianWalletRepository"],
  },
  REFRESH_MERCADOPAGO_TOKENS_USE_CASE: {
    provide: RefreshMercadoPagoTokensUseCase,
    useFactory: (
      walletRepo: IMusicianWalletRepository,
      oauth: IMercadoPagoOAuthGateway,
    ) => new RefreshMercadoPagoTokensUseCase({ walletRepo, oauth }),
    inject: [
      "MusicianWalletRepository",
      INFRA_PROVIDERS.MERCADOPAGO_OAUTH_GATEWAY.provide,
    ],
  },

  /**
   * Liberação da custódia (F1.3a).
   *
   * Exportado como use case próprio — e não escondido dentro do job — porque
   * tem DOIS chamadores: a varredura por prazo e a resolução manual de uma
   * contestação. Duplicar a regra nos dois seria garantir que divergissem.
   */
  /*
   * Repositórios TRANSACIONAIS, montados aqui em vez de injetados pelos tokens
   * padrão: custódia e carteira precisam compartilhar a mesma transação, e os
   * repositórios registrados no container são construídos sem `uow`. Mesmo
   * desenho de `CONFIRM_TIP_PAYMENT_USE_CASE`, que resolveu isto primeiro.
   */
  RELEASE_BOOKING_ESCROW_USE_CASE: {
    provide: ReleaseBookingEscrowUseCase,
    useFactory: (
      prismaService: PrismaService,
      gateway: IBookingEscrowGateway,
      bookingRepo: IBookingRepository,
      domainEventMediator: DomainEventMediator,
      encryption: IEncryptionService,
    ) => {
      const uow = new PrismaUnitOfWork(prismaService);
      return new ReleaseBookingEscrowUseCase({
        escrowRepo: new BookingEscrowPrismaRepository(prismaService, uow),
        walletRepo: new MusicianWalletPrismaRepository(
          prismaService,
          uow,
          encryption,
        ),
        gateway,
        bookingRepo,
        uow,
        domainEventMediator,
      });
    },
    inject: [
      PrismaService,
      INFRA_PROVIDERS.ASAAS_ESCROW_GATEWAY.provide,
      "BookingRepository",
      DomainEventMediator,
      "EncryptionService",
    ],
  },

  /**
   * Abertura da custódia, disparada pelo `BookingConfirmedEvent`.
   *
   * Nunca é chamada por HTTP: a custódia nasce da confirmação do show, e uma
   * rota que a criasse avulsa permitiria cobrar um estabelecimento por um show
   * que ninguém confirmou.
   */
  CREATE_BOOKING_ESCROW_USE_CASE: {
    provide: CreateBookingEscrowUseCase,
    useFactory: (
      escrowRepo: IBookingEscrowRepository,
      bookingRepo: IBookingRepository,
      walletRepo: IMusicianWalletRepository,
      gateway: IBookingEscrowGateway,
      planCheckService: PlanCheckService,
    ) =>
      new CreateBookingEscrowUseCase({
        escrowRepo,
        bookingRepo,
        walletRepo,
        gateway,
        // Satisfaz `BookingFeeResolver` por tipagem estrutural, mesmo desenho
        // do `planResolver` da varredura de liberação.
        planResolver: planCheckService,
      }),
    inject: [
      "BookingEscrowRepository",
      "BookingRepository",
      "MusicianWalletRepository",
      INFRA_PROVIDERS.ASAAS_ESCROW_GATEWAY.provide,
      PlanCheckService,
    ],
  },

  /** Retenção — só o webhook do provedor chama. Transacional, como a liberação. */
  MARK_BOOKING_ESCROW_HELD_USE_CASE: {
    provide: MarkBookingEscrowHeldUseCase,
    useFactory: (
      prismaService: PrismaService,
      encryption: IEncryptionService,
    ) => {
      const uow = new PrismaUnitOfWork(prismaService);
      return new MarkBookingEscrowHeldUseCase({
        escrowRepo: new BookingEscrowPrismaRepository(prismaService, uow),
        walletRepo: new MusicianWalletPrismaRepository(
          prismaService,
          uow,
          encryption,
        ),
        uow,
      });
    },
    inject: [PrismaService, "EncryptionService"],
  },

  GET_MUSICIAN_ESCROWS_USE_CASE: {
    provide: GetMusicianEscrowsUseCase,
    useFactory: (escrowRepo: IBookingEscrowRepository) =>
      new GetMusicianEscrowsUseCase(escrowRepo),
    inject: ["BookingEscrowRepository"],
  },

  PROCESS_DUE_ESCROW_RELEASES_USE_CASE: {
    provide: ProcessDueEscrowReleasesUseCase,
    useFactory: (
      escrowRepo: IBookingEscrowRepository,
      bookingRepo: IBookingRepository,
      releaseUseCase: ReleaseBookingEscrowUseCase,
      planCheckService: PlanCheckService,
    ) =>
      new ProcessDueEscrowReleasesUseCase({
        escrowRepo,
        bookingRepo,
        releaseUseCase,
        /*
         * O `PlanCheckService` satisfaz `EscrowReleaseDaysResolver` por tipagem
         * estrutural — a porta é estreita de propósito, para o use-case do
         * pagamento não passar a depender da superfície inteira de planos.
         */
        planResolver: planCheckService,
      }),
    inject: [
      "BookingEscrowRepository",
      "BookingRepository",
      ReleaseBookingEscrowUseCase,
      PlanCheckService,
    ],
  },

  SEND_TIP_USE_CASE: {
    provide: SendTipUseCase,
    useFactory: (
      tipRepo: ITipRepository,
      planCheckService: PlanCheckService,
      pixGateway: IPixGateway,
      configService: ConfigService<EnvConfig>,
      bandRepo: IBandRepository,
    ) => {
      return new SendTipUseCase(
        tipRepo,
        planCheckService,
        pixGateway,
        /*
         * A taxa do provedor sai da NOSSA comissão, não do músico — é o que a
         * tabela de preços promete com "1% gateway incluso". Ver
         * `SendTipUseCase.getApplicationFee`.
         */
        configService.get<number>("MERCADOPAGO_FEE_PERCENTAGE") ?? 0.99,
        /*
         * Gorjeta de BANDA liquida na conta do líder — banda não tem conta no
         * provedor. Sem este repositório a cobrança sairia sem beneficiário e
         * o adapter recusaria toda gorjeta de banda.
         */
        bandRepo,
      );
    },
    inject: [
      REPOSITORIES.TIP_REPOSITORY.provide,
      PlanCheckService,
      INFRA_PROVIDERS.PIX_GATEWAY.provide,
      ConfigService,
      "BandRepository",
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
  GET_TIP_USE_CASE: {
    provide: GetTipUseCase,
    useFactory: (tipRepo: ITipRepository) => {
      return new GetTipUseCase(tipRepo);
    },
    inject: [REPOSITORIES.TIP_REPOSITORY.provide],
  },
  UPDATE_MUSICIAN_PIX_KEY_USE_CASE: {
    provide: UpdateMusicianPixKeyUseCase,
    useFactory: (
      walletRepo: IMusicianWalletRepository,
      planCheckService: PlanCheckService,
      domainEventMediator: DomainEventMediator,
    ) => {
      return new UpdateMusicianPixKeyUseCase(
        walletRepo,
        planCheckService,
        domainEventMediator,
      );
    },
    inject: [
      REPOSITORIES.MUSICIAN_WALLET_REPOSITORY.provide,
      PlanCheckService,
      DomainEventMediator,
    ],
  },
  /**
   * 🔴 Os repositórios são construídos AQUI, ligados a esta `UnitOfWork` — não
   * são os singletons de `REPOSITORIES`.
   *
   * É a mesma razão de `RELEASE_BOOKING_ESCROW_USE_CASE`: um repositório sem
   * UoW escreve sempre fora da transação, e aqui isso apagaria as duas
   * garantias do saque de uma vez — o débito e o lançamento deixariam de ser
   * atômicos, e `findByMusicianIdForUpdate` não teria transação para segurar o
   * lock (ele recusa rodar, em vez de fingir que protege).
   */
  REFUND_FAILED_WITHDRAW_USE_CASE: {
    provide: RefundFailedWithdrawUseCase,
    useFactory: (
      prismaService: PrismaService,
      encryption: IEncryptionService,
    ) => {
      const uow = new PrismaUnitOfWork(prismaService);
      return new RefundFailedWithdrawUseCase(
        new TransactionPrismaRepository(prismaService, uow),
        new MusicianWalletPrismaRepository(prismaService, uow, encryption),
        uow,
      );
    },
    inject: [PrismaService, "EncryptionService"],
  },
  WITHDRAW_TO_PIX_USE_CASE: {
    provide: WithdrawToPixUseCase,
    useFactory: (
      prismaService: PrismaService,
      encryption: IEncryptionService,
      pixWithdrawGateway: IPixWithdrawGateway,
      planCheckService: PlanCheckService,
      refundUseCase: RefundFailedWithdrawUseCase,
      configService: ConfigService,
      emailVerificationChecker: PrismaEmailVerificationChecker,
    ) => {
      const uow = new PrismaUnitOfWork(prismaService);
      const cooldownHours =
        configService.get<number>("PIX_KEY_CHANGE_COOLDOWN_HOURS") ?? 24;
      return new WithdrawToPixUseCase({
        walletRepo: new MusicianWalletPrismaRepository(
          prismaService,
          uow,
          encryption,
        ),
        txRepo: new TransactionPrismaRepository(prismaService, uow),
        uow,
        refundUseCase,
        pixWithdrawGateway,
        planCheckService,
        emailVerificationChecker,
        pixKeyChangeCooldownMs: cooldownHours * 3_600_000,
      });
    },
    inject: [
      PrismaService,
      "EncryptionService",
      INFRA_PROVIDERS.ASAAS_PIX_WITHDRAW_GATEWAY.provide,
      PlanCheckService,
      RefundFailedWithdrawUseCase,
      ConfigService,
      PrismaEmailVerificationChecker,
    ],
  },
};

export const PAYMENT_PROVIDERS = {
  REPOSITORIES,
  INFRA_PROVIDERS,
  USE_CASES,
};
