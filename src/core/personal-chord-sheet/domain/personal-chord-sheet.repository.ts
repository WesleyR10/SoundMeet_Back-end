import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import {
  PersonalChordSheet,
  PersonalChordSheetId,
  type PersonalChordSheetReconcileStatus,
  type PersonalChordSheetShareScope,
} from "./personal-chord-sheet.aggregate";

export type PersonalChordSheetFilter = {
  musician_id?: string | null;
  music_library_id?: string | null;
  share_scope?: PersonalChordSheetShareScope | null;
  reconcile_status?: PersonalChordSheetReconcileStatus | null;
};

export class PersonalChordSheetSearchParams extends DefaultSearchParams<PersonalChordSheetFilter> {
  private constructor(
    props: SearchParamsConstructorProps<PersonalChordSheetFilter> = {},
  ) {
    super(props);
  }

  static create(
    props: SearchParamsConstructorProps<PersonalChordSheetFilter> = {},
  ): PersonalChordSheetSearchParams {
    return new PersonalChordSheetSearchParams(props);
  }

  get filter(): PersonalChordSheetFilter | null {
    return this._filter;
  }

  /**
   * Override obrigatório: o setter da classe base faz `${value}`, o que
   * transforma um filtro-objeto em "[object Object]" e o descarta em silêncio.
   * Todos os domínios que filtram por objeto sobrescrevem — ver
   * ai-cifra-upload.repository.ts, establishment.repository.ts e outros.
   */
  protected set filter(value: PersonalChordSheetFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value?.musician_id && { musician_id: `${_value.musician_id}` }),
      ...(_value?.music_library_id && {
        music_library_id: `${_value.music_library_id}`,
      }),
      ...(_value?.share_scope && { share_scope: _value.share_scope }),
      ...(_value?.reconcile_status && {
        reconcile_status: _value.reconcile_status,
      }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class PersonalChordSheetSearchResult extends DefaultSearchResult<PersonalChordSheet> {}

export interface IPersonalChordSheetRepository extends ISearchableRepository<
  PersonalChordSheet,
  PersonalChordSheetId,
  PersonalChordSheetFilter,
  PersonalChordSheetSearchParams,
  PersonalChordSheetSearchResult
> {
  /**
   * A consulta que sustenta a regra "no máximo 1 fork por música por músico".
   * A unicidade real é garantida pelo índice único no banco — este método é o
   * caminho feliz, não a defesa contra corrida.
   */
  findByMusicianAndMusicLibrary(
    musician_id: string,
    music_library_id: string,
  ): Promise<PersonalChordSheet | null>;

  findByMusicianId(musician_id: string): Promise<PersonalChordSheet[]>;

  countByMusicianId(musician_id: string): Promise<number>;

  /** Forks compartilhados de uma mesma música — as "outras versões" dela. */
  findSharedByMusicLibraryId(
    music_library_id: string,
    scope?: Exclude<PersonalChordSheetShareScope, "private">,
  ): Promise<PersonalChordSheet[]>;
}
