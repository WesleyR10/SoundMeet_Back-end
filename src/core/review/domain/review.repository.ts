import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import {
  Review,
  ReviewAuthorType,
  ReviewContextType,
  ReviewId,
  ReviewTargetType,
} from "./review.aggregate";

export type ReviewFilter = {
  target_type?: ReviewTargetType | string | null;
  target_id?: string | null;
  author_type?: ReviewAuthorType | string | null;
  author_id?: string | null;
  context_type?: ReviewContextType | string | null;
  context_id?: string | null;
  /** Só avaliações com texto — para a vitrine de comentários do perfil. */
  has_comment?: boolean | null;
};

export class ReviewSearchParams extends DefaultSearchParams<ReviewFilter> {
  private constructor(props: SearchParamsConstructorProps<ReviewFilter> = {}) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<ReviewFilter> = {}) {
    return new ReviewSearchParams(props);
  }

  get filter(): ReviewFilter | null {
    return this._filter;
  }

  /**
   * Override obrigatório: o setter da classe base coage escalares a string
   * (herança do FC3, onde `Filter` é busca livre). Sem isto o filtro é
   * descartado, o repositório monta `where: {}` e a listagem de um perfil
   * devolveria as avaliações de **todos** os perfis.
   */
  protected set filter(value: ReviewFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value &&
        _value.target_type && { target_type: `${_value.target_type}` }),
      ...(_value && _value.target_id && { target_id: `${_value.target_id}` }),
      ...(_value &&
        _value.author_type && { author_type: `${_value.author_type}` }),
      ...(_value && _value.author_id && { author_id: `${_value.author_id}` }),
      ...(_value &&
        _value.context_type && { context_type: `${_value.context_type}` }),
      ...(_value &&
        _value.context_id && { context_id: `${_value.context_id}` }),
      // Booleano: `false` é valor legítimo e não pode cair no truthy-check
      // usado acima — por isso a checagem explícita de tipo.
      ...(_value &&
        typeof _value.has_comment === "boolean" && {
          has_comment: _value.has_comment,
        }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : (filter as any);
  }
}

export class ReviewSearchResult extends DefaultSearchResult<Review> {}

export interface IReviewRepository extends ISearchableRepository<
  Review,
  ReviewId,
  ReviewFilter,
  ReviewSearchParams,
  ReviewSearchResult
> {
  /**
   * A avaliação daquele autor, para aquele alvo, **naquele contexto**.
   *
   * É o que implementa "uma avaliação por par por evento/booking": o caminho
   * feliz consulta antes de inserir e transforma repetição em atualização. A
   * garantia real é a unique `(target_type, target_id, author_id, context_id)`
   * no banco — esta consulta é conveniência, não a defesa.
   */
  findByAuthorAndContext(params: {
    target_type: ReviewTargetType;
    target_id: string;
    author_id: string;
    context_id: string;
  }): Promise<Review | null>;

  /**
   * Média e contagem calculadas a partir do ledger, para reconstruir a
   * projeção (`rating`/`total_ratings`) sem depender do acumulador
   * incremental — que não sobrevive a uma remoção.
   */
  aggregateForTarget(params: {
    target_type: ReviewTargetType;
    target_id: string;
  }): Promise<{ average: number; total: number }>;

  /**
   * A mesma média, **quebrada por tipo de autor**.
   *
   * ════════════════════════════════════════════════════════════════════════
   * POR QUE ISTO EXISTE
   * ════════════════════════════════════════════════════════════════════════
   *
   * `aggregateForTarget` agrega o ledger inteiro sem olhar `author_type`, e é
   * assim de propósito: a projeção `musicians.rating` é a nota do artista, de
   * todo mundo que tocou com ele ou o viu tocar.
   *
   * O efeito colateral é que aquele número **não sabe responder** "o que o
   * público achou" nem "o que quem contratou achou" — as duas perguntas que a
   * grade de artistas do estabelecimento faz. Dizer que os `3.6` são "de
   * outros estabelecimentos" seria afirmação falsa: são de estabelecimentos,
   * público e músicos misturados.
   *
   * ⚠️ As médias parciais **não** são recombináveis a partir da geral, e a
   * geral não é a média das parciais (os pesos diferem). Por isso este método
   * devolve o total ao lado de cada média — sem ele, quem consome não tem como
   * saber que o `5.0` do público vem de uma avaliação só.
   *
   * Devolve uma entrada por tipo presente no ledger. Tipo sem nenhuma
   * avaliação **não** aparece com zero: ausência é ausência, e `0` leria como
   * "avaliado mal".
   */
  aggregateForTargetByAuthor(params: {
    target_type: ReviewTargetType;
    target_id: string;
  }): Promise<
    Partial<Record<ReviewAuthorType, { average: number; total: number }>>
  >;
}
