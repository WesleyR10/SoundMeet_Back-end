import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult } from "../../shared/domain/repository/search-result";
import { Audience, AudienceId } from "./audience.aggregate";

export type AudienceFilter = {
  name?: string | null;
  email?: string | null;
  is_active?: boolean | null;
  favorite_genres?: string[] | null;
  min_points?: number | null;
  min_level?: number | null;
  notification_settings?: any | null;
  privacy_settings?: any | null;
  discovery_settings?: any | null;
};

export class AudienceSearchParams extends SearchParams<AudienceFilter> {
  private constructor(
    props: SearchParamsConstructorProps<AudienceFilter> = {},
  ) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<AudienceFilter> = {}) {
    return new AudienceSearchParams(props);
  }

  get filter(): AudienceFilter | null {
    return this._filter;
  }

  protected set filter(value: AudienceFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value && _value.name && { name: `${_value?.name}` }),
      ...(_value && _value.email && { email: `${_value?.email}` }),
      ...(_value &&
        typeof _value.is_active === "boolean" && {
          is_active: _value.is_active,
        }),
      ...(_value &&
        _value.favorite_genres && { favorite_genres: _value.favorite_genres }),
      ...(_value &&
        typeof _value.min_points === "number" && {
          min_points: _value.min_points,
        }),
      ...(_value &&
        typeof _value.min_level === "number" && {
          min_level: _value.min_level,
        }),
      ...(_value &&
        _value.notification_settings && {
          notification_settings: _value.notification_settings,
        }),
      ...(_value &&
        _value.privacy_settings && {
          privacy_settings: _value.privacy_settings,
        }),
      ...(_value &&
        _value.discovery_settings && {
          discovery_settings: _value.discovery_settings,
        }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class AudienceSearchResult extends SearchResult<Audience> {}

export interface IAudienceRepository extends ISearchableRepository<
  Audience,
  AudienceId,
  AudienceFilter,
  AudienceSearchParams,
  AudienceSearchResult
> {
  // Métodos específicos do domínio Audience
  findByEmail(email: string): Promise<Audience | null>;
  findActiveAudiences(): Promise<Audience[]>;
  findByGenrePreference(genre: string): Promise<Audience[]>;

  // Métodos de estatísticas
  getAudienceStats(): Promise<{
    total_audiences: number;
    active_audiences: number;
    inactive_audiences: number;
  }>;

  // Métodos de gamificação
  findTopFans(limit?: number): Promise<Audience[]>;
  findByLevel(level: number): Promise<Audience[]>;
  incrementTips(audienceId: AudienceId, amount: number): Promise<void>;
}
