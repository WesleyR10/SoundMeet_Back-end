import { ISearchableRepository } from "../../../shared/domain/repository/repository-interface";
import { SearchParams } from "../../../shared/domain/repository/search-params";
import { SearchResult } from "../../../shared/domain/repository/search-result";
import { Tip } from "../tip.entity";
import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";

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

export interface ITipRepository
  extends ISearchableRepository<
    Tip,
    Uuid,
    TipFilter,
    TipSearchParams,
    TipSearchResult
  > {
  findById(id: Uuid): Promise<Tip | null>;
  findByMusicianId(musicianId: string): Promise<Tip[]>;
}
