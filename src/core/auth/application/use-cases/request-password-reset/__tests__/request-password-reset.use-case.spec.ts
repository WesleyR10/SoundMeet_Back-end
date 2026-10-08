import { IdentityProviderUnavailableError } from "../../../../infra/gateways/identity-provider-gateway.interface";
import { makeSessionGateway } from "../../common/session-gateway.testing";
import {
  PASSWORD_RESET_REQUESTED_MESSAGE,
  RequestPasswordResetUseCase,
} from "../request-password-reset.use-case";

describe("RequestPasswordResetUseCase Unit Tests", () => {
  it("pede o envio com o e-mail normalizado", async () => {
    const gateway = makeSessionGateway();
    gateway.sendPasswordResetEmail.mockResolvedValue(undefined);

    await new RequestPasswordResetUseCase(gateway).execute({
      email: " Joao@SoundMeet.dev ",
    });

    expect(gateway.sendPasswordResetEmail).toHaveBeenCalledWith(
      "joao@soundmeet.dev",
    );
  });

  it("responde IGUAL quando o envio falha — senão o erro só aparece para e-mail cadastrado", async () => {
    const ok = makeSessionGateway();
    ok.sendPasswordResetEmail.mockResolvedValue(undefined);
    const failing = makeSessionGateway();
    failing.sendPasswordResetEmail.mockRejectedValue(
      new IdentityProviderUnavailableError(),
    );
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    const a = await new RequestPasswordResetUseCase(ok).execute({
      email: "existe@soundmeet.dev",
    });
    const b = await new RequestPasswordResetUseCase(failing).execute({
      email: "existe@soundmeet.dev",
    });

    expect(a).toEqual(b);
    expect(a).toEqual({ message: PASSWORD_RESET_REQUESTED_MESSAGE });
    spy.mockRestore();
  });
});
