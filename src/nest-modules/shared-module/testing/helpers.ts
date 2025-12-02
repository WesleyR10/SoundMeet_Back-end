import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "../../../app.module";
import { applyGlobalConfig } from "../../global-config";
import { PrismaService } from "../../database-module/prisma/prisma.service";
import { DatabaseModule } from "../../database-module/database.module";
import { DatabaseTestModule } from "../../database-module/database-test.module";

export function startApp() {
  let _app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(DatabaseModule)
      .useModule(DatabaseTestModule)
      .compile();

    const prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Clean database for tests (only if connected)
    try {
      await prisma.$executeRaw`TRUNCATE TABLE "musicians" RESTART IDENTITY CASCADE`;
    } catch (error) {
      console.warn(
        "Database cleanup failed, continuing with tests:",
        error.message,
      );
    }

    _app = moduleFixture.createNestApplication();
    applyGlobalConfig(_app);
    await _app.init();
  });

  afterEach(async () => {
    await _app?.close();
  });

  return {
    get app() {
      return _app;
    },
  };
}
