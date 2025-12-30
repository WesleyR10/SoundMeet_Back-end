import Joi from "joi";
import { join } from "path";
import {
  CONFIG_AUTH_SCHEMA,
  CONFIG_DATABASE_CACHE_SCHEMA,
  CONFIG_ENV_SCHEMA,
  CONFIG_EXTERNAL_APIS_SCHEMA,
  CONFIG_LIMITS_SCHEMA,
  CONFIG_NOTIFICATIONS_SCHEMA,
  CONFIG_PAYMENT_SCHEMA,
  CONFIG_PRISMA_SCHEMA,
  CONFIG_RABBITMQ_SCHEMA,
  CONFIG_STORAGE_SCHEMA,
  ConfigModuleRoot,
} from "../config-module.module";

function expectValidate(schema: Joi.Schema, value: any) {
  const result = schema.validate(value, { abortEarly: false });
  return expect(result.error?.message ?? "");
}

describe("Schema Unit Tests", () => {
  const schema = Joi.object({
    ...CONFIG_ENV_SCHEMA,
    ...CONFIG_DATABASE_CACHE_SCHEMA,
    ...CONFIG_RABBITMQ_SCHEMA,
    ...CONFIG_AUTH_SCHEMA,
    ...CONFIG_STORAGE_SCHEMA,
    ...CONFIG_EXTERNAL_APIS_SCHEMA,
    ...CONFIG_PAYMENT_SCHEMA,
    ...CONFIG_NOTIFICATIONS_SCHEMA,
    ...CONFIG_LIMITS_SCHEMA,
    ...CONFIG_PRISMA_SCHEMA,
  });

  const minimalRequired = {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/soundmeet",
    MONGODB_URL: "mongodb://localhost:27017/soundmeet",
    REDIS_URL: "redis://localhost:6379",
    RABBITMQ_URL: "amqp://localhost:5672",
    KEYCLOAK_URL: "http://localhost:8080",
    KEYCLOAK_CLIENT_ID: "soundmeet-api",
    KEYCLOAK_CLIENT_SECRET: "secret",
    JWT_SECRET: "jwt-secret",
    JWT_REFRESH_SECRET: "jwt-refresh-secret",
  };

  describe("required env vars", () => {
    test("invalid cases", () => {
      expectValidate(schema, {}).toContain('"DATABASE_URL" is required');
      expectValidate(schema, {}).toContain('"MONGODB_URL" is required');
      expectValidate(schema, {}).toContain('"REDIS_URL" is required');
      expectValidate(schema, {}).toContain('"RABBITMQ_URL" is required');
      expectValidate(schema, {}).toContain('"KEYCLOAK_URL" is required');
      expectValidate(schema, {}).toContain('"KEYCLOAK_CLIENT_ID" is required');
      expectValidate(schema, {}).toContain(
        '"KEYCLOAK_CLIENT_SECRET" is required',
      );
      expectValidate(schema, {}).toContain('"JWT_SECRET" is required');
      expectValidate(schema, {}).toContain('"JWT_REFRESH_SECRET" is required');
    });

    test("valid cases", () => {
      expectValidate(schema, minimalRequired).not.toContain("is required");
    });
  });

  describe("NODE_ENV", () => {
    test("invalid cases", () => {
      expectValidate(schema, {
        ...minimalRequired,
        NODE_ENV: "invalid",
      }).toContain('"NODE_ENV" must be one of [development, production, test]');
    });

    test("default case", () => {
      const validated = schema.validate(minimalRequired).value;
      expect(validated.NODE_ENV).toBe("development");
    });
  });

  describe("AWS credentials", () => {
    test("should require keys in production", () => {
      expectValidate(schema, {
        ...minimalRequired,
        NODE_ENV: "production",
      }).toContain('"AWS_ACCESS_KEY_ID" is required');
      expectValidate(schema, {
        ...minimalRequired,
        NODE_ENV: "production",
      }).toContain('"AWS_SECRET_ACCESS_KEY" is required');
    });

    test("should not require keys outside production", () => {
      expectValidate(schema, {
        ...minimalRequired,
        NODE_ENV: "development",
      }).not.toContain("AWS_ACCESS_KEY_ID");
      expectValidate(schema, {
        ...minimalRequired,
        NODE_ENV: "test",
      }).not.toContain("AWS_SECRET_ACCESS_KEY");
    });
  });

  describe("defaults and coercion", () => {
    test("should apply defaults", () => {
      const validated = schema.validate(minimalRequired).value;

      expect(validated.PORT).toBe(3000);
      expect(validated.APP_URL).toBe("https://soundmeet.app");
      expect(validated.RABBITMQ_EXCHANGE).toBe("soundmeet.exchange");
      expect(validated.MINIO_PORT).toBe(9000);
      expect(validated.PRISMA_LOG_QUERIES).toBe(false);
      expect(validated.RATE_LIMIT_TTL).toBe(60);
      expect(validated.RATE_LIMIT_MAX).toBe(100);
      expect(validated.MAX_REQUESTS_PER_USER_PER_EVENT).toBe(5);
      expect(validated.VOTING_INTERVAL_MINUTES).toBe(3);
    });

    test("should coerce booleans and numbers from strings", () => {
      const validated = schema.validate({
        ...minimalRequired,
        PRISMA_LOG_QUERIES: "true",
        MINIO_PORT: "9001",
      }).value;

      expect(validated.PRISMA_LOG_QUERIES).toBe(true);
      expect(validated.MINIO_PORT).toBe(9001);
    });
  });
});

describe("ConfigModuleRoot Unit Tests", () => {
  it("should throw an error when env vars are invalid", async () => {
    await expect(
      ConfigModuleRoot.forRoot({
        envFilePath: join(__dirname, ".env.invalid"),
        ignoreEnvVars: true,
      }),
    ).rejects.toThrow(
      '"NODE_ENV" must be one of [development, production, test]',
    );
  });

  it("should be valid", async () => {
    await expect(
      ConfigModuleRoot.forRoot({
        envFilePath: join(__dirname, ".env.valid"),
        ignoreEnvVars: true,
      }),
    ).resolves.toBeDefined();
  });
});
