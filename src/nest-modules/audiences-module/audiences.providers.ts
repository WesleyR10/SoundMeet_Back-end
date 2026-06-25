import { MusicianPrismaRepository } from "@core/musician/infra/db/prisma/musician-prisma.repository";
import { PrismaUnitOfWork } from "@core/shared/infra/db/prisma/prisma-unit-of-work";

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
import { DomainEventMediator } from "../../core/shared/domain/events/domain-event-mediator";
import { AudiencePrismaRepository } from "../../core/audience/infra/db/prisma/audience-prisma.repository";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AddEventAttendeeUseCase } from "../../core/events/application/use-cases/add-event-attendee/add-event-attendee.use-case";
import { AddPointsUseCase } from "../../core/gamification/application/use-cases/add-points/add-points.use-case";
import { IUserInteractionRepository } from "../../core/gamification/domain/user-interaction.repository";
import { UserInteractionPrismaRepository } from "../../core/gamification/infra/db/prisma/user-interaction-prisma.repository";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { SendTipUseCase as PaymentSendTipUseCase } from "../../core/payment/application/use-cases/send-tip/send-tip.use-case";
import { CreateRequestUseCase } from "../../core/request/application/use-cases/create-request/create-request.use-case";
import { VoteRequestUseCase } from "../../core/request/application/use-cases/vote-request/vote-request.use-case";
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
  USER_INTERACTION_REPOSITORY: {
    provide: "UserInteractionRepository",
    useExisting: UserInteractionPrismaRepository,
  },
  USER_INTERACTION_PRISMA_REPOSITORY: {
    provide: UserInteractionPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new UserInteractionPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
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
    useFactory: (
      audienceRepo: IAudienceRepository,
      domainEventMediator: DomainEventMediator,
    ) => {
      return new UpdateAudienceUseCase(audienceRepo, domainEventMediator);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide, DomainEventMediator],
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
    useFactory: (
      audienceRepo: IAudienceRepository,
      addEventAttendeeUseCase: AddEventAttendeeUseCase,
    ) => {
      return new AttendEventUseCase(audienceRepo, addEventAttendeeUseCase);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide, AddEventAttendeeUseCase],
  },
  SCAN_QR_USE_CASE: {
    provide: ScanQRUseCase,
    useFactory: (
      audienceRepo: IAudienceRepository,
      userInteractionRepo: IUserInteractionRepository,
      musicianRepo: IMusicianRepository,
      prismaService: PrismaService,
    ) => {
      const uow = new PrismaUnitOfWork(prismaService);
      return new ScanQRUseCase(
        audienceRepo,
        userInteractionRepo,
        musicianRepo,
        uow,
      );
    },
    inject: [
      REPOSITORIES.AUDIENCE_REPOSITORY.provide,
      REPOSITORIES.USER_INTERACTION_REPOSITORY.provide,
      REPOSITORIES.MUSICIAN_REPOSITORY.provide,
      PrismaService,
    ],
  },
  MAKE_MUSIC_REQUEST_USE_CASE: {
    provide: MakeMusicRequestUseCase,
    useFactory: (
      audienceRepo: IAudienceRepository,
      createRequestUseCase: CreateRequestUseCase,
      addPointsUseCase: AddPointsUseCase,
    ) => {
      return new MakeMusicRequestUseCase(
        audienceRepo,
        createRequestUseCase,
        addPointsUseCase,
      );
    },
    inject: [
      REPOSITORIES.AUDIENCE_REPOSITORY.provide,
      CreateRequestUseCase,
      AddPointsUseCase,
    ],
  },
  VOTE_SONG_USE_CASE: {
    provide: VoteSongUseCase,
    useFactory: (
      audienceRepo: IAudienceRepository,
      voteRequestUseCase: VoteRequestUseCase,
    ) => {
      return new VoteSongUseCase(audienceRepo, voteRequestUseCase);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide, VoteRequestUseCase],
  },
  SEND_TIP_USE_CASE: {
    provide: SendTipUseCase,
    useFactory: (
      audienceRepo: IAudienceRepository,
      sendTipUseCase: PaymentSendTipUseCase,
    ) => {
      return new SendTipUseCase(audienceRepo, sendTipUseCase);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide, PaymentSendTipUseCase],
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

export const EVENTS = {
  DOMAIN_EVENT_MEDIATOR: {
    provide: DomainEventMediator,
    useFactory: (eventEmitter: EventEmitter2) => {
      return new DomainEventMediator(eventEmitter);
    },
    inject: [EventEmitter2],
  },
};

export const AUDIENCES_PROVIDERS = {
  REPOSITORIES,
  USE_CASES,
  EVENTS,
};
