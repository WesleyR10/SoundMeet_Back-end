import { ConfigService } from "@nestjs/config";

import { IAudienceRepository } from "../../core/audience/domain";
import { IEventRepository } from "../../core/events/domain";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { BatchRespondToRequestsUseCase } from "../../core/request/application/use-cases/batch-respond-to-requests/batch-respond-to-requests.use-case";
import { CreateRequestUseCase } from "../../core/request/application/use-cases/create-request/create-request.use-case";
import { CreateRequestFeedbackUseCase } from "../../core/request/application/use-cases/create-request-feedback/create-request-feedback.use-case";
import { DeleteRequestUseCase } from "../../core/request/application/use-cases/delete-request/delete-request.use-case";
import { GetMusicianRequestsUseCase } from "../../core/request/application/use-cases/get-musician-requests/get-musician-requests.use-case";
import { GetRequestUseCase } from "../../core/request/application/use-cases/get-request/get-request.use-case";
import { GetRequestFeedbackUseCase } from "../../core/request/application/use-cases/get-request-feedback/get-request-feedback.use-case";
import { GetRequestSuggestionsUseCase } from "../../core/request/application/use-cases/get-request-suggestions/get-request-suggestions.use-case";
import { ListRequestsUseCase } from "../../core/request/application/use-cases/list-requests/list-requests.use-case";
import { MarkRequestPlayedUseCase } from "../../core/request/application/use-cases/mark-request-played/mark-request-played.use-case";
import { RespondToRequestUseCase } from "../../core/request/application/use-cases/respond-to-request/respond-to-request.use-case";
import { UpdateRequestUseCase } from "../../core/request/application/use-cases/update-request/update-request.use-case";
import { VoteRequestUseCase } from "../../core/request/application/use-cases/vote-request/vote-request.use-case";
import { IRequestRepository } from "../../core/request/domain/request.repository";
import { IRequestFeedbackRepository } from "../../core/request/domain/request-feedback.repository";
import { IRequestVoteRepository } from "../../core/request/domain/request-vote.repository";
import { RequestFeedbackPrismaRepository } from "../../core/request/infra/db/prisma/request-feedback-prisma.repository";
import { RequestPrismaRepository } from "../../core/request/infra/db/prisma/request-prisma.repository";
import { RequestVotePrismaRepository } from "../../core/request/infra/db/prisma/request-vote-prisma.repository";
import { IClock } from "../../core/shared/application/clock.interface";
import { DomainEventMediator } from "../../core/shared/domain/events/domain-event-mediator";
import { ConfigSchemaType } from "../config-module/config.schema";
import { PrismaService } from "../database-module/prisma/prisma.service";

export const REPOSITORIES = {
  REQUEST_REPOSITORY: {
    provide: "RequestRepository",
    useExisting: RequestPrismaRepository,
  },
  REQUEST_PRISMA_REPOSITORY: {
    provide: RequestPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new RequestPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  REQUEST_VOTE_REPOSITORY: {
    provide: "RequestVoteRepository",
    useExisting: RequestVotePrismaRepository,
  },
  REQUEST_VOTE_PRISMA_REPOSITORY: {
    provide: RequestVotePrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new RequestVotePrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  REQUEST_FEEDBACK_REPOSITORY: {
    provide: "RequestFeedbackRepository",
    useExisting: RequestFeedbackPrismaRepository,
  },
  REQUEST_FEEDBACK_PRISMA_REPOSITORY: {
    provide: RequestFeedbackPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new RequestFeedbackPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
};

export const SERVICES = {
  CLOCK: {
    provide: "Clock",
    useValue: { now: () => new Date() } satisfies IClock,
  },
};

export const USE_CASES = {
  CREATE_REQUEST_USE_CASE: {
    provide: CreateRequestUseCase,
    useFactory: (
      requestRepo: IRequestRepository,
      eventRepo: IEventRepository,
      musicianRepo: IMusicianRepository,
      audienceRepo: IAudienceRepository,
      configService: ConfigSchemaType,
      clock: IClock,
      domainEventMediator: DomainEventMediator,
    ) => {
      return new CreateRequestUseCase(
        requestRepo,
        eventRepo,
        musicianRepo,
        audienceRepo,
        configService.get<number>("MAX_REQUESTS_PER_USER_PER_EVENT")!,
        configService.get<number>("REQUEST_COOLDOWN_MINUTES")!,
        clock,
        domainEventMediator,
      );
    },
    inject: [
      REPOSITORIES.REQUEST_REPOSITORY.provide,
      "EventRepository",
      "MusicianRepository",
      "AudienceRepository",
      ConfigService,
      SERVICES.CLOCK.provide,
      DomainEventMediator,
    ],
  },
  LIST_REQUESTS_USE_CASE: {
    provide: ListRequestsUseCase,
    useFactory: (requestRepo: IRequestRepository) => {
      return new ListRequestsUseCase(requestRepo);
    },
    inject: [REPOSITORIES.REQUEST_REPOSITORY.provide],
  },
  GET_REQUEST_USE_CASE: {
    provide: GetRequestUseCase,
    useFactory: (
      requestRepo: IRequestRepository,
      eventRepo: IEventRepository,
    ) => {
      return new GetRequestUseCase(requestRepo, eventRepo);
    },
    inject: [REPOSITORIES.REQUEST_REPOSITORY.provide, "EventRepository"],
  },
  UPDATE_REQUEST_USE_CASE: {
    provide: UpdateRequestUseCase,
    useFactory: (
      requestRepo: IRequestRepository,
      eventRepo: IEventRepository,
      musicianRepo: IMusicianRepository,
      domainEventMediator: DomainEventMediator,
    ) => {
      return new UpdateRequestUseCase(
        requestRepo,
        eventRepo,
        musicianRepo,
        domainEventMediator,
      );
    },
    inject: [
      REPOSITORIES.REQUEST_REPOSITORY.provide,
      "EventRepository",
      "MusicianRepository",
      DomainEventMediator,
    ],
  },
  DELETE_REQUEST_USE_CASE: {
    provide: DeleteRequestUseCase,
    useFactory: (requestRepo: IRequestRepository) => {
      return new DeleteRequestUseCase(requestRepo);
    },
    inject: [REPOSITORIES.REQUEST_REPOSITORY.provide],
  },
  RESPOND_TO_REQUEST_USE_CASE: {
    provide: RespondToRequestUseCase,
    useFactory: (
      requestRepo: IRequestRepository,
      eventRepo: IEventRepository,
      musicianRepo: IMusicianRepository,
      configService: ConfigSchemaType,
      domainEventMediator: DomainEventMediator,
    ) => {
      return new RespondToRequestUseCase(
        requestRepo,
        eventRepo,
        musicianRepo,
        configService.get<number>("REQUEST_RESPONSE_TIME_MINUTES")!,
        domainEventMediator,
      );
    },
    inject: [
      REPOSITORIES.REQUEST_REPOSITORY.provide,
      "EventRepository",
      "MusicianRepository",
      ConfigService,
      DomainEventMediator,
    ],
  },
  // Bloco 9.4c — compõe o use case individual, não reimplementa.
  BATCH_RESPOND_TO_REQUESTS_USE_CASE: {
    provide: BatchRespondToRequestsUseCase,
    useFactory: (respondUseCase: RespondToRequestUseCase) =>
      new BatchRespondToRequestsUseCase(respondUseCase),
    inject: [RespondToRequestUseCase],
  },
  GET_MUSICIAN_REQUESTS_USE_CASE: {
    provide: GetMusicianRequestsUseCase,
    useFactory: (requestRepo: IRequestRepository) => {
      return new GetMusicianRequestsUseCase(requestRepo);
    },
    inject: [REPOSITORIES.REQUEST_REPOSITORY.provide],
  },
  GET_REQUEST_SUGGESTIONS_USE_CASE: {
    provide: GetRequestSuggestionsUseCase,
    useFactory: (
      requestRepo: IRequestRepository,
      musicianRepo: IMusicianRepository,
    ) => {
      return new GetRequestSuggestionsUseCase(requestRepo, musicianRepo);
    },
    inject: [REPOSITORIES.REQUEST_REPOSITORY.provide, "MusicianRepository"],
  },
  MARK_REQUEST_PLAYED_USE_CASE: {
    provide: MarkRequestPlayedUseCase,
    useFactory: (
      requestRepo: IRequestRepository,
      eventRepo: IEventRepository,
      musicianRepo: IMusicianRepository,
      clock: IClock,
      domainEventMediator: DomainEventMediator,
    ) => {
      return new MarkRequestPlayedUseCase(
        requestRepo,
        eventRepo,
        musicianRepo,
        clock,
        domainEventMediator,
      );
    },
    inject: [
      REPOSITORIES.REQUEST_REPOSITORY.provide,
      "EventRepository",
      "MusicianRepository",
      SERVICES.CLOCK.provide,
      DomainEventMediator,
    ],
  },
  VOTE_REQUEST_USE_CASE: {
    provide: VoteRequestUseCase,
    useFactory: (
      requestRepo: IRequestRepository,
      requestVoteRepo: IRequestVoteRepository,
    ) => {
      return new VoteRequestUseCase(requestRepo, requestVoteRepo);
    },
    inject: [
      REPOSITORIES.REQUEST_REPOSITORY.provide,
      REPOSITORIES.REQUEST_VOTE_REPOSITORY.provide,
    ],
  },
  CREATE_REQUEST_FEEDBACK_USE_CASE: {
    provide: CreateRequestFeedbackUseCase,
    useFactory: (
      feedbackRepo: IRequestFeedbackRepository,
      requestRepo: IRequestRepository,
    ) => {
      return new CreateRequestFeedbackUseCase(feedbackRepo, requestRepo);
    },
    inject: [
      REPOSITORIES.REQUEST_FEEDBACK_REPOSITORY.provide,
      REPOSITORIES.REQUEST_REPOSITORY.provide,
    ],
  },
  GET_REQUEST_FEEDBACK_USE_CASE: {
    provide: GetRequestFeedbackUseCase,
    useFactory: (
      feedbackRepo: IRequestFeedbackRepository,
      requestRepo: IRequestRepository,
      eventRepo: IEventRepository,
    ) => {
      return new GetRequestFeedbackUseCase(
        feedbackRepo,
        requestRepo,
        eventRepo,
      );
    },
    inject: [
      REPOSITORIES.REQUEST_FEEDBACK_REPOSITORY.provide,
      REPOSITORIES.REQUEST_REPOSITORY.provide,
      "EventRepository",
    ],
  },
};

export const REQUESTS_PROVIDERS = {
  REPOSITORIES,
  SERVICES,
  USE_CASES,
};
