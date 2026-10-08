import { haversineKm } from "../../../shared/domain/geo.utils";
import {
  publicDistanceKm,
  toPublicCoordinate,
  toPublicDistanceKm,
} from "../musician-location-privacy";

describe("grade pública da posição do músico", () => {
  describe("toPublicCoordinate", () => {
    it("arredonda a 2 casas", () => {
      expect(toPublicCoordinate(-23.56284)).toBe(-23.56);
      expect(toPublicCoordinate(-46.65632)).toBe(-46.66);
      expect(toPublicCoordinate(0)).toBe(0);
    });

    it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY])(
      "%p vira null, nunca zero",
      (value) => {
        expect(toPublicCoordinate(value as number | null)).toBeNull();
      },
    );
  });

  /*
   * 🔴 O teste que importa. A casa fica em (-23.5628, -46.654). Com a
   * distância EXATA, mover a origem 20 metros muda quem entra num raio de
   * 1 km — é assim que se acha a porta. Na grade, as duas origens veem o mesmo
   * músico à distância do CENTRO DA CÉLULA.
   */
  describe("publicDistanceKm não revela a posição dentro da célula", () => {
    const origin = { lat: -23.5538, lng: -46.654 };
    // Duas casas diferentes na MESMA célula de 2 casas (-23.56, -46.65).
    const houseA = { latitude: -23.5628, longitude: -46.654 };
    const houseB = { latitude: -23.5571, longitude: -46.6492 };

    it("casas diferentes na mesma célula ficam à MESMA distância", () => {
      expect(publicDistanceKm(origin, [houseA])).toBe(
        publicDistanceKm(origin, [houseB]),
      );
    });

    it("a distância devolvida é a do centro da célula, não a da casa", () => {
      const fromGrid = haversineKm(origin.lat, origin.lng, -23.56, -46.65);
      const fromHouse = haversineKm(origin.lat, origin.lng, -23.5628, -46.654);

      expect(publicDistanceKm(origin, [houseA])).toBeCloseTo(fromGrid, 6);
      expect(publicDistanceKm(origin, [houseA])).not.toBeCloseTo(fromHouse, 2);
    });
  });

  describe("vários pontos (base e turnê)", () => {
    const origin = { lat: -8.05, lng: -34.88 }; // Recife

    it("vale o ponto mais próximo", () => {
      const base = { latitude: -23.55, longitude: -46.63 }; // São Paulo
      const touring = { latitude: -8.06, longitude: -34.87 }; // Recife

      const distance = publicDistanceKm(origin, [base, touring])!;

      expect(distance).toBeLessThan(5);
    });

    it("ponto sem coordenada é ignorado; sem nenhum, null", () => {
      expect(
        publicDistanceKm(origin, [null, { latitude: null, longitude: null }]),
      ).toBeNull();
      expect(publicDistanceKm(origin, [])).toBeNull();
    });
  });

  describe("toPublicDistanceKm", () => {
    it("devolve km inteiros", () => {
      expect(toPublicDistanceKm(3.44)).toBe(3);
      expect(toPublicDistanceKm(3.5)).toBe(4);
      expect(toPublicDistanceKm(0.2)).toBe(0);
    });

    it("null segue null", () => {
      expect(toPublicDistanceKm(null)).toBeNull();
    });
  });
});
