import { PrismaClient } from "@prisma/client";

import { IEstablishmentRepository } from "../../core/establishment/domain/establishment.repository";
import { IEventRepository } from "../../core/events/domain/event.repository";
import { IEventAttendeeRepository } from "../../core/events/domain/event-attendee.repository";
import { IEventMusicianRepository } from "../../core/events/domain/event-musician.repository";
import { IMusicLibraryRepository } from "../../core/music-library/domain/music-library.repository";
import { IBandRepository } from "../../core/musician/domain/band.repository";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { ITipRepository } from "../../core/payment/domain/repositories/tip.repository";
import { PerformanceEligibilityService } from "../../core/performance/application/services/performance-eligibility.service";
import { EndPerformanceUseCase } from "../../core/performance/application/use-cases/end-performance/end-performance.use-case";
import { GetLivePerformanceUseCase } from "../../core/performance/application/use-cases/get-live-performance/get-live-performance.use-case";
import { GetMusicianResumeUseCase } from "../../core/performance/application/use-cases/get-musician-resume/get-musician-resume.use-case";
import { GetPerformanceUseCase } from "../../core/performance/application/use-cases/get-performance/get-performance.use-case";
import { GetPerformanceReportUseCase } from "../../core/performance/application/use-cases/get-performance-report/get-performance-report.use-case";
import { ListOpenableEventsUseCase } from "../../core/performance/application/use-cases/list-openable-events/list-openable-events.use-case";
import { ListPerformancesUseCase } from "../../core/performance/application/use-cases/list-performances/list-performances.use-case";
import { StartPerformanceUseCase } from "../../core/performance/application/use-cases/start-performance/start-performance.use-case";
import { StartSongUseCase } from "../../core/performance/application/use-cases/start-song/start-song.use-case";
import { SuggestSetlistUseCase } from "../../core/performance/application/use-cases/suggest-setlist/suggest-setlist.use-case";
import { IPerformanceRepository } from "../../core/performance/domain/performance.repository";
import { PerformancePrismaRepository } from "../../core/performance/infra/db/prisma/performance-prisma.repository";
import { IRequestRepository } from "../../core/request/domain/request.repository";
import { IReviewRepository } from "../../core/review/domain/review.repository";
import { IBookingRepository } from "../../core/scheduling/domain/booking.repository";
import { DomainEventMediator } from "../../core/shared/domain/events/domain-event-mediator";
import { PrismaService } from "../database-module/prisma/prisma.service";

export const REPOSITORIES = {
  PERFORMANCE_PRISMA_REPOSITORY: {
    provide: PerformancePrismaRepository,
    useFactory: (prisma: PrismaClient) =>
      new PerformancePrismaRepository(prisma),
    inject: [PrismaService],
  },
  PERFORMANCE_REPOSITORY: {
    provide: "PerformanceRepository",
    useExisting: PerformancePrismaRepository,
  },
};

export const SERVICES = {
  PERFORMANCE_ELIGIBILITY_SERVICE: {
    provide: PerformanceEligibilityService,
    useFactory: (
      eventRepo: IEventRepository,
      eventMusicianRepo: IEventMusicianRepository,
    ) => new PerformanceEligibilityService(eventRepo, eventMusicianRepo),
    inject: ["EventRepository", "EventMusicianRepository"],
  },
};

export const USE_CASES = {
  START_PERFORMANCE_USE_CASE: {
    provide: StartPerformanceUseCase,
    useFactory: (
      performanceRepo: IPerformanceRepository,
      eligibility: PerformanceEligibilityService,
    ) => new StartPerformanceUseCase(performanceRepo, eligibility),
    inject: [
      REPOSITORIES.PERFORMANCE_REPOSITORY.provide,
      PerformanceEligibilityService,
    ],
  },
  START_SONG_USE_CASE: {
    provide: StartSongUseCase,
    useFactory: (
      performanceRepo: IPerformanceRepository,
      musicLibraryRepo: IMusicLibraryRepository,
      requestRepo: IRequestRepository,
      domainEventMediator: DomainEventMediator,
    ) =>
      new StartSongUseCase(
        performanceRepo,
        musicLibraryRepo,
        requestRepo,
        domainEventMediator,
      ),
    inject: [
      REPOSITORIES.PERFORMANCE_REPOSITORY.provide,
      "MusicLibraryRepository",
      "RequestRepository",
      DomainEventMediator,
    ],
  },
  END_PERFORMANCE_USE_CASE: {
    provide: EndPerformanceUseCase,
    useFactory: (
      performanceRepo: IPerformanceRepository,
      domainEventMediator: DomainEventMediator,
    ) => new EndPerformanceUseCase(performanceRepo, domainEventMediator),
    inject: [REPOSITORIES.PERFORMANCE_REPOSITORY.provide, DomainEventMediator],
  },
  GET_PERFORMANCE_USE_CASE: {
    provide: GetPerformanceUseCase,
    useFactory: (performanceRepo: IPerformanceRepository) =>
      new GetPerformanceUseCase(performanceRepo),
    inject: [REPOSITORIES.PERFORMANCE_REPOSITORY.provide],
  },
  GET_LIVE_PERFORMANCE_USE_CASE: {
    provide: GetLivePerformanceUseCase,
    useFactory: (
      performanceRepo: IPerformanceRepository,
      requestRepo: IRequestRepository,
    ) => new GetLivePerformanceUseCase(performanceRepo, requestRepo),
    inject: [REPOSITORIES.PERFORMANCE_REPOSITORY.provide, "RequestRepository"],
  },
  LIST_OPENABLE_EVENTS_USE_CASE: {
    provide: ListOpenableEventsUseCase,
    useFactory: (
      eventMusicianRepo: IEventMusicianRepository,
      eventRepo: IEventRepository,
      performanceRepo: IPerformanceRepository,
    ) =>
      new ListOpenableEventsUseCase(
        eventMusicianRepo,
        eventRepo,
        performanceRepo,
      ),
    inject: [
      "EventMusicianRepository",
      "EventRepository",
      REPOSITORIES.PERFORMANCE_REPOSITORY.provide,
    ],
  },
  LIST_PERFORMANCES_USE_CASE: {
    provide: ListPerformancesUseCase,
    useFactory: (performanceRepo: IPerformanceRepository) =>
      new ListPerformancesUseCase(performanceRepo),
    inject: [REPOSITORIES.PERFORMANCE_REPOSITORY.provide],
  },
  GET_PERFORMANCE_REPORT_USE_CASE: {
    provide: GetPerformanceReportUseCase,
    useFactory: (
      performanceRepo: IPerformanceRepository,
      requestRepo: IRequestRepository,
      tipRepo: ITipRepository,
      attendeeRepo: IEventAttendeeRepository,
      establishmentRepo: IEstablishmentRepository,
    ) =>
      new GetPerformanceReportUseCase(
        performanceRepo,
        requestRepo,
        tipRepo,
        attendeeRepo,
        establishmentRepo,
      ),
    inject: [
      REPOSITORIES.PERFORMANCE_REPOSITORY.provide,
      "RequestRepository",
      "TipRepository",
      "EventAttendeeRepository",
      "EstablishmentRepository",
    ],
  },
  GET_MUSICIAN_RESUME_USE_CASE: {
    provide: GetMusicianResumeUseCase,
    useFactory: (
      musicianRepo: IMusicianRepository,
      bandRepo: IBandRepository,
      bookingRepo: IBookingRepository,
      establishmentRepo: IEstablishmentRepository,
      attendeeRepo: IEventAttendeeRepository,
      reviewRepo: IReviewRepository,
      performanceRepo: IPerformanceRepository,
    ) =>
      new GetMusicianResumeUseCase(
        musicianRepo,
        bandRepo,
        bookingRepo,
        establishmentRepo,
        attendeeRepo,
        reviewRepo,
        performanceRepo,
      ),
    inject: [
      "MusicianRepository",
      "BandRepository",
      "BookingRepository",
      "EstablishmentRepository",
      "EventAttendeeRepository",
      "ReviewRepository",
      REPOSITORIES.PERFORMANCE_REPOSITORY.provide,
    ],
  },
  SUGGEST_SETLIST_USE_CASE: {
    provide: SuggestSetlistUseCase,
    useFactory: (
      performanceRepo: IPerformanceRepository,
      requestRepo: IRequestRepository,
      musicLibraryRepo: IMusicLibraryRepository,
    ) =>
      new SuggestSetlistUseCase(performanceRepo, requestRepo, musicLibraryRepo),
    inject: [
      REPOSITORIES.PERFORMANCE_REPOSITORY.provide,
      "RequestRepository",
      "MusicLibraryRepository",
    ],
  },
};

export const PERFORMANCE_PROVIDERS = {
  REPOSITORIES,
  SERVICES,
  USE_CASES,
};
