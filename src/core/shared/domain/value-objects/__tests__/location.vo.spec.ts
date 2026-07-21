import { InvalidLocationError, Location } from "../location.vo";

describe("Location Value Object Unit Tests", () => {
  it("should create an empty location (all fields null)", () => {
    const location = new Location({});
    expect(location.city).toBeNull();
    expect(location.state).toBeNull();
    expect(location.latitude).toBeNull();
    expect(location.longitude).toBeNull();
    expect(location.street).toBeNull();
    expect(location.zip_code).toBeNull();
  });

  it("should create a location with full address and normalize the CEP", () => {
    const location = new Location({
      city: "São Paulo",
      state: "SP",
      street: "Avenida Paulista",
      number: "1578",
      complement: "Apto 12",
      neighborhood: "Bela Vista",
      zip_code: "01310-200",
    });

    expect(location.zip_code).toBe("01310200");
    expect(location.formattedZipCode).toBe("01310-200");
    expect(location.street).toBe("Avenida Paulista");
    expect(location.neighborhood).toBe("Bela Vista");
  });

  it("should reject a CEP without 8 digits", () => {
    expect(() => new Location({ zip_code: "1234" })).toThrow(
      InvalidLocationError,
    );
  });

  it("should require latitude and longitude together", () => {
    expect(() => new Location({ latitude: -23.55 })).toThrow(
      InvalidLocationError,
    );
    expect(
      () => new Location({ latitude: -23.55, longitude: -46.63 }),
    ).not.toThrow();
  });

  it("should round-trip address fields through toJSON/fromJSON", () => {
    const original = new Location({
      city: "Curitiba",
      state: "PR",
      street: "Rua XV de Novembro",
      number: "100",
      neighborhood: "Centro",
      zip_code: "80020310",
      latitude: -25.43,
      longitude: -49.27,
    });

    const restored = Location.fromJSON(original.toJSON());
    expect(restored.toJSON()).toEqual(original.toJSON());
  });

  it("should keep legacy JSON (only city/state/coordinates) loadable", () => {
    const legacy = Location.fromJSON({
      city: "Rio de Janeiro",
      state: "RJ",
      coordinates: { lat: -22.9, lng: -43.2 },
    });

    expect(legacy.city).toBe("Rio de Janeiro");
    expect(legacy.latitude).toBe(-22.9);
    expect(legacy.street).toBeNull();
    expect(legacy.zip_code).toBeNull();
  });
});
