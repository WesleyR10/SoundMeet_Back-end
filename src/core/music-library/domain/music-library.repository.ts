import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { MusicLibrary, MusicLibraryId } from "./music-library.aggregate";

export type MusicLibraryFilter = {
  musician_id?: string | null;
  title?: string | null;
  artist?: string | null;
  genre?: string | null;
  key?: string | null;
  source?: string | null;
  difficulty?: number | null;
  is_favorite?: boolean | null;
};

export class MusicLibrarySearchParams extends DefaultSearchParams<MusicLibraryFilter> {
  private constructor(
    props: SearchParamsConstructorProps<MusicLibraryFilter> = {},
  ) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<MusicLibraryFilter> = {}) {
    return new MusicLibrarySearchParams(props);
  }

  get filter(): MusicLibraryFilter | null {
    return this._filter;
  }

  protected set filter(value: MusicLibraryFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value &&
        _value.musician_id && { musician_id: `${_value.musician_id}` }),
      ...(_value && _value.title && { title: `${_value.title}` }),
      ...(_value && _value.artist && { artist: `${_value.artist}` }),
      ...(_value && _value.genre && { genre: `${_value.genre}` }),
      ...(_value && _value.key && { key: `${_value.key}` }),
      ...(_value && _value.source && { source: `${_value.source}` }),
      ...(_value &&
        _value.difficulty !== null &&
        _value.difficulty !== undefined &&
        Number.isFinite(_value.difficulty) && {
          difficulty: _value.difficulty,
        }),
      ...(_value &&
        typeof _value.is_favorite === "boolean" && {
          is_favorite: _value.is_favorite,
        }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class MusicLibrarySearchResult extends DefaultSearchResult<MusicLibrary> {}

/**
 * Uma música do catálogo da plataforma — agregada, sem dono.
 *
 * `MusicLibrary` é biblioteca **pessoal**: cada músico tem a própria linha da
 * mesma música, com a própria análise. "O catálogo do SoundMeet" existe como a
 * UNIÃO dessas linhas, e é isso que esta entrada representa: um par
 * (título, artista) que a plataforma já cifrou, sem dizer de quem é.
 *
 * 🔴 **Não existe `musician_id` aqui, e é a feature.** Devolver o dono de cada
 * linha transformaria a busca do fã num relatório de quem toca o quê. O único
 * id que sai é `library_id`, e ele é sempre do músico **alvo** da busca — o
 * mesmo que o fã já escolheu para pedir.
 */
export type SongCatalogEntry = {
  title: string;
  artist: string;
  genre: string | null;
  /** Quantos músicos da plataforma têm a música. Ordena por popularidade. */
  musicians_count: number;
  /**
   * A linha do músico ALVO para esta música, quando ele já a tem. É o que o
   * pedido carrega em `library_id` — nunca a linha de um terceiro.
   */
  library_id: string | null;
};

/**
 * Onde a busca do fã acontece.
 *
 * `platform` — todas as músicas já cifradas na plataforma, deduplicadas.
 * `repertoire` — só a biblioteca deste músico, para quem desligou o pedido
 * fora do repertório.
 *
 * 🔴 Quem escolhe é o SERVIDOR, a partir do próprio músico, nunca o cliente.
 * Um `scope` vindo da query faria o limite depender de quem faz a chamada —
 * exatamente o que desligar o switch existe para impedir.
 */
export type SongCatalogScope = "platform" | "repertoire";

export type SearchSongCatalogInput = {
  /** Texto livre do fã. `null` devolve as mais presentes na plataforma. */
  term: string | null;
  limit: number;
  /** Músico a quem o pedido será feito — resolve `library_id`. */
  musician_id: string;
  scope: SongCatalogScope;
};

export interface IMusicLibraryRepository extends ISearchableRepository<
  MusicLibrary,
  MusicLibraryId,
  MusicLibraryFilter,
  MusicLibrarySearchParams,
  MusicLibrarySearchResult
> {
  /**
   * Músicas que ainda não foram procuradas no catálogo do Spotify — a fila do
   * job de backfill.
   *
   * Existe como método próprio, e não como filtro de `search()`, porque
   * "nunca procurado" é `spotifyCheckedAt IS NULL`: o `SearchParams` do projeto
   * descarta valores falsy no setter de filtro, então `null` como critério não
   * atravessa. Tentar expressar isso ali daria um filtro que se apaga sozinho e
   * devolve a biblioteca inteira.
   */
  findPendingSpotifyResolution(limit: number): Promise<MusicLibrary[]>;

  /**
   * Catálogo agregado da plataforma: pares (título, artista) já cifrados,
   * deduplicados entre todos os músicos.
   *
   * Método próprio, e não `search()` sem `musician_id`, por duas razões que
   * não dá para expressar em `SearchParams`: a **deduplicação** (sem ela a
   * mesma música volta uma vez por músico) e a **omissão do dono** (o
   * `MusicLibrary` sai sempre com `musicianId`, e aqui ele não pode sair).
   */
  searchSongCatalog(input: SearchSongCatalogInput): Promise<SongCatalogEntry[]>;
}
