import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { Indication, IndicationId } from "./indication.aggregate";
import { IndicationStatus } from "./indication-types";

export type IndicationFilter = {
  audience_id?: string | null;
  musician_id?: string | null;
  establishment_id?: string | null;
  status?: IndicationStatus | string | null;
};

export class IndicationSearchParams extends DefaultSearchParams<IndicationFilter> {
  private constructor(
    props: SearchParamsConstructorProps<IndicationFilter> = {},
  ) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<IndicationFilter> = {}) {
    return new IndicationSearchParams(props);
  }

  get filter(): IndicationFilter | null {
    return this._filter;
  }

  /**
   * 🔴 Override OBRIGATÓRIO: o setter da classe base coage escalares a string
   * (herança do FC3, onde `Filter` é busca livre). Sem isto o filtro é
   * descartado, o repositório monta `where: {}` e a caixa de indicações de um
   * estabelecimento devolveria as indicações de **todos** os estabelecimentos.
   *
   * Já aconteceu de verdade neste projeto (`repertoire`, vazamento ativo;
   * `transaction` e `musician-wallet`, latentes) — ver CLAUDE.md.
   */
  protected set filter(value: IndicationFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value &&
        _value.audience_id && { audience_id: `${_value.audience_id}` }),
      ...(_value &&
        _value.musician_id && { musician_id: `${_value.musician_id}` }),
      ...(_value &&
        _value.establishment_id && {
          establishment_id: `${_value.establishment_id}`,
        }),
      ...(_value && _value.status && { status: `${_value.status}` }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : (filter as any);
  }
}

export class IndicationSearchResult extends DefaultSearchResult<Indication> {}

export interface IIndicationRepository extends ISearchableRepository<
  Indication,
  IndicationId,
  IndicationFilter,
  IndicationSearchParams,
  IndicationSearchResult
> {
  /**
   * A indicação daquele fã, para aquele músico, naquele estabelecimento.
   *
   * Implementa "uma indicação por trio" no caminho feliz. A garantia real é a
   * unique `(audience_id, musician_id, establishment_id)` no banco — esta
   * consulta é conveniência, não a defesa: dois POSTs simultâneos passam pelos
   * dois `find` antes de qualquer insert.
   */
  findByTrio(params: {
    audience_id: string;
    musician_id: string;
    establishment_id: string;
  }): Promise<Indication | null>;

  /** Quantas indicações novas o estabelecimento tem — o badge da caixa. */
  countNewByEstablishment(establishment_id: string): Promise<number>;
}
