import { PrismaClient } from "@prisma/client";

import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import {
  UserScore,
  UserScoreId,
} from "../../../../domain/user-score.aggregate";
import { UserScoreSearchParams } from "../../../../domain/user-score.repository";
import { ScoreTypeEnum } from "../../../../domain/value-objects/score-type.vo";
import { UserScorePrismaRepository } from "../user-score-prisma.repository";

describe("UserScorePrismaRepository Unit Tests", () => {
  let repository: UserScorePrismaRepository;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = {
      userScore: {
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
    repository = new UserScorePrismaRepository(prisma);
  });

  describe("insert", () => {
    it("should insert a new user score", async () => {
      const userScore = UserScore.fake().aUserScore().build();
      const modelProps = {
        id: userScore.id.id,
        user_id: userScore.user_id.id,
        score_type: userScore.score_type,
        points: userScore.points,
        reference_id: userScore.reference_id,
        description: userScore.description,
        created_at: userScore.created_at,
      };

      (prisma.userScore.create as jest.Mock).mockResolvedValue(modelProps);

      await repository.insert(userScore);

      expect(prisma.userScore.create).toHaveBeenCalledWith({
        data: modelProps,
      });
    });
  });

  describe("bulkInsert", () => {
    it("should insert multiple user scores", async () => {
      const userScores = UserScore.fake().theUserScores(3).build();
      const modelPropsArray = userScores.map((userScore) => ({
        id: userScore.id.id,
        user_id: userScore.user_id.id,
        score_type: userScore.score_type,
        points: userScore.points,
        reference_id: userScore.reference_id,
        description: userScore.description,
        created_at: userScore.created_at,
      }));

      (prisma.userScore.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      await repository.bulkInsert(userScores);

      expect(prisma.userScore.createMany).toHaveBeenCalledWith({
        data: modelPropsArray,
      });
    });
  });

  describe("update", () => {
    it("should update an existing user score", async () => {
      const userScore = UserScore.fake().aUserScore().build();
      userScore.changePoints(100);

      const modelProps = {
        id: userScore.id.id,
        user_id: userScore.user_id.id,
        score_type: ScoreTypeEnum.QR_SCAN,
        points: userScore.points,
        created_at: userScore.created_at,
      };

      (prisma.userScore.update as jest.Mock).mockResolvedValue(modelProps);
      (prisma.userScore.findUnique as jest.Mock).mockResolvedValue(modelProps);

      await repository.update(userScore);

      expect(prisma.userScore.update).toHaveBeenCalledWith({
        where: { id: userScore.id.id },
        data: {
          id: userScore.id.id,
          user_id: userScore.user_id.id,
          score_type: userScore.score_type,
          points: userScore.points,
          reference_id: userScore.reference_id,
          description: userScore.description,
          created_at: userScore.created_at,
        },
      });
    });

    it("should throw NotFoundError when user score does not exist", async () => {
      const userScore = UserScore.fake().aUserScore().build();

      const prismaError = new Error("Record to update not found");
      (prismaError as any).code = "P2025";

      (prisma.userScore.update as jest.Mock).mockRejectedValue(prismaError);

      await expect(repository.update(userScore)).rejects.toThrow(NotFoundError);
    });
  });

  describe("delete", () => {
    it("should delete an existing user score", async () => {
      const userScore = UserScore.fake().aUserScore().build();

      (prisma.userScore.delete as jest.Mock).mockResolvedValue({
        id: userScore.id.id,
      });
      (prisma.userScore.findUnique as jest.Mock).mockResolvedValue({
        id: userScore.id.id,
        user_id: userScore.user_id.id,
        score_type: userScore.score_type,
        points: userScore.points,
        reference_id: userScore.reference_id,
        description: userScore.description,
        created_at: userScore.created_at,
      });

      await repository.delete(userScore.id);

      expect(prisma.userScore.delete).toHaveBeenCalledWith({
        where: { id: userScore.id.id },
      });
    });

    it("should throw NotFoundError when user score does not exist", async () => {
      const id = new UserScoreId();

      (prisma.userScore.delete as jest.Mock).mockRejectedValue({
        code: "P2025",
        message: "Record to delete does not exist",
      });

      await expect(repository.delete(id)).rejects.toThrow(NotFoundError);
    });
  });

  describe("findById", () => {
    it("should find user score by id", async () => {
      const userScore = UserScore.fake().aUserScore().build();
      const modelProps = {
        id: userScore.id.id,
        user_id: userScore.user_id.id,
        score_type: userScore.score_type,
        points: userScore.points,
        created_at: userScore.created_at,
      };

      (prisma.userScore.findUnique as jest.Mock).mockResolvedValue(modelProps);

      const result = await repository.findById(userScore.id);

      expect(result).toBeDefined();
      expect(result!.id.id).toBe(userScore.id.id);
      expect(result!.user_id.id).toBe(userScore.user_id.id);
      expect(result!.score_type).toBe(userScore.score_type);
      expect(result!.points).toBe(userScore.points);
    });

    it("should return null when user score is not found", async () => {
      const id = new UserScoreId();

      (prisma.userScore.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById(id);

      expect(result).toBeNull();
    });
  });

  describe("findByIds", () => {
    it("should find user scores by ids", async () => {
      const userScores = UserScore.fake().theUserScores(3).build();
      const modelPropsArray = userScores.map((userScore) => ({
        id: userScore.id.id,
        user_id: userScore.user_id.id,
        score_type: userScore.score_type,
        points: userScore.points,
        reference_id: userScore.reference_id,
        description: userScore.description,
        created_at: userScore.created_at,
      }));

      (prisma.userScore.findMany as jest.Mock).mockResolvedValue(
        modelPropsArray,
      );

      const ids = userScores.map((score) => score.id);
      const result = await repository.findByIds(ids);

      expect(result).toHaveLength(3);
      expect(result.map((score) => score.id.id)).toEqual(
        expect.arrayContaining(ids.map((id) => id.id)),
      );
      expect(prisma.userScore.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ids.map((id) => id.id),
          },
        },
      });
    });
  });

  describe("findByIds", () => {
    it("should return all user scores by ids", async () => {
      const userScores = [
        UserScore.fake().aUserScore().build(),
        UserScore.fake().aUserScore().build(),
      ];

      const modelPropsArray = userScores.map((userScore) => ({
        id: userScore.id.id,
        user_id: userScore.user_id.id,
        score_type: userScore.score_type,
        points: userScore.points,
        created_at: userScore.created_at,
      }));

      (prisma.userScore.findMany as jest.Mock).mockResolvedValue(
        modelPropsArray,
      );

      const result = await repository.findByIds([
        userScores[0].id,
        userScores[1].id,
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].id.id).toBe(userScores[0].id.id);
      expect(result[1].id.id).toBe(userScores[1].id.id);
    });
  });

  describe("existsById", () => {
    it("should return true when user score exists", async () => {
      const userScore = UserScore.fake().aUserScore().build();

      (prisma.userScore.findMany as jest.Mock).mockResolvedValue([
        {
          id: userScore.id.id,
        },
      ]);

      const result = await repository.existsById([userScore.id]);

      expect(result.exists).toHaveLength(1);
      expect(result.exists[0]).toStrictEqual(userScore.id);
      expect(result.not_exists).toHaveLength(0);
      expect(prisma.userScore.findMany).toHaveBeenCalledWith({
        where: { id: { in: [userScore.id.id] } },
        select: { id: true },
      });
    });

    it("should return false when user score does not exist", async () => {
      const id = new UserScoreId();

      (prisma.userScore.findMany as jest.Mock).mockResolvedValue([]);

      const result = await repository.existsById([id]);

      expect(result.exists).toHaveLength(0);
      expect(result.not_exists).toHaveLength(1);
      expect(result.not_exists[0]).toStrictEqual(id);
    });
  });

  describe("search", () => {
    it("should search user scores with filters", async () => {
      const userId = new Uuid().id;
      const userScores = UserScore.fake().theUserScores(2).build();
      const modelPropsArray = userScores.map((userScore) => ({
        id: userScore.id.id,
        user_id: userScore.user_id.id,
        score_type: userScore.score_type,
        points: userScore.points,
        reference_id: userScore.reference_id,
        description: userScore.description,
        created_at: userScore.created_at,
      }));

      (prisma.userScore.findMany as jest.Mock).mockResolvedValue(
        modelPropsArray,
      );
      (prisma.userScore.count as jest.Mock).mockResolvedValue(2);

      const searchParams = UserScoreSearchParams.create({
        filter: { user_id: userId, score_type: ScoreTypeEnum.QR_SCAN },
        page: 1,
        per_page: 10,
      });

      const result = await repository.search(searchParams);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(prisma.userScore.findMany).toHaveBeenCalledWith({
        where: {
          user_id: userId,
          score_type: ScoreTypeEnum.QR_SCAN,
        },
        orderBy: { created_at: "desc" },
        skip: 0,
        take: 10,
      });
    });
  });

  describe("findByUserAndType", () => {
    it("should find user scores by user and type", async () => {
      const userId = new Uuid();
      const userScore = UserScore.fake()
        .aUserScore()
        .withUserId(userId)
        .build();
      const modelProps = {
        id: userScore.id.id,
        user_id: userId.id,
        score_type: ScoreTypeEnum.QR_SCAN,
        points: userScore.points,
        created_at: userScore.created_at,
      };

      (prisma.userScore.findMany as jest.Mock).mockResolvedValue([modelProps]);

      const result = await repository.findByUserAndType(
        userId.id,
        ScoreTypeEnum.QR_SCAN,
      );

      expect(result).toHaveLength(1);
      expect(result[0].user_id.id).toBe(userId.id);
      expect(result[0].score_type).toBe(ScoreTypeEnum.QR_SCAN);
      expect(prisma.userScore.findMany).toHaveBeenCalledWith({
        where: {
          user_id: userId.id,
          score_type: ScoreTypeEnum.QR_SCAN,
        },
        orderBy: { created_at: "desc" },
      });
    });
  });

  describe("getTotalPointsByUser", () => {
    it("should get total points by user", async () => {
      const userId = "user-1";

      (prisma.userScore.aggregate as jest.Mock).mockResolvedValue({
        _sum: { points: 30 },
      });

      const total = await repository.getTotalPointsByUser(userId);

      expect(total).toBe(30);
      expect(prisma.userScore.aggregate).toHaveBeenCalledWith({
        where: { user_id: userId },
        _sum: { points: true },
      });
    });

    it("should return 0 when user has no scores", async () => {
      const userId = "non-existent-user";

      (prisma.userScore.aggregate as jest.Mock).mockResolvedValue({
        _sum: { points: null },
      });

      const total = await repository.getTotalPointsByUser(userId);

      expect(total).toBe(0);
    });
  });

  describe("getPointsByUserAndType", () => {
    it("should get points by user and type", async () => {
      const userId = "user-123";
      const scoreType = ScoreTypeEnum.QR_SCAN;

      (prisma.userScore.aggregate as jest.Mock).mockResolvedValue({
        _sum: { points: 150 },
      });

      const result = await repository.getPointsByUserAndType(userId, scoreType);

      expect(result).toBe(150);
      expect(prisma.userScore.aggregate).toHaveBeenCalledWith({
        where: {
          user_id: userId,
          score_type: scoreType,
        },
        _sum: {
          points: true,
        },
      });
    });

    it("should return 0 when user has no scores for the type", async () => {
      const userId = "user-123";
      const scoreType = ScoreTypeEnum.QR_SCAN;

      (prisma.userScore.aggregate as jest.Mock).mockResolvedValue({
        _sum: { points: null },
      });

      const result = await repository.getPointsByUserAndType(userId, scoreType);

      expect(result).toBe(0);
    });
  });
});
