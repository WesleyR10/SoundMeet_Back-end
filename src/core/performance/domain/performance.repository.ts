import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { Performance, PerformanceId } from "./performance.aggregate";

export type PerformanceFilter = {
  musician_id?: string | null;
  band_id?: string | null;
  establishment_id?: string | null;
  event_id?: string | null;
  status?: string | null;
};

export class PerformanceSearchParams extends DefaultSearchParams<PerformanceFilter> {
  private constructor(
    props: SearchParamsConstructorProps<PerformanceFilter> = {},
  ) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<PerformanceFilter> = {}) {
    return new PerformanceSearchParams(props);
  }

  get filter(): PerformanceFilter | null {
    return this._filter;
  }

  /**
   * ⚠️ Override obrigatório. O setter da classe base coage escalares a string
   * (herança do FC3, onde `Filter` é busca livre). Sem isto o filtro é
   * descartado, o repositório monta `where: {}` e a listagem devolveria os sets
   * de **todos os músicos** — o ownership guard autoriza o dono da URL mas não
   * escopa o resultado. Foi exatamente assim que `repertoire` vazou em
   * jul/2026.
   */
  protected set filter(value: PerformanceFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value &&
        _value.musician_id && { musician_id: `${_value.musician_id}` }),
      ...(_value && _value.band_id && { band_id: `${_value.band_id}` }),
      ...(_value &&
        _value.establishment_id && {
          establishment_id: `${_value.establishment_id}`,
        }),
      ...(_value && _value.event_id && { event_id: `${_value.event_id}` }),
      ...(_value && _value.status && { status: `${_value.status}` }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : (filter as any);
  }
}

export class PerformanceSearchResult extends DefaultSearchResult<Performance> {}

export interface IPerformanceRepository extends ISearchableRepository<
  Performance,
  PerformanceId,
  PerformanceFilter,
  PerformanceSearchParams,
  PerformanceSearchResult
> {
  /**
   * O set ao vivo daquele músico naquele evento — a consulta que responde
   * "o que está tocando agora?" para o fã.
   *
   * A unicidade real é o índice parcial `(eventId, musicianId) WHERE status =
   * 'live'` no banco; esta consulta é o caminho de leitura, não a defesa.
   */
  findLiveByEventAndMusician(params: {
    event_id: string;
    musician_id: string;
  }): Promise<Performance | null>;

  /**
   * Sets encerrados do músico, do mais recente ao mais antigo.
   *
   * `started_from` é piso INCLUSIVO de `started_at` — o recorte do período no
   * Analytics. Sem ele, a leitura é o histórico inteiro.
   */
  findEndedByMusician(params: {
    musician_id: string;
    establishment_id?: string | null;
    limit?: number;
    started_from?: Date | null;
  }): Promise<Performance[]>;

  /**
   * Contagem de execuções por música, restrita a um estabelecimento — a base do
   * setlist inteligente (F5). Agregada NO banco: trazer todo o histórico de
   * sets para a aplicação só para contar seria varredura inteira a cada
   * sugestão.
   */
  countPlaysByMusicianAtEstablishment(params: {
    musician_id: string;
    establishment_id: string;
  }): Promise<
    Array<{
      music_library_id: string | null;
      title: string;
      artist: string;
      plays: number;
      last_played_at: Date;
    }>
  >;

  /** Músicas distintas já executadas pelo músico — item do currículo (F4). */
  countDistinctSongsByMusician(musician_id: string): Promise<number>;
}
