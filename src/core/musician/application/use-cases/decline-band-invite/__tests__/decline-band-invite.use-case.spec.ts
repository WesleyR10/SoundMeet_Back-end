import EventEmitter2 from "eventemitter2";

import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Band } from "../../../../domain/band.aggregate";
import { BandInviteDeclinedEvent } from "../../../../domain/events/band-invite-responded.event";
import { Musician } from "../../../../domain/musician.aggregate";
import { BandInMemoryRepository } from "../../../../infra/db/in-memory/band-in-memory.repository";
import { bandLedBy, bandMember } from "../../common/__tests__/band-fixtures";
import { DeclineBandInviteUseCase } from "../decline-band-invite.use-case";

describe("DeclineBandInviteUseCase Unit Tests", () => {
  let useCase: DeclineBandInviteUseCase;
  let bandRepo: BandInMemoryRepository;

  beforeEach(() => {
    bandRepo = new BandInMemoryRepository();
    useCase = new DeclineBandInviteUseCase(bandRepo);
  });

  it("should decline a pending invite", async () => {
    const band = Band.fake().aBand().build();
    const musician = Musician.fake().aMusician().build();
    band.inviteMember(musician.musician_id, "member", "guitar");
    bandRepo.items = [band];

    const output = await useCase.execute({
      band_id: band.band_id.id,
      musician_id: musician.musician_id.id,
    });

    expect(output.members[0].status).toBe("declined");
    expect(bandRepo.items[0].acceptedMembers).toHaveLength(0);
  });

  it("should throw error when band not found", async () => {
    await expect(
      useCase.execute({
        band_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
        musician_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("should throw error when there is no invite for the musician", async () => {
    const band = Band.fake().aBand().build();
    bandRepo.items = [band];

    await expect(
      useCase.execute({
        band_id: band.band_id.id,
        musician_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
      }),
    ).rejects.toThrow(EntityValidationError);
  });

  it("avisa o líder de que o convite foi recusado", async () => {
    const leader = new Uuid();
    const invited = new Uuid();
    const emitter = new EventEmitter2();
    const received: BandInviteDeclinedEvent[] = [];
    emitter.on(BandInviteDeclinedEvent.name, (event) => received.push(event));
    useCase = new DeclineBandInviteUseCase(
      bandRepo,
      new DomainEventMediator(emitter),
    );
    const band = bandLedBy(leader, [bandMember(invited, "member", "pending")]);
    bandRepo.items = [band];

    await useCase.execute({
      band_id: band.band_id.id,
      musician_id: invited.id,
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      musician_id: invited.id,
      leader_musician_id: leader.id,
    });
  });
});
