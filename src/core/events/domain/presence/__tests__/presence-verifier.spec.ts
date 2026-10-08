import { presenceRefusalMessage, PresenceVerifier } from "../presence-verifier";

describe("PresenceVerifier", () => {
  // 0,001° de latitude ≈ 111,2 m em qualquer ponto do globo.
  const VENUE = { latitude: -22.9068, longitude: -43.1729 };
  const at = (dLat: number, accuracy_m = 10, mocked?: boolean) => ({
    latitude: VENUE.latitude + dLat,
    longitude: VENUE.longitude,
    accuracy_m,
    mocked,
  });
  const verifier = new PresenceVerifier({
    radius_m: 250,
    accuracy_tolerance_cap_m: 150,
    max_accuracy_m: 500,
  });

  it("aceita quem está dentro do raio", () => {
    const verdict = verifier.verify(at(0.001), VENUE);
    expect(verdict).toEqual({ kind: "ok", distance_m: 111 });
  });

  it("soma a incerteza do GPS como folga (até o teto)", () => {
    // ~334 m: fora de 250, dentro de 250 + 100.
    expect(verifier.verify(at(0.003, 100), VENUE).kind).toBe("ok");
    expect(verifier.verify(at(0.003, 10), VENUE).kind).toBe("far");
  });

  it("limita a folga: incerteza enorme não estica o raio indefinidamente", () => {
    // ~445 m com incerteza de 450: o teto de 150 dá limite 400.
    const verdict = verifier.verify(at(0.004, 450), VENUE);
    expect(verdict).toMatchObject({ kind: "far", limit_m: 400 });
  });

  it("recusa leitura com incerteza acima do máximo", () => {
    expect(verifier.verify(at(0, 800), VENUE)).toEqual({
      kind: "low_accuracy",
      accuracy_m: 800,
    });
  });

  it("recusa localização simulada mesmo no ponto exato da casa", () => {
    expect(verifier.verify(at(0, 5, true), VENUE).kind).toBe("mocked");
  });

  it("não trata `mocked` ausente (iOS) como simulado", () => {
    expect(verifier.verify(at(0, 5, undefined), VENUE).kind).toBe("ok");
  });

  it("recusa sem leitura", () => {
    expect(verifier.verify(null, VENUE).kind).toBe("no_location");
    expect(verifier.verify(undefined, VENUE).kind).toBe("no_location");
  });

  it("aceita casa sem coordenada (exceção deliberada)", () => {
    const verdict = verifier.verify(null, null);
    expect(verdict.kind).toBe("venue_without_coords");
    expect(PresenceVerifier.isAccepted(verdict)).toBe(true);
  });

  it("só `ok` e `venue_without_coords` são aceitos", () => {
    expect(PresenceVerifier.isAccepted({ kind: "ok", distance_m: 1 })).toBe(
      true,
    );
    for (const verdict of [
      { kind: "no_location" },
      { kind: "mocked" },
      { kind: "low_accuracy", accuracy_m: 900 },
      { kind: "far", distance_m: 900, limit_m: 300 },
    ] as const) {
      expect(PresenceVerifier.isAccepted(verdict)).toBe(false);
      expect(presenceRefusalMessage(verdict)).toEqual(expect.any(String));
    }
  });

  it("a mensagem de recusa por distância não revela a distância", () => {
    const message = presenceRefusalMessage({
      kind: "far",
      distance_m: 3412,
      limit_m: 300,
    });
    expect(message).not.toMatch(/\d/);
    expect(message).toContain("gorjeta");
  });
});
