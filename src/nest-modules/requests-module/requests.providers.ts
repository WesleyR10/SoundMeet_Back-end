import { ConfigService } from "@nestjs/config";

import { IAudienceRepository } from "../../core/audience/domain";
import { IEventRepository } from "../../core/events/domain";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { CreateRequestUseCase } from "../../core/request/application/use-cases/create-request/create-request.use-case";
import { DeleteRequestUseCase } from "../../core/request/application/use-cases/delete-request/delete-request.use-case";
import { GetMusicianRequestsUseCase } from "../../core/request/application/use-cases/get-musician-requests/get-musician-requests.use-case";
import { GetRequestUseCase } from "../../core/request/application/use-cases/get-request/get-request.use-case";
import { GetRequestSuggestionsUseCase } from "../../core/request/application/use-cases/get-request-suggestions/get-request-suggestions.use-case";
import { ListRequestsUseCase } from "../../core/request/application/use-cases/list-requests/list-requests.use-case";
import { MarkRequestPlayedUseCase } from "../../core/request/application/use-cases/mark-request-played/mark-request-played.use-case";
import { RespondToRequestUseCase } from "../../core/request/application/use-cases/respond-to-request/respond-to-request.use-case";
import { UpdateRequestUseCase } from "../../core/request/application/use-cases/update-request/update-request.use-case";
import { IRequestRepository } from "../../core/request/domain/request.repository";
import { RequestPrismaRepository } from "../../core/request/infra/db/prisma/request-prisma.repository";
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
      domainEventMediator: DomainEventMediator,
    ) => {
      return new CreateRequestUseCase(
        requestRepo,
        eventRepo,
        musicianRepo,
        audienceRepo,
        configService.get<number>("MAX_REQUESTS_PER_USER_PER_EVENT")!,
        configService.get<number>("REQUEST_COOLDOWN_MINUTES")!,
        domainEventMediator,
      );
    },
    inject: [
      REPOSITORIES.REQUEST_REPOSITORY.provide,
      "EventRepository",
      "MusicianRepository",
      "AudienceRepository",
      ConfigService,
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
    useFactory: (requestRepo: IRequestRepository) => {
      return new GetRequestUseCase(requestRepo);
    },
    inject: [REPOSITORIES.REQUEST_REPOSITORY.provide],
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
      domainEventMediator: DomainEventMediator,
    ) => {
      return new MarkRequestPlayedUseCase(
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
};

export const REQUESTS_PROVIDERS = {
  REPOSITORIES,
  USE_CASES,
};
