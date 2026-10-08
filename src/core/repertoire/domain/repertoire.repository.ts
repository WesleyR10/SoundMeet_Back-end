import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { Repertoire, RepertoireId } from "./repertoire.aggregate";

export type RepertoireFilter = {
  musician_id?: string | null;
  name?: string | null;
};

export class RepertoireSearchParams extends DefaultSearchParams<RepertoireFilter> {
  private constructor(
    props: SearchParamsConstructorProps<RepertoireFilter> = {},
  ) {
    super(props);
  }

  static create(
    props: SearchParamsConstructorProps<RepertoireFilter> = {},
  ): RepertoireSearchParams {
    return new RepertoireSearchParams(props);
  }

  get filter(): RepertoireFilter | null {
    return this._filter;
  }

  /**
   * Override obrigatório — o setter da classe base faz `${value}` e converte o
   * filtro-objeto em "[object Object]".
   *
   * Sem isto, `params.filter?.musician_id` era undefined, o repositório montava
   * `where: {}` e `GET /musicians/:id/repertoires` devolvia os repertórios de
   * TODOS os músicos: o MusicianOwnershipGuard autoriza o dono da URL, mas não
   * escopa o resultado. Corrigido em 28/jul/2026; regressão coberta em
   * `__tests__/repertoire-search-params.spec.ts`.
   */
  protected set filter(value: RepertoireFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value?.musician_id && { musician_id: `${_value.musician_id}` }),
      ...(_value?.name && { name: `${_value.name}` }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class RepertoireSearchResult extends DefaultSearchResult<Repertoire> {}

export interface IRepertoireRepository extends ISearchableRepository<
  Repertoire,
  RepertoireId,
  RepertoireFilter,
  RepertoireSearchParams,
  RepertoireSearchResult
> {
  findByMusicianId(musician_id: string): Promise<Repertoire[]>;
  countByMusicianId(musician_id: string): Promise<number>;
  findByShareToken(token: string): Promise<Repertoire | null>;
  findSharedWithMusician(musician_id: string): Promise<Repertoire[]>;
}
