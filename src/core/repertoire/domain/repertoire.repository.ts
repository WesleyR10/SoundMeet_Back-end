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
  private constructor(props: SearchParamsConstructorProps<RepertoireFilter> = {}) {
    super(props);
  }

  static create(
    props: SearchParamsConstructorProps<RepertoireFilter> = {},
  ): RepertoireSearchParams {
    return new RepertoireSearchParams(props);
  }
}

export class RepertoireSearchResult extends DefaultSearchResult<Repertoire> {}

export interface IRepertoireRepository
  extends ISearchableRepository<
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
