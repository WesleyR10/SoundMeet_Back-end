import { PrismaClient } from "@prisma/client";

import { IEstablishmentRepository } from "../../core/establishment/domain/establishment.repository";
import { IEventRepository } from "../../core/events/domain/event.repository";
import { IEventAttendeeRepository } from "../../core/events/domain/event-attendee.repository";
import { IEventMusicianRepository } from "../../core/events/domain/event-musician.repository";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { ReviewEligibilityService } from "../../core/review/application/services/review-eligibility.service";
import { ListReviewsUseCase } from "../../core/review/application/use-cases/list-reviews/list-reviews.use-case";
import { SubmitReviewUseCase } from "../../core/review/application/use-cases/submit-review/submit-review.use-case";
import { IReviewRepository } from "../../core/review/domain/review.repository";
import { ReviewPrismaRepository } from "../../core/review/infra/db/prisma/review-prisma.repository";
import { IBookingRepository } from "../../core/scheduling/domain/booking.repository";
import { PrismaService } from "../database-module/prisma/prisma.service";

export const REPOSITORIES = {
  REVIEW_PRISMA_REPOSITORY: {
    provide: ReviewPrismaRepository,
    useFactory: (prisma: PrismaClient) => new ReviewPrismaRepository(prisma),
    inject: [PrismaService],
  },
  REVIEW_REPOSITORY: {
    provide: "ReviewRepository",
    useExisting: ReviewPrismaRepository,
  },
};

export const SERVICES = {
  REVIEW_ELIGIBILITY_SERVICE: {
    provide: ReviewEligibilityService,
    useFactory: (
      bookingRepo: IBookingRepository,
      attendeeRepo: IEventAttendeeRepository,
      eventRepo: IEventRepository,
      eventMusicianRepo: IEventMusicianRepository,
    ) =>
      new ReviewEligibilityService(
        bookingRepo,
        attendeeRepo,
        eventRepo,
        eventMusicianRepo,
      ),
    inject: [
      "BookingRepository",
      "EventAttendeeRepository",
      "EventRepository",
      "EventMusicianRepository",
    ],
  },
};

export const USE_CASES = {
  SUBMIT_REVIEW_USE_CASE: {
    provide: SubmitReviewUseCase,
    useFactory: (
      reviewRepo: IReviewRepository,
      eligibility: ReviewEligibilityService,
      musicianRepo: IMusicianRepository,
      establishmentRepo: IEstablishmentRepository,
    ) =>
      new SubmitReviewUseCase(
        reviewRepo,
        eligibility,
        musicianRepo,
        establishmentRepo,
      ),
    inject: [
      REPOSITORIES.REVIEW_REPOSITORY.provide,
      ReviewEligibilityService,
      "MusicianRepository",
      "EstablishmentRepository",
    ],
  },
  LIST_REVIEWS_USE_CASE: {
    provide: ListReviewsUseCase,
    useFactory: (reviewRepo: IReviewRepository) =>
      new ListReviewsUseCase(reviewRepo),
    inject: [REPOSITORIES.REVIEW_REPOSITORY.provide],
  },
};

export const REVIEWS_PROVIDERS = {
  REPOSITORIES,
  SERVICES,
  USE_CASES,
};
