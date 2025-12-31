import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import { queryTags } from "@prisma/sqlcommenter-query-tags";
import { traceContext } from "@prisma/sqlcommenter-trace-context";

import { EnvConfig } from "../../config-module/config.schema";

@Injectable()
export class PrismaService
  extends PrismaClient<
    Prisma.PrismaClientOptions,
    "query" | "info" | "warn" | "error"
  >
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService<EnvConfig>) {
    const adapter = new PrismaPg({
      connectionString: configService.get<string>("DATABASE_URL")!,
    });

    const nodeEnv = configService.get<string>("NODE_ENV");
    const logQueriesFlag =
      configService.get<boolean>("PRISMA_LOG_QUERIES") ?? false;

    const shouldLogQueries =
      typeof logQueriesFlag === "boolean"
        ? logQueriesFlag
        : nodeEnv === "development";

    const errorFormat: Prisma.ErrorFormat =
      nodeEnv === "production" ? "minimal" : "pretty";

    const logConfig: Prisma.LogDefinition[] = [
      {
        emit: "event",
        level: "error",
      },
      {
        emit: "event",
        level: "info",
      },
      {
        emit: "event",
        level: "warn",
      },
    ];

    if (shouldLogQueries) {
      logConfig.unshift({
        emit: "event",
        level: "query",
      });
    }

    super({
      adapter,
      errorFormat,
      log: logConfig,
      comments: [queryTags(), traceContext()],
    });

    if (shouldLogQueries) {
      this.$on("query", (e: Prisma.QueryEvent) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Params: ${e.params}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    this.$on("error", (e: Prisma.LogEvent) => {
      this.logger.error("Prisma Error:", e);
    });

    this.$on("warn", (e: Prisma.LogEvent) => {
      this.logger.warn("Prisma Warning:", e);
    });

    this.$on("info", (e: Prisma.LogEvent) => {
      this.logger.log("Prisma Info:", e);
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log("Connected to PostgreSQL database");
    } catch (error) {
      this.logger.error("Failed to connect to PostgreSQL database:", error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log("Disconnected from PostgreSQL database");
    } catch (error) {
      this.logger.error("Error disconnecting from PostgreSQL database:", error);
    }
  }

  async cleanDatabase() {
    if (this.configService.get("NODE_ENV") !== "test") {
      throw new Error("cleanDatabase can only be used in test environment");
    }

    const tablenames = await this.$queryRaw<
      Array<{ tablename: string }>
    >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

    const tables = tablenames
      .map(({ tablename }) => tablename)
      .filter((name) => name !== "_prisma_migrations")
      .map((name) => `"public"."${name}"`)
      .join(", ");

    try {
      await this.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
      this.logger.log("Database cleaned successfully");
    } catch (error) {
      this.logger.error("Error cleaning database:", error);
      throw error;
    }
  }

  async executeRaw(sql: string, ...values: any[]) {
    this.logger.debug(`Executing raw SQL: ${sql}`);
    return this.$executeRawUnsafe(sql, ...values);
  }

  async queryRaw<T = unknown>(sql: string, ...values: any[]): Promise<T> {
    this.logger.debug(`Querying raw SQL: ${sql}`);
    return this.$queryRawUnsafe(sql, ...values);
  }
}
