import { ExternalServiceError } from "../../../../../shared/domain/errors/external-service.error";
import { UnauthorizedError } from "../../../../../shared/domain/errors/unauthorized.error";
import {
  IdentityProviderInvalidCredentialsError,
  IdentityProviderUnavailableError,
} from "../../../../infra/gateways/identity-provider-gateway.interface";
import {
  FAKE_SESSION_TOKENS,
  makeSessionGateway,
} from "../../common/session-gateway.testing";
import { INVALID_CREDENTIALS_MESSAGE, LoginUseCase } from "../login.use-case";

describe("LoginUseCase Unit Tests", () => {
  it("devolve só os tokens da sessão", async () => {
    const gateway = makeSessionGateway();
    gateway.authenticateWithPassword.mockResolvedValue(FAKE_SESSION_TOKENS);

    const output = await new LoginUseCase(gateway).execute({
      email: "joao@soundmeet.dev",
      password: "Seed@123",
    });

    expect(output).toEqual(FAKE_SESSION_TOKENS);
  });

  it("normaliza o e-mail (espaço e caixa) antes de ir ao provedor", async () => {
    const gateway = makeSessionGateway();
    gateway.authenticateWithPassword.mockResolvedValue(FAKE_SESSION_TOKENS);

    await new LoginUseCase(gateway).execute({
      email: "  Joao@SoundMeet.dev ",
      password: "Seed@123",
    });

    expect(gateway.authenticateWithPassword).toHaveBeenCalledWith(
      "joao@soundmeet.dev",
      "Seed@123",
    );
  });

  it("recusa credencial inválida com 401 e a mensagem única", async () => {
    const gateway = makeSessionGateway();
    gateway.authenticateWithPassword.mockRejectedValue(
      new IdentityProviderInvalidCredentialsError(),
    );

    const promise = new LoginUseCase(gateway).execute({
      email: "joao@soundmeet.dev",
      password: "errada",
    });

    await expect(promise).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(promise).rejects.toThrow(INVALID_CREDENTIALS_MESSAGE);
  });

  it("provedor fora do ar vira 503, nunca 401 (não é culpa da senha)", async () => {
    const gateway = makeSessionGateway();
    gateway.authenticateWithPassword.mockRejectedValue(
      new IdentityProviderUnavailableError(),
    );

    await expect(
      new LoginUseCase(gateway).execute({
        email: "joao@soundmeet.dev",
        password: "Seed@123",
      }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it("a mensagem de recusa não carrega nada do usuário", () => {
    // Regressão barata contra "E-mail x não encontrado" / "conta bloqueada".
    expect(INVALID_CREDENTIALS_MESSAGE).toBe("E-mail ou senha incorretos");
  });
});
