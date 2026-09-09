import { S3Client } from "@aws-sdk/client-s3";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaClient } from "@prisma/client";
import { Cache } from "cache-manager";

import { IContractChallengeNotifier } from "../../core/contract/application/ports/contract-challenge-notifier.port";
import { IContractDocumentNotifier } from "../../core/contract/application/ports/contract-document-notifier.port";
import { IContractRenderer } from "../../core/contract/application/ports/contract-renderer.port";
import { IContractSignatureChallenge } from "../../core/contract/application/ports/contract-signature-challenge.port";
import { IContractSignatureProvider } from "../../core/contract/application/ports/contract-signature-provider.port";
import { IContractStorage } from "../../core/contract/application/ports/contract-storage.interface";
import { AnnulContractUseCase } from "../../core/contract/application/use-cases/annul-contract/annul-contract.use-case";
import { GetContractUseCase } from "../../core/contract/application/use-cases/get-contract/get-contract.use-case";
import { GetContractDocumentUseCase } from "../../core/contract/application/use-cases/get-contract-document/get-contract-document.use-case";
import { IssueContractUseCase } from "../../core/contract/application/use-cases/issue-contract/issue-contract.use-case";
import { ListContractsUseCase } from "../../core/contract/application/use-cases/list-contracts/list-contracts.use-case";
import { NotifyContractPartiesUseCase } from "../../core/contract/application/use-cases/notify-contract-parties/notify-contract-parties.use-case";
import { RequestSignatureChallengeUseCase } from "../../core/contract/application/use-cases/request-signature-challenge/request-signature-challenge.use-case";
import { SignContractUseCase } from "../../core/contract/application/use-cases/sign-contract/sign-contract.use-case";
import { VerifyContractUseCase } from "../../core/contract/application/use-cases/verify-contract/verify-contract.use-case";
import {
  ClauseCatalog,
  IClauseCatalog,
} from "../../core/contract/domain/catalog/clause-catalog";
import { IContractRepository } from "../../core/contract/domain/contract.repository";
import { ContractPrismaRepository } from "../../core/contract/infra/db/prisma/contract-prisma.repository";
import { ReactPdfContractRenderer } from "../../core/contract/infra/renderer/react-pdf-contract.renderer";
import { CacheSignatureChallengeProvider } from "../../core/contract/infra/signature/cache-signature-challenge.provider";
import { InternalContractSignatureProvider } from "../../core/contract/infra/signature/internal-signature.provider";
import { S3ContractStorage } from "../../core/contract/infra/storage/s3-contract.storage";
import { IEstablishmentRepository } from "../../core/establishment/domain/establishment.repository";
import { IBandRepository } from "../../core/musician/domain/band.repository";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { IBookingRepository } from "../../core/scheduling/domain/booking.repository";
import { DomainEventMediator } from "../../core/shared/domain/events/domain-event-mediator";
import { PrismaService } from "../database-module/prisma/prisma.service";
import { MailService } from "../mail-module/mail.service";
import { MailContractChallengeNotifier } from "./mail-contract-challenge.notifier";
import { MailContractDocumentNotifier } from "./mail-contract-document.notifier";

export const CONTRACT_STORAGE_TOKEN = "ContractStorage";
export const CONTRACT_RENDERER_TOKEN = "ContractRenderer";
export const CONTRACT_SIGNATURE_PROVIDER_TOKEN = "ContractSignatureProvider";
export const CONTRACT_SIGNATURE_CHALLENGE_TOKEN = "ContractSignatureChallenge";
export const CONTRACT_CHALLENGE_NOTIFIER_TOKEN = "ContractChallengeNotifier";
export const CONTRACT_DOCUMENT_NOTIFIER_TOKEN = "ContractDocumentNotifier";
export const CLAUSE_CATALOG_TOKEN = "ClauseCatalog";

export const REPOSITORIES = {
  CONTRACT_PRISMA_REPOSITORY: {
    provide: ContractPrismaRepository,
    useFactory: (prisma: PrismaClient) => new ContractPrismaRepository(prisma),
    inject: [PrismaService],
  },
  CONTRACT_REPOSITORY: {
    provide: "ContractRepository",
    useExisting: ContractPrismaRepository,
  },
};

export const INFRA = {
  /**
   * Storage **privado** do contrato.
   *
   * Bucket próprio e, principalmente, **sem `publicBaseUrl`**: a porta
   * `IContractStorage` não tem `getPublicUrl`, então não há como um contrato
   * com CPF, CNPJ e endereço acabar exposto por uma URL de bucket. O download
   * passa por rota autorizada que faz stream.
   *
   * Switch de três vias no mesmo molde de establishment/ai-cifra/ai-audio, mas
   * o bucket cai para um nome próprio (`soundmeet-contracts`) em vez de
   * compartilhar `soundmeet-media`, que é público.
   */
  CONTRACT_STORAGE: {
    provide: CONTRACT_STORAGE_TOKEN,
    useFactory: (configService: ConfigService): IContractStorage => {
      const provider = configService.get<string>("CONTRACT_STORAGE_PROVIDER");
      const region = configService.get<string>("AWS_REGION") ?? "us-east-1";
      const bucket =
        configService.get<string>("CONTRACT_STORAGE_BUCKET") ??
        "soundmeet-contracts";

      if (provider === "cloudflare_r2") {
        const s3 = new S3Client({
          region,
          endpoint: configService.get<string>("CLOUDFLARE_R2_ENDPOINT"),
          credentials: {
            accessKeyId: configService.get<string>(
              "CLOUDFLARE_R2_ACCESS_KEY_ID",
            )!,
            secretAccessKey: configService.get<string>(
              "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
            )!,
          },
          forcePathStyle: true,
        });
        return new S3ContractStorage(s3, bucket);
      }

      if (provider === "aws_s3") {
        return new S3ContractStorage(new S3Client({ region }), bucket);
      }

      const endpoint = `http://${configService.get<string>("MINIO_ENDPOINT") ?? "localhost"}:${configService.get<number>("MINIO_PORT") ?? 9000}`;
      const s3 = new S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId:
            configService.get<string>("MINIO_ACCESS_KEY") ?? "soundmeet",
          secretAccessKey:
            configService.get<string>("MINIO_SECRET_KEY") ?? "soundmeet123",
        },
        forcePathStyle: true,
      });
      return new S3ContractStorage(s3, bucket);
    },
    inject: [ConfigService],
  },

  CONTRACT_RENDERER: {
    provide: CONTRACT_RENDERER_TOKEN,
    useFactory: (): IContractRenderer => new ReactPdfContractRenderer(),
  },

  CONTRACT_SIGNATURE_PROVIDER: {
    provide: CONTRACT_SIGNATURE_PROVIDER_TOKEN,
    useFactory: (): IContractSignatureProvider =>
      new InternalContractSignatureProvider(),
  },

  /*
   * Segundo fator em cache. Redis em produção, memória no teste — o mesmo
   * `CACHE_MANAGER` que `synced-lyrics` já usa. O provider guarda o HASH do
   * código, então nem um dump do Redis revela código vivo.
   */
  CONTRACT_SIGNATURE_CHALLENGE: {
    provide: CONTRACT_SIGNATURE_CHALLENGE_TOKEN,
    useFactory: (
      cache: Cache,
      config: ConfigService,
    ): IContractSignatureChallenge =>
      new CacheSignatureChallengeProvider(
        cache,
        config.get<string>("CONTRACT_CHALLENGE_SECRET") ?? "",
      ),
    inject: [CACHE_MANAGER, ConfigService],
  },

  CONTRACT_CHALLENGE_NOTIFIER: {
    provide: CONTRACT_CHALLENGE_NOTIFIER_TOKEN,
    useFactory: (mail: MailService): IContractChallengeNotifier =>
      new MailContractChallengeNotifier(mail),
    inject: [MailService],
  },

  CONTRACT_DOCUMENT_NOTIFIER: {
    provide: CONTRACT_DOCUMENT_NOTIFIER_TOKEN,
    useFactory: (mail: MailService): IContractDocumentNotifier =>
      new MailContractDocumentNotifier(mail),
    inject: [MailService],
  },

  CLAUSE_CATALOG: {
    provide: CLAUSE_CATALOG_TOKEN,
    useFactory: (): IClauseCatalog => new ClauseCatalog(),
  },
};

export const USE_CASES = {
  ISSUE_CONTRACT_USE_CASE: {
    provide: IssueContractUseCase,
    useFactory: (
      contractRepo: IContractRepository,
      bookingRepo: IBookingRepository,
      establishmentRepo: IEstablishmentRepository,
      musicianRepo: IMusicianRepository,
      bandRepo: IBandRepository,
      catalog: IClauseCatalog,
      renderer: IContractRenderer,
      storage: IContractStorage,
      configService: ConfigService,
      domainEventMediator: DomainEventMediator,
    ) =>
      new IssueContractUseCase({
        contractRepo,
        bookingRepo,
        establishmentRepo,
        musicianRepo,
        bandRepo,
        catalog,
        renderer,
        storage,
        issuer: {
          legal_name:
            configService.get<string>("CONTRACT_ISSUER_LEGAL_NAME") ??
            "SoundMeet",
          document:
            configService.get<string>("CONTRACT_ISSUER_DOCUMENT") ??
            "00000000000000",
        },
        verificationBaseUrl:
          configService.get<string>("CONTRACT_VERIFICATION_BASE_URL") ??
          "https://soundmeet.com.br/contrato",
        /*
         * 🔑 Único ponto de contato do contrato com o F1.3(a). Ligado, passa a
         * escolher `cache_pagamento.com_custodia` e a incluir
         * `custodia_liberacao` — sem tocar em cláusula nenhuma. O nome é o da
         * instituição de pagamento, nunca o da plataforma.
         */
        escrow: {
          enabled: configService.get<boolean>("ESCROW_ENABLED") === true,
          custodian_legal_name:
            configService.get<string>("ESCROW_CUSTODIAN_LEGAL_NAME") ?? "",
        },
        domainEventMediator,
      }),
    inject: [
      "ContractRepository",
      "BookingRepository",
      "EstablishmentRepository",
      "MusicianRepository",
      "BandRepository",
      CLAUSE_CATALOG_TOKEN,
      CONTRACT_RENDERER_TOKEN,
      CONTRACT_STORAGE_TOKEN,
      ConfigService,
      DomainEventMediator,
    ],
  },

  REQUEST_SIGNATURE_CHALLENGE_USE_CASE: {
    provide: RequestSignatureChallengeUseCase,
    useFactory: (
      contractRepo: IContractRepository,
      challenge: IContractSignatureChallenge,
      notifier: IContractChallengeNotifier,
      bandRepo: IBandRepository,
    ) =>
      new RequestSignatureChallengeUseCase({
        contractRepo,
        challenge,
        notifier,
        bandRepo,
      }),
    inject: [
      "ContractRepository",
      CONTRACT_SIGNATURE_CHALLENGE_TOKEN,
      CONTRACT_CHALLENGE_NOTIFIER_TOKEN,
      "BandRepository",
    ],
  },

  NOTIFY_CONTRACT_PARTIES_USE_CASE: {
    provide: NotifyContractPartiesUseCase,
    useFactory: (
      contractRepo: IContractRepository,
      storage: IContractStorage,
      notifier: IContractDocumentNotifier,
      bandRepo: IBandRepository,
      config: ConfigService,
    ) =>
      new NotifyContractPartiesUseCase({
        contractRepo,
        storage,
        notifier,
        bandRepo,
        verificationBaseUrl:
          config.get<string>("CONTRACT_VERIFICATION_BASE_URL") ??
          "https://soundmeet.com.br/contrato",
      }),
    inject: [
      "ContractRepository",
      CONTRACT_STORAGE_TOKEN,
      CONTRACT_DOCUMENT_NOTIFIER_TOKEN,
      "BandRepository",
      ConfigService,
    ],
  },

  SIGN_CONTRACT_USE_CASE: {
    provide: SignContractUseCase,
    useFactory: (
      contractRepo: IContractRepository,
      challenge: IContractSignatureChallenge,
      signatureProvider: IContractSignatureProvider,
      renderer: IContractRenderer,
      storage: IContractStorage,
      bandRepo: IBandRepository,
      domainEventMediator: DomainEventMediator,
    ) =>
      new SignContractUseCase({
        contractRepo,
        challenge,
        signatureProvider,
        renderer,
        storage,
        bandRepo,
        domainEventMediator,
      }),
    inject: [
      "ContractRepository",
      CONTRACT_SIGNATURE_CHALLENGE_TOKEN,
      CONTRACT_SIGNATURE_PROVIDER_TOKEN,
      CONTRACT_RENDERER_TOKEN,
      CONTRACT_STORAGE_TOKEN,
      "BandRepository",
      DomainEventMediator,
    ],
  },

  GET_CONTRACT_USE_CASE: {
    provide: GetContractUseCase,
    useFactory: (contractRepo: IContractRepository) =>
      new GetContractUseCase(contractRepo),
    inject: ["ContractRepository"],
  },

  LIST_CONTRACTS_USE_CASE: {
    provide: ListContractsUseCase,
    useFactory: (contractRepo: IContractRepository) =>
      new ListContractsUseCase(contractRepo),
    inject: ["ContractRepository"],
  },

  VERIFY_CONTRACT_USE_CASE: {
    provide: VerifyContractUseCase,
    useFactory: (contractRepo: IContractRepository) =>
      new VerifyContractUseCase(contractRepo),
    inject: ["ContractRepository"],
  },

  GET_CONTRACT_DOCUMENT_USE_CASE: {
    provide: GetContractDocumentUseCase,
    useFactory: (
      contractRepo: IContractRepository,
      storage: IContractStorage,
    ) => new GetContractDocumentUseCase(contractRepo, storage),
    inject: ["ContractRepository", CONTRACT_STORAGE_TOKEN],
  },

  ANNUL_CONTRACT_USE_CASE: {
    provide: AnnulContractUseCase,
    useFactory: (
      contractRepo: IContractRepository,
      domainEventMediator: DomainEventMediator,
    ) =>
      new AnnulContractUseCase(
        contractRepo,
        { now: () => new Date() },
        domainEventMediator,
      ),
    inject: ["ContractRepository", DomainEventMediator],
  },
};

export const EVENTS = {
  DOMAIN_EVENT_MEDIATOR: {
    provide: DomainEventMediator,
    useFactory: (eventEmitter: EventEmitter2) =>
      new DomainEventMediator(eventEmitter),
    inject: [EventEmitter2],
  },
};

export const CONTRACT_PROVIDERS = {
  REPOSITORIES,
  INFRA,
  EVENTS,
  USE_CASES,
};
