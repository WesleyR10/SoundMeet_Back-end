import {
  InvalidUuidError,
  Uuid,
} from "../../../shared/domain/value-objects/uuid.vo";
import { UserScore, UserScoreId } from "../user-score.aggregate";
import { ScoreTypeEnum } from "../value-objects/score-type.vo";

describe("UserScore Unit Tests without validator", () => {
  beforeEach(() => {
    UserScore.prototype.validate = jest
      .fn()
      .mockImplementation(UserScore.prototype.validate);
  });

  test("constructor of user score", () => {
    const userScore = new UserScore({
      user_id: new Uuid("550e8400-e29b-41d4-a716-446655440000"),
      score_type: ScoreTypeEnum.QR_SCAN,
      points: 10,
    });

    expect(userScore.user_score_id).toBeInstanceOf(UserScoreId);
    expect(userScore.user_id).toBeInstanceOf(Uuid);
    expect(userScore.score_type).toBe(ScoreTypeEnum.QR_SCAN);
    expect(userScore.points).toBe(10);
    expect(userScore.reference_id).toBeNull();
    expect(userScore.description).toBeNull();
    expect(userScore.created_at).toBeInstanceOf(Date);
  });

  test("constructor with all props", () => {
    const createdAt = new Date();
    const validUuid = "550e8400-e29b-41d4-a716-446655440000";
    const userScore = new UserScore({
      user_score_id: new UserScoreId(validUuid),
      user_id: new Uuid("550e8400-e29b-41d4-a716-446655440001"),
      score_type: ScoreTypeEnum.TIP_GIVEN,
      points: 5,
      reference_id: "tip-789",
      description: "Tip for great performance",
      created_at: createdAt,
    });

    expect(userScore.user_score_id.id).toBe(validUuid);
    expect(userScore.user_id).toBeInstanceOf(Uuid);
    expect(userScore.score_type).toBe(ScoreTypeEnum.TIP_GIVEN);
    expect(userScore.points).toBe(5);
    expect(userScore.reference_id).toBe("tip-789");
    expect(userScore.description).toBe("Tip for great performance");
    expect(userScore.created_at).toBe(createdAt);
  });

  test("should create user score with create method", () => {
    const userScore = UserScore.create({
      user_id: new Uuid("550e8400-e29b-41d4-a716-446655440002"),
      score_type: ScoreTypeEnum.REQUEST_SENT,
      points: 25,
      description: "Request sent to musician",
    });

    expect(userScore.user_score_id).toBeInstanceOf(UserScoreId);
    expect(userScore.user_id).toBeInstanceOf(Uuid);
    expect(userScore.score_type).toBe(ScoreTypeEnum.REQUEST_SENT);
    expect(userScore.points).toBe(25);
    expect(userScore.description).toBe("Request sent to musician");
  });

  test("should change points", () => {
    const userScore = UserScore.fake().aUserScore().build();

    userScore.changePoints(50);
    expect(userScore.points).toBe(50);
  });

  test("should change description", () => {
    const userScore = UserScore.fake().aUserScore().build();

    userScore.changeDescription("Updated description");
    expect(userScore.description).toBe("Updated description");
  });

  test("should change reference id", () => {
    const userScore = UserScore.fake().aUserScore().build();

    userScore.updateReference("new-ref-123");
    expect(userScore.reference_id).toBe("new-ref-123");
  });

  test("should have an id", () => {
    const userScore = UserScore.fake().aUserScore().build();
    expect(userScore.user_score_id).toBeInstanceOf(UserScoreId);
  });

  test("should return json", () => {
    const userScore = UserScore.fake().aUserScore().build();
    const json = userScore.toJSON();

    expect(json).toMatchObject({
      user_score_id: userScore.user_score_id.id,
      user_id: userScore.user_id.id,
      score_type: userScore.score_type,
      points: userScore.points,
      reference_id: userScore.reference_id,
      description: userScore.description,
      created_at: userScore.created_at,
    });
  });

  test("should use fake builder", () => {
    const userScore = UserScore.fake().aUserScore().build();

    expect(userScore).toBeInstanceOf(UserScore);
    expect(userScore.user_score_id).toBeInstanceOf(UserScoreId);
    expect(userScore.user_id).toBeTruthy();
    expect(Object.values(ScoreTypeEnum)).toContain(userScore.score_type);
    expect(userScore.points).toBeGreaterThanOrEqual(0);
  });
});

describe("UserScore Unit Tests with validator", () => {
  test("should throw with invalid uuid", () => {
    expect(() => new Uuid("invalid-uuid")).toThrow(InvalidUuidError);
  });

  test("should include errors with invalid points", () => {
    const userScore = UserScore.create({
      user_id: new Uuid("550e8400-e29b-41d4-a716-446655440000"),
      score_type: ScoreTypeEnum.QR_SCAN,
      points: -1,
    });
    expect(userScore.notification.hasErrors()).toBe(true);
    expect(userScore.notification.toJSON()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          points: expect.arrayContaining(["points must not be less than 0"]),
        }),
      ]),
    );
  });

  test("should include errors with invalid score_type", () => {
    const userScore = UserScore.create({
      user_id: new Uuid("550e8400-e29b-41d4-a716-446655440000"),
      score_type: "INVALID_TYPE" as ScoreTypeEnum,
      points: 10,
    });
    expect(userScore.notification.hasErrors()).toBe(true);
    expect(userScore.notification.toJSON()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          score_type: expect.arrayContaining([
            "score_type must be a valid ScoreType",
          ]),
        }),
      ]),
    );
  });

  test("should validate successfully with valid data", () => {
    const userScore = UserScore.create({
      user_id: new Uuid("550e8400-e29b-41d4-a716-446655440000"),
      score_type: ScoreTypeEnum.QR_SCAN,
      points: 10,
      description: "Valid description",
    });
    expect(userScore.notification.hasErrors()).toBe(false);
  });
});
