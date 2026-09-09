import { GamificationController } from "../gamification.controller";
import {
  BadgeCollectionPresenter,
  BadgePresenter,
  RankingCollectionPresenter,
  UserPointsPresenter,
} from "../gamification.presenter";

const now = new Date("2026-06-19T12:00:00.000Z");

function userPointsOutput(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "22222222-2222-4222-8222-222222222222",
    total_points: 150,
    total_scans: 2,
    total_requests: 3,
    total_tips: 1,
    total_social_shares: 0,
    current_level: 2,
    level_info: {
      level: 2,
      name: "Fã",
      min_points: 100,
      max_points: 300,
      benefits: [],
    },
    progress_to_next_level: 25,
    is_top_fan: false,
    is_active_supporter: true,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function badgeOutput(overrides: Record<string, unknown> = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Top Fan",
    description: "Engajamento alto",
    icon: "star",
    category: "engagement",
    requirement: { points: 100 },
    points: 100,
    rarity: "common",
    is_active: true,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function rankingOutput(overrides: Record<string, unknown> = {}) {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    user_id: "22222222-2222-4222-8222-222222222222",
    ranking_type: "points",
    period: "weekly",
    position: 1,
    score: 150,
    period_start: now,
    period_end: now,
    created_at: now,
    updated_at: now,
    is_current_period: true,
    is_top_position: true,
    position_medal: "gold",
    ranking_description: "Ranking semanal",
    period_description: "Semana atual",
    ...overrides,
  };
}

function inject(
  controller: GamificationController,
  key: string,
  execute = jest.fn(),
) {
  (controller as any)[key] = { execute };
  return execute;
}

describe("GamificationController Unit Tests", () => {
  let controller: GamificationController;

  beforeEach(() => {
    controller = new GamificationController();
  });

  it("should render leaderboard using user points presenter", async () => {
    const execute = inject(
      controller,
      "getLeaderboardUseCase",
      jest.fn().mockResolvedValue([userPointsOutput()]),
    );

    const output = await controller.leaderboard({ limit: 10 });

    expect(execute).toHaveBeenCalledWith({ limit: 10 });
    expect(output).toHaveLength(1);
    expect(output[0]).toBeInstanceOf(UserPointsPresenter);
    expect(output[0].total_points).toBe(150);
  });

  it("should return null when user points projection is missing", async () => {
    inject(
      controller,
      "getUserPointsUseCase",
      jest.fn().mockResolvedValue(null),
    );

    const adminUser = {
      userId: "22222222-2222-4222-8222-222222222222",
      roles: ["admin"],
      establishmentIds: [],
      bandIds: [],
      isAdmin: true,
    };

    await expect(
      controller.getUserPoints(
        "22222222-2222-4222-8222-222222222222",
        adminUser,
      ),
    ).resolves.toBeNull();
  });

  it("should render badge and collection presenters", async () => {
    inject(
      controller,
      "getBadgeUseCase",
      jest.fn().mockResolvedValue(badgeOutput()),
    );
    inject(
      controller,
      "listBadgesUseCase",
      jest.fn().mockResolvedValue({
        items: [badgeOutput()],
        current_page: 1,
        per_page: 10,
        last_page: 1,
        total: 1,
      }),
    );

    const badge = await controller.getBadge(
      "33333333-3333-4333-8333-333333333333",
    );
    const collection = await controller.listBadges({ page: 1, per_page: 10 });

    expect(badge).toBeInstanceOf(BadgePresenter);
    expect(collection).toBeInstanceOf(BadgeCollectionPresenter);
    expect(collection.data).toHaveLength(1);
  });

  it("should render ranking collection presenter", async () => {
    inject(
      controller,
      "listRankingsUseCase",
      jest.fn().mockResolvedValue({
        items: [rankingOutput()],
        current_page: 1,
        per_page: 10,
        last_page: 1,
        total: 1,
      }),
    );

    const collection = await controller.listRankings({ page: 1, per_page: 10 });

    expect(collection).toBeInstanceOf(RankingCollectionPresenter);
    expect(collection.data[0].position).toBe(1);
  });
});
