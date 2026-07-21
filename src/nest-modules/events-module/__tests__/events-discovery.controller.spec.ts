import { EventCollectionPresenter } from "../event.presenter";
import { EventsDiscoveryController } from "../events-discovery.controller";

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
  controller: EventsDiscoveryController,
  key: string,
  execute = jest.fn(),
) {
  (controller as any)[key] = { execute };
  return execute;
}

describe("EventsDiscoveryController Unit Tests", () => {
  let controller: EventsDiscoveryController;

  beforeEach(() => {
    controller = new EventsDiscoveryController();
  });

  it("should list events cross-establishment without pinning establishment_id", async () => {
    const execute = inject(
      controller,
      "listEventsUseCase",
      jest.fn().mockResolvedValue({
        items: [eventOutput()],
        current_page: 1,
        per_page: 15,
        last_page: 1,
        total: 1,
      }),
    );

    const presenter = await controller.findAll({
      page: 1,
      per_page: 15,
      filter: { lat: -23.5614, lng: -46.6559, radius_km: 5 },
    } as any);

    expect(execute).toHaveBeenCalledWith({
      page: 1,
      per_page: 15,
      sort: undefined,
      sort_dir: undefined,
      filter: { lat: -23.5614, lng: -46.6559, radius_km: 5 },
    });
    expect(execute.mock.calls[0][0]).not.toHaveProperty("establishment_id");
    expect(presenter).toBeInstanceOf(EventCollectionPresenter);
    expect(presenter.data).toHaveLength(1);
  });

  it("should forward date_gte/date_lte filters for 'hoje à noite' discovery", async () => {
    const execute = inject(
      controller,
      "listEventsUseCase",
      jest.fn().mockResolvedValue({
        items: [],
        current_page: 1,
        per_page: 15,
        last_page: 0,
        total: 0,
      }),
    );

    const dateGte = new Date("2026-07-16T20:00:00.000Z");
    const dateLte = new Date("2026-07-17T04:00:00.000Z");

    await controller.findAll({
      filter: { date_gte: dateGte, date_lte: dateLte },
    } as any);

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { date_gte: dateGte, date_lte: dateLte },
      }),
    );
  });
});
