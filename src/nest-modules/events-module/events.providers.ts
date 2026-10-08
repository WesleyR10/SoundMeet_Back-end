import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { ActivateEventUseCase } from "../../core/events/application/use-cases/activate-event/activate-event.use-case";
import { AddEventAttendeeUseCase } from "../../core/events/application/use-cases/add-event-attendee/add-event-attendee.use-case";
import { AddEventPerformerUseCase } from "../../core/events/application/use-cases/add-event-performer/add-event-performer.use-case";
import { AutoFinishEventsUseCase } from "../../core/events/application/use-cases/auto-finish-events/auto-finish-events.use-case";
import { CancelEventUseCase } from "../../core/events/application/use-cases/cancel-event/cancel-event.use-case";
import { CreateEventUseCase } from "../../core/events/application/use-cases/create-event/create-event.use-case";
import { DeleteEventUseCase } from "../../core/events/application/use-cases/delete-event/delete-event.use-case";
import { FinishEventUseCase } from "../../core/events/application/use-cases/finish-event/finish-event.use-case";
import { GetEventUseCase } from "../../core/events/application/use-cases/get-event/get-event.use-case";
import { ListEventAttendeesUseCase } from "../../core/events/application/use-cases/list-event-attendees/list-event-attendees.use-case";
import { ListEventMusiciansUseCase } from "../../core/events/application/use-cases/list-event-musicians/list-event-musicians.use-case";
import { ListEventsUseCase } from "../../core/events/application/use-cases/list-events/list-events.use-case";
import { RemoveEventAttendeeUseCase } from "../../core/events/application/use-cases/remove-event-attendee/remove-event-attendee.use-case";
import { RemoveEventPerformerUseCase } from "../../core/events/application/use-cases/remove-event-performer/remove-event-performer.use-case";
import { UpdateEventUseCase } from "../../core/events/application/use-cases/update-event/update-event.use-case";
import { UpdateEventMusicianStatusUseCase } from "../../core/events/application/use-cases/update-event-musician-status/update-event-musician-status.use-case";
import {
  IEventAttendeeRepository,
  IEventMusicianRepository,
  IEventRepository,
  IVenueLocationPort,
  PresenceVerifier,
} from "../../core/events/domain";
import {
  EventAttendeePrismaRepository,
  EventMusicianPrismaRepository,
  EventPrismaRepository,
} from "../../core/events/infra/db/prisma";
import { VenueLocationPrismaAdapter } from "../../core/events/infra/venue-location";
import { DomainEventMediator } from "../../core/shared/domain/events/domain-event-mediator";
import { PrismaService } from "../database-module/prisma/prisma.service";

export const REPOSITORIES = {
  EVENT_REPOSITORY: {
    provide: "EventRepository",
    useExisting: EventPrismaRepository,
  },
  EVENT_PRISMA_REPOSITORY: {
    provide: EventPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new EventPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  EVENT_ATTENDEE_REPOSITORY: {
    provide: "EventAttendeeRepository",
    useExisting: EventAttendeePrismaRepository,
  },
  EVENT_ATTENDEE_PRISMA_REPOSITORY: {
    provide: EventAttendeePrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new EventAttendeePrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  EVENT_MUSICIAN_REPOSITORY: {
    provide: "EventMusicianRepository",
    useExisting: EventMusicianPrismaRepository,
  },
  EVENT_MUSICIAN_PRISMA_REPOSITORY: {
    provide: EventMusicianPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new EventMusicianPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
};

/**
 * Presença verificada no show. Exportados pelo módulo (que é `@Global`) para
 * que `CreateRequestUseCase` reverifique com a MESMA regra e a MESMA config do
 * check-in — duas instâncias configuradas em lugares diferentes seriam duas
 * regras de presença que divergem em silêncio.
 */
export const PRESENCE = {
  VENUE_LOCATION: {
    provide: VenueLocationPrismaAdapter,
    useFactory: (prismaService: PrismaService) =>
      new VenueLocationPrismaAdapter(prismaService),
    inject: [PrismaService],
  },
  PRESENCE_VERIFIER: {
    provide: PresenceVerifier,
    useFactory: (config: ConfigService) =>
      new PresenceVerifier({
        radius_m: config.get<number>("PRESENCE_RADIUS_METERS") ?? 250,
        accuracy_tolerance_cap_m:
          config.get<number>("PRESENCE_ACCURACY_TOLERANCE_CAP_METERS") ?? 150,
        max_accuracy_m:
          config.get<number>("PRESENCE_MAX_ACCURACY_METERS") ?? 500,
      }),
    inject: [ConfigService],
  },
};

export const USE_CASES = {
  CREATE_EVENT_USE_CASE: {
    provide: CreateEventUseCase,
    useFactory: (repo: IEventRepository, mediator: DomainEventMediator) => {
      return new CreateEventUseCase(repo, mediator);
    },
    inject: [REPOSITORIES.EVENT_REPOSITORY.provide, DomainEventMediator],
  },
  UPDATE_EVENT_USE_CASE: {
    provide: UpdateEventUseCase,
    useFactory: (repo: IEventRepository) => {
      return new UpdateEventUseCase(repo);
    },
    inject: [REPOSITORIES.EVENT_REPOSITORY.provide],
  },
  GET_EVENT_USE_CASE: {
    provide: GetEventUseCase,
    useFactory: (repo: IEventRepository) => {
      return new GetEventUseCase(repo);
    },
    inject: [REPOSITORIES.EVENT_REPOSITORY.provide],
  },
  LIST_EVENTS_USE_CASE: {
    provide: ListEventsUseCase,
    useFactory: (repo: IEventRepository) => {
      return new ListEventsUseCase(repo);
    },
    inject: [REPOSITORIES.EVENT_REPOSITORY.provide],
  },
  // Bloco 9.4b — job de auto-finalização.
  AUTO_FINISH_EVENTS_USE_CASE: {
    provide: AutoFinishEventsUseCase,
    useFactory: (repo: IEventRepository) => {
      return new AutoFinishEventsUseCase(repo);
    },
    inject: [REPOSITORIES.EVENT_REPOSITORY.provide],
  },
  DELETE_EVENT_USE_CASE: {
    provide: DeleteEventUseCase,
    useFactory: (repo: IEventRepository) => {
      return new DeleteEventUseCase(repo);
    },
    inject: [REPOSITORIES.EVENT_REPOSITORY.provide],
  },
  ACTIVATE_EVENT_USE_CASE: {
    provide: ActivateEventUseCase,
    useFactory: (repo: IEventRepository) => {
      return new ActivateEventUseCase(repo);
    },
    inject: [REPOSITORIES.EVENT_REPOSITORY.provide],
  },
  CANCEL_EVENT_USE_CASE: {
    provide: CancelEventUseCase,
    useFactory: (repo: IEventRepository, mediator: DomainEventMediator) => {
      return new CancelEventUseCase(repo, mediator);
    },
    inject: [REPOSITORIES.EVENT_REPOSITORY.provide, DomainEventMediator],
  },
  FINISH_EVENT_USE_CASE: {
    provide: FinishEventUseCase,
    useFactory: (repo: IEventRepository) => {
      return new FinishEventUseCase(repo);
    },
    inject: [REPOSITORIES.EVENT_REPOSITORY.provide],
  },
  ADD_EVENT_ATTENDEE_USE_CASE: {
    provide: AddEventAttendeeUseCase,
    useFactory: (
      repo: IEventRepository,
      venueLocation: IVenueLocationPort,
      presenceVerifier: PresenceVerifier,
    ) => {
      return new AddEventAttendeeUseCase(repo, venueLocation, presenceVerifier);
    },
    inject: [
      REPOSITORIES.EVENT_REPOSITORY.provide,
      PRESENCE.VENUE_LOCATION.provide,
      PRESENCE.PRESENCE_VERIFIER.provide,
    ],
  },
  REMOVE_EVENT_ATTENDEE_USE_CASE: {
    provide: RemoveEventAttendeeUseCase,
    useFactory: (repo: IEventRepository) => {
      return new RemoveEventAttendeeUseCase(repo);
    },
    inject: [REPOSITORIES.EVENT_REPOSITORY.provide],
  },
  LIST_EVENT_ATTENDEES_USE_CASE: {
    provide: ListEventAttendeesUseCase,
    useFactory: (
      repo: IEventRepository,
      eventAttendeeRepo: IEventAttendeeRepository,
    ) => {
      return new ListEventAttendeesUseCase(repo, eventAttendeeRepo);
    },
    inject: [
      REPOSITORIES.EVENT_REPOSITORY.provide,
      REPOSITORIES.EVENT_ATTENDEE_REPOSITORY.provide,
    ],
  },
  LIST_EVENT_MUSICIANS_USE_CASE: {
    provide: ListEventMusiciansUseCase,
    useFactory: (
      repo: IEventRepository,
      eventMusicianRepo: IEventMusicianRepository,
    ) => {
      return new ListEventMusiciansUseCase(repo, eventMusicianRepo);
    },
    inject: [
      REPOSITORIES.EVENT_REPOSITORY.provide,
      REPOSITORIES.EVENT_MUSICIAN_REPOSITORY.provide,
    ],
  },
  UPDATE_EVENT_MUSICIAN_STATUS_USE_CASE: {
    provide: UpdateEventMusicianStatusUseCase,
    useFactory: (
      repo: IEventRepository,
      eventMusicianRepo: IEventMusicianRepository,
      mediator: DomainEventMediator,
    ) => {
      return new UpdateEventMusicianStatusUseCase(
        repo,
        eventMusicianRepo,
        mediator,
      );
    },
    inject: [
      REPOSITORIES.EVENT_REPOSITORY.provide,
      REPOSITORIES.EVENT_MUSICIAN_REPOSITORY.provide,
      DomainEventMediator,
    ],
  },
  ADD_EVENT_PERFORMER_USE_CASE: {
    provide: AddEventPerformerUseCase,
    useFactory: (
      repo: IEventRepository,
      eventMusicianRepo: IEventMusicianRepository,
      mediator: DomainEventMediator,
    ) => {
      return new AddEventPerformerUseCase(repo, eventMusicianRepo, mediator);
    },
    inject: [
      REPOSITORIES.EVENT_REPOSITORY.provide,
      REPOSITORIES.EVENT_MUSICIAN_REPOSITORY.provide,
      DomainEventMediator,
    ],
  },
  REMOVE_EVENT_PERFORMER_USE_CASE: {
    provide: RemoveEventPerformerUseCase,
    useFactory: (
      repo: IEventRepository,
      eventMusicianRepo: IEventMusicianRepository,
    ) => {
      return new RemoveEventPerformerUseCase(repo, eventMusicianRepo);
    },
    inject: [
      REPOSITORIES.EVENT_REPOSITORY.provide,
      REPOSITORIES.EVENT_MUSICIAN_REPOSITORY.provide,
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

export const EVENTS_PROVIDERS = {
  REPOSITORIES,
  PRESENCE,
  USE_CASES,
  EVENTS,
};
