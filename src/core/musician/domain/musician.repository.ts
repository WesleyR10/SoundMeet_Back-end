import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { Currency } from "../../shared/domain/value-objects/money.vo";
import { PriceModel } from "../../shared/domain/value-objects/price-range.vo";
import { Musician, MusicianId } from "./musician.aggregate";

export type MusicianFilter = {
  name?: string | null;
  /**
   * Restringe a busca a um conjunto fechado de ids.
   *
   * Existe para a faixa "Em destaque" da grade de artistas: os ids vêm do
   * repositório de assinaturas e entram aqui, para que o resultado atravesse
   * o MESMO gate de consentimento (`createPublic`) e a mesma ordenação da
   * busca normal. Um `findManyByIds` paralelo teria de reimplementar
   * `open_to_gigs`, e a segunda implementação é onde o gate se perde.
   *
   * 🔴 Lista VAZIA não é "sem filtro": é "nenhum id", e tem de devolver zero
   * resultados. Ver a checagem explícita de `length` no setter abaixo.
   */
  ids?: string[] | null;
  stage_name?: string | null;
  email?: string | null;
  genres?: string[] | null;
  instruments?: string[] | null;
  price_model?: PriceModel | null;
  price_min?: number | null;
  price_max?: number | null;
  price_currency?: Currency | null;
  is_active?: boolean | null;
  is_verified?: boolean | null;
  // Consentimento explícito para aparecer em busca de estabelecimentos —
  // ListMusiciansUseCase força true incondicionalmente (não é preferência
  // de busca opcional, é gate de consentimento).
  open_to_gigs?: boolean | null;
  // Busca por proximidade (7.13c) — mesmo contrato de EstablishmentFilter:
  // só entra com o trio completo; ordenação por distância no repositório.
  lat?: number | null;
  lng?: number | null;
  radius_km?: number | null;
};

const isPriceModel = (value: unknown): value is PriceModel => {
  return value === "per_event" || value === "per_hour";
};

const isCurrency = (value: unknown): value is Currency => {
  return (Object.values(Currency) as string[]).includes(value as string);
};

export class MusicianSearchParams extends DefaultSearchParams<MusicianFilter> {
  private constructor(
    props: SearchParamsConstructorProps<MusicianFilter> = {},
  ) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<MusicianFilter> = {}) {
    return new MusicianSearchParams(props);
  }

  // Gate de consentimento — único ponto de aplicação de "só músicos com
  // open_to_gigs=true aparecem em busca pública/de estabelecimento". Use
  // SEMPRE este método (nunca `create`) em qualquer use case que exponha
  // músicos a estabelecimentos (radar, dashboard de contratação, indicação).
  // O filtro do chamador entra primeiro no spread — open_to_gigs: true por
  // último sempre vence, nenhuma query consegue contornar o gate.
  static createPublic(
    props: SearchParamsConstructorProps<MusicianFilter> = {},
  ) {
    return new MusicianSearchParams({
      ...props,
      filter: { ...(props.filter ?? {}), open_to_gigs: true },
    });
  }

  get filter(): MusicianFilter | null {
    return this._filter;
  }

  protected set filter(value: MusicianFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value && _value.name && { name: `${_value?.name}` }),
      /*
       * 🔴 `Array.isArray`, e NÃO truthiness. Um `_value.ids && {...}` deixaria
       * `[]` passar (array vazio é truthy) — o que é o certo aqui —, mas um
       * `_value.ids?.length && {...}` descartaria a lista vazia e o filtro
       * sairia da query: a faixa "Em destaque" passaria a mostrar TODOS os
       * músicos, sem erro nenhum. É exatamente o vazamento que o override
       * deste setter existe para evitar (registrado no CLAUDE.md a partir de
       * `repertoire`), só que ao contrário: aqui o perigo é o filtro sumir
       * justamente quando não há ninguém para destacar.
       */
      ...(_value &&
        Array.isArray(_value.ids) && {
          ids: _value.ids.map((id) => `${id}`),
        }),
      ...(_value &&
        _value.stage_name && { stage_name: `${_value?.stage_name}` }),
      ...(_value && _value.email && { email: `${_value?.email}` }),
      ...(_value && _value.genres && { genres: _value.genres }),
      ...(_value && _value.instruments && { instruments: _value.instruments }),
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
        typeof _value.is_verified === "boolean" && {
          is_verified: _value.is_verified,
        }),
      ...(_value &&
        typeof _value.open_to_gigs === "boolean" && {
          open_to_gigs: _value.open_to_gigs,
        }),
      // Coerção explícita (query string entrega strings) — só entra com o
      // trio completo e válido; raio máximo sanitizado em 500km.
      ...(_value &&
        Number.isFinite(Number(_value.lat)) &&
        Number.isFinite(Number(_value.lng)) &&
        Number(_value.radius_km) > 0 && {
          lat: Number(_value.lat),
          lng: Number(_value.lng),
          radius_km: Math.min(Number(_value.radius_km), 500),
        }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class MusicianSearchResult extends DefaultSearchResult<Musician> {}

export interface IMusicianRepository extends ISearchableRepository<
  Musician,
  MusicianId,
  MusicianFilter,
  MusicianSearchParams,
  MusicianSearchResult
> {
  findByEmail(email: string): Promise<Musician | null>;
  findByCpf(cpf: string): Promise<Musician | null>;
  findByCnpj(cnpj: string): Promise<Musician | null>;
  findByPhone(phone: string): Promise<Musician | null>;
}
