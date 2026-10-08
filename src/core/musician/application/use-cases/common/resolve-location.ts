import { IGeocodingService } from "../../../../shared/domain/geocoding.service";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  InvalidLocationError,
  Location,
  LocationProps,
} from "../../../../shared/domain/value-objects/location.vo";

/** Os campos que dizem ONDE fica — os que o geocodificador lê. */
const ADDRESS_TEXT_FIELDS = [
  "street",
  "number",
  "neighborhood",
  "city",
  "state",
] as const;

const normalizeText = (value: string | null | undefined): string =>
  (value ?? "").trim().toLocaleLowerCase();

const onlyDigits = (value: string | null | undefined): string =>
  (value ?? "").replace(/\D/g, "");

const hasCoordinates = (input: LocationProps): boolean =>
  input.latitude !== null &&
  input.latitude !== undefined &&
  input.longitude !== null &&
  input.longitude !== undefined;

/**
 * O endereço escrito mudou em relação ao que está gravado?
 *
 * `complement` fica de fora de propósito: "apto 12" não muda a posição no
 * mapa, e trocá-lo não deve custar uma chamada ao geocodificador.
 */
function addressTextChanged(input: LocationProps, previous: Location): boolean {
  if (onlyDigits(input.zip_code) !== onlyDigits(previous.zip_code)) {
    return true;
  }
  return ADDRESS_TEXT_FIELDS.some(
    (field) => normalizeText(input[field]) !== normalizeText(previous[field]),
  );
}

/**
 * Monta o `Location` que vai ser gravado, resolvendo a coordenada.
 *
 * Geocodificação é best-effort (7.13c): endereço sem coordenada tenta
 * CEP/endereço → coordenada para o perfil entrar na busca por raio, e falha
 * do provedor nunca bloqueia o save — só fica sem coordenada.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 COORDENADA DO CLIENTE NÃO VALE QUANDO O ENDEREÇO MUDOU
 * ════════════════════════════════════════════════════════════════════════════
 *
 * As telas de endereço do app não coletam latitude/longitude: elas devolvem a
 * que receberam (`latitude: initialLocation?.latitude ?? null`). Enquanto a
 * regra aqui era "veio coordenada, não geocodifica", isso tinha dois efeitos,
 * ambos com HTTP 200:
 *
 *  - quem se mudava de São Paulo para o Rio continuava aparecendo nas buscas
 *    de São Paulo, porque o endereço novo viajava com a coordenada antiga;
 *  - banda criada pelo app NUNCA ganhava coordenada (a banda não geocodificava
 *    de jeito nenhum) e ficava fora de toda busca por raio.
 *
 * Por isso a coordenada que chega só é aceita quando é novidade de verdade:
 * primeiro endereço, mesmo endereço, ou um par diferente do gravado (cliente
 * que realmente mediu). Endereço novo com o par antigo é reenvio, e o par é
 * descartado. Se o geocodificador não responder, o resultado é SEM coordenada
 * — sumir da busca por raio é melhor do que aparecer na cidade errada.
 *
 * `field` é o nome do campo no erro de validação (`location`, `address`).
 */
export async function resolveLocation(
  input: LocationProps,
  previous: Location | null | undefined,
  geocodingService: IGeocodingService | undefined,
  field: string,
): Promise<Location> {
  try {
    const moved = !!previous && addressTextChanged(input, previous);
    const coordsAreResend =
      hasCoordinates(input) &&
      !!previous &&
      input.latitude === previous.latitude &&
      input.longitude === previous.longitude;

    if (hasCoordinates(input) && !(moved && coordsAreResend)) {
      return new Location(input);
    }

    const withoutCoords = { ...input, latitude: null, longitude: null };

    if (!geocodingService) {
      return new Location(withoutCoords);
    }

    const coords = await geocodingService.geocode({
      street: input.street,
      number: input.number,
      neighborhood: input.neighborhood,
      city: input.city,
      state: input.state,
      zip_code: input.zip_code,
    });

    return new Location(
      coords
        ? {
            ...input,
            latitude: coords.latitude,
            longitude: coords.longitude,
          }
        : withoutCoords,
    );
  } catch (error) {
    // `InvalidLocationError` é `Error` puro: sem esta tradução, latitude sem
    // longitude virava 500 no `GlobalExceptionFilter`.
    if (error instanceof InvalidLocationError) {
      throw new EntityValidationError([{ [field]: [error.message] }]);
    }
    throw error;
  }
}
