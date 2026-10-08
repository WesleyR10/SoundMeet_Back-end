import { haversineKm } from "../../shared/domain/geo.utils";

/**
 * A grade em que a posição de um músico existe PARA TERCEIROS.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE NÃO BASTA ARREDONDAR O QUE SAI NO JSON
 * ════════════════════════════════════════════════════════════════════════════
 *
 * O `Location` do músico é o endereço de CASA de uma pessoa (o app preenche
 * por CEP). Esconder a coordenada no presenter resolve só metade: a busca por
 * raio também fala sobre a posição, e fala com precisão. Verificado por HTTP
 * em 08/out/2026, sem token: com a origem 100 m ao norte da casa de um
 * músico, `radius_km=0.09` não o devolvia e `radius_km=0.11` devolvia. Quem
 * move a origem e repete acha a porta em poucas dezenas de requisições — e o
 * mesmo vale para uma distância devolvida em metros.
 *
 * Arredondar a DISTÂNCIA não fecha isso: o ponto em que "2 km" vira "3 km" é
 * um círculo exato em volta da casa. O que fecha é medir a partir de uma
 * posição que já é grossa: aqui toda conta de distância usada na busca
 * pública parte da coordenada ARREDONDADA do músico. O máximo que se recupera
 * por tentativa é o centro da célula (~1 km), não o endereço.
 *
 * Um lugar só define a grade. O filtro por raio, a distância devolvida e
 * qualquer coordenada que um dia volte a sair para terceiros usam ESTA
 * função — duas grades diferentes, sobrepostas, devolveriam a precisão que
 * cada uma sozinha esconde.
 */
export const PUBLIC_COORDINATE_DECIMALS = 2;

/**
 * Quanto a posição grossa pode estar da real: meia diagonal da célula
 * (0,005° ≈ 0,56 km por eixo), com folga. Serve para ALARGAR o pré-filtro por
 * caixa, que roda sobre as colunas exatas.
 */
export const PUBLIC_GRID_MARGIN_KM = 1;

export function toPublicCoordinate(
  value: number | null | undefined,
): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  const factor = 10 ** PUBLIC_COORDINATE_DECIMALS;
  return Math.round(value * factor) / factor;
}

export type GeoPoint =
  | {
      latitude: number | null | undefined;
      longitude: number | null | undefined;
    }
  | null
  | undefined;

/**
 * Distância em km da origem ao ponto MAIS PRÓXIMO da lista, medida na grade
 * pública. `null` quando nenhum ponto tem coordenada.
 *
 * A lista existe por causa do modo turnê: o músico pode ser achado pela base
 * OU pelo ponto de turnê vigente, e a distância que faz sentido mostrar é a
 * do ponto que o trouxe para a busca.
 */
export function publicDistanceKm(
  origin: { lat: number; lng: number },
  points: readonly GeoPoint[],
): number | null {
  const distances: number[] = [];

  for (const point of points) {
    const latitude = toPublicCoordinate(point?.latitude);
    const longitude = toPublicCoordinate(point?.longitude);
    if (latitude === null || longitude === null) continue;
    distances.push(haversineKm(origin.lat, origin.lng, latitude, longitude));
  }

  return distances.length > 0 ? Math.min(...distances) : null;
}

/**
 * O número que SAI: quilômetros inteiros.
 *
 * Uma casa decimal seria precisão falsa — a grade tem ~1 km — e é o tipo de
 * número ("3,4 km") que parece medido da porta.
 */
export function toPublicDistanceKm(distanceKm: number | null): number | null {
  return distanceKm === null ? null : Math.round(distanceKm);
}
