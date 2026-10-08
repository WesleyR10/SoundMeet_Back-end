import { IdentityProviderUnavailableError } from "../../../../infra/gateways/identity-provider-gateway.interface";
import { makeSessionGateway } from "../../common/session-gateway.testing";
import { LogoutUseCase } from "../logout.use-case";

describe("LogoutUseCase Unit Tests", () => {
  it("revoga a sessão no provedor", async () => {
    const gateway = makeSessionGateway();
    gateway.revokeSession.mockResolvedValue(undefined);

    await new LogoutUseCase(gateway).execute({ refresh_token: "r" });

    expect(gateway.revokeSession).toHaveBeenCalledWith("r");
  });

  it("nunca lança — falha do provedor não impede ninguém de sair", async () => {
    const gateway = makeSessionGateway();
    gateway.revokeSession.mockRejectedValue(
      new IdentityProviderUnavailableError(),
    );
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      new LogoutUseCase(gateway).execute({ refresh_token: "r" }),
    ).resolves.toBeUndefined();

    // O token não pode ir para o log junto com a falha.
    expect(JSON.stringify(spy.mock.calls)).not.toContain('"r"');
    spy.mockRestore();
  });
});
