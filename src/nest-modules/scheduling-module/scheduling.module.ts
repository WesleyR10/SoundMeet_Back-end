import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database-module/database.module";
import { MusiciansModule } from "../musicians-module/musicians.module";
import { AvailabilityController } from "./availability.controller";
import { BookingsController } from "./bookings.controller";
import { CalendarController } from "./calendar.controller";
import { InquiriesController } from "./inquiries.controller";
import { SCHEDULING_PROVIDERS } from "./scheduling.providers";

@Module({
  imports: [DatabaseModule, MusiciansModule],
  controllers: [
    AvailabilityController,
    BookingsController,
    CalendarController,
    InquiriesController,
  ],
  providers: [
    ...Object.values(SCHEDULING_PROVIDERS.REPOSITORIES),
    ...Object.values(SCHEDULING_PROVIDERS.EVENTS),
    ...Object.values(SCHEDULING_PROVIDERS.SERVICES),
    ...Object.values(SCHEDULING_PROVIDERS.USE_CASES),
    ...Object.values(SCHEDULING_PROVIDERS.HANDLERS),
    ...Object.values(SCHEDULING_PROVIDERS.JOBS),
  ],
  exports: [
    SCHEDULING_PROVIDERS.REPOSITORIES.BOOKING_REPOSITORY.provide,
    SCHEDULING_PROVIDERS.REPOSITORIES.AVAILABILITY_REPOSITORY.provide,
  ],
})
export class SchedulingModule {}
