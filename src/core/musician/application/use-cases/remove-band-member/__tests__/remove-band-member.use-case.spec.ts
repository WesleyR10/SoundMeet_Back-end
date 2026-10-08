import { ForbiddenException } from "@nestjs/common";

import { InvalidOperationError } from "../../../../../shared/domain/errors/invalid-operation.error";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { BandInMemoryRepository } from "../../../../infra/db/in-memory/band-in-memory.repository";
import { bandLedBy, bandMember } from "../../common/__tests__/band-fixtures";
import { RemoveBandMemberInput } from "../remove-band-member.input";
import { RemoveBandMemberUseCase } from "../remove-band-member.use-case";

describe("RemoveBandMemberUseCase Unit Tests", () => {
  let useCase: RemoveBandMemberUseCase;
  let repository: BandInMemoryRepository;
  let leader: Uuid;
  let member: Uuid;

  beforeEach(() => {
    repository = new BandInMemoryRepository();
    useCase = new RemoveBandMemberUseCase(repository);
    leader = new Uuid();
    member = new Uuid();
  });

  const remove = (
    band_id: string,
    musician_id: string,
    requesting_musician_id: string | null,
    is_admin = false,
  ) =>
    useCase.execute(
      new RemoveBandMemberInput({
        band_id,
        musician_id,
        requesting_musician_id,
        is_admin,
      }),
    );

  it("o líder remove um integrante", async () => {
    const band = bandLedBy(leader, [bandMember(member)]);
    repository.items = [band];

    const output = await remove(band.band_id.id, member.id, leader.id);

    expect(output.members).toHaveLength(1);
    expect(repository.items[0].findMember(member)).toBeNull();
  });

  it("o líder cancela um convite pendente", async () => {
    const band = bandLedBy(leader, [bandMember(member, "member", "pending")]);
    repository.items = [band];

    const output = await remove(band.band_id.id, member.id, leader.id);

    expect(output.members).toHaveLength(1);
  });

  describe("🔴 sair da banda — o integrante se remove sozinho", () => {
    it("integrante aceito sai sem depender do líder", async () => {
      const band = bandLedBy(leader, [bandMember(member)]);
      repository.items = [band];

      const output = await remove(band.band_id.id, member.id, member.id);

      expect(output.members.map((m) => m.musician_id)).toEqual([leader.id]);
    });

    it("convidado desiste do convite pendente", async () => {
      const band = bandLedBy(leader, [bandMember(member, "member", "pending")]);
      repository.items = [band];

      await remove(band.band_id.id, member.id, member.id);

      expect(repository.items[0].findMember(member)).toBeNull();
    });

    it("integrante NÃO remove outro integrante", async () => {
      const other = new Uuid();
      const band = bandLedBy(leader, [bandMember(member), bandMember(other)]);
      repository.items = [band];

      await expect(
        remove(band.band_id.id, other.id, member.id),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.items[0].members).toHaveLength(3);
    });

    it("estranho não remove ninguém", async () => {
      const band = bandLedBy(leader, [bandMember(member)]);
      repository.items = [band];

      await expect(
        remove(band.band_id.id, member.id, new Uuid().id),
      ).rejects.toThrow(ForbiddenException);
    });

    it("sem `sub`, nega", async () => {
      const band = bandLedBy(leader, [bandMember(member)]);
      repository.items = [band];

      await expect(remove(band.band_id.id, member.id, null)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("o líder não some da banda", () => {
    it("com outros integrantes: transfira antes", async () => {
      const band = bandLedBy(leader, [bandMember(member)]);
      repository.items = [band];

      await expect(
        remove(band.band_id.id, leader.id, leader.id),
      ).rejects.toThrow(EntityValidationError);
      expect(repository.items[0].isLeader(leader)).toBe(true);
    });

    it("🔴 sozinho: não deixa uma banda sem ninguém — o caminho é dissolver", async () => {
      const band = bandLedBy(leader);
      repository.items = [band];

      await expect(
        remove(band.band_id.id, leader.id, leader.id),
      ).rejects.toThrow(InvalidOperationError);
      expect(repository.items[0].members).toHaveLength(1);
    });
  });

  it("admin remove em nome da banda", async () => {
    const band = bandLedBy(leader, [bandMember(member)]);
    repository.items = [band];

    await remove(band.band_id.id, member.id, new Uuid().id, true);

    expect(repository.items[0].members).toHaveLength(1);
  });

  it("should throw error when band not found", async () => {
    await expect(
      remove(
        "9366b7dc-2d71-4799-b91c-c64adb205104",
        "9366b7dc-2d71-4799-b91c-c64adb205104",
        leader.id,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("should throw error when member not in band", async () => {
    const band = bandLedBy(leader);
    repository.items = [band];

    await expect(
      remove(
        band.band_id.id,
        "9366b7dc-2d71-4799-b91c-c64adb205104",
        leader.id,
      ),
    ).rejects.toThrow(EntityValidationError);
  });
});
