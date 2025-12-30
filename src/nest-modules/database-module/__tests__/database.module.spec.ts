jest.mock("@prisma/adapter-pg", () => ({
  PrismaPg: jest.fn().mockImplementation(({ connectionString }) => ({
    connectionString,
  })),
}));

jest.mock("@prisma/client", () => {
  class PrismaClient {
    public options: any;
    public $on: any;
    public $connect: any;
    public $disconnect: any;
    public $queryRaw: any;
    public $queryRawUnsafe: any;
    public $executeRawUnsafe: any;

    constructor(options: any) {
      this.options = options;
      this.$on = jest.fn();
      this.$connect = jest.fn();
      this.$disconnect = jest.fn();
      this.$queryRaw = jest.fn();
      this.$queryRawUnsafe = jest.fn();
      this.$executeRawUnsafe = jest.fn();
    }
  }

  return {
    PrismaClient,
    Prisma: {},
  };
});

import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  createMongoConnectionOptions,
  createRedisCacheOptions,
} from "../database.module";
import { PrismaService } from "../prisma/prisma.service";

function createConfigService(values: Record<string, any>) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as any;
}

describe("DatabaseModule Unit Tests", () => {
  beforeEach(() => {
    jest.mocked(PrismaPg).mockClear();
  });

  describe("mongodb connection", () => {
    it("should configure MongooseModule using MONGODB_URL", () => {
      const configService = createConfigService({
        MONGODB_URL: "mongodb://localhost:27017/soundmeet",
      });

      const options = createMongoConnectionOptions(configService);
      expect(options).toEqual({
        uri: "mongodb://localhost:27017/soundmeet",
        retryWrites: true,
        w: "majority",
      });
    });
  });

  describe("redis cache", () => {
    it("should parse REDIS_URL with password and port", async () => {
      const configService = createConfigService({
        REDIS_URL: "redis://:pass@redis-host:6380",
      });

      const options = await createRedisCacheOptions(configService);
      expect(options.host).toBe("redis-host");
      expect(options.port).toBe(6380);
      expect(options.password).toBe("pass");
      expect(options.ttl).toBe(300);
    });

    it("should default port to 6379 and password to undefined", async () => {
      const configService = createConfigService({
        REDIS_URL: "redis://redis-host",
      });

      const options = await createRedisCacheOptions(configService);
      expect(options.host).toBe("redis-host");
      expect(options.port).toBe(6379);
      expect(options.password).toBeUndefined();
    });
  });

  describe("prisma service", () => {
    it("should provide PrismaService when module is compiled", async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          PrismaService,
          {
            provide: ConfigService,
            useValue: createConfigService({
              NODE_ENV: "test",
              DATABASE_URL: "postgresql://user:pass@localhost:5432/soundmeet",
              PRISMA_LOG_QUERIES: false,
            }),
          },
        ],
      }).compile();

      const prisma = moduleRef.get(PrismaService);
      expect(prisma).toBeDefined();
    });

    it("should configure PrismaPg using DATABASE_URL", () => {
      const configService = createConfigService({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/soundmeet",
        PRISMA_LOG_QUERIES: false,
      });

      new PrismaService(configService);
      expect(PrismaPg).toHaveBeenCalledWith({
        connectionString: "postgresql://user:pass@localhost:5432/soundmeet",
      });
    });

    it("should register query listener when PRISMA_LOG_QUERIES is true", () => {
      const configService = createConfigService({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/soundmeet",
        PRISMA_LOG_QUERIES: true,
      });

      const prisma = new PrismaService(configService) as any;
      expect(prisma.$on).toHaveBeenCalledWith("query", expect.any(Function));
    });

    it("should not register query listener when PRISMA_LOG_QUERIES is false", () => {
      const configService = createConfigService({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/soundmeet",
        PRISMA_LOG_QUERIES: false,
      });

      const prisma = new PrismaService(configService) as any;
      expect(prisma.$on).not.toHaveBeenCalledWith(
        "query",
        expect.any(Function),
      );
    });

    it("should block cleanDatabase outside test environment", async () => {
      const configService = createConfigService({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/soundmeet",
        PRISMA_LOG_QUERIES: false,
      });

      const prisma = new PrismaService(configService);
      await expect(prisma.cleanDatabase()).rejects.toThrow(
        "cleanDatabase can only be used in test environment",
      );
    });

    it("should clean all tables except _prisma_migrations in test environment", async () => {
      const configService = createConfigService({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/soundmeet",
        PRISMA_LOG_QUERIES: false,
      });

      const prisma = new PrismaService(configService) as any;
      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([
          { tablename: "users" },
          { tablename: "_prisma_migrations" },
          { tablename: "musicians" },
        ]);
      prisma.$executeRawUnsafe = jest.fn().mockResolvedValue(undefined);

      await prisma.cleanDatabase();

      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        'TRUNCATE TABLE "public"."users", "public"."musicians" CASCADE;',
      );
    });
  });
});
