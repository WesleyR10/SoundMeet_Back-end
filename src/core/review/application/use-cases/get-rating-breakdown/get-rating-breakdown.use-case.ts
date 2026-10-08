import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  REVIEW_AUTHOR_TYPES,
  ReviewAuthorType,
  ReviewTargetType,
} from "../../../domain/review.aggregate";
import { IReviewRepository } from "../../../domain/review.repository";

export type GetRatingBreakdownInput = {
  target_type: ReviewTargetType;
  target_id: string;
};

export type RatingSliceOutput = {
  average: number;
  total: number;
};

export type GetRatingBreakdownOutput = {
  /**
   * A nota do artista, de todo mundo — o mesmo número que a projeção
   * `musicians.rating` guarda e que a busca ordena.
   */
  overall: RatingSliceOutput;
  /**
   * A mesma nota quebrada por quem avaliou. Tipo sem nenhuma avaliação sai
   * `null`, nunca `{ average: 0 }` — zero leria como "avaliado mal".
   */
  by_author: Record<ReviewAuthorType, RatingSliceOutput | null>;
};

/**
 * Nota de um alvo, inteira e quebrada por tipo de autor.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O DEFEITO QUE ISTO CORRIGE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `aggregateForTarget` sempre agregou o ledger inteiro sem olhar
 * `author_type`, e a UI do estabelecimento exibia o resultado como se fosse a
 * opinião de outras casas. Não é: são estabelecimentos, público e músicos na
 * mesma média. A tela afirmava uma procedência que o dado não sustenta.
 *
 * ⚠️ **`overall` NÃO é a média das parciais.** Os pesos diferem, e por isso
 * este output entrega os dois lados em vez de deixar o cliente recompor — uma
 * UI que somasse as médias parciais e dividisse por três produziria um número
 * que não existe em lugar nenhum do banco.
 *
 * ⚠️ **Cada parcial vem com o seu total, e isso é obrigatório para a UI ser
 * honesta.** "5,0 do público" a partir de uma avaliação só e "4,6 do público"
 * a partir de trinta são afirmações de força muito diferente; sem o total ao
 * lado, as duas se parecem.
 *
 * Uma consulta só (`groupBy` no repositório Prisma), não uma por tipo.
 */
export class GetRatingBreakdownUseCase implements IUseCase<
  GetRatingBreakdownInput,
  GetRatingBreakdownOutput
> {
  constructor(private readonly reviewRepo: IReviewRepository) {}

  async execute(
    input: GetRatingBreakdownInput,
  ): Promise<GetRatingBreakdownOutput> {
    const params = {
      target_type: input.target_type,
      target_id: input.target_id,
    };

    /*
     * ⚠️ NÃO derivar `overall` somando os buckets: o repositório descarta
     * `author_type` desconhecido (coluna String, não enum), então a soma das
     * parciais pode ser menor que o total real. `overall` tem de vir da mesma
     * agregação que alimenta a projeção — é o número que a busca ordena.
     *
     * Em paralelo porque são duas leituras independentes do mesmo ledger.
     */
    const [overall, byAuthor] = await Promise.all([
      this.reviewRepo.aggregateForTarget(params),
      this.reviewRepo.aggregateForTargetByAuthor(params),
    ]);

    // Todas as chaves presentes, com `null` onde não houve avaliação: o
    // cliente não precisa saber a lista de tipos para renderizar a ausência.
    const by_author = REVIEW_AUTHOR_TYPES.reduce(
      (acc, authorType) => {
        acc[authorType] = byAuthor[authorType] ?? null;
        return acc;
      },
      {} as Record<ReviewAuthorType, RatingSliceOutput | null>,
    );

    return { overall, by_author };
  }
}
