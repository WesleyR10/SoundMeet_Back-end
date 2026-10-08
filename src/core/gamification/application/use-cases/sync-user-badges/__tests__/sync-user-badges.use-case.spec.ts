import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { UserBadge } from "../../../../domain/user-badge.aggregate";
import { UserScore } from "../../../../domain/user-score.aggregate";
import { BadgeTypeEnum } from "../../../../domain/value-objects/badge-type.vo";
import { ScoreTypeEnum } from "../../../../domain/value-objects/score-type.vo";
import { UserBadgeInMemoryRepository } from "../../../../infra/db/in-memory/user-badge-in-memory.repository";
import { UserScoreInMemoryRepository } from "../../../../infra/db/in-memory/user-score-in-memory.repository";
import { SyncUserBadgesUseCase } from "../sync-user-badges.use-case";

describe("SyncUserBadgesUseCase", () => {
  let scoreRepo: UserScoreInMemoryRepository;
  let badgeRepo: UserBadgeInMemoryRepository;
  let useCase: SyncUserBadgesUseCase;
  const userId = new Uuid();

  async function credit(type: ScoreTypeEnum, points: number) {
    await scoreRepo.insert(
      UserScore.fake()
        .aUserScore()
        .withUserId(userId)
        .withScoreType(type)
        .withPoints(points)
        .build(),
    );
  }

  const badgeOf = async (type: BadgeTypeEnum) =>
    badgeRepo.findByUserAndBadgeType(userId.id, type);

  beforeEach(() => {
    scoreRepo = new UserScoreInMemoryRepository();
    badgeRepo = new UserBadgeInMemoryRepository();
    useCase = new SyncUserBadgesUseCase(scoreRepo, badgeRepo);
  });

  it("sem pontos, não cria linha nenhuma (argola vazia é do app)", async () => {
    const out = await useCase.execute({ user_id: userId.id });
    expect(out.newly_unlocked).toEqual([]);
    expect(await badgeRepo.findByUserId(userId.id)).toHaveLength(0);
  });

  it("cria as conquistas com progresso e desbloqueia a que passou do limiar", async () => {
    await credit(ScoreTypeEnum.QR_SCAN, 10);
    await credit(ScoreTypeEnum.REQUEST_ACCEPTED, 50);
    await credit(ScoreTypeEnum.REQUEST_SENT, 25);
    await credit(ScoreTypeEnum.REQUEST_SENT, 25);

    const out = await useCase.execute({ user_id: userId.id });

    const iniciante = await badgeOf(BadgeTypeEnum.INICIANTE_MUSICAL);
    expect(iniciante?.progress).toBe(110);
    expect(iniciante?.is_unlocked).toBe(true);
    expect(out.newly_unlocked).toEqual([BadgeTypeEnum.INICIANTE_MUSICAL]);

    // Acima de 100 PONTOS e ainda assim válida — o `@Max(100)` antigo a recusaria.
    const superFa = await badgeOf(BadgeTypeEnum.SUPER_FA);
    expect(superFa?.progress).toBe(110);
    expect(superFa?.is_unlocked).toBe(false);

    expect((await badgeOf(BadgeTypeEnum.SUGESTOR_CRIATIVO))?.progress).toBe(50);
    expect(await badgeOf(BadgeTypeEnum.MECENAS)).toBeNull();
  });

  it("é idempotente: rodar de novo não duplica nem re-anuncia desbloqueio", async () => {
    await credit(ScoreTypeEnum.QR_SCAN, 120);
    await useCase.execute({ user_id: userId.id });

    const again = await useCase.execute({ user_id: userId.id });

    expect(again.newly_unlocked).toEqual([]);
    const all = await badgeRepo.findByUserId(userId.id);
    expect(
      all.filter((b) => b.badge_type.value === BadgeTypeEnum.INICIANTE_MUSICAL),
    ).toHaveLength(1);
  });

  it("corrige linha antiga escrita à mão para o valor do ledger", async () => {
    const stale = UserBadge.create({
      user_id: userId,
      badge_type: BadgeTypeEnum.APOIADOR,
    });
    stale.updateProgress(40);
    await badgeRepo.insert(stale);
    await credit(ScoreTypeEnum.TIP_GIVEN, 15);

    await useCase.execute({ user_id: userId.id });

    expect((await badgeOf(BadgeTypeEnum.APOIADOR))?.progress).toBe(15);
  });

  it("nunca revoga conquista já desbloqueada", async () => {
    const unlocked = UserBadge.create({
      user_id: userId,
      badge_type: BadgeTypeEnum.INICIANTE_MUSICAL,
    });
    unlocked.updateProgress(100);
    await badgeRepo.insert(unlocked);
    await credit(ScoreTypeEnum.QR_SCAN, 10);

    await useCase.execute({ user_id: userId.id });

    expect((await badgeOf(BadgeTypeEnum.INICIANTE_MUSICAL))?.is_unlocked).toBe(
      true,
    );
  });

  it("anuncia o desbloqueio quando uma linha existente cruza o limiar", async () => {
    await credit(ScoreTypeEnum.QR_SCAN, 60);
    await useCase.execute({ user_id: userId.id });
    await credit(ScoreTypeEnum.QR_SCAN, 60);

    const out = await useCase.execute({ user_id: userId.id });

    expect(out.newly_unlocked).toContain(BadgeTypeEnum.INICIANTE_MUSICAL);
  });

  it("não mistura o ledger de outra pessoa", async () => {
    await scoreRepo.insert(
      UserScore.fake()
        .aUserScore()
        .withUserId(new Uuid())
        .withScoreType(ScoreTypeEnum.QR_SCAN)
        .withPoints(500)
        .build(),
    );

    await useCase.execute({ user_id: userId.id });

    expect(await badgeRepo.findByUserId(userId.id)).toHaveLength(0);
  });
});
