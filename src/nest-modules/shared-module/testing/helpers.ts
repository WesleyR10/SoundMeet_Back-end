import { INestApplication } from "@nestjs/common";
import { ModuleMetadata } from "@nestjs/common/interfaces";
import { Test, TestingModule, TestingModuleBuilder } from "@nestjs/testing";

import { applyGlobalConfig } from "../../global-config";

/**
 * Transformação aplicada ao builder antes do `compile()`, para o teste
 * sobrescrever providers/guards. O caso comum é `applyAuthGuardMocks`
 * (`./auth-guard-mock`), já usado pelos `.int-spec.ts` dos controllers.
 */
export type TestingModuleConfigurer = (
  builder: TestingModuleBuilder,
) => TestingModuleBuilder;

export function startApp(
  moduleMetadata: ModuleMetadata,
  configure?: TestingModuleConfigurer,
) {
  let _app: INestApplication;

  beforeEach(async () => {
    const builder = Test.createTestingModule(moduleMetadata);
    const moduleFixture: TestingModule = await (
      configure ? configure(builder) : builder
    ).compile();

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
