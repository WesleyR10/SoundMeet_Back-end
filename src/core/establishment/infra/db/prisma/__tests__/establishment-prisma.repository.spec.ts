import { PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../../shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import {
  Establishment,
  EstablishmentId,
} from "../../../../domain/establishment.aggregate";
import { EstablishmentSearchParams } from "../../../../domain/establishment.repository";
import { EstablishmentProfile } from "../../../../domain/establishment-profile.aggregate";
import { EstablishmentModelMapper } from "../establishment-model-mapper";
import { EstablishmentPrismaRepository } from "../establishment-prisma.repository";

describe("EstablishmentPrismaRepository", () => {
  let repository: EstablishmentPrismaRepository;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = {
      establishment: {
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      establishmentProfile: {
        delete: jest.fn(),
      },
    } as any;
    repository = new EstablishmentPrismaRepository(prisma);
  });

  describe("insert", () => {
    it("should insert an establishment", async () => {
      const establishment = Establishment.fake().anEstablishment().build();
      const modelProps = EstablishmentModelMapper.toModel(establishment);

      await repository.insert(establishment);

      expect(prisma.establishment.create).toHaveBeenCalledWith({
        data: {
          ...modelProps,
          profile: undefined,
        },
      });
    });
  });

  describe("bulkInsert", () => {
    it("should insert multiple establishments", async () => {
      const establishments = [
        Establishment.fake().anEstablishment().build(),
        Establishment.fake().anEstablishment().build(),
      ];
      const modelsProps = establishments.map((entity) =>
        EstablishmentModelMapper.toModel(entity),
      );

      await repository.bulkInsert(establishments);

      expect(prisma.establishment.createMany).toHaveBeenCalledWith({
        data: modelsProps,
      });
    });
  });

  describe("findById", () => {
    it("should return an establishment when found", async () => {
      const establishment = Establishment.fake().anEstablishment().build();
      const modelProps = EstablishmentModelMapper.toModel(establishment);

      (prisma.establishment.findUnique as jest.Mock).mockResolvedValue(
        modelProps,
      );

      const result = await repository.findById(establishment.establishment_id);

      expect(prisma.establishment.findUnique).toHaveBeenCalledWith({
        where: { id: establishment.establishment_id.id },
        include: { profile: true },
      });
      expect(result).toBeInstanceOf(Establishment);
      expect(result?.establishment_id).toEqual(establishment.establishment_id);
      expect(result?.name).toBe(establishment.name);
      expect(result?.email).toEqual(establishment.email);
      expect(result?.cnpj).toEqual(establishment.cnpj);
      expect(result?.is_active).toBe(establishment.is_active);
      expect(result?.is_verified).toBe(establishment.is_verified);
    });

    it("should return null when establishment not found", async () => {
      const establishmentId = new EstablishmentId();

      (prisma.establishment.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById(establishmentId);

      expect(prisma.establishment.findUnique).toHaveBeenCalledWith({
        where: { id: establishmentId.id },
        include: { profile: true },
      });
      expect(result).toBeNull();
    });
  });

  describe("findAll", () => {
    it("should return all establishments", async () => {
      const establishments = [
        Establishment.fake().anEstablishment().build(),
        Establishment.fake().anEstablishment().build(),
      ];
      const modelsProps = establishments.map((entity) =>
        EstablishmentModelMapper.toModel(entity),
      );

      (prisma.establishment.findMany as jest.Mock).mockResolvedValue(
        modelsProps,
      );

      const result = await repository.findAll();

      expect(prisma.establishment.findMany).toHaveBeenCalledWith({
        include: { profile: true },
      });
      expect(result).toHaveLength(2);
      expect(result[0].establishment_id.id).toBe(
        establishments[0].establishment_id.id,
      );
      expect(result[0].name).toBe(establishments[0].name);
      expect(result[1].establishment_id.id).toBe(
        establishments[1].establishment_id.id,
      );
      expect(result[1].name).toBe(establishments[1].name);
    });
  });

  describe("update", () => {
    it("should update an establishment", async () => {
      const establishment = Establishment.fake().anEstablishment().build();
      const modelProps = EstablishmentModelMapper.toModel(establishment);

      (prisma.establishment.update as jest.Mock).mockResolvedValue(modelProps);

      await repository.update(establishment);

      expect(prisma.establishment.update).toHaveBeenCalledWith({
        where: { id: establishment.establishment_id.id },
        data: {
          ...modelProps,
          profile: undefined,
        },
      });
    });

    it("should throw NotFoundError when establishment not found", async () => {
      const establishment = Establishment.fake().anEstablishment().build();

      (prisma.establishment.update as jest.Mock).mockRejectedValue({
        code: "P2025",
        message: "Record not found",
      });

      await expect(repository.update(establishment)).rejects.toThrow(
        new NotFoundError(establishment.establishment_id.id, Establishment),
      );
    });
  });

  describe("delete", () => {
    it("should delete an establishment", async () => {
      const establishmentId = new EstablishmentId();
      const establishment = Establishment.fake().anEstablishment().build();
      const modelProps = EstablishmentModelMapper.toModel(establishment);

      (prisma.establishment.findUnique as jest.Mock).mockResolvedValue(
        modelProps,
      );

      await repository.delete(establishmentId);

      expect(prisma.establishment.delete).toHaveBeenCalledWith({
        where: { id: establishmentId.id },
      });
    });

    it("should throw NotFoundError when establishment not found", async () => {
      const establishmentId = new EstablishmentId();

      (prisma.establishment.delete as jest.Mock).mockRejectedValue({
        code: "P2025",
        message: "Record not found",
      });

      await expect(repository.delete(establishmentId)).rejects.toThrow(
        new NotFoundError(establishmentId.id, Establishment),
      );
    });
  });

  describe("search", () => {
    it("should search establishments with default params", async () => {
      const establishments = [
        Establishment.fake().anEstablishment().build(),
        Establishment.fake().anEstablishment().build(),
      ];
      const modelsProps = establishments.map((entity) =>
        EstablishmentModelMapper.toModel(entity),
      );

      (prisma.establishment.findMany as jest.Mock).mockResolvedValue(
        modelsProps,
      );
      (prisma.establishment.count as jest.Mock).mockResolvedValue(2);

      const searchParams = EstablishmentSearchParams.create();
      const result = await repository.search(searchParams);

      expect(prisma.establishment.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { created_at: "desc" },
        skip: 0,
        take: 15,
        include: { profile: true },
      });
      expect(prisma.establishment.count).toHaveBeenCalledWith({ where: {} });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("should search establishments with filter", async () => {
      const establishments = [
        Establishment.fake().anEstablishment().withName("Rock Bar").build(),
      ];
      const modelsProps = establishments.map((entity) =>
        EstablishmentModelMapper.toModel(entity),
      );

      (prisma.establishment.findMany as jest.Mock).mockResolvedValue(
        modelsProps,
      );
      (prisma.establishment.count as jest.Mock).mockResolvedValue(1);

      const searchParams = EstablishmentSearchParams.create({
        filter: { name: "Rock" },
      });
      const result = await repository.search(searchParams);

      expect(prisma.establishment.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ name: { contains: "Rock", mode: "insensitive" } }],
        },
        orderBy: { created_at: "desc" },
        skip: 0,
        take: 15,
        include: { profile: true },
      });
      expect(result.items).toHaveLength(1);
    });

    it("should search establishments with profile filters", async () => {
      const establishments = [
        Establishment.fake().anEstablishment().withName("Rock Bar").build(),
      ];
      const modelsProps = establishments.map((entity) =>
        EstablishmentModelMapper.toModel(entity),
      );

      (prisma.establishment.findMany as jest.Mock).mockResolvedValue(
        modelsProps,
      );
      (prisma.establishment.count as jest.Mock).mockResolvedValue(1);

      const searchParams = EstablishmentSearchParams.create({
        filter: {
          location_city: "São",
          amenities: ["Wi-Fi"],
          preferred_genres: ["rock"],
          capacity_min: 100,
          capacity_max: 300,
        },
      });
      await repository.search(searchParams);

      expect(prisma.establishment.findMany).toHaveBeenCalledWith({
        where: {
          profile: {
            is: {
              location_city: { contains: "São", mode: "insensitive" },
              amenities: { hasSome: ["Wi-Fi"] },
              preferredGenres: { hasSome: ["rock"] },
              capacity: { gte: 100, lte: 300 },
            },
          },
        },
        orderBy: { created_at: "desc" },
        skip: 0,
        take: 15,
        include: { profile: true },
      });
    });

    it("should search establishments with sorting", async () => {
      const establishments = [Establishment.fake().anEstablishment().build()];
      const modelsProps = establishments.map((entity) =>
        EstablishmentModelMapper.toModel(entity),
      );

      (prisma.establishment.findMany as jest.Mock).mockResolvedValue(
        modelsProps,
      );
      (prisma.establishment.count as jest.Mock).mockResolvedValue(1);

      const searchParams = EstablishmentSearchParams.create({
        sort: "name",
        sort_dir: "asc",
      });
      const result = await repository.search(searchParams);

      expect(prisma.establishment.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { name: "asc" },
        skip: 0,
        take: 15,
        include: { profile: true },
      });
    });

    it("should search establishments with pagination", async () => {
      const establishments = [Establishment.fake().anEstablishment().build()];
      const modelsProps = establishments.map((entity) =>
        EstablishmentModelMapper.toModel(entity),
      );

      (prisma.establishment.findMany as jest.Mock).mockResolvedValue(
        modelsProps,
      );
      (prisma.establishment.count as jest.Mock).mockResolvedValue(10);

      const searchParams = EstablishmentSearchParams.create({
        page: 2,
        per_page: 5,
      });
      const result = await repository.search(searchParams);

      expect(prisma.establishment.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { created_at: "desc" },
        skip: 5,
        take: 5,
        include: { profile: true },
      });
      expect(result.current_page).toBe(2);
      expect(result.per_page).toBe(5);
    });

    it("should handle complex search with all parameters", async () => {
      const establishments = [Establishment.fake().anEstablishment().build()];
      const modelsProps = establishments.map((entity) =>
        EstablishmentModelMapper.toModel(entity),
      );

      (prisma.establishment.findMany as jest.Mock).mockResolvedValue(
        modelsProps,
      );
      (prisma.establishment.count as jest.Mock).mockResolvedValue(1);

      const searchParams = EstablishmentSearchParams.create({
        page: 1,
        per_page: 10,
        sort: "name",
        sort_dir: "desc",
        filter: { name: "Bar", email: "contact" },
      });
      const result = await repository.search(searchParams);

      expect(prisma.establishment.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: "Bar", mode: "insensitive" } },
            { email: { contains: "contact", mode: "insensitive" } },
          ],
        },
        orderBy: { name: "desc" },
        skip: 0,
        take: 10,
        include: { profile: true },
      });
    });

    it("should throw InvalidArgumentError for invalid sort field", async () => {
      const searchParams = EstablishmentSearchParams.create({
        sort: "invalid_field" as any,
      });

      await expect(repository.search(searchParams)).rejects.toThrow(
        InvalidArgumentError,
      );
    });
  });

  describe("getEntity", () => {
    it("should return Establishment constructor", () => {
      expect(repository.getEntity()).toBe(Establishment);
    });
  });

  describe("deleteProfile", () => {
    it("should delete an establishment profile", async () => {
      const establishmentId = new EstablishmentId();

      await repository.deleteProfile(establishmentId);

      expect(prisma.establishmentProfile.delete).toHaveBeenCalledWith({
        where: {
          establishmentId: establishmentId.id,
        },
      });
    });

    it("should throw NotFoundError when profile not found", async () => {
      const establishmentId = new EstablishmentId();

      (prisma.establishmentProfile.delete as jest.Mock).mockRejectedValue({
        code: "P2025",
        message: "Record not found",
      });

      await expect(repository.deleteProfile(establishmentId)).rejects.toThrow(
        new NotFoundError(establishmentId.id, EstablishmentProfile),
      );
    });
  });
});
