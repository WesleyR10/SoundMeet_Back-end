import { boundingBoxForRadius, haversineKm } from "../geo.utils";

describe("geo.utils", () => {
  it("haversineKm computes known distances (SP ↔ RJ ≈ 357km)", () => {
    const distance = haversineKm(-23.5505, -46.6333, -22.9068, -43.1729);
    expect(distance).toBeGreaterThan(350);
    expect(distance).toBeLessThan(370);
  });

  it("haversineKm is 0 for the same point", () => {
    expect(haversineKm(-23.5, -46.6, -23.5, -46.6)).toBe(0);
  });

  it("boundingBoxForRadius contains every point of the circle", () => {
    const lat = -23.5505;
    const lng = -46.6333;
    const radius = 10;
    const box = boundingBoxForRadius(lat, lng, radius);

    // pontos cardeais a 10km devem cair dentro da caixa
    for (const bearing of [0, 90, 180, 270]) {
      const rad = (bearing * Math.PI) / 180;
      const pointLat = lat + (radius / 111.32) * Math.cos(rad);
      const pointLng =
        lng +
        ((radius / (111.32 * Math.cos((lat * Math.PI) / 180))) *
          Math.sin(rad));
      expect(pointLat).toBeGreaterThanOrEqual(box.min_lat - 1e-9);
      expect(pointLat).toBeLessThanOrEqual(box.max_lat + 1e-9);
      expect(pointLng).toBeGreaterThanOrEqual(box.min_lng - 1e-9);
      expect(pointLng).toBeLessThanOrEqual(box.max_lng + 1e-9);
    }
  });
});
