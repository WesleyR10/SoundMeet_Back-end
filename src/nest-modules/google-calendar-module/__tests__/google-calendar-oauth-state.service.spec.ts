import { Uuid } from "../../../core/shared/domain/value-objects/uuid.vo";
import {
  GoogleCalendarOAuthStateService,
  InvalidOAuthStateError,
} from "../google-calendar-oauth-state.service";

describe("GoogleCalendarOAuthStateService", () => {
  const service = new GoogleCalendarOAuthStateService("test-secret");
  const musician_id = new Uuid().id;

  it("assina e verifica round-trip", () => {
    const state = service.sign(musician_id);

    expect(service.verify(state)).toEqual({ musician_id });
  });

  it("gera nonce diferente a cada assinatura", () => {
    expect(service.sign(musician_id)).not.toBe(service.sign(musician_id));
  });

  it("rejeita state adulterado (payload trocado, assinatura antiga)", () => {
    const state = service.sign(musician_id);
    const [, signature] = state.split(".");
    const forged = Buffer.from(
      JSON.stringify({
        musician_id: new Uuid().id,
        nonce: "x",
        exp: Date.now() + 60_000,
        purpose: "gcal_connect",
      }),
    ).toString("base64url");

    expect(() => service.verify(`${forged}.${signature}`)).toThrow(
      InvalidOAuthStateError,
    );
  });

  it("rejeita state assinado com outro secret", () => {
    const other = new GoogleCalendarOAuthStateService("outro-secret");
    const state = other.sign(musician_id);

    expect(() => service.verify(state)).toThrow(InvalidOAuthStateError);
  });

  it("rejeita state expirado", () => {
    jest.useFakeTimers();
    const state = service.sign(musician_id);
    jest.advanceTimersByTime(11 * 60 * 1000);

    expect(() => service.verify(state)).toThrow(InvalidOAuthStateError);
    jest.useRealTimers();
  });

  it("rejeita formatos malformados", () => {
    expect(() => service.verify("")).toThrow(InvalidOAuthStateError);
    expect(() => service.verify("sem-ponto")).toThrow(InvalidOAuthStateError);
    expect(() => service.verify("a.b")).toThrow(InvalidOAuthStateError);
  });

  it("exige secret não-vazio na construção", () => {
    expect(() => new GoogleCalendarOAuthStateService("")).toThrow(
      /secret não-vazio/,
    );
  });
});
