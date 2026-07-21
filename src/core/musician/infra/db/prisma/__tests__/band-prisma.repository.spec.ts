import { PrismaClient } from "@prisma/client";

import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Band } from "../../../../domain/band.aggregate";
import { BandSearchParams } from "../../../../domain/band.repository";
import { BandPrismaRepository } from "../band-prisma.repository";

describe("BandPrismaRepository", () => {
  let repository: BandPrismaRepository;
  let prisma: any;
  let txClient: any;

  beforeEach(() => {
    txClient = {
      band: { update: jest.fn() },
      bandMember: {
        deleteMany: jest.fn(),
        upsert: jest.fn(),
        createMany: jest.fn(),
      },
    };
    prisma = {
      band: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      bandMember: {
        deleteMany: jest.fn(),
        upsert: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn(async (fn: any) => fn(txClient)),
    };
    repository = new BandPrismaRepository(prisma as PrismaClient);
  });

  describe("update", () => {
    it("upserts each member instead of deleting and recreating all rows", async () => {
      const musicianAId = new Uuid();
      const musicianBId = new Uuid();
      const musicianA = musicianAId.id;
      const musicianB = musicianBId.id;
      const band = Band.create({ name: "The Band", genres: ["rock"] });
      band.inviteMember(musicianAId, "leader", "vocals");
      band.inviteMember(musicianBId, "member", "guitar");

      await repository.update(band);

      // Não deve mais existir um delete-all incondicional seguido de
      // createMany — só o diff (membros que saíram) é apagado.
      expect(txClient.bandMember.createMany).not.toHaveBeenCalled();
      expect(txClient.bandMember.deleteMany).toHaveBeenCalledWith({
        where: {
          bandId: band.band_id.id,
          musicianId: { notIn: [musicianA, musicianB] },
        },
      });
      expect(txClient.bandMember.upsert).toHaveBeenCalledTimes(2);
      expect(txClient.bandMember.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            bandId_musicianId: { bandId: band.band_id.id, musicianId: musicianA },
          },
          create: expect.objectContaining({ musicianId: musicianA, status: "pending" }),
          update: expect.objectContaining({ status: "pending" }),
        }),
      );
    });

    it("deletes all members when the band ends up with zero members", async () => {
      const band = Band.create({ name: "The Band", genres: ["rock"] });

      await repository.update(band);

      expect(txClient.bandMember.deleteMany).toHaveBeenCalledWith({
        where: { bandId: band.band_id.id, musicianId: { notIn: [""] } },
      });
      expect(txClient.bandMember.upsert).not.toHaveBeenCalled();
    });
  });

  describe("search — musician_id filter (\"minhas bandas\")", () => {
    it("only matches accepted membership, not pending/declined invites", async () => {
      prisma.band.findMany.mockResolvedValue([]);
      prisma.band.count.mockResolvedValue(0);

      const musicianId = new Uuid().id;
      await repository.search(
        BandSearchParams.create({ filter: { musician_id: musicianId } }),
      );

      expect(prisma.band.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            members: { some: { musicianId, status: "accepted" } },
          }),
        }),
      );
    });
  });
});
