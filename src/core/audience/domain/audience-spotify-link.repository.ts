import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import { SearchParams } from "../../shared/domain/repository/search-params";
import { SearchResult } from "../../shared/domain/repository/search-result";
import {
  AudienceSpotifyLink,
  AudienceSpotifyLinkId,
} from "./audience-spotify-link.aggregate";

export type AudienceSpotifyLinkFilter = {
  audience_id?: string;
};

export class AudienceSpotifyLinkSearchParams extends SearchParams<AudienceSpotifyLinkFilter> {
  get filter(): AudienceSpotifyLinkFilter | null {
    return this._filter;
  }

  /**
   * Override obrigatório — regra geral do projeto.
   *
   * O setter da classe base coage o filtro-objeto a `"[object Object]"`
   * (herança do FC3, onde `Filter` é busca livre). O repositório leria
   * `filter.audience_id` como `undefined`, montaria `where: {}` e devolveria o
   * vínculo de TODOS os fãs. Já aconteceu de verdade em `repertoire`; nasce
   * corrigido aqui.
   */
  protected set filter(value: AudienceSpotifyLinkFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value?.audience_id && { audience_id: `${_value.audience_id}` }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class AudienceSpotifyLinkSearchResult extends SearchResult<AudienceSpotifyLink> {}

export interface IAudienceSpotifyLinkRepository extends ISearchableRepository<
  AudienceSpotifyLink,
  AudienceSpotifyLinkId,
  AudienceSpotifyLinkFilter,
  AudienceSpotifyLinkSearchParams,
  AudienceSpotifyLinkSearchResult
> {
  /** O vínculo do fã — `audienceId` é `@unique`, então é no máximo um. */
  findByAudienceId(audienceId: string): Promise<AudienceSpotifyLink | null>;

  /**
   * Vínculos com token vencendo até `before` — a varredura do job de renovação.
   *
   * O access token do Spotify dura ~1h. Sem renovação silenciosa, "salvar no
   * Spotify" falharia para qualquer fã que não tivesse acabado de autorizar —
   * que é praticamente todo mundo.
   */
  findExpiring(before: Date, limit: number): Promise<AudienceSpotifyLink[]>;

  /** Desfaz o vínculo. */
  deleteByAudienceId(audienceId: string): Promise<void>;
}
