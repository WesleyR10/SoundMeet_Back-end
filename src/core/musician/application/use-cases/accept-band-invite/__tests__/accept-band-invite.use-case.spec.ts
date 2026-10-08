import EventEmitter2 from "eventemitter2";

import { InvalidOperationError } from "../../../../../shared/domain/errors/invalid-operation.error";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { BandInviteAcceptedEvent } from "../../../../domain/events/band-invite-responded.event";
import { BandInMemoryRepository } from "../../../../infra/db/in-memory/band-in-memory.repository";
import { bandLedBy, bandMember } from "../../common/__tests__/band-fixtures";
import { AcceptBandInviteUseCase } from "../accept-band-invite.use-case";

describe("AcceptBandInviteUseCase Unit Tests", () => {
  let useCase: AcceptBandInviteUseCase;
  let bandRepo: BandInMemoryRepository;
  let leader: Uuid;
  let invited: Uuid;

  beforeEach(() => {
    bandRepo = new BandInMemoryRepository();
    useCase = new AcceptBandInviteUseCase(bandRepo);
    leader = new Uuid();
    invited = new Uuid();
  });

  it("should accept a pending invite", async () => {
    const band = bandLedBy(leader, [bandMember(invited, "member", "pending")]);
    bandRepo.items = [band];

    const output = await useCase.execute({
      band_id: band.band_id.id,
      musician_id: invited.id,
    });

    expect(
      output.members.find((m) => m.musician_id === invited.id)?.status,
    ).toBe("accepted");
    expect(bandRepo.items[0].acceptedMembers).toHaveLength(2);
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
    const band = bandLedBy(leader);
    bandRepo.items = [band];

    await expect(
      useCase.execute({
        band_id: band.band_id.id,
        musician_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
      }),
    ).rejects.toThrow(EntityValidationError);
  });

  it("banda dissolvida não ganha integrante", async () => {
    const band = bandLedBy(leader, [bandMember(invited, "member", "pending")]);
    // Simula a corrida: a banda foi desativada com o convite ainda na linha.
    band.deactivate();
    bandRepo.items = [band];

    await expect(
      useCase.execute({ band_id: band.band_id.id, musician_id: invited.id }),
    ).rejects.toThrow(InvalidOperationError);
  });

  it("avisa o líder de que o convite foi aceito", async () => {
    const emitter = new EventEmitter2();
    const received: BandInviteAcceptedEvent[] = [];
    emitter.on(BandInviteAcceptedEvent.name, (event) => received.push(event));
    useCase = new AcceptBandInviteUseCase(
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
      band_name: band.name,
    });
  });
});
