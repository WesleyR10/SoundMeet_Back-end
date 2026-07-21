import { AcceptBandInviteUseCase } from "../../core/musician/application/use-cases/accept-band-invite/accept-band-invite.use-case";
import { AddBandMemberUseCase } from "../../core/musician/application/use-cases/add-band-member/add-band-member.use-case";
import { ClearMusicianTouringLocationUseCase } from "../../core/musician/application/use-cases/clear-musician-touring-location/clear-musician-touring-location.use-case";
import { SetMusicianTouringLocationUseCase } from "../../core/musician/application/use-cases/set-musician-touring-location/set-musician-touring-location.use-case";
import { CustomizeQRCodeUseCase } from "../../core/musician/application/use-cases/customize-qr-code/customize-qr-code.use-case";
import { VerifyMusicianUseCase } from "../../core/musician/application/use-cases/verify-musician/verify-musician.use-case";
import { CreateBandUseCase } from "../../core/musician/application/use-cases/create-band/create-band.use-case";
import { CreateMusicianUseCase } from "../../core/musician/application/use-cases/create-musician/create-musician.use-case";
import { DeclineBandInviteUseCase } from "../../core/musician/application/use-cases/decline-band-invite/decline-band-invite.use-case";
import { DeleteBandUseCase } from "../../core/musician/application/use-cases/delete-band/delete-band.use-case";
import { DeleteMusicianUseCase } from "../../core/musician/application/use-cases/delete-musician/delete-musician.use-case";
import { GetBandUseCase } from "../../core/musician/application/use-cases/get-band/get-band.use-case";
import { GetMusicianUseCase } from "../../core/musician/application/use-cases/get-musician/get-musician.use-case";
import { InviteBandMemberUseCase } from "../../core/musician/application/use-cases/invite-band-member/invite-band-member.use-case";
import { ListBandsUseCase } from "../../core/musician/application/use-cases/list-bands/list-bands.use-case";
import { ListMusiciansUseCase } from "../../core/musician/application/use-cases/list-musicians/list-musicians.use-case";
import { RegisterPushTokenUseCase } from "../../core/musician/application/use-cases/register-push-token/register-push-token.use-case";
import { RemoveBandMemberUseCase } from "../../core/musician/application/use-cases/remove-band-member/remove-band-member.use-case";
import { SetBandOpenToGigsUseCase } from "../../core/musician/application/use-cases/set-band-open-to-gigs/set-band-open-to-gigs.use-case";
import { SetMusicianOpenToGigsUseCase } from "../../core/musician/application/use-cases/set-musician-open-to-gigs/set-musician-open-to-gigs.use-case";
import { UpdateBandUseCase } from "../../core/musician/application/use-cases/update-band/update-band.use-case";
import { UpdateMusicianUseCase } from "../../core/musician/application/use-cases/update-musician/update-musician.use-case";
import { UpdateMusicianProfileUseCase } from "../../core/musician/application/use-cases/update-musician-profile/update-musician-profile.use-case";
import { UploadMusicianAvatarUseCase } from "../../core/musician/application/use-cases/upload-musician-avatar/upload-musician-avatar.use-case";
import { UploadQrLogoUseCase } from "../../core/musician/application/use-cases/upload-qr-logo/upload-qr-logo.use-case";
import { IBandRepository } from "../../core/musician/domain/band.repository";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { IMusicianStorage } from "../../core/musician/application/ports/musician-storage.interface";
import { S3MusicianStorage } from "../../core/musician/infra/storage/s3-musician.storage";
import { PlanCheckService } from "../../core/plans/domain/plan-check.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ConfigService } from "@nestjs/config";
import AWS from "aws-sdk";
import { DomainEventMediator } from "../../core/shared/domain/events/domain-event-mediator";
import { IGeocodingService } from "../../core/shared/domain/geocoding.service";
import { HttpGeocodingService } from "../../core/shared/infra/geocoding/http-geocoding.service";
import { BandPrismaRepository } from "../../core/musician/infra/db/prisma/band-prisma.repository";
import { MusicianPrismaRepository } from "../../core/musician/infra/db/prisma/musician-prisma.repository";
import { PrismaService } from "../database-module/prisma/prisma.service";

export const MUSICIAN_STORAGE_TOKEN = "MusicianStorage";
export const GEOCODING_SERVICE_TOKEN = "GeocodingService";

// Geocodificacao best-effort (7.13c) usada pelo update de perfil — endereco
// cadastrado (CEP) vira coordenadas pra busca por raio, sem GPS do musico.
export const SERVICES = {
  GEOCODING_SERVICE: {
    provide: GEOCODING_SERVICE_TOKEN,
    useClass: HttpGeocodingService,
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
      const provider = configService.get<string>("ESTABLISHMENT_STORAGE_PROVIDER");
      const region = configService.get<string>("AWS_REGION") ?? "us-east-1";

      const r2Endpoint = configService.get<string>("CLOUDFLARE_R2_ENDPOINT");
      const r2AccessKey = configService.get<string>("CLOUDFLARE_R2_ACCESS_KEY_ID");
      const r2SecretKey = configService.get<string>("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
      const r2Bucket = configService.get<string>("CLOUDFLARE_R2_BUCKET");
      const r2PublicBaseUrl = configService.get<string>("CLOUDFLARE_R2_PUBLIC_BASE_URL") ?? null;

      if (provider === "cloudflare_r2") {
        const s3 = new AWS.S3({
          apiVersion: "2006-03-01",
          signatureVersion: "v4",
          region,
          endpoint: r2Endpoint,
          accessKeyId: r2AccessKey,
          secretAccessKey: r2SecretKey,
          s3ForcePathStyle: true,
        });
        return new S3MusicianStorage(s3, r2Bucket!, r2PublicBaseUrl);
      }

      const minioEndpoint = configService.get<string>("MINIO_ENDPOINT") ?? "localhost";
      const minioPort = configService.get<number>("MINIO_PORT") ?? 9000;
      const minioAccessKey = configService.get<string>("MINIO_ACCESS_KEY") ?? "soundmeet";
      const minioSecretKey = configService.get<string>("MINIO_SECRET_KEY") ?? "soundmeet123";
      const minioBucket = configService.get<string>("MINIO_BUCKET") ?? "soundmeet-media";
      const minioPublicEndpoint = configService.get<string>("MINIO_PUBLIC_ENDPOINT");
      const minioPublicPort = configService.get<number>("MINIO_PUBLIC_PORT");

      if (provider === "minio" || !provider) {
        const endpoint = `http://${minioEndpoint}:${minioPort}`;
        const s3 = new AWS.S3({
          apiVersion: "2006-03-01",
          signatureVersion: "v4",
          region,
          endpoint,
          accessKeyId: minioAccessKey,
          secretAccessKey: minioSecretKey,
          s3ForcePathStyle: true,
        });
        const publicBaseUrl =
          minioPublicEndpoint && minioPublicPort && minioBucket
            ? `http://${minioPublicEndpoint}:${minioPublicPort}/${minioBucket}`
            : null;
        return new S3MusicianStorage(s3, minioBucket, publicBaseUrl);
      }

      const awsBucket = configService.get<string>("AWS_S3_BUCKET") ?? "soundmeet-media";
      const cloudfrontUrl = configService.get<string>("AWS_CLOUDFRONT_URL") ?? null;
      const s3 = new AWS.S3({ apiVersion: "2006-03-01", signatureVersion: "v4", region });
      return new S3MusicianStorage(s3, awsBucket, cloudfrontUrl);
    },
    inject: [ConfigService],
  },
};

export const USE_CASES = {
  CREATE_MUSICIAN_USE_CASE: {
    provide: CreateMusicianUseCase,
    useFactory: (musicianRepo: IMusicianRepository) => {
      return new CreateMusicianUseCase(musicianRepo);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide],
  },
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
  SET_MUSICIAN_OPEN_TO_GIGS_USE_CASE: {
    provide: SetMusicianOpenToGigsUseCase,
    useFactory: (musicianRepo: IMusicianRepository) => {
      return new SetMusicianOpenToGigsUseCase(musicianRepo);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide],
  },
  SET_MUSICIAN_TOURING_LOCATION_USE_CASE: {
    provide: SetMusicianTouringLocationUseCase,
    useFactory: (
      musicianRepo: IMusicianRepository,
      geocodingService: IGeocodingService,
    ) => {
      return new SetMusicianTouringLocationUseCase(musicianRepo, geocodingService);
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
  DELETE_MUSICIAN_USE_CASE: {
    provide: DeleteMusicianUseCase,
    useFactory: (musicianRepo: IMusicianRepository) => {
      return new DeleteMusicianUseCase(musicianRepo);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide],
  },
  CREATE_BAND_USE_CASE: {
    provide: CreateBandUseCase,
    useFactory: (bandRepo: IBandRepository) => {
      return new CreateBandUseCase(bandRepo);
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
  DELETE_BAND_USE_CASE: {
    provide: DeleteBandUseCase,
    useFactory: (bandRepo: IBandRepository) => {
      return new DeleteBandUseCase(bandRepo);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide],
  },
  UPDATE_BAND_USE_CASE: {
    provide: UpdateBandUseCase,
    useFactory: (bandRepo: IBandRepository) => {
      return new UpdateBandUseCase(bandRepo);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide],
  },
  GET_BAND_USE_CASE: {
    provide: GetBandUseCase,
    useFactory: (bandRepo: IBandRepository) => {
      return new GetBandUseCase(bandRepo);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide],
  },
  // @deprecated — mantido registrado (não injetado em nenhum controller) só
  // para não quebrar quem ainda referencia AddBandMemberUseCase diretamente.
  // Substituído por INVITE_BAND_MEMBER_USE_CASE (fluxo com convite/aceite).
  ADD_BAND_MEMBER_USE_CASE: {
    provide: AddBandMemberUseCase,
    useFactory: (
      bandRepo: IBandRepository,
      musicianRepo: IMusicianRepository,
      planCheckService: PlanCheckService,
    ) => {
      return new AddBandMemberUseCase(bandRepo, musicianRepo, planCheckService);
    },
    inject: [
      REPOSITORIES.BAND_REPOSITORY.provide,
      REPOSITORIES.MUSICIAN_REPOSITORY.provide,
      PlanCheckService,
    ],
  },
  INVITE_BAND_MEMBER_USE_CASE: {
    provide: InviteBandMemberUseCase,
    useFactory: (
      bandRepo: IBandRepository,
      musicianRepo: IMusicianRepository,
      planCheckService: PlanCheckService,
    ) => {
      return new InviteBandMemberUseCase(bandRepo, musicianRepo, planCheckService);
    },
    inject: [
      REPOSITORIES.BAND_REPOSITORY.provide,
      REPOSITORIES.MUSICIAN_REPOSITORY.provide,
      PlanCheckService,
    ],
  },
  ACCEPT_BAND_INVITE_USE_CASE: {
    provide: AcceptBandInviteUseCase,
    useFactory: (bandRepo: IBandRepository) => {
      return new AcceptBandInviteUseCase(bandRepo);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide],
  },
  DECLINE_BAND_INVITE_USE_CASE: {
    provide: DeclineBandInviteUseCase,
    useFactory: (bandRepo: IBandRepository) => {
      return new DeclineBandInviteUseCase(bandRepo);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide],
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
    ) => {
      return new CustomizeQRCodeUseCase(musicianRepo, planCheckService);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide, PlanCheckService],
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
