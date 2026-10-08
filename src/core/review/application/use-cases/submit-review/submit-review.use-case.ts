import {
  Establishment,
  EstablishmentId,
} from "../../../../establishment/domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../../../establishment/domain/establishment.repository";
import {
  Musician,
  MusicianId,
} from "../../../../musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../../../musician/domain/musician.repository";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  Review,
  ReviewAuthorType,
  ReviewContextType,
  ReviewTargetType,
} from "../../../domain/review.aggregate";
import { IReviewRepository } from "../../../domain/review.repository";
import { ReviewEligibilityService } from "../../services/review-eligibility.service";
import {
  ReviewOutput,
  ReviewOutputMapper,
  TargetRatingOutput,
} from "../common/review-output";

export type SubmitReviewInput = {
  target_type: ReviewTargetType;
  target_id: string;
  author_type: ReviewAuthorType;
  author_id: string;
  rating: number;
  comment?: string | null;
  context_type: ReviewContextType;
  context_id: string;
};

export type SubmitReviewOutput = {
  review: ReviewOutput;
  target_rating: TargetRatingOutput;
};

/**
 * Registra (ou atualiza) a avaliação de um músico ou estabelecimento.
 *
 * Um único use-case serve os dois alvos de propósito: a diferença entre eles é
 * apenas qual agregado recebe a projeção. Duas classes quase idênticas
 * divergiriam na primeira mudança de regra — e a regra que importa (prova de
 * vínculo, unicidade, recálculo) é rigorosamente a mesma.
 *
 * Ordem: elegibilidade → upsert no ledger → recálculo da projeção. A projeção
 * é sempre derivada do ledger inteiro, nunca incrementada: é o que faz
 * reavaliar substituir a nota antiga em vez de somar duas vezes.
 */
export class SubmitReviewUseCase implements IUseCase<
  SubmitReviewInput,
  SubmitReviewOutput
> {
  constructor(
    private readonly reviewRepo: IReviewRepository,
    private readonly eligibility: ReviewEligibilityService,
    private readonly musicianRepo: IMusicianRepository,
    private readonly establishmentRepo: IEstablishmentRepository,
  ) {}

  async execute(input: SubmitReviewInput): Promise<SubmitReviewOutput> {
    // O alvo tem que existir antes de qualquer coisa: as colunas do ledger são
    // polimórficas e sem FK, então esta é a única barreira contra avaliação
    // apontando para um id inexistente.
    //
    // Carregado UMA vez e reaproveitado na projeção — buscar de novo depois
    // seria um round-trip a mais em toda avaliação, sem ganho nenhum.
    const target = await this.loadTarget(input.target_type, input.target_id);

    await this.eligibility.assertEligible(input);

    const review = await this.upsertReview(input);

    const projection = await this.syncProjection(input.target_type, target);

    return {
      review: ReviewOutputMapper.toOutput(review),
      target_rating: projection,
    };
  }

  private async loadTarget(
    targetType: ReviewTargetType,
    targetId: string,
  ): Promise<Musician | Establishment> {
    if (targetType === "musician") {
      const musician = await this.musicianRepo.findById(
        new MusicianId(targetId),
      );
      if (!musician) throw new NotFoundError(targetId, Musician);
      return musician;
    }

    const establishment = await this.establishmentRepo.findById(
      new EstablishmentId(targetId),
    );
    if (!establishment) throw new NotFoundError(targetId, Establishment);
    return establishment;
  }

  /**
   * Reavaliar o MESMO contexto atualiza, não duplica — é o que implementa "uma
   * avaliação por par por evento/booking" no caminho feliz. A garantia real
   * contra corrida é a unique no banco.
   */
  private async upsertReview(input: SubmitReviewInput): Promise<Review> {
    const existing = await this.reviewRepo.findByAuthorAndContext({
      target_type: input.target_type,
      target_id: input.target_id,
      author_id: input.author_id,
      context_id: input.context_id,
    });

    if (existing) {
      existing.changeRating(input.rating, input.comment);
      if (existing.notification.hasErrors()) {
        throw new EntityValidationError(existing.notification.toJSON());
      }
      await this.reviewRepo.update(existing);
      return existing;
    }

    const review = Review.create(input);
    await this.reviewRepo.insert(review);
    return review;
  }

  /**
   * A média é recalculada NO BANCO sobre o ledger inteiro (uma agregação, sem
   * trazer linha nenhuma) e então gravada na projeção.
   *
   * ⚠️ Ledger e projeção não compartilham transação. Se o update do alvo
   * falhar, a avaliação já está registrada e a média fica velha até a próxima
   * avaliação daquele alvo — inconsistência temporária e auto-corrigível,
   * nunca perda de dado (a fonte de verdade é o ledger). Envolver os dois num
   * `PrismaUnitOfWork` (precedente do scan de QR, Bloco 2.5) exigiria que os
   * três repositórios compartilhassem o mesmo client transacional; fica
   * registrado como melhoria, não como correção urgente.
   */
  private async syncProjection(
    targetType: ReviewTargetType,
    target: Musician | Establishment,
  ): Promise<TargetRatingOutput> {
    const targetId =
      targetType === "musician"
        ? (target as Musician).musician_id.id
        : (target as Establishment).establishment_id.id;

    const { average, total } = await this.reviewRepo.aggregateForTarget({
      target_type: targetType,
      target_id: targetId,
    });

    target.syncRatingProjection(average, total);

    if (target.notification.hasErrors()) {
      throw new EntityValidationError(target.notification.toJSON());
    }

    if (targetType === "musician") {
      await this.musicianRepo.update(target as Musician);
    } else {
      await this.establishmentRepo.update(target as Establishment);
    }

    return { average, total };
  }
}
