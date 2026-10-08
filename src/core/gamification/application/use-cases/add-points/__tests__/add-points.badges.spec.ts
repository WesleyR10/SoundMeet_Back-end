import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { BadgeTypeEnum } from "../../../../domain/value-objects/badge-type.vo";
import { PointsSourceEnum } from "../../../../domain/value-objects/points-source.vo";
import { UserBadgeInMemoryRepository } from "../../../../infra/db/in-memory/user-badge-in-memory.repository";
import { UserPointsInMemoryRepository } from "../../../../infra/db/in-memory/user-points-in-memory.repository";
import { UserScoreInMemoryRepository } from "../../../../infra/db/in-memory/user-score-in-memory.repository";
import { SyncUserBadgesUseCase } from "../../sync-user-badges/sync-user-badges.use-case";
import { AddPointsUseCase } from "../add-points.use-case";

describe("AddPointsUseCase — conquistas", () => {
  let pointsRepo: UserPointsInMemoryRepository;
  let scoreRepo: UserScoreInMemoryRepository;
  let badgeRepo: UserBadgeInMemoryRepository;
  let sync: SyncUserBadgesUseCase;
  let useCase: AddPointsUseCase;
  const userId = new Uuid().id;

  beforeEach(() => {
    pointsRepo = new UserPointsInMemoryRepository();
    scoreRepo = new UserScoreInMemoryRepository();
    badgeRepo = new UserBadgeInMemoryRepository();
    sync = new SyncUserBadgesUseCase(scoreRepo, badgeRepo);
    useCase = new AddPointsUseCase(pointsRepo, scoreRepo, sync);
  });

  it("pontuar avança a conquista — antes nada avançava conquista nenhuma", async () => {
    await useCase.execute({
      user_id: userId,
      source: PointsSourceEnum.REQUEST,
    });

    const badge = await badgeRepo.findByUserAndBadgeType(
      userId,
      BadgeTypeEnum.SUGESTOR_CRIATIVO,
    );
    expect(badge?.progress).toBe(25);
  });

  it("falha nas conquistas NÃO derruba o crédito que já foi gravado", async () => {
    jest.spyOn(sync, "execute").mockRejectedValueOnce(new Error("db down"));

    const out = await useCase.execute({
      user_id: userId,
      source: PointsSourceEnum.SCAN_QR,
    });

    expect(out.total_points).toBe(10);
    expect(await scoreRepo.getTotalPointsByUser(userId)).toBe(10);
  });
});
