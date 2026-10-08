import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { Follow, FollowId } from "./follow.aggregate";
import { FollowTarget, FollowTargetType } from "./follow-types";

export type FollowFilter = {
  audience_id?: string | null;
  target_type?: FollowTargetType | string | null;
  target_id?: string | null;
};

export class FollowSearchParams extends DefaultSearchParams<FollowFilter> {
  private constructor(props: SearchParamsConstructorProps<FollowFilter> = {}) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<FollowFilter> = {}) {
    return new FollowSearchParams(props);
  }

  get filter(): FollowFilter | null {
    return this._filter;
  }

  /**
   * 🔴 Override OBRIGATÓRIO: o setter da classe base coage escalares a string
   * (herança do FC3). Sem isto o filtro é descartado, o repositório monta
   * `where: {}` e "quem eu sigo" devolveria os vínculos de **todos** os fãs.
   * Já aconteceu em `repertoire` — ver CLAUDE.md.
   */
  protected set filter(value: FollowFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value &&
        _value.audience_id && { audience_id: `${_value.audience_id}` }),
      ...(_value &&
        _value.target_type && { target_type: `${_value.target_type}` }),
      ...(_value && _value.target_id && { target_id: `${_value.target_id}` }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : (filter as any);
  }
}

export class FollowSearchResult extends DefaultSearchResult<Follow> {}

export interface IFollowRepository extends ISearchableRepository<
  Follow,
  FollowId,
  FollowFilter,
  FollowSearchParams,
  FollowSearchResult
> {
  findByAudienceAndTarget(
    params: { audience_id: string } & FollowTarget,
  ): Promise<Follow | null>;

  countByTarget(target: FollowTarget): Promise<number>;

  /**
   * Quem segue QUALQUER um dos alvos e não desligou os avisos daquele
   * vínculo. Distinto por fã, em ordem de `audience_id`, paginado por cursor
   * (`after`) — o envio anda em lotes sem carregar a base inteira.
   *
   * 🔴 Lista vazia de alvos devolve vazio, nunca "todos os seguidores".
   */
  listNotifiableFollowerIds(params: {
    targets: FollowTarget[];
    after: string | null;
    limit: number;
  }): Promise<string[]>;
}
