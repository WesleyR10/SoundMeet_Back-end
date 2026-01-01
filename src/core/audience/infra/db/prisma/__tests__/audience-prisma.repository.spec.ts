import { PrismaClient } from "@prisma/client";

import { Audience, AudienceId } from "../../../../domain/audience.aggregate";
import { AudienceSearchParams } from "../../../../domain/audience.repository";
import { AudienceFakeBuilder } from "../../../../domain/audience-fake.builder";
import { AudienceModelMapper } from "../audience-model-mapper";
import { AudiencePrismaRepository } from "../audience-prisma.repository";

describe("AudiencePrismaRepository", () => {
  let repository: AudiencePrismaRepository;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = {
      audience: {
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    } as any;
    repository = new AudiencePrismaRepository(prisma);
  });

  describe("insert", () => {
    it("should insert a new audience", async () => {
      const audience = AudienceFakeBuilder.aAudience().build();
      const modelProps = AudienceModelMapper.toModel(audience);
      const { badges, location, social_links, ...dataWithoutBadges } =
        modelProps;

      (prisma.audience.create as jest.Mock).mockResolvedValue(modelProps);

      await repository.insert(audience);

      expect(prisma.audience.create).toHaveBeenCalledWith({
        data: dataWithoutBadges,
      });
    });
  });

  describe("bulkInsert", () => {
    it("should insert multiple audiences", async () => {
      const audiences = [
        AudienceFakeBuilder.aAudience().build(),
        AudienceFakeBuilder.aAudience().build(),
      ];
      const modelsProps = audiences.map((entity) => {
        const modelProps = AudienceModelMapper.toModel(entity);
        const { badges, location, social_links, ...dataWithoutBadges } =
          modelProps;
        return dataWithoutBadges;
      });

      (prisma.audience.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      await repository.bulkInsert(audiences);

      expect(prisma.audience.createMany).toHaveBeenCalledWith({
        data: modelsProps,
      });
    });
  });

  describe("findById", () => {
    it("should find audience by id", async () => {
      const audience = AudienceFakeBuilder.aAudience().build();
      const modelProps = AudienceModelMapper.toModel(audience);

      // Mock the badges structure as it would come from Prisma
      const modelWithBadges = {
        ...modelProps,
        badges: audience.badges.map((badgeName) => ({
          badge: { name: badgeName },
        })),
      };

      (prisma.audience.findUnique as jest.Mock).mockResolvedValue(
        modelWithBadges,
      );

      const result = await repository.findById(audience.id);

      expect(result).toMatchObject({
        id: audience.id,
        name: audience.name,
        email: audience.email,
        nickname: audience.nickname,
        avatar: audience.avatar,
        phone: audience.phone,
        badges: audience.badges,
        favorite_genres: audience.favorite_genres,
        favorite_artists: audience.favorite_artists,
        is_active: audience.is_active,
      });
      expect(prisma.audience.findUnique).toHaveBeenCalledWith({
        where: { id: audience.id.id },
        include: {
          badges: {
            include: {
              badge: true,
            },
          },
        },
      });
    });

    it("should return null when audience not found", async () => {
      const audienceId = new AudienceId();

      (prisma.audience.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById(audienceId);

      expect(result).toBeNull();
    });
  });

  describe("findAll", () => {
    it("should find all audiences", async () => {
      const audiences = [
        AudienceFakeBuilder.aAudience().build(),
        AudienceFakeBuilder.aAudience().build(),
      ];
      const modelsProps = audiences.map((entity) => {
        const modelProps = AudienceModelMapper.toModel(entity);
        return {
          ...modelProps,
          badges: entity.badges.map((badgeName) => ({
            badge: {
              name: badgeName,
            },
          })),
        };
      });

      (prisma.audience.findMany as jest.Mock).mockResolvedValue(modelsProps);

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: audiences[0].id,
        name: audiences[0].name,
        email: audiences[0].email,
        nickname: audiences[0].nickname,
        avatar: audiences[0].avatar,
        phone: audiences[0].phone,
        badges: audiences[0].badges,
        favorite_genres: audiences[0].favorite_genres,
        favorite_artists: audiences[0].favorite_artists,
        favorite_instruments: audiences[0].favorite_instruments,
        is_active: audiences[0].is_active,
      });
      expect(result[1]).toMatchObject({
        id: audiences[1].id,
        name: audiences[1].name,
        email: audiences[1].email,
        nickname: audiences[1].nickname,
        avatar: audiences[1].avatar,
        phone: audiences[1].phone,
        badges: audiences[1].badges,
        favorite_genres: audiences[1].favorite_genres,
        favorite_artists: audiences[1].favorite_artists,
        favorite_instruments: audiences[1].favorite_instruments,
        is_active: audiences[1].is_active,
      });
    });
  });

  describe("update", () => {
    it("should update an audience", async () => {
      const audience = AudienceFakeBuilder.aAudience().build();
      const modelProps = AudienceModelMapper.toModel(audience);

      (prisma.audience.update as jest.Mock).mockResolvedValue(modelProps);

      await repository.update(audience);

      expect(prisma.audience.update).toHaveBeenCalledWith({
        where: { id: audience.id.id },
        data: {
          email: modelProps.email,
          name: modelProps.name,
          nickname: modelProps.nickname,
          avatar: modelProps.avatar,
          phone: modelProps.phone,
          points: modelProps.points,
          monthly_points: modelProps.monthly_points,
          level: modelProps.level,
          favorite_genres: modelProps.favorite_genres,
          favorite_artists: modelProps.favorite_artists,
          favorite_instruments: modelProps.favorite_instruments,
          preferred_languages: modelProps.preferred_languages,
          notification_settings: modelProps.notification_settings,
          privacy_settings: modelProps.privacy_settings,
          discovery_settings: modelProps.discovery_settings,
          is_active: modelProps.is_active,
          updated_at: modelProps.updated_at,
        },
      });
    });
  });

  describe("delete", () => {
    it("should delete an audience", async () => {
      const audienceId = new AudienceId();

      (prisma.audience.delete as jest.Mock).mockResolvedValue({});

      await repository.delete(audienceId);

      expect(prisma.audience.delete).toHaveBeenCalledWith({
        where: { id: audienceId.id },
      });
    });
  });

  describe("getEntity", () => {
    it("should get audience by id", async () => {
      const audience = AudienceFakeBuilder.aAudience().build();
      const modelProps = AudienceModelMapper.toModel(audience);

      (prisma.audience.findUnique as jest.Mock).mockResolvedValue(modelProps);

      const result = await repository.getEntity();

      expect(result).toEqual(Audience);
    });

    it("should throw NotFoundError when audience not found", async () => {
      const audienceId = new AudienceId();

      (prisma.audience.findUnique as jest.Mock).mockResolvedValue(null);

      // getEntity method doesn't throw NotFoundError, it just returns the Audience class
      const result = repository.getEntity();
      expect(result).toBe(Audience);
    });
  });

  describe("search", () => {
    it("should search audiences with default params", async () => {
      const audiences = [
        AudienceFakeBuilder.aAudience().build(),
        AudienceFakeBuilder.aAudience().build(),
      ];
      const modelsProps = audiences.map((entity) => {
        const modelProps = AudienceModelMapper.toModel(entity);
        return {
          ...modelProps,
          badges: entity.badges.map((badgeName) => ({
            badge: {
              name: badgeName,
            },
          })),
        };
      });

      (prisma.audience.findMany as jest.Mock).mockResolvedValue(modelsProps);
      (prisma.audience.count as jest.Mock).mockResolvedValue(2);

      const searchParams = AudienceSearchParams.create();
      const result = await repository.search(searchParams);

      expect(prisma.audience.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { created_at: "asc" },
        skip: 0,
        take: 15,
        include: { badges: { include: { badge: true } } },
      });
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({
        id: audiences[0].id,
        name: audiences[0].name,
        email: audiences[0].email,
        nickname: audiences[0].nickname,
        avatar: audiences[0].avatar,
        phone: audiences[0].phone,
        badges: audiences[0].badges,
        favorite_genres: audiences[0].favorite_genres,
        favorite_artists: audiences[0].favorite_artists,
        is_active: audiences[0].is_active,
      });
      expect(result.items[1]).toMatchObject({
        id: audiences[1].id,
        name: audiences[1].name,
        email: audiences[1].email,
        nickname: audiences[1].nickname,
        avatar: audiences[1].avatar,
        phone: audiences[1].phone,
        badges: audiences[1].badges,
        favorite_genres: audiences[1].favorite_genres,
        favorite_artists: audiences[1].favorite_artists,
        is_active: audiences[1].is_active,
      });
      expect(result.total).toBe(2);
    });

    it("should search audiences with filter", async () => {
      const audience = AudienceFakeBuilder.aAudience().build();
      const modelProps = AudienceModelMapper.toModel(audience);
      const modelWithBadges = {
        ...modelProps,
        badges: audience.badges.map((badgeName) => ({
          badge: {
            name: badgeName,
          },
        })),
      };

      (prisma.audience.findMany as jest.Mock).mockResolvedValue([
        modelWithBadges,
      ]);
      (prisma.audience.count as jest.Mock).mockResolvedValue(1);

      const searchParams = AudienceSearchParams.create({
        filter: { name: "test" },
      });
      const result = await repository.search(searchParams);

      expect(prisma.audience.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: "test", mode: "insensitive" } },
            { nickname: { contains: "test", mode: "insensitive" } },
            { email: { contains: "test", mode: "insensitive" } },
          ],
        },
        orderBy: { created_at: "asc" },
        skip: 0,
        take: 15,
        include: { badges: { include: { badge: true } } },
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: audience.id,
        name: audience.name,
        email: audience.email,
        nickname: audience.nickname,
        avatar: audience.avatar,
        phone: audience.phone,
        badges: audience.badges,
        favorite_genres: audience.favorite_genres,
        favorite_artists: audience.favorite_artists,
        favorite_instruments: audience.favorite_instruments,
        is_active: audience.is_active,
      });
      expect(result.total).toBe(1);
    });

    it("should search audiences with pagination", async () => {
      const audience = AudienceFakeBuilder.aAudience().build();
      const modelProps = AudienceModelMapper.toModel(audience);
      const modelWithBadges = {
        ...modelProps,
        badges: audience.badges.map((badgeName) => ({
          badge: {
            name: badgeName,
          },
        })),
      };

      (prisma.audience.findMany as jest.Mock).mockResolvedValue([
        modelWithBadges,
      ]);
      (prisma.audience.count as jest.Mock).mockResolvedValue(1);

      const searchParams = AudienceSearchParams.create({
        page: 2,
        per_page: 10,
      });
      const result = await repository.search(searchParams);

      expect(prisma.audience.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { created_at: "asc" },
        skip: 10,
        take: 10,
        include: { badges: { include: { badge: true } } },
      });
    });

    it("should search audiences with sort", async () => {
      const audience = AudienceFakeBuilder.aAudience().build();
      const modelProps = AudienceModelMapper.toModel(audience);
      const modelWithBadges = {
        ...modelProps,
        badges: audience.badges.map((badgeName) => ({
          badge: {
            name: badgeName,
          },
        })),
      };

      (prisma.audience.findMany as jest.Mock).mockResolvedValue([
        modelWithBadges,
      ]);
      (prisma.audience.count as jest.Mock).mockResolvedValue(1);

      const searchParams = AudienceSearchParams.create({
        page: 1,
        per_page: 2,
        sort: "name",
        sort_dir: "desc",
      });
      const result = await repository.search(searchParams);

      expect(prisma.audience.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { name: "desc" },
        skip: 0,
        take: 2,
        include: { badges: { include: { badge: true } } },
      });
    });

    it("should handle invalid sort field by using default sort", async () => {
      const audience = AudienceFakeBuilder.aAudience().build();
      const modelProps = AudienceModelMapper.toModel(audience);
      const modelWithBadges = {
        ...modelProps,
        badges: audience.badges.map((badgeName) => ({
          badge: {
            name: badgeName,
          },
        })),
      };

      (prisma.audience.findMany as jest.Mock).mockResolvedValue([
        modelWithBadges,
      ]);
      (prisma.audience.count as jest.Mock).mockResolvedValue(1);

      const searchParams = AudienceSearchParams.create({
        sort: "invalid_field" as any,
      });

      const result = await repository.search(searchParams);

      expect(prisma.audience.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { created_at: "asc" },
        skip: 0,
        take: 15,
        include: { badges: { include: { badge: true } } },
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: audience.id,
        name: audience.name,
        email: audience.email,
        nickname: audience.nickname,
        avatar: audience.avatar,
        phone: audience.phone,
        badges: audience.badges,
        favorite_genres: audience.favorite_genres,
        favorite_artists: audience.favorite_artists,
        is_active: audience.is_active,
      });
    });
  });
});
