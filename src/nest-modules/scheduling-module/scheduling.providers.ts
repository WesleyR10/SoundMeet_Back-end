import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { IBandRepository } from "../../core/musician/domain/band.repository";
import { BandPrismaRepository } from "../../core/musician/infra/db/prisma/band-prisma.repository";
import { ICalendarReadModel } from "../../core/scheduling/application/gateways/calendar-read-model.interface";
import { AcceptInquiryUseCase } from "../../core/scheduling/application/use-cases/accept-inquiry/accept-inquiry.use-case";
import { CancelBookingUseCase } from "../../core/scheduling/application/use-cases/cancel-booking/cancel-booking.use-case";
import { ConfirmBookingUseCase } from "../../core/scheduling/application/use-cases/confirm-booking/confirm-booking.use-case";
import { ConvertInquiryToBookingUseCase } from "../../core/scheduling/application/use-cases/convert-inquiry-to-booking/convert-inquiry-to-booking.use-case";
import { CreateInquiryUseCase } from "../../core/scheduling/application/use-cases/create-inquiry/create-inquiry.use-case";
import { ExpirePendingBookingsUseCase } from "../../core/scheduling/application/use-cases/expire-pending-bookings/expire-pending-bookings.use-case";
import { GetFreeBusyUseCase } from "../../core/scheduling/application/use-cases/get-free-busy/get-free-busy.use-case";
import { GetMonthSlotsUseCase } from "../../core/scheduling/application/use-cases/get-month-slots/get-month-slots.use-case";
import { ProposeBookingUseCase } from "../../core/scheduling/application/use-cases/propose-booking/propose-booking.use-case";
import { RejectInquiryUseCase } from "../../core/scheduling/application/use-cases/reject-inquiry/reject-inquiry.use-case";
import { IAvailabilityRepository } from "../../core/scheduling/domain/availability.repository";
import { IBookingRepository } from "../../core/scheduling/domain/booking.repository";
import { IInquiryRepository } from "../../core/scheduling/domain/inquiry.repository";
import { AvailabilityPrismaRepository } from "../../core/scheduling/infra/db/prisma/availability-prisma.repository";
import { BookingPrismaRepository } from "../../core/scheduling/infra/db/prisma/booking-prisma.repository";
import { CalendarPrismaReadModel } from "../../core/scheduling/infra/db/prisma/calendar-prisma.read-model";
import { InquiryPrismaRepository } from "../../core/scheduling/infra/db/prisma/inquiry-prisma.repository";
import { IClock } from "../../core/shared/application/clock.interface";
import { IDateTimeService } from "../../core/shared/domain";
import { DomainEventMediator } from "../../core/shared/domain/events/domain-event-mediator";
import { LuxonDateTimeService } from "../../core/shared/infra/date-time/luxon-date-time.service";
import { ConfigSchemaType } from "../config-module/config.schema";
import { PrismaService } from "../database-module/prisma/prisma.service";
import { BookingEventsHandlers } from "./booking-events.handlers";
import { ExpirePendingBookingsJob } from "./expire-pending-bookings.job";

export const REPOSITORIES = {
  BOOKING_REPOSITORY: {
    provide: "BookingRepository",
    useExisting: BookingPrismaRepository,
  },
  BOOKING_PRISMA_REPOSITORY: {
    provide: BookingPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new BookingPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  AVAILABILITY_REPOSITORY: {
    provide: "AvailabilityRepository",
    useExisting: AvailabilityPrismaRepository,
  },
  AVAILABILITY_PRISMA_REPOSITORY: {
    provide: AvailabilityPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new AvailabilityPrismaRepository(prismaService);
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
  CALENDAR_READ_MODEL: {
    provide: "CalendarReadModel",
    useFactory: (prismaService: PrismaService) => {
      return new CalendarPrismaReadModel(prismaService);
    },
    inject: [PrismaService],
  },
  INQUIRY_REPOSITORY: {
    provide: "InquiryRepository",
    useExisting: InquiryPrismaRepository,
  },
  INQUIRY_PRISMA_REPOSITORY: {
    provide: InquiryPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new InquiryPrismaRepository(prismaService);
    },
    inject: [PrismaService],
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

export const SERVICES = {
  DATE_TIME_SERVICE: {
    provide: "DateTimeService",
    useClass: LuxonDateTimeService,
  },
  CLOCK: {
    provide: "Clock",
    useValue: { now: () => new Date() } satisfies IClock,
  },
};

export const USE_CASES = {
  CREATE_INQUIRY_USE_CASE: {
    provide: CreateInquiryUseCase,
    useFactory: (
      inquiryRepo: IInquiryRepository,
      domainEventMediator: DomainEventMediator,
    ) => {
      return new CreateInquiryUseCase(inquiryRepo, domainEventMediator);
    },
    inject: [
      REPOSITORIES.INQUIRY_REPOSITORY.provide,
      EVENTS.DOMAIN_EVENT_MEDIATOR.provide,
    ],
  },
  ACCEPT_INQUIRY_USE_CASE: {
    provide: AcceptInquiryUseCase,
    useFactory: (
      inquiryRepo: IInquiryRepository,
      clock: IClock,
      domainEventMediator: DomainEventMediator,
    ) => {
      return new AcceptInquiryUseCase(inquiryRepo, clock, domainEventMediator);
    },
    inject: [
      REPOSITORIES.INQUIRY_REPOSITORY.provide,
      SERVICES.CLOCK.provide,
      EVENTS.DOMAIN_EVENT_MEDIATOR.provide,
    ],
  },
  REJECT_INQUIRY_USE_CASE: {
    provide: RejectInquiryUseCase,
    useFactory: (
      inquiryRepo: IInquiryRepository,
      clock: IClock,
      domainEventMediator: DomainEventMediator,
    ) => {
      return new RejectInquiryUseCase(inquiryRepo, clock, domainEventMediator);
    },
    inject: [
      REPOSITORIES.INQUIRY_REPOSITORY.provide,
      SERVICES.CLOCK.provide,
      EVENTS.DOMAIN_EVENT_MEDIATOR.provide,
    ],
  },
  CONVERT_INQUIRY_TO_BOOKING_USE_CASE: {
    provide: ConvertInquiryToBookingUseCase,
    useFactory: (
      inquiryRepo: IInquiryRepository,
      bookingRepo: IBookingRepository,
      clock: IClock,
      domainEventMediator: DomainEventMediator,
      configService: ConfigSchemaType,
    ) => {
      return new ConvertInquiryToBookingUseCase(
        inquiryRepo,
        bookingRepo,
        clock,
        domainEventMediator,
        configService.get<number>("BOOKING_DEFAULT_FREE_CANCELLATION_HOURS")!,
      );
    },
    inject: [
      REPOSITORIES.INQUIRY_REPOSITORY.provide,
      REPOSITORIES.BOOKING_REPOSITORY.provide,
      SERVICES.CLOCK.provide,
      EVENTS.DOMAIN_EVENT_MEDIATOR.provide,
      ConfigService,
    ],
  },
  PROPOSE_BOOKING_USE_CASE: {
    provide: ProposeBookingUseCase,
    useFactory: (
      bookingRepo: IBookingRepository,
      dateTimeService: IDateTimeService,
      availabilityRepo: IAvailabilityRepository,
      bandRepo: IBandRepository,
      clock: IClock,
      domainEventMediator: DomainEventMediator,
      configService: ConfigSchemaType,
    ) => {
      return new ProposeBookingUseCase(
        bookingRepo,
        dateTimeService,
        availabilityRepo,
        bandRepo,
        clock,
        domainEventMediator,
        configService.get<number>("BOOKING_DEFAULT_FREE_CANCELLATION_HOURS")!,
      );
    },
    inject: [
      REPOSITORIES.BOOKING_REPOSITORY.provide,
      SERVICES.DATE_TIME_SERVICE.provide,
      REPOSITORIES.AVAILABILITY_REPOSITORY.provide,
      REPOSITORIES.BAND_REPOSITORY.provide,
      SERVICES.CLOCK.provide,
      EVENTS.DOMAIN_EVENT_MEDIATOR.provide,
      ConfigService,
    ],
  },
  CONFIRM_BOOKING_USE_CASE: {
    provide: ConfirmBookingUseCase,
    useFactory: (
      bookingRepo: IBookingRepository,
      dateTimeService: IDateTimeService,
      availabilityRepo: IAvailabilityRepository,
      bandRepo: IBandRepository,
      clock: IClock,
      domainEventMediator: DomainEventMediator,
    ) => {
      return new ConfirmBookingUseCase(
        bookingRepo,
        dateTimeService,
        availabilityRepo,
        bandRepo,
        clock,
        domainEventMediator,
      );
    },
    inject: [
      REPOSITORIES.BOOKING_REPOSITORY.provide,
      SERVICES.DATE_TIME_SERVICE.provide,
      REPOSITORIES.AVAILABILITY_REPOSITORY.provide,
      REPOSITORIES.BAND_REPOSITORY.provide,
      SERVICES.CLOCK.provide,
      EVENTS.DOMAIN_EVENT_MEDIATOR.provide,
    ],
  },
  CANCEL_BOOKING_USE_CASE: {
    provide: CancelBookingUseCase,
    useFactory: (
      bookingRepo: IBookingRepository,
      clock: IClock,
      domainEventMediator: DomainEventMediator,
    ) => {
      return new CancelBookingUseCase(bookingRepo, clock, domainEventMediator);
    },
    inject: [
      REPOSITORIES.BOOKING_REPOSITORY.provide,
      SERVICES.CLOCK.provide,
      EVENTS.DOMAIN_EVENT_MEDIATOR.provide,
    ],
  },
  EXPIRE_PENDING_BOOKINGS_USE_CASE: {
    provide: ExpirePendingBookingsUseCase,
    useFactory: (bookingRepo: IBookingRepository) => {
      return new ExpirePendingBookingsUseCase(bookingRepo);
    },
    inject: [REPOSITORIES.BOOKING_REPOSITORY.provide],
  },
  GET_FREE_BUSY_USE_CASE: {
    provide: GetFreeBusyUseCase,
    useFactory: (calendarReadModel: ICalendarReadModel) => {
      return new GetFreeBusyUseCase(calendarReadModel);
    },
    inject: [REPOSITORIES.CALENDAR_READ_MODEL.provide],
  },
  GET_MONTH_SLOTS_USE_CASE: {
    provide: GetMonthSlotsUseCase,
    useFactory: (
      calendarReadModel: ICalendarReadModel,
      dateTimeService: IDateTimeService,
    ) => {
      return new GetMonthSlotsUseCase(calendarReadModel, dateTimeService);
    },
    inject: [
      REPOSITORIES.CALENDAR_READ_MODEL.provide,
      SERVICES.DATE_TIME_SERVICE.provide,
    ],
  },
};

export const HANDLERS = {
  BOOKING_EVENTS_HANDLERS: {
    provide: BookingEventsHandlers,
    useClass: BookingEventsHandlers,
  },
};

export const JOBS = {
  EXPIRE_PENDING_BOOKINGS_JOB: {
    provide: ExpirePendingBookingsJob,
    useClass: ExpirePendingBookingsJob,
  },
};

export const SCHEDULING_PROVIDERS = {
  REPOSITORIES,
  EVENTS,
  SERVICES,
  USE_CASES,
  HANDLERS,
  JOBS,
};
