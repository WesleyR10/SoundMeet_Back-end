import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ConfigService } from "@nestjs/config";
import { ConfigSchemaType } from "../../config-module/config.schema";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigSchemaType) {
    const adapter = new PrismaPg({
      connectionString: configService.get("DATABASE_URL"),
    });

    super({
      adapter,
      log: [
        {
          emit: "event",
          level: "query",
        },
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
      ],
    });

    // Log queries in development
    if (configService.get("NODE_ENV") === "development") {
      this.$on("query" as any, (e: any) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Params: ${e.params}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    this.$on("error" as any, (e: any) => {
      this.logger.error("Prisma Error:", e);
    });

    this.$on("warn" as any, (e: any) => {
      this.logger.warn("Prisma Warning:", e);
    });

    this.$on("info" as any, (e: any) => {
      this.logger.log("Prisma Info:", e);
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log("✅ Connected to PostgreSQL database");
    } catch (error) {
      this.logger.error("❌ Failed to connect to PostgreSQL database:", error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log("✅ Disconnected from PostgreSQL database");
    } catch (error) {
      this.logger.error(
        "❌ Error disconnecting from PostgreSQL database:",
        error,
      );
    }
  }

  /**
   * Clean database for testing purposes
   */
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
      this.logger.log("🧹 Database cleaned successfully");
    } catch (error) {
      this.logger.error("❌ Error cleaning database:", error);
      throw error;
    }
  }

  /**
   * Execute raw SQL with logging
   */
  async executeRaw(sql: string, ...values: any[]) {
    this.logger.debug(`Executing raw SQL: ${sql}`);
    return this.$executeRawUnsafe(sql, ...values);
  }

  /**
   * Query raw SQL with logging
   */
  async queryRaw<T = unknown>(sql: string, ...values: any[]): Promise<T> {
    this.logger.debug(`Querying raw SQL: ${sql}`);
    return this.$queryRawUnsafe(sql, ...values);
  }
}
