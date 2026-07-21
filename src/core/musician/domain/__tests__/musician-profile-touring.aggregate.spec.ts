import { Uuid } from "../../../shared/domain";
import { Location } from "../../../shared/domain/value-objects/location.vo";
import {
  MAX_TOURING_DAYS,
  MusicianProfile,
} from "../musician-profile.aggregate";

describe("MusicianProfile — modo turnê (7.13d)", () => {
  const now = new Date("2026-07-16T12:00:00.000Z");
  const coords = {
    city: "Recife",
    state: "PE",
    latitude: -8.0476,
    longitude: -34.877,
  };

  const buildProfile = () => new MusicianProfile({ musician_id: new Uuid() });

  it("ativa o modo turnê preservando a base permanente", () => {
    const profile = buildProfile();
    const home = new Location({
      city: "São Paulo",
      state: "SP",
      latitude: -23.55,
      longitude: -46.63,
    });
    profile.changeLocation(home);

    const expiresAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    profile.setTouringLocation(new Location(coords), expiresAt, now);

    expect(profile.notification.hasErrors()).toBe(false);
    expect(profile.location).toBe(home);
    expect(profile.touring_location?.city).toBe("Recife");
    expect(profile.touring_expires_at).toEqual(expiresAt);
    expect(profile.isTouring).toBe(true);
  });

  it("rejeita localização de turnê sem coordenadas", () => {
    const profile = buildProfile();
    const expiresAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    profile.setTouringLocation(
      new Location({ city: "Recife", state: "PE" }),
      expiresAt,
      now,
    );

    expect(profile.notification.hasErrors()).toBe(true);
    expect(profile.notification.toJSON()).toEqual(
      expect.arrayContaining([
        { touring_location: ["Touring location must include coordinates"] },
      ]),
    );
    expect(profile.touring_location).toBeNull();
  });

  it("rejeita expiração no passado", () => {
    const profile = buildProfile();
    const pastExpiry = new Date(now.getTime() - 1000);

    profile.setTouringLocation(new Location(coords), pastExpiry, now);

    expect(profile.notification.hasErrors()).toBe(true);
    expect(profile.notification.toJSON()).toEqual(
      expect.arrayContaining([
        { touring_expires_at: ["touring_expires_at must be in the future"] },
      ]),
    );
  });

  it("rejeita expiração além do teto máximo de dias", () => {
    const profile = buildProfile();
    const tooFar = new Date(
      now.getTime() + (MAX_TOURING_DAYS + 1) * 24 * 60 * 60 * 1000,
    );

    profile.setTouringLocation(new Location(coords), tooFar, now);

    expect(profile.notification.hasErrors()).toBe(true);
    expect(profile.notification.toJSON()).toEqual(
      expect.arrayContaining([
        {
          touring_expires_at: [
            `touring_expires_at cannot exceed ${MAX_TOURING_DAYS} days from now`,
          ],
        },
      ]),
    );
  });

  it("aceita exatamente o teto máximo de dias", () => {
    const profile = buildProfile();
    const exactlyMax = new Date(
      now.getTime() + MAX_TOURING_DAYS * 24 * 60 * 60 * 1000,
    );

    profile.setTouringLocation(new Location(coords), exactlyMax, now);

    expect(profile.notification.hasErrors()).toBe(false);
    expect(profile.touring_expires_at).toEqual(exactlyMax);
  });

  it("clearTouringLocation reverte para só a base permanente", () => {
    const profile = buildProfile();
    const expiresAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    profile.setTouringLocation(new Location(coords), expiresAt, now);

    profile.clearTouringLocation(now);

    expect(profile.touring_location).toBeNull();
    expect(profile.touring_expires_at).toBeNull();
    expect(profile.isTouring).toBe(false);
  });

  it("isTouring é false depois do prazo expirar", () => {
    const profile = buildProfile();
    const expiresAt = new Date(now.getTime() + 1000);
    profile.setTouringLocation(new Location(coords), expiresAt, now);

    // isTouring lê o relógio real — o fixture `now` é fixo no passado, então
    // o relógio precisa ser mockado ANTES da primeira asserção (sem isso o
    // teste era dependente da data em que rodava e quebrou um dia depois).
    jest.useFakeTimers().setSystemTime(new Date(expiresAt.getTime() - 1));
    expect(profile.isTouring).toBe(true);

    jest.setSystemTime(new Date(expiresAt.getTime() + 1));
    expect(profile.isTouring).toBe(false);
    jest.useRealTimers();
  });
});
