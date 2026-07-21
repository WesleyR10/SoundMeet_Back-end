import { PrismaClient } from "@prisma/client";

import { DomainError } from "../../../../../shared/domain/errors/domain.error";
import { InvalidArgumentError } from "../../../../../shared/domain/errors/invalid-argument.error";
import { InvariantViolationError } from "../../../../../shared/domain/errors/invariant-violation.error";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Currency } from "../../../../../shared/domain/value-objects/money.vo";
import { Musician, MusicianId } from "../../../../domain/musician.aggregate";
import { MusicianSearchParams } from "../../../../domain/musician.repository";
import { MusicianModelMapper } from "../musician-model-mapper";
import { MusicianPrismaRepository } from "../musician-prisma.repository";

describe("MusicianPrismaRepository", () => {
  let repository: MusicianPrismaRepository;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = {
      musician: {
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    } as any;
    repository = new MusicianPrismaRepository(prisma);
  });

  describe("insert", () => {
    it("should insert a musician", async () => {
      const musician = Musician.fake().aMusician().build();
      const modelProps = MusicianModelMapper.toModel(musician);

      await repository.insert(musician);

      expect(prisma.musician.create).toHaveBeenCalledWith({
        data: { ...modelProps, profile: undefined },
      });
    });
  });

  describe("bulkInsert", () => {
    it("should insert multiple musicians", async () => {
      const musicians = [
        Musician.fake().aMusician().build(),
        Musician.fake().aMusician().build(),
      ];
      const modelsProps = musicians.map((entity) =>
        MusicianModelMapper.toModel(entity),
      );

      await repository.bulkInsert(musicians);

      expect(prisma.musician.createMany).toHaveBeenCalledWith({
        data: modelsProps,
      });
    });
  });

  describe("update", () => {
    it("should update a musician", async () => {
      const musician = Musician.fake().aMusician().build();
      const modelProps = MusicianModelMapper.toModel(musician);

      await repository.update(musician);

      expect(prisma.musician.update).toHaveBeenCalledWith({
        where: { id: musician.musician_id.id },
        data: { ...modelProps, profile: undefined },
      });
    });

    it("should throw NotFoundError when musician not found", async () => {
      const musician = Musician.fake().aMusician().build();
      const error = { code: "P2025" };
      (prisma.musician.update as jest.Mock).mockRejectedValue(error);

      await expect(repository.update(musician)).rejects.toThrow(
        new NotFoundError(musician.musician_id.id, Musician),
      );
    });

    it("should rethrow other errors", async () => {
      const musician = Musician.fake().aMusician().build();
      const error = new Error("Database error");
      (prisma.musician.update as jest.Mock).mockRejectedValue(error);

      try {
        await repository.update(musician);
        throw new InvariantViolationError(
          "Expected repository.update to throw",
        );
      } catch (e: any) {
        expect(e).toBeInstanceOf(DomainError);
        expect(e.message).toBe("Database error");
        expect((e as any).cause).toBe(error);
      }
    });
  });

  describe("delete", () => {
    it("should delete a musician", async () => {
      const musicianId = new MusicianId();

      await repository.delete(musicianId);

      expect(prisma.musician.delete).toHaveBeenCalledWith({
        where: { id: musicianId.id },
      });
    });

    it("should throw NotFoundError when musician not found", async () => {
      const musicianId = new MusicianId();
      const error = { code: "P2025" };
      (prisma.musician.delete as jest.Mock).mockRejectedValue(error);

      await expect(repository.delete(musicianId)).rejects.toThrow(
        new NotFoundError(musicianId.id, Musician),
      );
    });

    it("should rethrow other errors", async () => {
      const musicianId = new MusicianId();
      const error = new Error("Database error");
      (prisma.musician.delete as jest.Mock).mockRejectedValue(error);

      try {
        await repository.delete(musicianId);
        throw new InvariantViolationError(
          "Expected repository.delete to throw",
        );
      } catch (e: any) {
        expect(e).toBeInstanceOf(DomainError);
        expect(e.message).toBe("Database error");
        expect((e as any).cause).toBe(error);
      }
    });
  });

  describe("findById", () => {
    it("should return a musician when found", async () => {
      const musician = Musician.fake().aMusician().build();
      const model = MusicianModelMapper.toModel(musician);
      (prisma.musician.findUnique as jest.Mock).mockResolvedValue(model);

      const result = await repository.findById(musician.musician_id);

      expect(prisma.musician.findUnique).toHaveBeenCalledWith({
        where: { id: musician.musician_id.id },
        include: { profile: true },
      });
      expect(result).toEqual(musician);
    });

    it("should return null when musician not found", async () => {
      const musicianId = new MusicianId();
      (prisma.musician.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById(musicianId);

      expect(result).toBeNull();
    });
  });

  describe("findByIds", () => {
    it("should return musicians when found", async () => {
      const musicians = [
        Musician.fake().aMusician().build(),
        Musician.fake().aMusician().build(),
      ];
      const models = musicians.map((m) => MusicianModelMapper.toModel(m));
      const ids = musicians.map((m) => m.musician_id);
      (prisma.musician.findMany as jest.Mock).mockResolvedValue(models);

      const result = await repository.findByIds(ids);

      expect(prisma.musician.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ids.map((id) => id.id),
          },
        },
        include: { profile: true },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe("existsById", () => {
    it("should throw InvalidArgumentError when ids array is empty", async () => {
      await expect(repository.existsById([])).rejects.toThrow(
        new InvalidArgumentError(
          "ids must be an array with at least one element",
        ),
      );
    });

    it("should return exists and not_exists arrays", async () => {
      const id1 = new MusicianId();
      const id2 = new MusicianId();
      const id3 = new MusicianId();
      const ids = [id1, id2, id3];

      const existingModels = [{ id: id1.id }, { id: id2.id }];
      (prisma.musician.findMany as jest.Mock).mockResolvedValue(existingModels);

      const result = await repository.existsById(ids);

      expect(prisma.musician.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ids.map((id) => id.id),
          },
        },
        select: { id: true },
      });
      expect(result.exists).toHaveLength(2);
      expect(result.not_exists).toHaveLength(1);
      expect(result.not_exists[0].equals(id3)).toBe(true);
    });
  });

  describe("search", () => {
    it("should search musicians with pagination", async () => {
      const musicians = [
        Musician.fake().aMusician().build(),
        Musician.fake().aMusician().build(),
      ];
      const models = musicians.map((m) => MusicianModelMapper.toModel(m));
      (prisma.musician.findMany as jest.Mock).mockResolvedValue(models);
      (prisma.musician.count as jest.Mock).mockResolvedValue(10);

      const searchParams = MusicianSearchParams.create({
        page: 1,
        per_page: 2,
        sort: "name",
        sort_dir: "asc",
        filter: { name: "test" },
      });

      const result = await repository.search(searchParams);

      expect(prisma.musician.findMany).toHaveBeenCalledWith({
        where: {
          name: {
            contains: "test",
            mode: "insensitive",
          },
        },
        include: { profile: true },
        orderBy: { name: "asc" },
        skip: 0,
        take: 2,
      });
      expect(prisma.musician.count).toHaveBeenCalledWith({
        where: {
          name: {
            contains: "test",
            mode: "insensitive",
          },
        },
      });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.current_page).toBe(1);
      expect(result.per_page).toBe(2);
    });
  });

  describe("searchByProximity — 7.13d modo turnê", () => {
    const lat = -23.5614;
    const lng = -46.6559;

    it("builds an OR bounding box between base location and active touring location", async () => {
      (prisma.musician.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await repository.search(
        MusicianSearchParams.create({ filter: { lat, lng, radius_km: 5 } }),
      );

      const [candidateCall] = (prisma.musician.findMany as jest.Mock).mock.calls;
      const profileWhere = candidateCall[0].where.profile.is;

      expect(profileWhere.OR).toHaveLength(2);
      expect(profileWhere.OR[0]).toEqual({
        location_lat: expect.objectContaining({ gte: expect.any(Number), lte: expect.any(Number) }),
        location_lng: expect.objectContaining({ gte: expect.any(Number), lte: expect.any(Number) }),
      });
      expect(profileWhere.OR[1]).toEqual({
        touring_lat: expect.objectContaining({ gte: expect.any(Number), lte: expect.any(Number) }),
        touring_lng: expect.objectContaining({ gte: expect.any(Number), lte: expect.any(Number) }),
        touring_expires_at: { gt: expect.any(Date) },
      });
    });

    it("finds a musician only via an active touring point, even when the base is far away", async () => {
      const musicianId = "b7f8e6a0-1c2d-4e3f-9a1b-2c3d4e5f6a7b";
      const model = MusicianModelMapper.toModel(
        Musician.fake().aMusician().build(),
      );

      (prisma.musician.findMany as jest.Mock)
        .mockResolvedValueOnce([
          {
            id: musicianId,
            profile: {
              location_lat: -22.9035, // Rio — longe do centro de busca
              location_lng: -43.1771,
              touring_lat: lat, // turnê exatamente no centro de busca
              touring_lng: lng,
              touring_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          },
        ])
        .mockResolvedValueOnce([{ ...model, id: musicianId }]);

      const result = await repository.search(
        MusicianSearchParams.create({ filter: { lat, lng, radius_km: 5 } }),
      );

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("ignores an expired touring point and falls back to the base distance", async () => {
      (prisma.musician.findMany as jest.Mock)
        .mockResolvedValueOnce([
          {
            id: "b7f8e6a0-1c2d-4e3f-9a1b-2c3d4e5f6a7b",
            profile: {
              location_lat: -22.9035, // Rio — fora do raio de 5km
              location_lng: -43.1771,
              touring_lat: lat, // turnê expirado não deve contar
              touring_lng: lng,
              touring_expires_at: new Date(Date.now() - 1000),
            },
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await repository.search(
        MusicianSearchParams.create({ filter: { lat, lng, radius_km: 5 } }),
      );

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("buildWhereClause", () => {
    it("should return empty object when no filter", () => {
      const result = repository["buildWhereClause"](null);
      expect(result).toEqual({});
    });

    it("should build where clause with name filter", () => {
      const result = repository["buildWhereClause"]({ name: "John" });
      expect(result).toEqual({
        name: {
          contains: "John",
          mode: "insensitive",
        },
      });
    });

    it("should build where clause with multiple filters", () => {
      const result = repository["buildWhereClause"]({
        name: "John",
        genres: ["Rock", "Pop"],
        is_active: true,
      });
      expect(result).toEqual({
        name: {
          contains: "John",
          mode: "insensitive",
        },
        genres: {
          hasSome: ["Rock", "Pop"],
        },
        is_active: true,
      });
    });

    it("should build where clause with price range filters scoped to a model", () => {
      const result = repository["buildWhereClause"]({
        price_model: "per_event",
        price_min: 100,
        price_max: 200,
        price_currency: Currency.BRL,
      });

      expect(result).toEqual({
        profile: {
          is: {
            price_currency: "BRL",
            price_event_max: { gte: 100 },
            price_event_min: { lte: 200 },
          },
        },
      });
    });

    it("should build where clause matching any model when price_model is absent", () => {
      const result = repository["buildWhereClause"]({
        price_min: 100,
        price_max: 200,
      });

      expect(result).toEqual({
        profile: {
          is: {
            OR: [
              {
                price_hour_max: { gte: 100 },
                price_hour_min: { lte: 200 },
              },
              {
                price_event_max: { gte: 100 },
                price_event_min: { lte: 200 },
              },
            ],
          },
        },
      });
    });
  });

  describe("buildOrderByClause", () => {
    it("should return default order when no sort", () => {
      const result = repository["buildOrderByClause"](null, null);
      expect(result).toEqual({ created_at: "desc" });
    });

    it("should return default order when invalid sort field", () => {
      const result = repository["buildOrderByClause"]("invalid_field", "asc");
      expect(result).toEqual({ created_at: "desc" });
    });

    it("should return correct order for valid sort field", () => {
      const result = repository["buildOrderByClause"]("name", "asc");
      expect(result).toEqual({ name: "asc" });
    });

    it("should default to desc when invalid sort direction", () => {
      const result = repository["buildOrderByClause"]("name", "invalid");
      expect(result).toEqual({ name: "desc" });
    });
  });

  describe("getEntity", () => {
    it("should return Musician constructor", () => {
      expect(repository.getEntity()).toBe(Musician);
    });
  });
});
