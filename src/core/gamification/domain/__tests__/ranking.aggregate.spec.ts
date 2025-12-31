import { EntityValidationError } from "../../../shared/domain/validators/validation.error";
import { Ranking, RankingId } from "../ranking.aggregate";
import {
  RankingPeriodEnum,
  RankingTypeEnum,
} from "../value-objects/ranking-type.vo";

describe("Ranking Unit Tests without validator", () => {
  beforeEach(() => {
    Ranking.prototype.validate = jest
      .fn()
      .mockImplementation(Ranking.prototype.validate);
  });

  test("constructor of ranking", () => {
    const ranking = new Ranking({
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      ranking_type: RankingTypeEnum.TOP_FAS,
      period: RankingPeriodEnum.WEEKLY,
      position: 1,
      score: 500,
      period_start: new Date("2024-01-01"),
      period_end: new Date("2024-01-07"),
    });

    expect(ranking.id).toBeInstanceOf(RankingId);
    expect(ranking.user_id.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(ranking.ranking_type.value).toBe(RankingTypeEnum.TOP_FAS);
    expect(ranking.period.value).toBe(RankingPeriodEnum.WEEKLY);
    expect(ranking.position).toBe(1);
    expect(ranking.score).toBe(500);
    expect(ranking.period_start).toEqual(new Date("2024-01-01"));
    expect(ranking.period_end).toEqual(new Date("2024-01-07"));
    expect(ranking.created_at).toBeInstanceOf(Date);
    expect(ranking.updated_at).toBeInstanceOf(Date);
  });

  test("constructor with all props", () => {
    const createdAt = new Date();
    const updatedAt = new Date();
    const ranking = new Ranking({
      id: new RankingId(),
      user_id: "550e8400-e29b-41d4-a716-446655440001",
      ranking_type: RankingTypeEnum.TOP_APOIADORES,
      period: RankingPeriodEnum.MONTHLY,
      position: 3,
      score: 250,
      period_start: new Date("2024-01-01"),
      period_end: new Date("2024-01-31"),
      created_at: createdAt,
      updated_at: updatedAt,
    });

    expect(ranking.id).toBeInstanceOf(RankingId);
    expect(ranking.user_id.id).toBe("550e8400-e29b-41d4-a716-446655440001");
    expect(ranking.ranking_type.value).toBe(RankingTypeEnum.TOP_APOIADORES);
    expect(ranking.period.value).toBe(RankingPeriodEnum.MONTHLY);
    expect(ranking.position).toBe(3);
    expect(ranking.score).toBe(250);
    expect(ranking.created_at).toBe(createdAt);
    expect(ranking.updated_at).toBe(updatedAt);
  });

  test("should create ranking with create method", () => {
    const ranking = Ranking.create({
      user_id: "550e8400-e29b-41d4-a716-446655440002",
      ranking_type: RankingTypeEnum.TOP_FAS,
      period: RankingPeriodEnum.DAILY,
      position: 2,
      score: 150,
      period_start: new Date("2024-01-01"),
      period_end: new Date("2024-01-02"),
    });

    expect(ranking.id).toBeInstanceOf(RankingId);
    expect(ranking.user_id.id).toBe("550e8400-e29b-41d4-a716-446655440002");
    expect(ranking.ranking_type.value).toBe(RankingTypeEnum.TOP_FAS);
    expect(ranking.period.value).toBe(RankingPeriodEnum.DAILY);
    expect(ranking.position).toBe(2);
    expect(ranking.score).toBe(150);
    expect(ranking.validate).toHaveBeenCalledWith([
      "user_id",
      "ranking_type",
      "period",
      "position",
      "score",
      "period_start",
      "period_end",
    ]);
  });

  test("should update position", () => {
    const ranking = Ranking.fake().aRanking().build();

    ranking.updatePosition(5);
    expect(ranking.position).toBe(5);
    expect(ranking.updated_at).toBeInstanceOf(Date);
    expect(ranking.validate).toHaveBeenCalledWith(["position"]);
  });

  test("should update score", () => {
    const ranking = Ranking.fake().aRanking().build();

    ranking.updateScore(750);
    expect(ranking.score).toBe(750);
    expect(ranking.updated_at).toBeInstanceOf(Date);
    expect(ranking.validate).toHaveBeenCalledWith(["score"]);
  });

  test("should update period", () => {
    const ranking = Ranking.fake().aRanking().build();
    const newStart = new Date("2024-02-01");
    const newEnd = new Date("2024-02-07");

    ranking.updatePeriod(newStart, newEnd);
    expect(ranking.period_start).toBe(newStart);
    expect(ranking.period_end).toBe(newEnd);
    expect(ranking.updated_at).toBeInstanceOf(Date);
    expect(ranking.validate).toHaveBeenCalledWith([
      "period_start",
      "period_end",
    ]);
  });

  test("should activate ranking", () => {
    const ranking = Ranking.fake().aRanking().inactive().build();

    ranking.activate();
    expect(ranking.is_active).toBe(true);
    expect(ranking.updated_at).toBeInstanceOf(Date);
  });

  test("should deactivate ranking", () => {
    const ranking = Ranking.fake().aRanking().active().build();

    ranking.deactivate();
    expect(ranking.is_active).toBe(false);
    expect(ranking.updated_at).toBeInstanceOf(Date);
  });

  test("should check if period is current", () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const ranking = Ranking.fake()
      .aRanking()
      .withPeriod(yesterday, tomorrow)
      .build();

    expect(ranking.isCurrentPeriod()).toBe(true);
  });

  test("should check if period is not current", () => {
    const yesterday = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const ranking = Ranking.fake()
      .aRanking()
      .withPeriod(twoDaysAgo, yesterday)
      .build();

    expect(ranking.isCurrentPeriod()).toBe(false);
  });

  test("should return entity_id", () => {
    const ranking = Ranking.fake().aRanking().build();
    expect(ranking.entity_id).toBe(ranking.id);
  });

  test("should return json", () => {
    const ranking = Ranking.fake().aRanking().build();
    const json = ranking.toJSON();

    expect(json).toMatchObject({
      id: ranking.id.id,
      user_id: ranking.user_id.id,
      ranking_type: ranking.ranking_type.value,
      period: ranking.period.value,
      position: ranking.position,
      score: ranking.score,
      period_start: ranking.period_start,
      period_end: ranking.period_end,
      created_at: ranking.created_at,
      updated_at: ranking.updated_at,
    });
  });

  test("should use fake builder", () => {
    const ranking = Ranking.fake().aRanking().build();

    expect(ranking).toBeInstanceOf(Ranking);
    expect(ranking.id).toBeInstanceOf(RankingId);
    expect(ranking.user_id).toBeTruthy();
    expect(Object.values(RankingTypeEnum)).toContain(
      ranking.ranking_type.value,
    );
    expect(Object.values(RankingPeriodEnum)).toContain(ranking.period.value);
    expect(ranking.position).toBeGreaterThan(0);
    expect(ranking.score).toBeGreaterThanOrEqual(0);
    expect(ranking.period_start).toBeInstanceOf(Date);
    expect(ranking.period_end).toBeInstanceOf(Date);
  });

  test("should use fake builder with specific values", () => {
    const periodStart = new Date("2024-01-01");
    const periodEnd = new Date("2024-01-07");

    const ranking = Ranking.fake()
      .aRanking()
      .withPosition(1)
      .withScore(1000)
      .withPeriod(periodStart, periodEnd)
      .build();

    expect(ranking.position).toBe(1);
    expect(ranking.score).toBe(1000);
    expect(ranking.period_start).toBe(periodStart);
    expect(ranking.period_end).toBe(periodEnd);
  });
});

describe("Ranking Unit Tests with validator", () => {
  test("should throw EntityValidationError with invalid user_id", () => {
    expect(() => {
      Ranking.create({
        user_id: "",
        ranking_type: RankingTypeEnum.TOP_FAS,
        period: RankingPeriodEnum.WEEKLY,
        position: 1,
        score: 500,
        period_start: new Date("2024-01-01"),
        period_end: new Date("2024-01-07"),
      });
    }).toThrow(EntityValidationError);
  });

  test("should throw EntityValidationError with invalid position", () => {
    expect(() => {
      Ranking.create({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        ranking_type: RankingTypeEnum.TOP_FAS,
        period: RankingPeriodEnum.WEEKLY,
        position: 0,
        score: 500,
        period_start: new Date("2024-01-01"),
        period_end: new Date("2024-01-07"),
      });
    }).toThrow(EntityValidationError);
  });

  test("should throw EntityValidationError with negative points", () => {
    expect(() => {
      Ranking.create({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        ranking_type: RankingTypeEnum.TOP_FAS,
        period: RankingPeriodEnum.WEEKLY,
        position: 1,
        score: -10,
        period_start: new Date("2024-01-01"),
        period_end: new Date("2024-01-07"),
      });
    }).toThrow(EntityValidationError);
  });

  test("should throw EntityValidationError with invalid ranking_type", () => {
    expect(() => {
      Ranking.create({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        ranking_type: "INVALID_TYPE" as RankingTypeEnum,
        period: RankingPeriodEnum.WEEKLY,
        position: 1,
        score: 500,
        period_start: new Date("2024-01-01"),
        period_end: new Date("2024-01-07"),
      });
    }).toThrow(EntityValidationError);
  });

  test("should throw EntityValidationError when period_end is before period_start", () => {
    expect(() => {
      Ranking.create({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        ranking_type: RankingTypeEnum.TOP_FAS,
        period: RankingPeriodEnum.WEEKLY,
        position: 1,
        score: 500,
        period_start: new Date("2024-01-07"),
        period_end: new Date("2024-01-01"),
      });
    }).toThrow(EntityValidationError);
  });

  test("should validate successfully with valid data", () => {
    expect(() => {
      Ranking.create({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        ranking_type: RankingTypeEnum.TOP_FAS,
        period: RankingPeriodEnum.WEEKLY,
        position: 1,
        score: 500,
        period_start: new Date("2024-01-01"),
        period_end: new Date("2024-01-07"),
      });
    }).not.toThrow();
  });
});
