// Utilidades de geolocalização (roadmap 7.13 — busca por proximidade).
// Haversine puro (mesma fórmula do Address VO) + bounding box para pré-filtro
// barato em SQL antes do cálculo exato de distância.

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type GeoBoundingBox = {
  min_lat: number;
  max_lat: number;
  min_lng: number;
  max_lng: number;
};

/** Caixa que contém o círculo de raio radius_km em torno do ponto — usada
 *  como pré-filtro indexável; o corte exato é o Haversine. */
export function boundingBoxForRadius(
  lat: number,
  lng: number,
  radiusKm: number,
): GeoBoundingBox {
  const latDelta = radiusKm / 111.32; // ~km por grau de latitude
  const lngDelta =
    radiusKm / (111.32 * Math.max(Math.cos((lat * Math.PI) / 180), 1e-6));

  return {
    min_lat: lat - latDelta,
    max_lat: lat + latDelta,
    min_lng: lng - lngDelta,
    max_lng: lng + lngDelta,
  };
}
