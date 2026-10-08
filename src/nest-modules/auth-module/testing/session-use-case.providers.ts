import { Provider } from "@nestjs/common";

import { LoginUseCase } from "../../../core/auth/application/use-cases/login/login.use-case";
import { LogoutUseCase } from "../../../core/auth/application/use-cases/logout/logout.use-case";
import { RefreshSessionUseCase } from "../../../core/auth/application/use-cases/refresh-session/refresh-session.use-case";
import { RequestPasswordResetUseCase } from "../../../core/auth/application/use-cases/request-password-reset/request-password-reset.use-case";

/**
 * Stubs dos use-cases de sessão (AUTH-3) para specs que montam o
 * `AuthController` à mão mas testam outra rota — o controller os injeta todos.
 */
export function sessionUseCaseStubProviders(): Provider[] {
  return [
    LoginUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    RequestPasswordResetUseCase,
  ].map((useCase) => ({ provide: useCase, useValue: { execute: jest.fn() } }));
}
