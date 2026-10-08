import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { EventMusician } from "../event-musician.aggregate";
import { EventPerformerConfirmedEvent } from "../events/event-performer-confirmed.event";

const confirmedEvents = (entity: EventMusician) =>
  entity
    .getUncommittedEvents()
    .filter((e) => e instanceof EventPerformerConfirmedEvent);

describe("EventPerformerConfirmedEvent", () => {
  it("sai quando o ato entra já confirmado", () => {
    const entity = EventMusician.create({
      event_id: new Uuid().id,
      musician_id: new Uuid().id,
    });
    expect(confirmedEvents(entity)).toHaveLength(1);
  });

  it("não sai quando o ato entra pendente — só na confirmação", () => {
    const entity = EventMusician.create({
      event_id: new Uuid().id,
      musician_id: new Uuid().id,
      status: "pending",
    });
    expect(confirmedEvents(entity)).toHaveLength(0);

    entity.confirm();
    expect(confirmedEvents(entity)).toHaveLength(1);
  });

  it("reconfirmar não emite de novo (mesmo fato)", () => {
    const entity = EventMusician.create({
      event_id: new Uuid().id,
      musician_id: new Uuid().id,
    });
    entity.confirm();
    expect(confirmedEvents(entity)).toHaveLength(1);
  });
});
