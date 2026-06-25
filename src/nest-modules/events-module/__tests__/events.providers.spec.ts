import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, TestingModule } from "@nestjs/testing";

import { AddEventAttendeeUseCase } from "../../../core/events/application/use-cases/add-event-attendee/add-event-attendee.use-case";
import { AddEventPerformerUseCase } from "../../../core/events/application/use-cases/add-event-performer/add-event-performer.use-case";
import { RemoveEventAttendeeUseCase } from "../../../core/events/application/use-cases/remove-event-attendee/remove-event-attendee.use-case";
import { RemoveEventPerformerUseCase } from "../../../core/events/application/use-cases/remove-event-performer/remove-event-performer.use-case";
import { PrismaService } from "../../database-module/prisma/prisma.service";
import { applyAuthGuardMocks } from "../../shared-module/testing/auth-guard-mock";
import { EventsController } from "../events.controller";
import { EVENTS_PROVIDERS } from "../events.providers";

describe("Events providers", () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await applyAuthGuardMocks(
      Test.createTestingModule({
        controllers: [EventsController],
        providers: [
          ...Object.values(EVENTS_PROVIDERS.REPOSITORIES),
          ...Object.values(EVENTS_PROVIDERS.USE_CASES),
          ...Object.values(EVENTS_PROVIDERS.EVENTS),
          {
            provide: PrismaService,
            useValue: {},
          },
          {
            provide: EventEmitter2,
            useValue: { emit: jest.fn() },
          },
        ],
      }),
    ).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it("wires attendee and performer use cases", () => {
    expect(module.get(AddEventAttendeeUseCase)).toBeInstanceOf(
      AddEventAttendeeUseCase,
    );
    expect(module.get(RemoveEventAttendeeUseCase)).toBeInstanceOf(
      RemoveEventAttendeeUseCase,
    );
    expect(module.get(AddEventPerformerUseCase)).toBeInstanceOf(
      AddEventPerformerUseCase,
    );
    expect(module.get(RemoveEventPerformerUseCase)).toBeInstanceOf(
      RemoveEventPerformerUseCase,
    );
  });
});
