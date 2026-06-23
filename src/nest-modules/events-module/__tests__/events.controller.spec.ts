import { EventCollectionPresenter, EventPresenter } from "../event.presenter";
import { EventsController } from "../events.controller";

const now = new Date("2026-06-19T12:00:00.000Z");

function eventOutput(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    establishment_id: "22222222-2222-4222-8222-222222222222",
    name: "Acoustic Night",
    description: "Live music",
    start_at: now,
    end_at: new Date("2026-06-19T14:00:00.000Z"),
    status: "scheduled",
    max_capacity: 100,
    current_capacity: 0,
    is_public: true,
    cover_charge: 25,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function inject(
  controller: EventsController,
  key: string,
  execute = jest.fn(),
) {
  (controller as any)[key] = { execute };
  return execute;
}

describe("EventsController Unit Tests", () => {
  let controller: EventsController;

  beforeEach(() => {
    controller = new EventsController();
  });

  it("should create event with establishment id from route", async () => {
    const execute = inject(
      controller,
      "createEventUseCase",
      jest.fn().mockResolvedValue(eventOutput()),
    );

    const presenter = await controller.createEvent(
      "22222222-2222-4222-8222-222222222222",
      {
        name: "Acoustic Night",
        description: "Live music",
        start_at: now,
        end_at: new Date("2026-06-19T14:00:00.000Z"),
        max_capacity: 100,
        is_public: true,
        cover_charge: 25,
      },
    );

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        establishment_id: "22222222-2222-4222-8222-222222222222",
        name: "Acoustic Night",
      }),
    );
    expect(presenter).toBeInstanceOf(EventPresenter);
    expect(presenter.id).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("should list events preserving search params", async () => {
    const execute = inject(
      controller,
      "listEventsUseCase",
      jest.fn().mockResolvedValue({
        items: [eventOutput()],
        current_page: 2,
        per_page: 10,
        last_page: 3,
        total: 25,
      }),
    );

    const presenter = await controller.listEvents(
      "22222222-2222-4222-8222-222222222222",
      { page: 2, per_page: 10, sort: "startTime", sort_dir: "asc" },
    );

    expect(execute).toHaveBeenCalledWith({
      establishment_id: "22222222-2222-4222-8222-222222222222",
      page: 2,
      per_page: 10,
      sort: "startTime",
      sort_dir: "asc",
      filter: undefined,
    });
    expect(presenter).toBeInstanceOf(EventCollectionPresenter);
    expect(presenter.data).toHaveLength(1);
  });

  it("should delegate performer registration to use case", async () => {
    const execute = inject(
      controller,
      "addEventPerformerUseCase",
      jest.fn().mockResolvedValue(undefined),
    );

    await controller.addPerformer(
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      {
        musician_id: "44444444-4444-4444-8444-444444444444",
        fee: 250,
        status: "confirmed",
      },
    );

    expect(execute).toHaveBeenCalledWith({
      establishment_id: "22222222-2222-4222-8222-222222222222",
      event_id: "33333333-3333-4333-8333-333333333333",
      musician_id: "44444444-4444-4444-8444-444444444444",
      band_id: undefined,
      fee: 250,
      status: "confirmed",
      start_at: undefined,
      end_at: undefined,
    });
  });
});
