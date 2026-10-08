import { ForbiddenException } from "@nestjs/common";

import { IIdentityClaimsWriter } from "../../../../../shared/application/identity-claims.interface";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Band, BandId } from "../../../../domain/band.aggregate";
import { BandInMemoryRepository } from "../../../../infra/db/in-memory/band-in-memory.repository";
import { TransferBandLeadershipUseCase } from "../transfer-band-leadership.use-case";

describe("TransferBandLeadershipUseCase", () => {
  let repo: BandInMemoryRepository;
  let claims: jest.Mocked<IIdentityClaimsWriter>;
  let useCase: TransferBandLeadershipUseCase;
  let leader: Uuid;
  let successor: Uuid;
  let band: Band;

  const member = (musician_id: Uuid, role: "leader" | "member") => ({
    musician_id,
    role,
    instrument: "guitar",
    status: "accepted" as const,
    joined_at: new Date(),
    responded_at: new Date(),
  });

  beforeEach(async () => {
    repo = new BandInMemoryRepository();
    claims = {
      addClaimValue: jest.fn().mockResolvedValue(undefined),
      removeClaimValue: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new TransferBandLeadershipUseCase(repo, claims);
    leader = new Uuid();
    successor = new Uuid();
    band = new Band({
      band_id: new BandId(new Uuid().id),
      name: "Trio Elétrico",
      genres: ["rock"],
      members: [member(leader, "leader"), member(successor, "member")],
    });
    await repo.insert(band);
  });

  const execute = (props: {
    new_leader_musician_id?: string;
    requesting_musician_id?: string | null;
    is_admin?: boolean;
  }) =>
    useCase.execute({
      band_id: band.band_id.id,
      new_leader_musician_id: props.new_leader_musician_id ?? successor.id,
      requesting_musician_id: props.requesting_musician_id,
      is_admin: props.is_admin,
    });

  it("o líder atual passa a liderança para um integrante aceito", async () => {
    const output = await execute({ requesting_musician_id: leader.id });

    const saved = await repo.findById(band.band_id);
    expect(saved!.isLeader(successor)).toBe(true);
    expect(saved!.isLeader(leader)).toBe(false);
    expect(output.members).toHaveLength(2);
  });

  // O ponto da rota: quem não lidera não escolhe o próximo líder.
  it("integrante comum não transfere a liderança", async () => {
    await expect(
      execute({ requesting_musician_id: successor.id }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const saved = await repo.findById(band.band_id);
    expect(saved!.isLeader(leader)).toBe(true);
  });

  it("terceiro que conhece o UUID da banda não transfere", async () => {
    await expect(
      execute({ requesting_musician_id: new Uuid().id }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // Falha fechada: sem `sub` não há como provar liderança.
  it("sem identidade no token, nega", async () => {
    await expect(execute({})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      execute({ requesting_musician_id: "  " }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("admin transfere em nome da banda (suporte, líder inativo)", async () => {
    await execute({ requesting_musician_id: new Uuid().id, is_admin: true });

    const saved = await repo.findById(band.band_id);
    expect(saved!.isLeader(successor)).toBe(true);
  });

  it("sucessor precisa ser membro aceito", async () => {
    const pending = new Uuid();
    band.inviteMember(pending, "member", "drums");
    await repo.update(band);

    await expect(
      execute({
        requesting_musician_id: leader.id,
        new_leader_musician_id: pending.id,
      }),
    ).rejects.toBeInstanceOf(EntityValidationError);
  });

  it("banda inexistente devolve NotFound", async () => {
    await expect(
      useCase.execute({
        band_id: new Uuid().id,
        new_leader_musician_id: successor.id,
        requesting_musician_id: leader.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("banda sem líder não tem de quem transferir", async () => {
    const headless = new Band({
      band_id: new BandId(new Uuid().id),
      name: "Sem líder",
      genres: ["mpb"],
      members: [member(successor, "member")],
    });
    await repo.insert(headless);

    await expect(
      useCase.execute({
        band_id: headless.band_id.id,
        new_leader_musician_id: successor.id,
        requesting_musician_id: successor.id,
        is_admin: true,
      }),
    ).rejects.toBeInstanceOf(EntityValidationError);
  });

  describe("🔴 o claim `band_ids` acompanha o líder", () => {
    it("a nova líder recebe o claim e o ex-líder o perde", async () => {
      await execute({ requesting_musician_id: leader.id });

      expect(claims.addClaimValue).toHaveBeenCalledWith(
        successor.id,
        "band_ids",
        band.band_id.id,
      );
      expect(claims.removeClaimValue).toHaveBeenCalledWith(
        leader.id,
        "band_ids",
        band.band_id.id,
      );
    });

    it("a ordem é claim da nova líder → banco → claim do ex-líder", async () => {
      const order: string[] = [];
      claims.addClaimValue.mockImplementation(async () => {
        order.push("add");
      });
      claims.removeClaimValue.mockImplementation(async () => {
        order.push("remove");
      });
      const update = jest.spyOn(repo, "update");
      update.mockImplementation(async () => {
        order.push("update");
      });

      await execute({ requesting_musician_id: leader.id });

      expect(order).toEqual(["add", "update", "remove"]);
    });

    it("Keycloak fora ao dar o claim: nada é gravado", async () => {
      claims.addClaimValue.mockRejectedValueOnce(new Error("Keycloak fora"));
      const update = jest.spyOn(repo, "update");

      await expect(
        execute({ requesting_musician_id: leader.id }),
      ).rejects.toThrow("Keycloak fora");

      expect(update).not.toHaveBeenCalled();
      expect(claims.removeClaimValue).not.toHaveBeenCalled();
    });

    it("banco falha depois de dar o claim: o claim é desfeito", async () => {
      jest.spyOn(repo, "update").mockRejectedValueOnce(new Error("db down"));

      await expect(
        execute({ requesting_musician_id: leader.id }),
      ).rejects.toThrow("db down");

      expect(claims.removeClaimValue).toHaveBeenCalledTimes(1);
      expect(claims.removeClaimValue).toHaveBeenCalledWith(
        successor.id,
        "band_ids",
        band.band_id.id,
      );
    });

    it("falha ao tirar o claim do ex-líder não desfaz a transferência", async () => {
      claims.removeClaimValue.mockRejectedValueOnce(new Error("Keycloak fora"));

      const output = await execute({ requesting_musician_id: leader.id });

      expect(
        output.members.find((m) => m.musician_id === successor.id)?.role,
      ).toBe("leader");
    });

    it("sucessor inválido não rende claim a ninguém", async () => {
      await expect(
        execute({
          requesting_musician_id: leader.id,
          new_leader_musician_id: new Uuid().id,
        }),
      ).rejects.toBeInstanceOf(EntityValidationError);

      expect(claims.addClaimValue).not.toHaveBeenCalled();
    });
  });
});
