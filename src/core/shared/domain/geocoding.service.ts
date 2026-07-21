// Port de geocodificação (roadmap 7.13c — busca por raio para músicos e
// estabelecimentos). A localização de músico/estabelecimento é uma base fixa
// derivada do endereço cadastrado (CEP → coordenadas) — diferente do público,
// que usa GPS pontual em foreground. Implementações em
// shared/infra/geocoding/ (HTTP real + fake para testes).

export type GeocodeQuery = {
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
};

export type GeoCoordinates = {
  latitude: number;
  longitude: number;
};

export interface IGeocodingService {
  /**
   * Resolve o endereço em coordenadas. Retorna null quando não conseguir
   * (endereço insuficiente, provedor fora do ar, CEP sem coordenadas) —
   * geocodificação é best-effort e NUNCA deve derrubar o fluxo de perfil.
   */
  geocode(query: GeocodeQuery): Promise<GeoCoordinates | null>;
}
