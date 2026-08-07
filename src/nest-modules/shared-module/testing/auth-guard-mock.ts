import { ExecutionContext } from "@nestjs/common";
import { TestingModuleBuilder } from "@nestjs/testing";

import { AuthGuard, AuthUser, RolesGuard } from "../../auth-module";

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

/** Claims de um músico autenticado, no formato que o Keycloak entrega. */
export function musicianAuthUser(musicianId: string): AuthUser {
  return {
    sub: musicianId,
    roles: ["musician"],
    realm_access: { roles: ["musician"] },
  };
}

/**
 * Igual ao `applyAuthGuardMocks`, mas o duplê do `AuthGuard` também popula
 * `request.user` — como o guard real faz depois de validar o JWT.
 *
 * Necessário para rotas que leem `@CurrentUser()`: quem preenche
 * `request.currentUser` é o `CurrentUserContextGuard`, derivando de
 * `request.user`. Esse guard **não** é mockado de propósito — não tem
 * dependências e é a lógica de derivação de claims que vale exercitar de
 * verdade; mockar só a fronteira (verificação do token) mantém o teste
 * honesto. Sem isso, `@CurrentUser()` chega `undefined` e a rota estoura 500.
 */
export function applyAuthGuardMocksAs(
  user: AuthUser,
): (moduleBuilder: TestingModuleBuilder) => TestingModuleBuilder {
  const authGuardMock = {
    canActivate: (context: ExecutionContext) => {
      if (context.getType() !== "http") {
        return true;
      }
      context.switchToHttp().getRequest().user = user;
      return true;
    },
  };

  return (moduleBuilder) =>
    moduleBuilder
      .overrideGuard(AuthGuard)
      .useValue(authGuardMock)
      .overrideGuard(RolesGuard)
      .useValue(ROLES_GUARD_MOCK_VALUE);
}
