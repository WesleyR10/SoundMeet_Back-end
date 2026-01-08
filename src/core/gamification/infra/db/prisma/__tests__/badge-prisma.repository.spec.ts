import { PrismaClient } from "@prisma/client";

import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Badge, BadgeId } from "../../../../domain/badge.aggregate";
import { BadgeSearchParams } from "../../../../domain/badge.repository";
import { BadgeModelMapper } from "../badge-model-mapper";
import { BadgePrismaRepository } from "../badge-prisma.repository";

describe("BadgePrismaRepository", () => {
  let repository: BadgePrismaRepository;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = {
      badge: {
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    } as any;
    repository = new BadgePrismaRepository(prisma);
  });

  describe("insert", () => {
    it("should insert a badge", async () => {
      const badge = Badge.fake().aBadge().build();
      const modelProps = BadgeModelMapper.toModel(badge);

      await repository.insert(badge);

      expect(prisma.badge.create).toHaveBeenCalledWith({
        data: modelProps,
      });
    });
  });

  describe("bulkInsert", () => {
    it("should insert multiple badges", async () => {
      const badges = [
        Badge.fake().aBadge().build(),
        Badge.fake().aBadge().build(),
      ];
      const modelsProps = badges.map((entity) =>
        BadgeModelMapper.toModel(entity),
      );

      await repository.bulkInsert(badges);

      expect(prisma.badge.createMany).toHaveBeenCalledWith({
        data: modelsProps,
      });
    });
  });

  describe("update", () => {
    it("should update a badge", async () => {
      const badge = Badge.fake().aBadge().build();
      const modelProps = BadgeModelMapper.toModel(badge);

      await repository.update(badge);

      expect(prisma.badge.update).toHaveBeenCalledWith({
        where: { id: badge.badge_id.id },
        data: modelProps,
      });
    });

    it("should throw NotFoundError when badge does not exist", async () => {
      const badge = Badge.fake().aBadge().build();
      (prisma.badge.update as jest.Mock).mockRejectedValue({
        code: "P2025",
      });

      await expect(repository.update(badge)).rejects.toThrow(
        new NotFoundError(badge.badge_id.id, Badge),
      );
    });
  });

  describe("delete", () => {
    it("should delete a badge", async () => {
      const badgeId = new BadgeId();

      await repository.delete(badgeId);

      expect(prisma.badge.delete).toHaveBeenCalledWith({
        where: { id: badgeId.id },
      });
    });

    it("should throw NotFoundError when badge does not exist", async () => {
      const badgeId = new BadgeId();
      (prisma.badge.delete as jest.Mock).mockRejectedValue({
        code: "P2025",
      });

      await expect(repository.delete(badgeId)).rejects.toThrow(
        new NotFoundError(badgeId.id, Badge),
      );
    });
  });

  describe("findById", () => {
    it("should return a badge when found", async () => {
      const badge = Badge.fake().aBadge().build();
      const modelProps = BadgeModelMapper.toModel(badge);
      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(modelProps);

      const result = await repository.findById(badge.badge_id);

      expect(result).toEqual(badge);
      expect(prisma.badge.findUnique).toHaveBeenCalledWith({
        where: { id: badge.badge_id.id },
      });
    });

    it("should return null when badge not found", async () => {
      const badgeId = new BadgeId();
      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById(badgeId);

      expect(result).toBeNull();
    });
  });

  describe("findByIds", () => {
    it("should return badges when found", async () => {
      const badges = [
        Badge.fake().aBadge().build(),
        Badge.fake().aBadge().build(),
      ];
      const modelsProps = badges.map((badge) =>
        BadgeModelMapper.toModel(badge),
      );
      (prisma.badge.findMany as jest.Mock).mockResolvedValue(modelsProps);

      const result = await repository.findByIds(
        badges.map((badge) => badge.badge_id),
      );

      expect(result).toHaveLength(2);
      expect(prisma.badge.findMany).toHaveBeenCalledWith({
        where: { id: { in: badges.map((badge) => badge.badge_id.id) } },
      });
    });
  });

  describe("existsById", () => {
    it("should return exists and not_exists arrays", async () => {
      const badge1 = Badge.fake().aBadge().build();
      const badge2 = Badge.fake().aBadge().build();
      const badge3 = Badge.fake().aBadge().build();

      (prisma.badge.findMany as jest.Mock).mockResolvedValue([
        { id: badge1.badge_id.id },
        { id: badge2.badge_id.id },
      ]);

      const result = await repository.existsById([
        badge1.badge_id,
        badge2.badge_id,
        badge3.badge_id,
      ]);

      expect(result.exists).toHaveLength(2);
      expect(result.not_exists).toHaveLength(1);
      expect(result.not_exists[0]).toBe(badge3.badge_id);
    });
  });

  describe("search", () => {
    it("should search badges with filters", async () => {
      const badges = [Badge.fake().aBadge().build()];
      const modelsProps = badges.map((badge) =>
        BadgeModelMapper.toModel(badge),
      );

      (prisma.badge.findMany as jest.Mock).mockResolvedValue(modelsProps);
      (prisma.badge.count as jest.Mock).mockResolvedValue(1);

      const searchParams = BadgeSearchParams.create({
        page: 1,
        per_page: 10,
        filter: { name: "test", category: "engagement" },
      });

      const result = await repository.search(searchParams);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.badge.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: "test", mode: "insensitive" } },
            { description: { contains: "test", mode: "insensitive" } },
          ],
          category: "engagement",
        },
        orderBy: undefined,
        skip: 0,
        take: 10,
      });
    });
  });

  describe("findByCategory", () => {
    it("should find badges by category", async () => {
      const badges = [Badge.fake().aBadge().build()];
      const modelsProps = badges.map((badge) =>
        BadgeModelMapper.toModel(badge),
      );
      (prisma.badge.findMany as jest.Mock).mockResolvedValue(modelsProps);

      const result = await repository.findByCategory("engagement");

      expect(result).toHaveLength(1);
      expect(prisma.badge.findMany).toHaveBeenCalledWith({
        where: { category: "engagement" },
      });
    });
  });

  describe("findByRarity", () => {
    it("should find badges by rarity", async () => {
      const badges = [Badge.fake().aBadge().build()];
      const modelsProps = badges.map((badge) =>
        BadgeModelMapper.toModel(badge),
      );
      (prisma.badge.findMany as jest.Mock).mockResolvedValue(modelsProps);

      const result = await repository.findByRarity("rare");

      expect(result).toHaveLength(1);
      expect(prisma.badge.findMany).toHaveBeenCalledWith({
        where: { rarity: "rare" },
      });
    });
  });

  describe("findActiveOnly", () => {
    it("should find only active badges", async () => {
      const badges = [Badge.fake().aBadge().build()];
      const modelsProps = badges.map((badge) =>
        BadgeModelMapper.toModel(badge),
      );
      (prisma.badge.findMany as jest.Mock).mockResolvedValue(modelsProps);

      const result = await repository.findActiveOnly();

      expect(result).toHaveLength(1);
      expect(prisma.badge.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
      });
    });
  });
});
