import { ForbiddenException } from "@nestjs/common";
import EventEmitter2 from "eventemitter2";

import { PlanLimitExceededError } from "../../../../../plans/domain/errors/plan-limit-exceeded.error";
import { PlanCheckService } from "../../../../../plans/domain/plan-check.service";
import { InvalidOperationError } from "../../../../../shared/domain/errors/invalid-operation.error";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { BandMemberInvitedEvent } from "../../../../domain/events/band-member-invited.event";
import { Musician } from "../../../../domain/musician.aggregate";
import { BandInMemoryRepository } from "../../../../infra/db/in-memory/band-in-memory.repository";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { bandLedBy, bandMember } from "../../common/__tests__/band-fixtures";
import { InviteBandMemberInput } from "../invite-band-member.input";
import { InviteBandMemberUseCase } from "../invite-band-member.use-case";

describe("InviteBandMemberUseCase Unit Tests", () => {
  let useCase: InviteBandMemberUseCase;
  let bandRepo: BandInMemoryRepository;
  let musicianRepo: MusicianInMemoryRepository;
  let leader: Uuid;

  beforeEach(() => {
    bandRepo = new BandInMemoryRepository();
    musicianRepo = new MusicianInMemoryRepository();
    useCase = new InviteBandMemberUseCase(bandRepo, musicianRepo);
    leader = new Uuid();
  });

  const invite = (
    band_id: string,
    musician_id: string,
    over: Partial<{
      instrument: string;
      requesting_musician_id: string | null;
      is_admin: boolean;
    }> = {},
  ) =>
    new InviteBandMemberInput({
      band_id,
      musician_id,
      instrument: "guitar",
      requesting_musician_id: leader.id,
      ...over,
    });

  it("convida como integrante pendente — convite é sempre para `member`", async () => {
    const band = bandLedBy(leader);
    const musician = Musician.fake().aMusician().build();
    bandRepo.items = [band];
    musicianRepo.items = [musician];

    const output = await useCase.execute(
      invite(band.band_id.id, musician.musician_id.id),
    );

    expect(output.members).toHaveLength(2);
    expect(
      output.members.find((m) => m.musician_id === musician.musician_id.id),
    ).toMatchObject({
      role: "member",
      instrument: "guitar",
      status: "pending",
    });
    expect(bandRepo.items[0].acceptedMembers).toHaveLength(1);
  });

  it("should throw error when band not found", async () => {
    const musician = Musician.fake().aMusician().build();
    musicianRepo.items = [musician];

    await expect(
      useCase.execute(
        invite("9366b7dc-2d71-4799-b91c-c64adb205104", musician.musician_id.id),
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("should throw error when musician not found", async () => {
    const band = bandLedBy(leader);
    bandRepo.items = [band];

    await expect(
      useCase.execute(
        invite(band.band_id.id, "9366b7dc-2d71-4799-b91c-c64adb205104"),
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("should throw error when musician already has a member/invite", async () => {
    const musician = Musician.fake().aMusician().build();
    const band = bandLedBy(leader, [
      bandMember(musician.musician_id, "member", "pending"),
    ]);
    bandRepo.items = [band];
    musicianRepo.items = [musician];

    await expect(
      useCase.execute(
        invite(band.band_id.id, musician.musician_id.id, {
          instrument: "bass",
        }),
      ),
    ).rejects.toThrow(EntityValidationError);
  });

  it("should allow re-inviting a musician who previously declined", async () => {
    const musician = Musician.fake().aMusician().build();
    const band = bandLedBy(leader, [
      bandMember(musician.musician_id, "member", "declined"),
    ]);
    bandRepo.items = [band];
    musicianRepo.items = [musician];

    const output = await useCase.execute(
      invite(band.band_id.id, musician.musician_id.id, { instrument: "bass" }),
    );

    const row = output.members.find(
      (m) => m.musician_id === musician.musician_id.id,
    );
    expect(row?.status).toBe("pending");
    expect(row?.instrument).toBe("bass");
    expect(output.members).toHaveLength(2);
  });

  describe("🔴 só o líder atual convida", () => {
    it("integrante comum é recusado", async () => {
      const member = new Uuid();
      const band = bandLedBy(leader, [bandMember(member)]);
      const musician = Musician.fake().aMusician().build();
      bandRepo.items = [band];
      musicianRepo.items = [musician];

      await expect(
        useCase.execute(
          invite(band.band_id.id, musician.musician_id.id, {
            requesting_musician_id: member.id,
          }),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(bandRepo.items[0].members).toHaveLength(2);
    });

    it("estranho que conhece o id da banda é recusado", async () => {
      const band = bandLedBy(leader);
      const musician = Musician.fake().aMusician().build();
      bandRepo.items = [band];
      musicianRepo.items = [musician];

      await expect(
        useCase.execute(
          invite(band.band_id.id, musician.musician_id.id, {
            requesting_musician_id: new Uuid().id,
          }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  it("banda dissolvida não recebe convite", async () => {
    const band = bandLedBy(leader);
    band.archive();
    const musician = Musician.fake().aMusician().build();
    bandRepo.items = [band];
    musicianRepo.items = [musician];

    await expect(
      useCase.execute(invite(band.band_id.id, musician.musician_id.id)),
    ).rejects.toThrow(InvalidOperationError);
  });

  describe("gate de plano — do LÍDER", () => {
    const planCheck = (features: {
      auto_split_management: boolean;
      max_band_members: number | null;
    }) => {
      const service = Object.create(PlanCheckService.prototype);
      service.getMusicianFeatures = jest.fn().mockResolvedValue(features);
      return service as PlanCheckService & { getMusicianFeatures: jest.Mock };
    };

    it("plano sem banda (FREE/ESSENCIAL) não convida", async () => {
      const service = planCheck({
        auto_split_management: false,
        max_band_members: null,
      });
      useCase = new InviteBandMemberUseCase(bandRepo, musicianRepo, service);
      const band = bandLedBy(leader);
      const musician = Musician.fake().aMusician().build();
      bandRepo.items = [band];
      musicianRepo.items = [musician];

      await expect(
        useCase.execute(invite(band.band_id.id, musician.musician_id.id)),
      ).rejects.toThrow(PlanLimitExceededError);
      // O plano consultado é o do líder, não o de quem foi convidado.
      expect(service.getMusicianFeatures).toHaveBeenCalledWith(leader.id);
      expect(bandRepo.items[0].members).toHaveLength(1);
    });

    it("🔴 o teto de integrantes é aplicado — antes só existia no texto do app", async () => {
      const service = planCheck({
        auto_split_management: true,
        max_band_members: 3,
      });
      useCase = new InviteBandMemberUseCase(bandRepo, musicianRepo, service);
      // Líder + 1 aceito + 1 convite pendente = 3 vagas ocupadas.
      const band = bandLedBy(leader, [
        bandMember(new Uuid()),
        bandMember(new Uuid(), "member", "pending"),
      ]);
      const musician = Musician.fake().aMusician().build();
      bandRepo.items = [band];
      musicianRepo.items = [musician];

      await expect(
        useCase.execute(invite(band.band_id.id, musician.musician_id.id)),
      ).rejects.toThrow(PlanLimitExceededError);
      expect(bandRepo.items[0].members).toHaveLength(3);
    });

    it("convite recusado não ocupa vaga", async () => {
      const service = planCheck({
        auto_split_management: true,
        max_band_members: 3,
      });
      useCase = new InviteBandMemberUseCase(bandRepo, musicianRepo, service);
      // Líder + 1 aceito + 1 RECUSADO = 2 vagas ocupadas; cabe mais um.
      const band = bandLedBy(leader, [
        bandMember(new Uuid()),
        bandMember(new Uuid(), "member", "declined"),
      ]);
      const musician = Musician.fake().aMusician().build();
      bandRepo.items = [band];
      musicianRepo.items = [musician];

      const output = await useCase.execute(
        invite(band.band_id.id, musician.musician_id.id),
      );
      expect(output.members).toHaveLength(4);
    });
  });

  it("publica o convite DEPOIS de gravar — é o que dispara o aviso ao convidado", async () => {
    const emitter = new EventEmitter2();
    const received: BandMemberInvitedEvent[] = [];
    let persistedWhenNotified = false;
    const band = bandLedBy(leader);
    const musician = Musician.fake().aMusician().build();
    bandRepo.items = [band];
    musicianRepo.items = [musician];
    const update = jest.spyOn(bandRepo, "update");
    emitter.on(BandMemberInvitedEvent.name, (event: BandMemberInvitedEvent) => {
      received.push(event);
      persistedWhenNotified = update.mock.calls.length === 1;
    });
    useCase = new InviteBandMemberUseCase(
      bandRepo,
      musicianRepo,
      undefined,
      new DomainEventMediator(emitter),
    );

    await useCase.execute(invite(band.band_id.id, musician.musician_id.id));

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      musician_id: musician.musician_id.id,
      band_name: band.name,
      instrument: "guitar",
    });
    expect(persistedWhenNotified).toBe(true);
  });
});
