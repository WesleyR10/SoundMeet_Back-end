import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export type GoogleCalendarOAuthState = {
  musician_id: string;
  nonce: string;
  exp: number;
  purpose: typeof STATE_PURPOSE;
};

const STATE_PURPOSE = "gcal_connect" as const;
const STATE_TTL_MS = 10 * 60 * 1000;

export class InvalidOAuthStateError extends Error {
  constructor(message = "state do OAuth inválido, expirado ou adulterado") {
    super(message);
    this.name = "InvalidOAuthStateError";
  }
}

/**
 * Assina/verifica o parâmetro `state` do fluxo OAuth (defesa CSRF): HMAC-SHA256
 * sobre `{musician_id, nonce, exp, purpose}` em base64url. O callback vem do
 * navegador redirecionado pelo Google (sem Bearer token) — a autenticidade do
 * musician_id vem inteiramente daqui.
 */
export class GoogleCalendarOAuthStateService {
  constructor(private readonly secret: string) {
    if (!secret || !secret.trim()) {
      throw new Error(
        "GoogleCalendarOAuthStateService requer secret não-vazio (JWT_SECRET)",
      );
    }
  }

  sign(musician_id: string): string {
    const payload: GoogleCalendarOAuthState = {
      musician_id,
      nonce: randomBytes(16).toString("hex"),
      exp: Date.now() + STATE_TTL_MS,
      purpose: STATE_PURPOSE,
    };
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url",
    );
    return `${encoded}.${this.hmac(encoded)}`;
  }

  /** Retorna o musician_id embutido; lança InvalidOAuthStateError se inválido. */
  verify(state: string): { musician_id: string } {
    const [encoded, signature] = (state ?? "").split(".");
    if (!encoded || !signature) {
      throw new InvalidOAuthStateError();
    }

    const expected = Buffer.from(this.hmac(encoded), "utf8");
    const received = Buffer.from(signature, "utf8");
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      throw new InvalidOAuthStateError();
    }

    let payload: GoogleCalendarOAuthState;
    try {
      payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    } catch {
      throw new InvalidOAuthStateError();
    }

    if (
      payload.purpose !== STATE_PURPOSE ||
      typeof payload.musician_id !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp < Date.now()
    ) {
      throw new InvalidOAuthStateError();
    }

    return { musician_id: payload.musician_id };
  }

  private hmac(encoded: string): string {
    return createHmac("sha256", this.secret)
      .update(encoded)
      .digest("base64url");
  }
}
