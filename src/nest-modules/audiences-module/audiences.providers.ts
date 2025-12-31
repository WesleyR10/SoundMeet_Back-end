import { AttendEventUseCase } from "../../core/audience/application/use-cases/attend-event/attend-event.use-case";
import { CompleteProfileUseCase } from "../../core/audience/application/use-cases/complete-profile/complete-profile.use-case";
import { CreateAudienceUseCase } from "../../core/audience/application/use-cases/create-audience/create-audience.use-case";
import { DeleteAudienceUseCase } from "../../core/audience/application/use-cases/delete-audience/delete-audience.use-case";
import { GetAudienceUseCase } from "../../core/audience/application/use-cases/get-audience/get-audience.use-case";
import { IndicateMusicianUseCase } from "../../core/audience/application/use-cases/indicate-musician/indicate-musician.use-case";
import { ListAudiencesUseCase } from "../../core/audience/application/use-cases/list-audiences/list-audiences.use-case";
import { MakeMusicRequestUseCase } from "../../core/audience/application/use-cases/make-music-request/make-music-request.use-case";
import { RecommendMusiciansUseCase } from "../../core/audience/application/use-cases/recommend-musicians/recommend-musicians.use-case";
import { ScanQRUseCase } from "../../core/audience/application/use-cases/scan-qr/scan-qr.use-case";
import { SendTipUseCase } from "../../core/audience/application/use-cases/send-tip/send-tip.use-case";
import { ShareSocialMediaUseCase } from "../../core/audience/application/use-cases/share-social-media/share-social-media.use-case";
import { UpdateAudienceUseCase } from "../../core/audience/application/use-cases/update-audience/update-audience.use-case";
import { VoteSongUseCase } from "../../core/audience/application/use-cases/vote-song/vote-song.use-case";
import { IAudienceRepository } from "../../core/audience/domain/audience.repository";
import { AudiencePrismaRepository } from "../../core/audience/infra/db/prisma/audience-prisma.repository";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { PrismaService } from "../database-module/prisma/prisma.service";

export const REPOSITORIES = {
  AUDIENCE_REPOSITORY: {
    provide: "AudienceRepository",
    useExisting: AudiencePrismaRepository,
  },
  AUDIENCE_PRISMA_REPOSITORY: {
    provide: AudiencePrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new AudiencePrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
};

export const USE_CASES = {
  CREATE_AUDIENCE_USE_CASE: {
    provide: CreateAudienceUseCase,
    useFactory: (audienceRepo: IAudienceRepository) => {
      return new CreateAudienceUseCase(audienceRepo);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide],
  },
  UPDATE_AUDIENCE_USE_CASE: {
    provide: UpdateAudienceUseCase,
    useFactory: (audienceRepo: IAudienceRepository) => {
      return new UpdateAudienceUseCase(audienceRepo);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide],
  },
  DELETE_AUDIENCE_USE_CASE: {
    provide: DeleteAudienceUseCase,
    useFactory: (audienceRepo: IAudienceRepository) => {
      return new DeleteAudienceUseCase(audienceRepo);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide],
  },
  GET_AUDIENCE_USE_CASE: {
    provide: GetAudienceUseCase,
    useFactory: (audienceRepo: IAudienceRepository) => {
      return new GetAudienceUseCase(audienceRepo);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide],
  },
  LIST_AUDIENCES_USE_CASE: {
    provide: ListAudiencesUseCase,
    useFactory: (audienceRepo: IAudienceRepository) => {
      return new ListAudiencesUseCase(audienceRepo);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide],
  },
  COMPLETE_PROFILE_USE_CASE: {
    provide: CompleteProfileUseCase,
    useFactory: (audienceRepo: IAudienceRepository) => {
      return new CompleteProfileUseCase(audienceRepo);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide],
  },
  ATTEND_EVENT_USE_CASE: {
    provide: AttendEventUseCase,
    useFactory: (audienceRepo: IAudienceRepository) => {
      return new AttendEventUseCase(audienceRepo);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide],
  },
  SCAN_QR_USE_CASE: {
    provide: ScanQRUseCase,
    useFactory: (audienceRepo: IAudienceRepository) => {
      return new ScanQRUseCase(audienceRepo);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide],
  },
  MAKE_MUSIC_REQUEST_USE_CASE: {
    provide: MakeMusicRequestUseCase,
    useFactory: (audienceRepo: IAudienceRepository) => {
      return new MakeMusicRequestUseCase(audienceRepo);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide],
  },
  VOTE_SONG_USE_CASE: {
    provide: VoteSongUseCase,
    useFactory: (audienceRepo: IAudienceRepository) => {
      return new VoteSongUseCase(audienceRepo);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide],
  },
  SEND_TIP_USE_CASE: {
    provide: SendTipUseCase,
    useFactory: (audienceRepo: IAudienceRepository) => {
      return new SendTipUseCase(audienceRepo);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide],
  },
  SHARE_SOCIAL_MEDIA_USE_CASE: {
    provide: ShareSocialMediaUseCase,
    useFactory: (audienceRepo: IAudienceRepository) => {
      return new ShareSocialMediaUseCase(audienceRepo);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide],
  },
  INDICATE_MUSICIAN_USE_CASE: {
    provide: IndicateMusicianUseCase,
    useFactory: (audienceRepo: IAudienceRepository) => {
      return new IndicateMusicianUseCase(audienceRepo);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide],
  },
  RECOMMEND_MUSICIANS_USE_CASE: {
    provide: RecommendMusiciansUseCase,
    useFactory: (
      audienceRepo: IAudienceRepository,
      musicianRepo: IMusicianRepository,
    ) => {
      return new RecommendMusiciansUseCase(audienceRepo, musicianRepo);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide, "MusicianRepository"],
  },
};

export const AUDIENCES_PROVIDERS = {
  REPOSITORIES,
  USE_CASES,
};
