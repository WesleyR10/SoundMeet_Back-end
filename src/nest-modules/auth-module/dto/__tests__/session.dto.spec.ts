import { ValidationPipe } from "@nestjs/common";

import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../../../global-config";
import { LoginDto } from "../login.dto";
import { RefreshSessionDto } from "../refresh-session.dto";
import { RequestPasswordResetDto } from "../request-password-reset.dto";

/**
 * Pipe de PRODUÇÃO (`GLOBAL_VALIDATION_PIPE_OPTIONS`), não uma cópia — ver a
 * nota do INP-1 no CLAUDE.md sobre specs que passavam descrevendo o pipe velho.
 */
const pipe = new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS);

const body = (metatype: new () => unknown) => ({
  type: "body" as const,
  metatype,
  data: "",
});

describe("DTOs de sessão (AUTH-3)", () => {
  it("LoginDto aceita e-mail e senha", async () => {
    await expect(
      pipe.transform({ email: "a@b.com", password: "x" }, body(LoginDto)),
    ).resolves.toMatchObject({ email: "a@b.com" });
  });

  it("LoginDto recusa senha acima de 128 — custo de hash no provedor, não regra de senha", async () => {
    await expect(
      pipe.transform(
        { email: "a@b.com", password: "a".repeat(129) },
        body(LoginDto),
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("LoginDto recusa campo extra (ninguém escolhe client_id ou scope pelo corpo)", async () => {
    await expect(
      pipe.transform(
        { email: "a@b.com", password: "x", client_id: "soundmeet-admin" },
        body(LoginDto),
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("LoginDto recusa e-mail malformado", async () => {
    await expect(
      pipe.transform({ email: "nao-e-email", password: "x" }, body(LoginDto)),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("RefreshSessionDto exige o token e limita o tamanho", async () => {
    await expect(
      pipe.transform({}, body(RefreshSessionDto)),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      pipe.transform(
        { refresh_token: "a".repeat(8193) },
        body(RefreshSessionDto),
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("RequestPasswordResetDto exige e-mail válido", async () => {
    await expect(
      pipe.transform({ email: "x" }, body(RequestPasswordResetDto)),
    ).rejects.toMatchObject({ status: 422 });
  });
});
