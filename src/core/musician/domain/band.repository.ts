import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { Currency } from "../../shared/domain/value-objects/money.vo";
import { PriceModel } from "../../shared/domain/value-objects/price-range.vo";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { Band, BandId, BandMemberStatus } from "./band.aggregate";

export type BandFilter = {
  name?: string | null;
  genres?: string[] | null;
  price_model?: PriceModel | null;
  price_min?: number | null;
  price_max?: number | null;
  price_currency?: Currency | null;
  is_active?: boolean | null;
  // Consentimento explícito do líder — ListBandsUseCase força true
  // incondicionalmente (mesmo raciocínio de MusicianFilter.open_to_gigs).
  open_to_gigs?: boolean | null;
  // Busca por proximidade — paridade com MusicianFilter (7.13c): só entra
  // com o trio completo; ordenação por distância no repositório.
  lat?: number | null;
  lng?: number | null;
  radius_km?: number | null;
  // Bandas onde o músico é integrante ACEITO. Uso interno (currículo do
  // músico): NÃO é filtro da busca pública — por HTTP ele listava bandas fora
  // do radar e contornava o opt-in. "Minhas bandas" é `findByMember`.
  musician_id?: string | null;
};

const isPriceModel = (value: unknown): value is PriceModel => {
  return value === "per_event" || value === "per_hour";
};

const isCurrency = (value: unknown): value is Currency => {
  return (Object.values(Currency) as string[]).includes(value as string);
};

export class BandSearchParams extends DefaultSearchParams<BandFilter> {
  private constructor(props: SearchParamsConstructorProps<BandFilter> = {}) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<BandFilter> = {}) {
    return new BandSearchParams(props);
  }

  // Gate de descoberta — mesmo raciocínio de MusicianSearchParams.createPublic:
  // único ponto de aplicação, sempre vence o filtro do chamador.
  //
  // Duas condições, e as duas são do líder: `open_to_gigs` é o consentimento
  // para aparecer; `is_active` falso é banda dissolvida (arquivada), que não
  // pode ser sugerida a um estabelecimento como se ainda tocasse.
  static createPublic(props: SearchParamsConstructorProps<BandFilter> = {}) {
    return new BandSearchParams({
      ...props,
      filter: { ...(props.filter ?? {}), open_to_gigs: true, is_active: true },
    });
  }

  get filter(): BandFilter | null {
    return this._filter;
  }

  protected set filter(value: BandFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value && _value.name && { name: `${_value?.name}` }),
      ...(_value && _value.genres && { genres: _value.genres }),
      ...(_value &&
        isPriceModel((_value as any).price_model) && {
          price_model: (_value as any).price_model,
        }),
      ...(_value &&
        _value.price_min !== null &&
        _value.price_min !== undefined &&
        Number.isFinite(_value.price_min) && { price_min: _value.price_min }),
      ...(_value &&
        _value.price_max !== null &&
        _value.price_max !== undefined &&
        Number.isFinite(_value.price_max) && { price_max: _value.price_max }),
      ...(_value &&
        isCurrency((_value as any).price_currency) && {
          price_currency: (_value as any).price_currency,
        }),
      ...(_value &&
        typeof _value.is_active === "boolean" && {
          is_active: _value.is_active,
        }),
      ...(_value &&
        typeof _value.open_to_gigs === "boolean" && {
          open_to_gigs: _value.open_to_gigs,
        }),
      ...(_value &&
        Number.isFinite(Number(_value.lat)) &&
        Number.isFinite(Number(_value.lng)) &&
        Number(_value.radius_km) > 0 && {
          lat: Number(_value.lat),
          lng: Number(_value.lng),
          radius_km: Math.min(Number(_value.radius_km), 500),
        }),
      ...(_value &&
        _value.musician_id && {
          musician_id: `${_value.musician_id}`,
        }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class BandSearchResult extends DefaultSearchResult<Band> {}

export interface IBandRepository extends ISearchableRepository<
  Band,
  BandId,
  BandFilter,
  BandSearchParams,
  BandSearchResult
> {
  /**
   * As bandas em que o músico tem linha de integrante num dos `statuses`.
   *
   * É a consulta de "Minhas bandas": aceitas E convites pendentes saem da
   * mesma leitura. Não passa pelo gate de `open_to_gigs` nem por `is_active` —
   * o músico vê as próprias bandas, no radar ou não, arquivadas ou não.
   */
  findByMember(
    musician_id: Uuid,
    statuses: BandMemberStatus[],
  ): Promise<Band[]>;
}
