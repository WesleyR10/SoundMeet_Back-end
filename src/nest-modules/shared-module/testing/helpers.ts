import { INestApplication } from "@nestjs/common";
import { ModuleMetadata } from "@nestjs/common/interfaces";
import { Test, TestingModule } from "@nestjs/testing";

import { applyGlobalConfig } from "../../global-config";

export function startApp(moduleMetadata: ModuleMetadata) {
  let _app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule(moduleMetadata).compile();

    _app = moduleFixture.createNestApplication();
    applyGlobalConfig(_app);
    _app.setGlobalPrefix("api/v1");
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
