import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { badgeProgressFromLedger } from "../../../domain/badge-tracks";
import { UserBadge } from "../../../domain/user-badge.aggregate";
import { IUserBadgeRepository } from "../../../domain/user-badge.repository";
import { IUserScoreRepository } from "../../../domain/user-score.repository";
import { BadgeTypeEnum } from "../../../domain/value-objects/badge-type.vo";

export type SyncUserBadgesInput = { user_id: string };

export type SyncUserBadgesOutput = {
  /** Conquistas que passaram a desbloqueadas NESTA execução. */
  newly_unlocked: BadgeTypeEnum[];
};

/**
 * Recalcula o progresso de todas as conquistas do usuário a partir do ledger.
 *
 * - **Idempotente:** o progresso é a soma do `UserScore` (`badge-tracks.ts`),
 *   então rodar duas vezes grava o mesmo número.
 * - Só cria linha em `user_badges` quando há progresso > 0 — conquista que o
 *   fã nem começou é ausência, e o app desenha a argola vazia pelo catálogo.
 * - Nunca revoga: `UserBadge.updateProgress` não re-tranca o que já abriu.
 * - Só grava o que MUDOU — a maioria dos créditos não mexe em todas as oito.
 */
export class SyncUserBadgesUseCase implements IUseCase<
  SyncUserBadgesInput,
  SyncUserBadgesOutput
> {
  constructor(
    private readonly userScoreRepo: IUserScoreRepository,
    private readonly userBadgeRepo: IUserBadgeRepository,
  ) {}

  async execute(input: SyncUserBadgesInput): Promise<SyncUserBadgesOutput> {
    const [sums, existing] = await Promise.all([
      this.userScoreRepo.getPointsByUserGroupedByType(input.user_id),
      this.userBadgeRepo.findByUserId(input.user_id),
    ]);
    const progress = badgeProgressFromLedger(sums);
    const byType = new Map(existing.map((b) => [b.badge_type.value, b]));
    const newly_unlocked: BadgeTypeEnum[] = [];

    for (const type of Object.values(BadgeTypeEnum)) {
      const points = progress[type];
      const current = byType.get(type);

      if (!current) {
        if (points <= 0) continue;
        const badge = UserBadge.create({
          user_id: new Uuid(input.user_id),
          badge_type: type,
        });
        badge.updateProgress(points);
        this.assertValid(badge);
        await this.userBadgeRepo.insert(badge);
        if (badge.is_unlocked) newly_unlocked.push(type);
        continue;
      }

      if (current.progress === points) continue;
      const wasUnlocked = current.is_unlocked;
      current.updateProgress(points);
      this.assertValid(current);
      await this.userBadgeRepo.update(current);
      if (!wasUnlocked && current.is_unlocked) newly_unlocked.push(type);
    }

    return { newly_unlocked };
  }

  private assertValid(badge: UserBadge): void {
    if (badge.notification.hasErrors()) {
      throw new EntityValidationError(badge.notification.toJSON());
    }
  }
}
