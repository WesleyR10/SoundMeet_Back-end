import { S3Client } from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { IMusicianStorage } from "../../core/musician/application/ports/musician-storage.interface";
import { AcceptBandInviteUseCase } from "../../core/musician/application/use-cases/accept-band-invite/accept-band-invite.use-case";
import { ClearMusicianTouringLocationUseCase } from "../../core/musician/application/use-cases/clear-musician-touring-location/clear-musician-touring-location.use-case";
import { ClearPushTokenUseCase } from "../../core/musician/application/use-cases/clear-push-token/clear-push-token.use-case";
import { CreateBandUseCase } from "../../core/musician/application/use-cases/create-band/create-band.use-case";
import { CustomizeQRCodeUseCase } from "../../core/musician/application/use-cases/customize-qr-code/customize-qr-code.use-case";
import { DeclineBandInviteUseCase } from "../../core/musician/application/use-cases/decline-band-invite/decline-band-invite.use-case";
import { DeleteMusicianPresentationAudioUseCase } from "../../core/musician/application/use-cases/delete-musician-presentation-audio/delete-musician-presentation-audio.use-case";
import { DissolveBandUseCase } from "../../core/musician/application/use-cases/dissolve-band/dissolve-band.use-case";
import { GetBandUseCase } from "../../core/musician/application/use-cases/get-band/get-band.use-case";
import { GetMusicianUseCase } from "../../core/musician/application/use-cases/get-musician/get-musician.use-case";
import { InviteBandMemberUseCase } from "../../core/musician/application/use-cases/invite-band-member/invite-band-member.use-case";
import { ListBandIdentitiesUseCase } from "../../core/musician/application/use-cases/list-band-identities/list-band-identities.use-case";
import { ListBandsUseCase } from "../../core/musician/application/use-cases/list-bands/list-bands.use-case";
import { ListFeaturedMusiciansUseCase } from "../../core/musician/application/use-cases/list-featured-musicians/list-featured-musicians.use-case";
import { ListMusicianIdentitiesUseCase } from "../../core/musician/application/use-cases/list-musician-identities/list-musician-identities.use-case";
import { ListMusiciansUseCase } from "../../core/musician/application/use-cases/list-musicians/list-musicians.use-case";
import { ListMyBandsUseCase } from "../../core/musician/application/use-cases/list-my-bands/list-my-bands.use-case";
import { RegisterPushTokenUseCase } from "../../core/musician/application/use-cases/register-push-token/register-push-token.use-case";
import { RemoveBandMemberUseCase } from "../../core/musician/application/use-cases/remove-band-member/remove-band-member.use-case";
import { SetBandOpenToGigsUseCase } from "../../core/musician/application/use-cases/set-band-open-to-gigs/set-band-open-to-gigs.use-case";
import { SetMusicianOpenToGigsUseCase } from "../../core/musician/application/use-cases/set-musician-open-to-gigs/set-musician-open-to-gigs.use-case";
import { SetMusicianRequestScopeUseCase } from "../../core/musician/application/use-cases/set-musician-request-scope/set-musician-request-scope.use-case";
import { SetMusicianTouringLocationUseCase } from "../../core/musician/application/use-cases/set-musician-touring-location/set-musician-touring-location.use-case";
import { TransferBandLeadershipUseCase } from "../../core/musician/application/use-cases/transfer-band-leadership/transfer-band-leadership.use-case";
import { UpdateBandUseCase } from "../../core/musician/application/use-cases/update-band/update-band.use-case";
import { UpdateMusicianUseCase } from "../../core/musician/application/use-cases/update-musician/update-musician.use-case";
import { UpdateMusicianProfileUseCase } from "../../core/musician/application/use-cases/update-musician-profile/update-musician-profile.use-case";
import { UploadMusicianAvatarUseCase } from "../../core/musician/application/use-cases/upload-musician-avatar/upload-musician-avatar.use-case";
import { UploadMusicianPresentationAudioUseCase } from "../../core/musician/application/use-cases/upload-musician-presentation-audio/upload-musician-presentation-audio.use-case";
import { UploadQrLogoUseCase } from "../../core/musician/application/use-cases/upload-qr-logo/upload-qr-logo.use-case";
import { VerifyMusicianUseCase } from "../../core/musician/application/use-cases/verify-musician/verify-musician.use-case";
import { IBandRepository } from "../../core/musician/domain/band.repository";
import { IBandCommitmentsReader } from "../../core/musician/domain/band-commitments.reader";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { BandCommitmentsPrismaReader } from "../../core/musician/infra/db/prisma/band-commitments-prisma.reader";
import { BandPrismaRepository } from "../../core/musician/infra/db/prisma/band-prisma.repository";
import { MusicianPrismaRepository } from "../../core/musician/infra/db/prisma/musician-prisma.repository";
import { S3MusicianStorage } from "../../core/musician/infra/storage/s3-musician.storage";
import { PlanCheckService } from "../../core/plans/domain/plan-check.service";
import { IIdentityClaimsWriter } from "../../core/shared/application/identity-claims.interface";
import { DomainEventMediator } from "../../core/shared/domain/events/domain-event-mediator";
import { IGeocodingService } from "../../core/shared/domain/geocoding.service";
import { HttpGeocodingService } from "../../core/shared/infra/geocoding/http-geocoding.service";
import { IDENTITY_CLAIMS_WRITER } from "../auth-module/auth.providers";
import { PrismaService } from "../database-module/prisma/prisma.service";

export const MUSICIAN_STORAGE_TOKEN = "MusicianStorage";
export const GEOCODING_SERVICE_TOKEN = "GeocodingService";
export const BAND_COMMITMENTS_READER_TOKEN = "BandCommitmentsReader";

// Geocodificacao best-effort (7.13c) usada pelo update de perfil — endereco
// cadastrado (CEP) vira coordenadas pra busca por raio, sem GPS do musico.
export const SERVICES = {
  GEOCODING_SERVICE: {
    provide: GEOCODING_SERVICE_TOKEN,
    useClass: HttpGeocodingService,
  },
  // O que a banda tem pendurado em outros domínios (shows, conversas, cachê
  // em custódia, set no ar) — lido por contagem direta, sem importar os
  // módulos de `scheduling`/`payment`/`performance`, que já dependem deste.
  BAND_COMMITMENTS_READER: {
    provide: BAND_COMMITMENTS_READER_TOKEN,
    useFactory: (prismaService: PrismaService): IBandCommitmentsReader => {
      return new BandCommitmentsPrismaReader(prismaService);
    },
    inject: [PrismaService],
  },
};

export const REPOSITORIES = {
  MUSICIAN_REPOSITORY: {
    provide: "MusicianRepository",
    useExisting: MusicianPrismaRepository,
  },
  MUSICIAN_PRISMA_REPOSITORY: {
    provide: MusicianPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new MusicianPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  BAND_REPOSITORY: {
    provide: "BandRepository",
    useExisting: BandPrismaRepository,
  },
  BAND_PRISMA_REPOSITORY: {
    provide: BandPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new BandPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
};

// Reaproveita o mesmo bucket/credenciais de storage já configurados para o
// establishment (soundmeet-media) — mesma infra R2/MinIO/S3, prefixo de key diferente.
export const STORAGE = {
  MUSICIAN_STORAGE: {
    provide: MUSICIAN_STORAGE_TOKEN,
    useFactory: (configService: ConfigService): IMusicianStorage => {
      const provider = configService.get<string>(
        "ESTABLISHMENT_STORAGE_PROVIDER",
      );
      const region = configService.get<string>("AWS_REGION") ?? "us-east-1";

      const r2Endpoint = configService.get<string>("CLOUDFLARE_R2_ENDPOINT");
      const r2AccessKey = configService.get<string>(
        "CLOUDFLARE_R2_ACCESS_KEY_ID",
      );
      const r2SecretKey = configService.get<string>(
        "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
      );
      const r2Bucket = configService.get<string>("CLOUDFLARE_R2_BUCKET");
      const r2PublicBaseUrl =
        configService.get<string>("CLOUDFLARE_R2_PUBLIC_BASE_URL") ?? null;

      if (provider === "cloudflare_r2") {
        const s3 = new S3Client({
          region,
          endpoint: r2Endpoint,
          credentials: {
            accessKeyId: r2AccessKey!,
            secretAccessKey: r2SecretKey!,
          },
          forcePathStyle: true,
        });
        return new S3MusicianStorage(s3, r2Bucket!, r2PublicBaseUrl);
      }

      const minioEndpoint =
        configService.get<string>("MINIO_ENDPOINT") ?? "localhost";
      const minioPort = configService.get<number>("MINIO_PORT") ?? 9000;
      const minioAccessKey =
        configService.get<string>("MINIO_ACCESS_KEY") ?? "soundmeet";
      const minioSecretKey =
        configService.get<string>("MINIO_SECRET_KEY") ?? "soundmeet123";
      const minioBucket =
        configService.get<string>("MINIO_BUCKET") ?? "soundmeet-media";
      const minioPublicEndpoint = configService.get<string>(
        "MINIO_PUBLIC_ENDPOINT",
      );
      const minioPublicPort = configService.get<number>("MINIO_PUBLIC_PORT");

      if (provider === "minio" || !provider) {
        const endpoint = `http://${minioEndpoint}:${minioPort}`;
        const s3 = new S3Client({
          region,
          endpoint,
          credentials: {
            accessKeyId: minioAccessKey,
            secretAccessKey: minioSecretKey,
          },
          forcePathStyle: true,
        });
        const publicBaseUrl =
          minioPublicEndpoint && minioPublicPort && minioBucket
            ? `http://${minioPublicEndpoint}:${minioPublicPort}/${minioBucket}`
            : null;
        return new S3MusicianStorage(s3, minioBucket, publicBaseUrl);
      }

      const awsBucket =
        configService.get<string>("AWS_S3_BUCKET") ?? "soundmeet-media";
      const cloudfrontUrl =
        configService.get<string>("AWS_CLOUDFRONT_URL") ?? null;
      const s3 = new S3Client({ region });
      return new S3MusicianStorage(s3, awsBucket, cloudfrontUrl);
    },
    inject: [ConfigService],
  },
};

export const USE_CASES = {
  UPDATE_MUSICIAN_USE_CASE: {
    provide: UpdateMusicianUseCase,
    useFactory: (
      musicianRepo: IMusicianRepository,
      domainEventMediator: DomainEventMediator,
    ) => {
      return new UpdateMusicianUseCase(musicianRepo, domainEventMediator);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide, DomainEventMediator],
  },
  UPDATE_MUSICIAN_PROFILE_USE_CASE: {
    provide: UpdateMusicianProfileUseCase,
    useFactory: (
      musicianRepo: IMusicianRepository,
      geocodingService: IGeocodingService,
    ) => {
      return new UpdateMusicianProfileUseCase(musicianRepo, geocodingService);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide, GEOCODING_SERVICE_TOKEN],
  },
  REGISTER_PUSH_TOKEN_USE_CASE: {
    provide: RegisterPushTokenUseCase,
    useFactory: (musicianRepo: IMusicianRepository) => {
      return new RegisterPushTokenUseCase(musicianRepo);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide],
  },
  CLEAR_PUSH_TOKEN_USE_CASE: {
    provide: ClearPushTokenUseCase,
    useFactory: (musicianRepo: IMusicianRepository) => {
      return new ClearPushTokenUseCase(musicianRepo);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide],
  },
  SET_MUSICIAN_OPEN_TO_GIGS_USE_CASE: {
    provide: SetMusicianOpenToGigsUseCase,
    useFactory: (musicianRepo: IMusicianRepository) => {
      return new SetMusicianOpenToGigsUseCase(musicianRepo);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide],
  },
  SET_MUSICIAN_REQUEST_SCOPE_USE_CASE: {
    provide: SetMusicianRequestScopeUseCase,
    useFactory: (musicianRepo: IMusicianRepository) => {
      return new SetMusicianRequestScopeUseCase(musicianRepo);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide],
  },
  SET_MUSICIAN_TOURING_LOCATION_USE_CASE: {
    provide: SetMusicianTouringLocationUseCase,
    useFactory: (
      musicianRepo: IMusicianRepository,
      geocodingService: IGeocodingService,
    ) => {
      return new SetMusicianTouringLocationUseCase(
        musicianRepo,
        geocodingService,
      );
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide, GEOCODING_SERVICE_TOKEN],
  },
  CLEAR_MUSICIAN_TOURING_LOCATION_USE_CASE: {
    provide: ClearMusicianTouringLocationUseCase,
    useFactory: (musicianRepo: IMusicianRepository) => {
      return new ClearMusicianTouringLocationUseCase(musicianRepo);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide],
  },
  LIST_MUSICIANS_USE_CASE: {
    provide: ListMusiciansUseCase,
    useFactory: (musicianRepo: IMusicianRepository) => {
      return new ListMusiciansUseCase(musicianRepo);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide],
  },
  LIST_FEATURED_MUSICIANS_USE_CASE: {
    provide: ListFeaturedMusiciansUseCase,
    useFactory: (
      musicianRepo: IMusicianRepository,
      planCheckService: PlanCheckService,
    ) => {
      return new ListFeaturedMusiciansUseCase(musicianRepo, planCheckService);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide, PlanCheckService],
  },
  LIST_MUSICIAN_IDENTITIES_USE_CASE: {
    provide: ListMusicianIdentitiesUseCase,
    useFactory: (musicianRepo: IMusicianRepository) => {
      return new ListMusicianIdentitiesUseCase(musicianRepo);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide],
  },
  GET_MUSICIAN_USE_CASE: {
    provide: GetMusicianUseCase,
    useFactory: (
      musicianRepo: IMusicianRepository,
      planCheckService: PlanCheckService,
    ) => {
      return new GetMusicianUseCase(musicianRepo, planCheckService);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide, PlanCheckService],
  },
  CREATE_BAND_USE_CASE: {
    provide: CreateBandUseCase,
    useFactory: (
      bandRepo: IBandRepository,
      identityClaims: IIdentityClaimsWriter,
      geocodingService: IGeocodingService,
    ) => {
      return new CreateBandUseCase(bandRepo, identityClaims, geocodingService);
    },
    inject: [
      REPOSITORIES.BAND_REPOSITORY.provide,
      IDENTITY_CLAIMS_WRITER,
      GEOCODING_SERVICE_TOKEN,
    ],
  },
  LIST_MY_BANDS_USE_CASE: {
    provide: ListMyBandsUseCase,
    useFactory: (bandRepo: IBandRepository) => {
      return new ListMyBandsUseCase(bandRepo);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide],
  },
  LIST_BAND_IDENTITIES_USE_CASE: {
    provide: ListBandIdentitiesUseCase,
    useFactory: (bandRepo: IBandRepository) => {
      return new ListBandIdentitiesUseCase(bandRepo);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide],
  },
  LIST_BANDS_USE_CASE: {
    provide: ListBandsUseCase,
    useFactory: (bandRepo: IBandRepository) => {
      return new ListBandsUseCase(bandRepo);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide],
  },
  DISSOLVE_BAND_USE_CASE: {
    provide: DissolveBandUseCase,
    useFactory: (
      bandRepo: IBandRepository,
      commitments: IBandCommitmentsReader,
      identityClaims: IIdentityClaimsWriter,
    ) => {
      return new DissolveBandUseCase(bandRepo, commitments, identityClaims);
    },
    inject: [
      REPOSITORIES.BAND_REPOSITORY.provide,
      BAND_COMMITMENTS_READER_TOKEN,
      IDENTITY_CLAIMS_WRITER,
    ],
  },
  UPDATE_BAND_USE_CASE: {
    provide: UpdateBandUseCase,
    useFactory: (
      bandRepo: IBandRepository,
      geocodingService: IGeocodingService,
    ) => {
      return new UpdateBandUseCase(bandRepo, geocodingService);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide, GEOCODING_SERVICE_TOKEN],
  },
  GET_BAND_USE_CASE: {
    provide: GetBandUseCase,
    useFactory: (bandRepo: IBandRepository) => {
      return new GetBandUseCase(bandRepo);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide],
  },
  INVITE_BAND_MEMBER_USE_CASE: {
    provide: InviteBandMemberUseCase,
    useFactory: (
      bandRepo: IBandRepository,
      musicianRepo: IMusicianRepository,
      planCheckService: PlanCheckService,
      domainEventMediator: DomainEventMediator,
    ) => {
      return new InviteBandMemberUseCase(
        bandRepo,
        musicianRepo,
        planCheckService,
        domainEventMediator,
      );
    },
    inject: [
      REPOSITORIES.BAND_REPOSITORY.provide,
      REPOSITORIES.MUSICIAN_REPOSITORY.provide,
      PlanCheckService,
      DomainEventMediator,
    ],
  },
  ACCEPT_BAND_INVITE_USE_CASE: {
    provide: AcceptBandInviteUseCase,
    useFactory: (
      bandRepo: IBandRepository,
      domainEventMediator: DomainEventMediator,
    ) => {
      return new AcceptBandInviteUseCase(bandRepo, domainEventMediator);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide, DomainEventMediator],
  },
  DECLINE_BAND_INVITE_USE_CASE: {
    provide: DeclineBandInviteUseCase,
    useFactory: (
      bandRepo: IBandRepository,
      domainEventMediator: DomainEventMediator,
    ) => {
      return new DeclineBandInviteUseCase(bandRepo, domainEventMediator);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide, DomainEventMediator],
  },
  SET_BAND_OPEN_TO_GIGS_USE_CASE: {
    provide: SetBandOpenToGigsUseCase,
    useFactory: (bandRepo: IBandRepository) => {
      return new SetBandOpenToGigsUseCase(bandRepo);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide],
  },
  REMOVE_BAND_MEMBER_USE_CASE: {
    provide: RemoveBandMemberUseCase,
    useFactory: (bandRepo: IBandRepository) => {
      return new RemoveBandMemberUseCase(bandRepo);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide],
  },
  TRANSFER_BAND_LEADERSHIP_USE_CASE: {
    provide: TransferBandLeadershipUseCase,
    useFactory: (
      bandRepo: IBandRepository,
      identityClaims: IIdentityClaimsWriter,
    ) => {
      return new TransferBandLeadershipUseCase(bandRepo, identityClaims);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide, IDENTITY_CLAIMS_WRITER],
  },
  VERIFY_MUSICIAN_USE_CASE: {
    provide: VerifyMusicianUseCase,
    useFactory: (musicianRepo: IMusicianRepository) => {
      return new VerifyMusicianUseCase(musicianRepo);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide],
  },
  CUSTOMIZE_QR_CODE_USE_CASE: {
    provide: CustomizeQRCodeUseCase,
    useFactory: (
      musicianRepo: IMusicianRepository,
      planCheckService: PlanCheckService,
      storage: IMusicianStorage,
    ) => {
      return new CustomizeQRCodeUseCase(
        musicianRepo,
        planCheckService,
        storage,
      );
    },
    inject: [
      REPOSITORIES.MUSICIAN_REPOSITORY.provide,
      PlanCheckService,
      MUSICIAN_STORAGE_TOKEN,
    ],
  },
  UPLOAD_MUSICIAN_AVATAR_USE_CASE: {
    provide: UploadMusicianAvatarUseCase,
    useFactory: (
      musicianRepo: IMusicianRepository,
      storage: IMusicianStorage,
    ) => {
      return new UploadMusicianAvatarUseCase(musicianRepo, storage);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide, MUSICIAN_STORAGE_TOKEN],
  },
  UPLOAD_MUSICIAN_PRESENTATION_AUDIO_USE_CASE: {
    provide: UploadMusicianPresentationAudioUseCase,
    useFactory: (
      musicianRepo: IMusicianRepository,
      storage: IMusicianStorage,
    ) => {
      return new UploadMusicianPresentationAudioUseCase(musicianRepo, storage);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide, MUSICIAN_STORAGE_TOKEN],
  },
  DELETE_MUSICIAN_PRESENTATION_AUDIO_USE_CASE: {
    provide: DeleteMusicianPresentationAudioUseCase,
    useFactory: (
      musicianRepo: IMusicianRepository,
      storage: IMusicianStorage,
    ) => {
      return new DeleteMusicianPresentationAudioUseCase(musicianRepo, storage);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide, MUSICIAN_STORAGE_TOKEN],
  },
  UPLOAD_QR_LOGO_USE_CASE: {
    provide: UploadQrLogoUseCase,
    useFactory: (
      musicianRepo: IMusicianRepository,
      storage: IMusicianStorage,
      planCheckService: PlanCheckService,
    ) => {
      return new UploadQrLogoUseCase(musicianRepo, storage, planCheckService);
    },
    inject: [
      REPOSITORIES.MUSICIAN_REPOSITORY.provide,
      MUSICIAN_STORAGE_TOKEN,
      PlanCheckService,
    ],
  },
};

export const EVENTS = {
  DOMAIN_EVENT_MEDIATOR: {
    provide: DomainEventMediator,
    useFactory: (eventEmitter: EventEmitter2) => {
      return new DomainEventMediator(eventEmitter);
    },
    inject: [EventEmitter2],
  },
};

export const MUSICIANS_PROVIDERS = {
  REPOSITORIES,
  STORAGE,
  SERVICES,
  USE_CASES,
  EVENTS,
};
