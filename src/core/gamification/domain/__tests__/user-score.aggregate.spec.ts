import { EntityValidationError } from "../../../shared/domain/validators/validation.error";
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
      user_id: "user-123",
      score_type: ScoreTypeEnum.QR_SCAN,
      points: 10,
    });

    expect(userScore.id).toBeInstanceOf(UserScoreId);
    expect(userScore.user_id.id).toBe("user-123");
    expect(userScore.score_type.value).toBe(ScoreTypeEnum.QR_SCAN);
    expect(userScore.points).toBe(10);
    expect(userScore.reference_id).toBeNull();
    expect(userScore.description).toBeNull();
    expect(userScore.created_at).toBeInstanceOf(Date);
  });

  test("constructor with all props", () => {
    const createdAt = new Date();
    const validUuid = "550e8400-e29b-41d4-a716-446655440000";
    const userScore = new UserScore({
      id: new UserScoreId(validUuid),
      user_id: "user-456",
      score_type: ScoreTypeEnum.TIP_GIVEN,
      points: 5,
      reference_id: "tip-789",
      description: "Tip for great performance",
      created_at: createdAt,
    });

    expect(userScore.id.id).toBe(validUuid);
    expect(userScore.user_id.id).toBe("user-456");
    expect(userScore.score_type.value).toBe(ScoreTypeEnum.TIP_GIVEN);
    expect(userScore.points).toBe(5);
    expect(userScore.reference_id).toBe("tip-789");
    expect(userScore.description).toBe("Tip for great performance");
    expect(userScore.created_at).toBe(createdAt);
  });

  test("should create user score with create method", () => {
    const userScore = UserScore.create({
      user_id: "user-123",
      score_type: ScoreTypeEnum.REQUEST_SENT,
      points: 25,
      description: "Request sent to musician",
    });

    expect(userScore.id).toBeInstanceOf(UserScoreId);
    expect(userScore.user_id.id).toBe("user-123");
    expect(userScore.score_type.value).toBe(ScoreTypeEnum.REQUEST_SENT);
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

  test("should return entity_id", () => {
    const userScore = UserScore.fake().aUserScore().build();
    expect(userScore.entity_id).toBe(userScore.id);
  });

  test("should return json", () => {
    const userScore = UserScore.fake().aUserScore().build();
    const json = userScore.toJSON();

    expect(json).toMatchObject({
      id: userScore.id.id,
      user_id: userScore.user_id.id,
      score_type: userScore.score_type.value,
      points: userScore.points,
      reference_id: userScore.reference_id,
      description: userScore.description,
      created_at: userScore.created_at,
    });
  });

  test("should use fake builder", () => {
    const userScore = UserScore.fake().aUserScore().build();

    expect(userScore).toBeInstanceOf(UserScore);
    expect(userScore.id).toBeInstanceOf(UserScoreId);
    expect(userScore.user_id).toBeTruthy();
    expect(Object.values(ScoreTypeEnum)).toContain(userScore.score_type.value);
    expect(userScore.points).toBeGreaterThanOrEqual(0);
  });
});

describe("UserScore Unit Tests with validator", () => {
  test("should throw EntityValidationError with invalid user_id", () => {
    expect(() => {
      UserScore.create({
        user_id: "",
        score_type: ScoreTypeEnum.QR_SCAN,
        points: 10,
      });
    }).toThrow(EntityValidationError);
  });

  test("should throw EntityValidationError with invalid points", () => {
    expect(() => {
      UserScore.create({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        score_type: ScoreTypeEnum.QR_SCAN,
        points: -1,
      });
    }).toThrow(EntityValidationError);
  });

  test("should throw EntityValidationError with invalid score_type", () => {
    expect(() => {
      UserScore.create({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        score_type: "INVALID_TYPE" as ScoreTypeEnum,
        points: 10,
      });
    }).toThrow(EntityValidationError);
  });

  test("should validate successfully with valid data", () => {
    expect(() => {
      UserScore.create({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        score_type: ScoreTypeEnum.QR_SCAN,
        points: 10,
        description: "Valid description",
      });
    }).not.toThrow();
  });
});
