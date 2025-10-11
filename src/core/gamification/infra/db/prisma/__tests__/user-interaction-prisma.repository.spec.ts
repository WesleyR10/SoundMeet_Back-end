import { PrismaClient } from "@prisma/client";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { UserInteraction } from "../../../../domain/user-interaction.aggregate";
import { UserInteractionId } from "../../../../domain/value-objects/gamification-id.vo";
import { UserInteractionSearchParams } from "../../../../domain/user-interaction.repository";
import { UserInteractionPrismaRepository } from "../user-interaction-prisma.repository";
import { UserInteractionModelMapper } from "../user-interaction-model-mapper";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";

describe("UserInteractionPrismaRepository", () => {
  let repository: UserInteractionPrismaRepository;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = {
      userInteraction: {
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
    } as any;
    repository = new UserInteractionPrismaRepository(prisma);
  });

  describe("insert", () => {
    it("should insert a user interaction", async () => {
      const userInteraction = UserInteraction.fake().aUserInteraction().build();
      const modelProps = UserInteractionModelMapper.toModel(userInteraction);

      await repository.insert(userInteraction);

      expect(prisma.userInteraction.create).toHaveBeenCalledWith({
        data: modelProps,
      });
    });
  });

  describe("bulkInsert", () => {
    it("should insert multiple user interactions", async () => {
      const userInteractions = [
        UserInteraction.fake().aUserInteraction().build(),
        UserInteraction.fake().aUserInteraction().build(),
      ];
      const modelsProps = userInteractions.map((entity) =>
        UserInteractionModelMapper.toModel(entity),
      );

      await repository.bulkInsert(userInteractions);

      expect(prisma.userInteraction.createMany).toHaveBeenCalledWith({
        data: modelsProps,
      });
    });
  });

  describe("update", () => {
    it("should update a user interaction", async () => {
      const userInteraction = UserInteraction.fake().aUserInteraction().build();
      const modelProps = UserInteractionModelMapper.toModel(userInteraction);

      await repository.update(userInteraction);

      expect(prisma.userInteraction.update).toHaveBeenCalledWith({
        where: { id: userInteraction.id.id },
        data: modelProps,
      });
    });

    it("should throw NotFoundError when user interaction does not exist", async () => {
      const userInteraction = UserInteraction.fake().aUserInteraction().build();
      (prisma.userInteraction.update as jest.Mock).mockRejectedValue({
        code: "P2025",
      });

      await expect(repository.update(userInteraction)).rejects.toThrow(
        new NotFoundError(userInteraction.id.id, UserInteraction),
      );
    });
  });

  describe("delete", () => {
    it("should delete a user interaction", async () => {
      const userInteractionId = new UserInteractionId();

      await repository.delete(userInteractionId);

      expect(prisma.userInteraction.delete).toHaveBeenCalledWith({
        where: { id: userInteractionId.id },
      });
    });

    it("should throw NotFoundError when user interaction does not exist", async () => {
      const userInteractionId = new UserInteractionId();
      (prisma.userInteraction.delete as jest.Mock).mockRejectedValue({
        code: "P2025",
      });

      await expect(repository.delete(userInteractionId)).rejects.toThrow(
        new NotFoundError(userInteractionId.id, UserInteraction),
      );
    });
  });

  describe("findById", () => {
    it("should return a user interaction when found", async () => {
      const userInteraction = UserInteraction.fake().aUserInteraction().build();
      const modelProps = UserInteractionModelMapper.toModel(userInteraction);
      (prisma.userInteraction.findUnique as jest.Mock).mockResolvedValue(
        modelProps,
      );

      const result = await repository.findById(userInteraction.id);

      expect(result).toEqual(userInteraction);
      expect(prisma.userInteraction.findUnique).toHaveBeenCalledWith({
        where: { id: userInteraction.id.id },
      });
    });

    it("should return null when user interaction not found", async () => {
      const userInteractionId = UserInteractionId.create();
      (prisma.userInteraction.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById(userInteractionId);

      expect(result).toBeNull();
    });
  });

  describe("findByIds", () => {
    it("should return user interactions when found", async () => {
      const userInteractions = [
        UserInteraction.fake().aUserInteraction().build(),
        UserInteraction.fake().aUserInteraction().build(),
      ];
      const modelsProps = userInteractions.map((userInteraction) =>
        UserInteractionModelMapper.toModel(userInteraction),
      );
      (prisma.userInteraction.findMany as jest.Mock).mockResolvedValue(
        modelsProps,
      );

      const result = await repository.findByIds(
        userInteractions.map((userInteraction) => userInteraction.id),
      );

      expect(result).toHaveLength(2);
      expect(prisma.userInteraction.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: userInteractions.map(
              (userInteraction) => userInteraction.id.id,
            ),
          },
        },
      });
    });
  });

  describe("existsById", () => {
    it("should return exists and not_exists arrays", async () => {
      const userInteraction1 = UserInteraction.fake()
        .aUserInteraction()
        .build();
      const userInteraction2 = UserInteraction.fake()
        .aUserInteraction()
        .build();
      const userInteraction3 = UserInteraction.fake()
        .aUserInteraction()
        .build();

      (prisma.userInteraction.findMany as jest.Mock).mockResolvedValue([
        { id: userInteraction1.id.id },
        { id: userInteraction2.id.id },
      ]);

      const result = await repository.existsById([
        userInteraction1.id,
        userInteraction2.id,
        userInteraction3.id,
      ]);

      expect(result.exists).toHaveLength(2);
      expect(result.not_exists).toHaveLength(1);
      expect(result.not_exists[0]).toBe(userInteraction3.id);
    });
  });

  describe("search", () => {
    it("should search user interactions with filters", async () => {
      const userInteractions = [
        UserInteraction.fake().aUserInteraction().build(),
      ];
      const modelsProps = userInteractions.map((userInteraction) =>
        UserInteractionModelMapper.toModel(userInteraction),
      );

      (prisma.userInteraction.findMany as jest.Mock).mockResolvedValue(
        modelsProps,
      );
      (prisma.userInteraction.count as jest.Mock).mockResolvedValue(1);

      const userId = new Uuid();
      const searchParams = UserInteractionSearchParams.create({
        page: 1,
        per_page: 10,
        filter: {
          user_id: userId.id,
          interaction_type: "like",
        },
      });

      const result = await repository.search(searchParams);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.userInteraction.findMany).toHaveBeenCalledWith({
        where: {
          audienceId: userId.id,
          type: "like",
        },
        orderBy: undefined,
        skip: 0,
        take: 10,
      });
    });
  });

  describe("findByUserId", () => {
    it("should find user interactions by user id", async () => {
      const userInteractions = [
        UserInteraction.fake().aUserInteraction().build(),
      ];
      const modelsProps = userInteractions.map((userInteraction) =>
        UserInteractionModelMapper.toModel(userInteraction),
      );
      (prisma.userInteraction.findMany as jest.Mock).mockResolvedValue(
        modelsProps,
      );

      const userId = new Uuid();
      const result = await repository.findByUserId(userId.id);

      expect(result).toHaveLength(1);
      expect(prisma.userInteraction.findMany).toHaveBeenCalledWith({
        where: { audienceId: userId.id },
      });
    });
  });

  describe("findByInteractionType", () => {
    it("should find user interactions by interaction type", async () => {
      const userInteractions = [
        UserInteraction.fake().aUserInteraction().build(),
      ];
      const modelsProps = userInteractions.map((userInteraction) =>
        UserInteractionModelMapper.toModel(userInteraction),
      );
      (prisma.userInteraction.findMany as jest.Mock).mockResolvedValue(
        modelsProps,
      );

      const result = await repository.findByInteractionType("like");

      expect(result).toHaveLength(1);
      expect(prisma.userInteraction.findMany).toHaveBeenCalledWith({
        where: { type: "like" },
      });
    });
  });

  describe("findByUserIdAndType", () => {
    it("should find user interactions by user id and type", async () => {
      const userInteractions = [
        UserInteraction.fake().aUserInteraction().build(),
      ];
      const modelsProps = userInteractions.map((userInteraction) =>
        UserInteractionModelMapper.toModel(userInteraction),
      );
      (prisma.userInteraction.findMany as jest.Mock).mockResolvedValue(
        modelsProps,
      );

      const userId = new Uuid();
      const result = await repository.findByUserIdAndType(userId.id, "like");

      expect(result).toHaveLength(1);
      expect(prisma.userInteraction.findMany).toHaveBeenCalledWith({
        where: {
          audienceId: userId.id,
          type: "like",
        },
      });
    });
  });

  describe("findByDateRange", () => {
    it("should find user interactions by date range", async () => {
      const userInteractions = [
        UserInteraction.fake().aUserInteraction().build(),
      ];
      const modelsProps = userInteractions.map((userInteraction) =>
        UserInteractionModelMapper.toModel(userInteraction),
      );
      (prisma.userInteraction.findMany as jest.Mock).mockResolvedValue(
        modelsProps,
      );

      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-12-31");
      const result = await repository.findByDateRange(startDate, endDate);

      expect(result).toHaveLength(1);
      expect(prisma.userInteraction.findMany).toHaveBeenCalledWith({
        where: {
          created_at: {
            gte: startDate,
            lte: endDate,
          },
        },
      });
    });
  });

  describe("getTotalPointsByUserId", () => {
    it("should get total points by user id", async () => {
      const userId = new Uuid();
      (prisma.userInteraction.aggregate as jest.Mock).mockResolvedValue({
        _sum: { points: 100 },
      });

      const result = await repository.getTotalPointsByUserId(userId.id);

      expect(result).toBe(100);
      expect(prisma.userInteraction.aggregate).toHaveBeenCalledWith({
        where: { audienceId: userId.id },
        _sum: {
          points: true,
        },
      });
    });

    it("should return 0 when no points found", async () => {
      const userId = new Uuid();
      (prisma.userInteraction.aggregate as jest.Mock).mockResolvedValue({
        _sum: { points: null },
      });

      const result = await repository.getTotalPointsByUserId(userId.id);

      expect(result).toBe(0);
    });
  });

  describe("getInteractionCountByType", () => {
    it("should get interaction count by type", async () => {
      (prisma.userInteraction.count as jest.Mock).mockResolvedValue(5);

      const result = await repository.getInteractionCountByType("like");

      expect(result).toBe(5);
      expect(prisma.userInteraction.count).toHaveBeenCalledWith({
        where: { type: "like" },
      });
    });
  });
});
