import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { PerformanceStartedEvent } from "../events/performance-started.event";
import { Performance } from "../performance.aggregate";

describe("PerformanceStartedEvent", () => {
  it("abrir o set emite o 'começou agora' com evento, casa e músico", () => {
    const ids = {
      event_id: new Uuid().id,
      establishment_id: new Uuid().id,
      musician_id: new Uuid().id,
    };
    const performance = Performance.create(ids);

    const [event] = performance
      .getUncommittedEvents()
      .filter(
        (e) => e instanceof PerformanceStartedEvent,
      ) as PerformanceStartedEvent[];

    expect(event).toMatchObject({ ...ids, band_id: null });
  });
});
