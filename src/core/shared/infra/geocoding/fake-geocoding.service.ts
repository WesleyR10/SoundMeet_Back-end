import {
  GeocodeQuery,
  GeoCoordinates,
  IGeocodingService,
} from "../../domain/geocoding.service";

// Fake determinístico para testes — devolve as coordenadas configuradas
// (ou null, simulando provedor indisponível/CEP sem dado) e registra as
// queries recebidas para asserções.
export class FakeGeocodingService implements IGeocodingService {
  readonly queries: GeocodeQuery[] = [];

  constructor(private coordinates: GeoCoordinates | null = null) {}

  setCoordinates(coordinates: GeoCoordinates | null) {
    this.coordinates = coordinates;
  }

  async geocode(query: GeocodeQuery): Promise<GeoCoordinates | null> {
    this.queries.push(query);
    return this.coordinates;
  }
}
