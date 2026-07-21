import axios from "axios";

import {
  GeocodeQuery,
  GeoCoordinates,
  IGeocodingService,
} from "../../domain/geocoding.service";

const REQUEST_TIMEOUT_MS = 5_000;

// Geocodificação best-effort em duas camadas, ambas gratuitas e sem API key:
//   1. BrasilAPI CEP v2 — resolve CEP → coordenadas quando a base tem o dado
//      (cobre a maioria dos CEPs urbanos; é o caminho barato e nacional).
//   2. Nominatim (OpenStreetMap) — busca estruturada por rua/cidade/UF como
//      fallback; exige User-Agent identificado e é rate-limitado (1 req/s),
//      adequado ao volume de atualização de perfil (não é hot path).
// Qualquer falha (timeout, 404, shape inesperado) retorna null — o perfil
// salva sem coordenadas e o músico/estabelecimento só fica de fora do filtro
// por raio até a próxima atualização de endereço.
export class HttpGeocodingService implements IGeocodingService {
  async geocode(query: GeocodeQuery): Promise<GeoCoordinates | null> {
    const viaCep = await this.fromBrasilApiCep(query.zip_code ?? null);
    if (viaCep) return viaCep;
    return this.fromNominatim(query);
  }

  private async fromBrasilApiCep(
    zipCode: string | null,
  ): Promise<GeoCoordinates | null> {
    const cep = (zipCode ?? "").replace(/\D/g, "");
    if (cep.length !== 8) return null;

    try {
      const { data } = await axios.get(
        `https://brasilapi.com.br/api/cep/v2/${cep}`,
        { timeout: REQUEST_TIMEOUT_MS },
      );
      const coordinates = data?.location?.coordinates;
      const latitude = Number(coordinates?.latitude);
      const longitude = Number(coordinates?.longitude);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude };
      }
      return null;
    } catch {
      return null;
    }
  }

  private async fromNominatim(
    query: GeocodeQuery,
  ): Promise<GeoCoordinates | null> {
    if (!query.city) return null;

    const params: Record<string, string> = {
      format: "json",
      limit: "1",
      country: "Brazil",
      city: query.city,
    };
    if (query.state) params.state = query.state;
    if (query.street) {
      params.street = query.number
        ? `${query.number} ${query.street}`
        : query.street;
    }
    if (query.zip_code) params.postalcode = query.zip_code;

    try {
      const { data } = await axios.get(
        "https://nominatim.openstreetmap.org/search",
        {
          params,
          timeout: REQUEST_TIMEOUT_MS,
          headers: { "User-Agent": "SoundMeet/1.0 (contato@soundmeet.com.br)" },
        },
      );
      const first = Array.isArray(data) ? data[0] : null;
      const latitude = Number(first?.lat);
      const longitude = Number(first?.lon);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude };
      }
      return null;
    } catch {
      return null;
    }
  }
}
