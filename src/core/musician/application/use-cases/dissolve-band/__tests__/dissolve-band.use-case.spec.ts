import { ForbiddenException } from "@nestjs/common";

import { IIdentityClaimsWriter } from "../../../../../shared/application/identity-claims.interface";
import { ConflictError } from "../../../../../shared/domain/errors/conflict.error";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { BandCommitmentsInMemoryReader } from "../../../../infra/db/in-memory/band-commitments-in-memory.reader";
import { BandInMemoryRepository } from "../../../../infra/db/in-memory/band-in-memory.repository";
import { bandLedBy, bandMember } from "../../common/__tests__/band-fixtures";
import { DissolveBandInput } from "../dissolve-band.input";
import { DissolveBandUseCase } from "../dissolve-band.use-case";

describe("DissolveBandUseCase Unit Tests", () => {
  let useCase: DissolveBandUseCase;
  let repository: BandInMemoryRepository;
  let commitments: BandCommitmentsInMemoryReader;
  let claims: jest.Mocked<IIdentityClaimsWriter>;
  let leader: Uuid;

  beforeEach(() => {
    repository = new BandInMemoryRepository();
    commitments = new BandCommitmentsInMemoryReader();
    claims = {
      addClaimValue: jest.fn().mockResolvedValue(undefined),
      removeClaimValue: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new DissolveBandUseCase(repository, commitments, claims);
    leader = new Uuid();
  });

  const dissolve = (id: string, requesting_musician_id: string | null) =>
    useCase.execute(new DissolveBandInput({ id, requesting_musician_id }));

  it("banda sem registro em lugar nenhum é apagada, e o claim do líder sai junto", async () => {
    const band = bandLedBy(leader);
    repository.items = [band];

    const output = await dissolve(band.band_id.id, leader.id);

    expect(output).toEqual({ outcome: "deleted" });
    expect(repository.items).toHaveLength(0);
    expect(claims.removeClaimValue).toHaveBeenCalledWith(
      leader.id,
      "band_ids",
      band.band_id.id,
    );
  });

  it("🔴 banda com histórico é ARQUIVADA, não apagada", async () => {
    const pending = new Uuid();
    const member = new Uuid();
    const band = bandLedBy(leader, [
      bandMember(member),
      bandMember(pending, "member", "pending"),
    ]);
    band.setOpenToGigs(true);
    repository.items = [band];
    commitments.set(band.band_id, { has_history: true });

    const output = await dissolve(band.band_id.id, leader.id);

    expect(output).toEqual({ outcome: "archived" });
    const saved = repository.items[0];
    expect(saved.is_active).toBe(false);
    // Fora da busca: `createPublic` exige `open_to_gigs` e `is_active`.
    expect(saved.open_to_gigs).toBe(false);
    // Quem tocou continua no registro; convite em aberto não tem mais banda.
    expect(saved.findMember(member)).not.toBeNull();
    expect(saved.findMember(pending)).toBeNull();
    // O líder ainda lê os shows antigos da banda — o claim fica.
    expect(claims.removeClaimValue).not.toHaveBeenCalled();
  });

  describe("🔴 compromisso em aberto impede dissolver", () => {
    it.each([
      ["show futuro", { upcoming_bookings: 1 }, "1 show marcado ou proposto"],
      [
        "conversa de contratação",
        { open_inquiries: 2 },
        "2 conversas de contratação em andamento",
      ],
      ["cachê em custódia", { held_escrows: 1 }, "1 cachê em custódia"],
      ["set no ar", { live_performances: 1 }, "1 apresentação no ar"],
    ])("%s", async (_label, open, message) => {
      const band = bandLedBy(leader);
      repository.items = [band];
      commitments.set(band.band_id, { open, has_history: true });

      const attempt = dissolve(band.band_id.id, leader.id);

      await expect(attempt).rejects.toThrow(ConflictError);
      await expect(attempt).rejects.toThrow(message);
      // Nem apagada nem arquivada: continua como estava.
      expect(repository.items).toHaveLength(1);
      expect(repository.items[0].is_active).toBe(true);
    });
  });

  it("corrida: o DELETE é recusado pelo banco → arquiva em vez de estourar", async () => {
    const band = bandLedBy(leader);
    repository.items = [band];
    jest
      .spyOn(repository, "delete")
      .mockRejectedValueOnce(new Error("check constraint violated"));

    const output = await dissolve(band.band_id.id, leader.id);

    expect(output).toEqual({ outcome: "archived" });
    expect(repository.items[0].is_active).toBe(false);
  });

  it("repetir numa banda já arquivada não é erro", async () => {
    const band = bandLedBy(leader);
    band.archive();
    repository.items = [band];
    const summarize = jest.spyOn(commitments, "summarize");

    await expect(dissolve(band.band_id.id, leader.id)).resolves.toEqual({
      outcome: "archived",
    });
    expect(summarize).not.toHaveBeenCalled();
  });

  describe("só o líder atual dissolve", () => {
    it("integrante comum é recusado", async () => {
      const member = new Uuid();
      const band = bandLedBy(leader, [bandMember(member)]);
      repository.items = [band];

      await expect(dissolve(band.band_id.id, member.id)).rejects.toThrow(
        ForbiddenException,
      );
      expect(repository.items).toHaveLength(1);
    });

    it("🔴 ex-líder não apaga a banda depois de transferir", async () => {
      const successor = new Uuid();
      const band = bandLedBy(leader, [bandMember(successor)]);
      band.transferLeadership(leader, successor);
      repository.items = [band];

      await expect(dissolve(band.band_id.id, leader.id)).rejects.toThrow(
        ForbiddenException,
      );
      expect(repository.items).toHaveLength(1);
    });
  });

  it("falha ao tirar o claim não desfaz a exclusão", async () => {
    claims.removeClaimValue.mockRejectedValueOnce(new Error("Keycloak fora"));
    const band = bandLedBy(leader);
    repository.items = [band];

    await expect(dissolve(band.band_id.id, leader.id)).resolves.toEqual({
      outcome: "deleted",
    });
    expect(repository.items).toHaveLength(0);
  });

  it("should throw error when band not found", async () => {
    await expect(
      dissolve("9366b7dc-2d71-4799-b91c-c64adb205104", leader.id),
    ).rejects.toThrow(NotFoundError);
  });
});
