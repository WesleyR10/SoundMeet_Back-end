import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import {
  EventMusician,
  EventMusicianCreateCommand,
} from "../event-musician.aggregate";

describe("EventMusician Unit Tests", () => {
  test("should create a lineup entry for a musician", () => {
    const command: EventMusicianCreateCommand = {
      event_id: new Uuid().id,
      musician_id: new Uuid().id,
      fee: 100,
    };

    const entity = EventMusician.create(command);

    expect(entity.event_musician_id).toBeDefined();
    expect(entity.event_id.id).toBe(command.event_id);
    expect(entity.musician_id?.id).toBe(command.musician_id);
    expect(entity.band_id).toBeNull();
    expect(entity.status).toBe("confirmed");
    expect(entity.notification.hasErrors()).toBe(false);
  });

  test("should create a lineup entry for a band", () => {
    const command: EventMusicianCreateCommand = {
      event_id: new Uuid().id,
      band_id: new Uuid().id,
    };

    const entity = EventMusician.create(command);

    expect(entity.band_id?.id).toBe(command.band_id);
    expect(entity.musician_id).toBeNull();
    expect(entity.notification.hasErrors()).toBe(false);
  });

  test("should require exactly one of musician_id or band_id", () => {
    const withBoth = EventMusician.create({
      event_id: new Uuid().id,
      musician_id: new Uuid().id,
      band_id: new Uuid().id,
    });
    expect(withBoth.notification.hasErrors()).toBe(true);
    expect(withBoth.notification.toJSON()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: expect.arrayContaining([
            "Either musician_id or band_id must be provided (exclusively)",
          ]),
        }),
      ]),
    );

    const withNone = EventMusician.create({ event_id: new Uuid().id });
    expect(withNone.notification.hasErrors()).toBe(true);
  });

  test("should confirm and cancel", () => {
    const entity = EventMusician.create({
      event_id: new Uuid().id,
      musician_id: new Uuid().id,
      status: "pending",
    });

    entity.confirm();
    expect(entity.status).toBe("confirmed");

    entity.cancel();
    expect(entity.status).toBe("cancelled");
  });

  test("should not confirm a cancelled lineup entry", () => {
    const entity = EventMusician.create({
      event_id: new Uuid().id,
      musician_id: new Uuid().id,
    });

    entity.cancel();
    entity.confirm();
    expect(entity.status).toBe("cancelled");
    expect(entity.notification.hasErrors()).toBe(true);
  });

  test("should validate fee is non-negative", () => {
    const entity = EventMusician.create({
      event_id: new Uuid().id,
      musician_id: new Uuid().id,
    });

    entity.changeFee(-1);
    expect(entity.notification.hasErrors()).toBe(true);

    const ok = EventMusician.create({
      event_id: new Uuid().id,
      musician_id: new Uuid().id,
    });
    ok.changeFee(250);
    expect(ok.fee).toBe(250);
    expect(ok.notification.hasErrors()).toBe(false);
  });

  test("should validate performance window end after start", () => {
    const now = new Date();
    const entity = EventMusician.create({
      event_id: new Uuid().id,
      musician_id: new Uuid().id,
    });

    entity.setPerformanceWindow(now, now);
    expect(entity.notification.hasErrors()).toBe(true);

    const ok = EventMusician.create({
      event_id: new Uuid().id,
      musician_id: new Uuid().id,
    });
    ok.setPerformanceWindow(now, new Date(now.getTime() + 60 * 60 * 1000));
    expect(ok.notification.hasErrors()).toBe(false);
  });

  test("should build using fake builder", () => {
    const entity = EventMusician.fake().aEventMusician().asBand().build();
    expect(entity.band_id).not.toBeNull();
    expect(entity.musician_id).toBeNull();
    expect(entity.notification.hasErrors()).toBe(false);
  });
});
