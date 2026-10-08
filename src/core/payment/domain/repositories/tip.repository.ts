import { ISearchableRepository } from "../../../shared/domain/repository/repository-interface";
import { SearchParams } from "../../../shared/domain/repository/search-params";
import { SearchResult } from "../../../shared/domain/repository/search-result";
import { Tip, TipId } from "../tip.aggregate";

export type TipFilter = {
  musician_id?: string;
  audience_id?: string;
  event_id?: string;
  status?: string;
};

export class TipSearchParams extends SearchParams<TipFilter> {
  protected set filter(value: TipFilter | null) {
    this._filter =
      value === null || value === undefined || (value as unknown) === ""
        ? null
        : value;
  }

  get filter(): TipFilter | null {
    return this._filter;
  }
}

export class TipSearchResult extends SearchResult<Tip> {}

export interface ITipRepository extends ISearchableRepository<
  Tip,
  TipId,
  TipFilter,
  TipSearchParams,
  TipSearchResult
> {
  findById(id: TipId): Promise<Tip | null>;
  findByMusicianId(musicianId: string): Promise<Tip[]>;
  /**
   * Gorjetas CONFIRMADAS de vários eventos, numa consulta. Não filtra
   * destinatário — um evento tem mais de um artista, e quem chama estreita por
   * músico/banda (mesma regra do relatório pós-show). Lista vazia devolve vazio.
   */
  findCompletedByEvents(event_ids: string[]): Promise<Tip[]>;
  /**
   * Total em REAIS das gorjetas CONFIRMADAS dadas diretamente ao músico, de
   * todos os tempos — somado no banco. É o "total em gorjetas" do Analytics.
   * Não é `wallet.total_earned`: aquele também cresce com o cachê liberado da
   * custódia, e gorjeta é gorjeta, cachê é cachê.
   */
  sumCompletedByMusician(musician_id: string): Promise<number>;
}
