import { Test } from "@nestjs/testing";

import { AddRoleUseCase } from "../../../core/auth/application/use-cases/add-role/add-role.use-case";
import {
  FAKE_SESSION_TOKENS,
  makeSessionGateway,
} from "../../../core/auth/application/use-cases/common/session-gateway.testing";
import { LoginUseCase } from "../../../core/auth/application/use-cases/login/login.use-case";
import { LogoutUseCase } from "../../../core/auth/application/use-cases/logout/logout.use-case";
import { RefreshSessionUseCase } from "../../../core/auth/application/use-cases/refresh-session/refresh-session.use-case";
import { RegisterUseCase } from "../../../core/auth/application/use-cases/register/register.use-case";
import { RegisterEstablishmentUseCase } from "../../../core/auth/application/use-cases/register-establishment/register-establishment.use-case";
import { RequestPasswordResetUseCase } from "../../../core/auth/application/use-cases/request-password-reset/request-password-reset.use-case";
import { SocialSignupUseCase } from "../../../core/auth/application/use-cases/social-signup/social-signup.use-case";
import { IdentityProviderInvalidCredentialsError } from "../../../core/auth/infra/gateways/identity-provider-gateway.interface";
import { UnauthorizedError } from "../../../core/shared/domain/errors/unauthorized.error";
import { applyAuthGuardMocks } from "../../shared-module/testing/auth-guard-mock";
import { AuthController } from "../auth.controller";
import { VerifyEmailService } from "../verify-email.service";

describe("AuthController — sessão do login por senha (AUTH-3)", () => {
  let controller: AuthController;
  let gateway: ReturnType<typeof makeSessionGateway>;

  beforeEach(async () => {
    gateway = makeSessionGateway();
    const stub = { execute: jest.fn() };

    const moduleRef = await applyAuthGuardMocks(
      Test.createTestingModule({
        controllers: [AuthController],
        providers: [
          { provide: VerifyEmailService, useValue: {} },
          { provide: RegisterUseCase, useValue: stub },
          { provide: RegisterEstablishmentUseCase, useValue: stub },
          { provide: SocialSignupUseCase, useValue: stub },
          { provide: AddRoleUseCase, useValue: stub },
          {
            provide: LoginUseCase,
            useFactory: () => new LoginUseCase(gateway),
          },
          {
            provide: RefreshSessionUseCase,
            useFactory: () => new RefreshSessionUseCase(gateway),
          },
          {
            provide: LogoutUseCase,
            useFactory: () => new LogoutUseCase(gateway),
          },
          {
            provide: RequestPasswordResetUseCase,
            useFactory: () => new RequestPasswordResetUseCase(gateway),
          },
        ],
      }),
    ).compile();

    controller = moduleRef.get(AuthController);
  });

  it("login devolve a sessão", async () => {
    gateway.authenticateWithPassword.mockResolvedValue(FAKE_SESSION_TOKENS);

    await expect(
      controller.login({ email: "a@b.com", password: "Seed@123" }),
    ).resolves.toEqual(FAKE_SESSION_TOKENS);
  });

  it("login recusado vira UnauthorizedError (401 no filtro global)", async () => {
    gateway.authenticateWithPassword.mockRejectedValue(
      new IdentityProviderInvalidCredentialsError(),
    );

    await expect(
      controller.login({ email: "a@b.com", password: "errada" }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("refresh repassa o token ao provedor", async () => {
    gateway.refreshSession.mockResolvedValue(FAKE_SESSION_TOKENS);

    await controller.refresh({ refresh_token: "r" });

    expect(gateway.refreshSession).toHaveBeenCalledWith("r");
  });

  it("logout resolve mesmo com o provedor fora", async () => {
    gateway.revokeSession.mockRejectedValue(new Error("down"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      controller.logout({ refresh_token: "r" }),
    ).resolves.toBeUndefined();
    spy.mockRestore();
  });

  it("forgot-password responde a mensagem genérica", async () => {
    gateway.sendPasswordResetEmail.mockResolvedValue(undefined);

    const result = await controller.forgotPassword({ email: "a@b.com" });

    expect(result.message).toMatch(/Se houver uma conta/);
  });
});
