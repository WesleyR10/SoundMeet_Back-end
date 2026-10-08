import { ExternalServiceError } from "../../../../../shared/domain/errors/external-service.error";
import { UnauthorizedError } from "../../../../../shared/domain/errors/unauthorized.error";
import {
  IdentityProviderSessionExpiredError,
  IdentityProviderUnavailableError,
} from "../../../../infra/gateways/identity-provider-gateway.interface";
import {
  FAKE_SESSION_TOKENS,
  makeSessionGateway,
} from "../../common/session-gateway.testing";
import { RefreshSessionUseCase } from "../refresh-session.use-case";

describe("RefreshSessionUseCase Unit Tests", () => {
  it("devolve a sessão renovada", async () => {
    const gateway = makeSessionGateway();
    gateway.refreshSession.mockResolvedValue(FAKE_SESSION_TOKENS);

    await expect(
      new RefreshSessionUseCase(gateway).execute({ refresh_token: "r" }),
    ).resolves.toEqual(FAKE_SESSION_TOKENS);
    expect(gateway.refreshSession).toHaveBeenCalledWith("r");
  });

  it("sessão vencida/revogada vira 401 — o sinal para o app sair", async () => {
    const gateway = makeSessionGateway();
    gateway.refreshSession.mockRejectedValue(
      new IdentityProviderSessionExpiredError(),
    );

    await expect(
      new RefreshSessionUseCase(gateway).execute({ refresh_token: "r" }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("provedor fora do ar vira 503, nunca 401 — uma queda não desloga ninguém", async () => {
    const gateway = makeSessionGateway();
    gateway.refreshSession.mockRejectedValue(
      new IdentityProviderUnavailableError(),
    );

    await expect(
      new RefreshSessionUseCase(gateway).execute({ refresh_token: "r" }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });
});
