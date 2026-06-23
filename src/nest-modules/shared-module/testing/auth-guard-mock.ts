import { TestingModuleBuilder } from "@nestjs/testing";

import { AuthGuard, RolesGuard } from "../../auth-module";

export const AUTH_GUARD_MOCK_VALUE = { canActivate: jest.fn(() => true) };
export const ROLES_GUARD_MOCK_VALUE = { canActivate: jest.fn(() => true) };

export const UOW_MOCK_VALUE = {
  do: async (fn: () => Promise<unknown>) => fn(),
};

export function applyAuthGuardMocks(
  moduleBuilder: TestingModuleBuilder,
): TestingModuleBuilder {
  return moduleBuilder
    .overrideGuard(AuthGuard)
    .useValue(AUTH_GUARD_MOCK_VALUE)
    .overrideGuard(RolesGuard)
    .useValue(ROLES_GUARD_MOCK_VALUE);
}
