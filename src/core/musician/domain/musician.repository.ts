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
  /**
   * Busca livre pelo nome que a TELA mostra: casa com `stage_name` OU `name`.
   *
   * Existe porque `name` e `stage_name` separados obrigavam o cliente a saber
   * em qual coluna o texto digitado mora. A grade de artistas do web mandava
   * `name` (o de cadastro) e exibia o artístico: procurar "Carlão" não achava
   * "Carlão do Piano", cadastrado como "Carlos Teclas". É o mesmo par que
   * `displayName` usa no agregado.
   */
  q?: string | null;
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
  /*
   * 🔴 NÃO existe filtro por e-mail, e a ausência é a correção (out/2026).
   * `GET /musicians` é pública: com `filter[email]` fazendo `contains`, quem
   * quisesse reconstruía o e-mail de qualquer artista letra a letra — o
   * presenter escondia o campo e o filtro o entregava. Nenhum cliente usava.
   * Quem precisa achar por e-mail usa `findByEmail`, que não é alcançável por
   * query string.
   */
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
  /*
   * Busca por proximidade (7.13c).
   *
   * `lat` + `lng` são a ORIGEM: com os dois, cada item do resultado ganha a
   * sua distância (`MusicianSearchResult.distances`). Só com `radius_km` junto
   * a busca FILTRA por raio e ordena por distância. Par incompleto é
   * descartado.
   *
   * 🔴 Toda distância aqui é medida na grade pública
   * (`musician-location-privacy.ts`), nunca na coordenada exata do músico.
   */
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

/*
 * 🔴 Tudo que chega por query string é TEXTO. O DTO da rota converte, mas este
 * setter não pode depender disso: ele é a última linha antes do repositório, e
 * é montado também por use-cases e testes.
 *
 * Até out/2026 só o trio geográfico era convertido aqui. `price_min` passava
 * por `Number.isFinite("100")` (false) e `is_active` por
 * `typeof "true" === "boolean"` (false): os dois filtros eram descartados em
 * silêncio e a busca devolvia a lista inteira com HTTP 200 — o filtro de preço
 * da grade de artistas nunca filtrou nada.
 */
const toFiniteNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toBoolean = (value: unknown): boolean | undefined => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
};

/**
 * `filter[genres]=MPB` (sem colchete) chega como texto, e o `hasSome` do
 * Prisma exige lista: a busca respondia 500. Texto vira lista de um; o que não
 * for texto nem lista (o `qs` devolve OBJETO acima de 20 itens) é descartado.
 */
const toStringList = (value: unknown): string[] | undefined => {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];
  const list = items
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return list.length > 0 ? list : undefined;
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

    const priceMin = toFiniteNumber(_value?.price_min);
    const priceMax = toFiniteNumber(_value?.price_max);
    const isActive = toBoolean(_value?.is_active);
    const isVerified = toBoolean(_value?.is_verified);
    const openToGigs = toBoolean(_value?.open_to_gigs);
    const genres = toStringList(_value?.genres);
    const instruments = toStringList(_value?.instruments);
    const lat = toFiniteNumber(_value?.lat);
    const lng = toFiniteNumber(_value?.lng);
    const radiusKm = toFiniteNumber(_value?.radius_km);
    const q =
      typeof _value?.q === "string" && _value.q.trim().length > 0
        ? _value.q.trim()
        : undefined;

    const filter = {
      ...(q !== undefined && { q }),
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
      ...(genres !== undefined && { genres }),
      ...(instruments !== undefined && { instruments }),
      ...(_value &&
        isPriceModel((_value as any).price_model) && {
          price_model: (_value as any).price_model,
        }),
      ...(priceMin !== undefined && { price_min: priceMin }),
      ...(priceMax !== undefined && { price_max: priceMax }),
      ...(_value &&
        isCurrency((_value as any).price_currency) && {
          price_currency: (_value as any).price_currency,
        }),
      ...(isActive !== undefined && { is_active: isActive }),
      ...(isVerified !== undefined && { is_verified: isVerified }),
      ...(openToGigs !== undefined && { open_to_gigs: openToGigs }),
      // A origem entra com o PAR completo; o raio só com a origem e maior
      // que zero, sanitizado em 500km. `toFiniteNumber` e não `Number()` cru:
      // `Number(null)` é 0, e um par nulo viraria a coordenada (0, 0) no meio
      // do Atlântico.
      ...(lat !== undefined && lng !== undefined && { lat, lng }),
      ...(lat !== undefined &&
        lng !== undefined &&
        radiusKm !== undefined &&
        radiusKm > 0 && { radius_km: Math.min(radiusKm, 500) }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

/**
 * Resultado da busca, com a distância de cada item quando houve origem.
 *
 * A distância não é do agregado (depende de quem pergunta), então viaja ao
 * lado dos itens, por id. Em km, medida na grade pública; mapa vazio quando a
 * busca não trouxe `lat`/`lng`, e sem entrada para músico sem coordenada.
 */
export class MusicianSearchResult extends DefaultSearchResult<Musician> {
  readonly distances: ReadonlyMap<string, number>;

  constructor(
    props: ConstructorParameters<typeof DefaultSearchResult<Musician>>[0] & {
      distances?: ReadonlyMap<string, number>;
    },
  ) {
    super(props);
    this.distances = props.distances ?? new Map<string, number>();
  }
}

/**
 * O mínimo para dizer QUEM é um músico numa lista: nome exibido, foto e o que
 * toca. É um modelo de leitura, não o agregado — existe para resolver vários
 * ids de uma vez sem carregar perfil, QR, preço e plano de cada um.
 */
export type MusicianIdentity = {
  id: string;
  name: string;
  stage_name: string | null;
  avatar: string | null;
  instruments: string[];
  genres: string[];
  rating: number;
  total_ratings: number;
  is_verified: boolean;
};

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
  /** Ids inexistentes simplesmente não voltam. A ordem não é garantida. */
  findIdentitiesByIds(ids: MusicianId[]): Promise<MusicianIdentity[]>;
}
