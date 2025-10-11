import { UserBadge, UserBadgeId } from "../user-badge.aggregate";
import { BadgeType, BadgeTypeEnum } from "../value-objects/badge-type.vo";
import { UserBadgeValidatorFactory } from "../user-badge.validator";
import { EntityValidationError } from "../../../shared/domain/validators/validation.error";

describe("UserBadge Unit Tests without validator", () => {
  beforeEach(() => {
    UserBadge.prototype.validate = jest
      .fn()
      .mockImplementation(UserBadge.prototype.validate);
  });

  test("constructor of user badge", () => {
    const userBadge = new UserBadge({
      user_id: "550e8400-e29b-41d4-a716-446655440003",
      badge_type: BadgeTypeEnum.INICIANTE_MUSICAL,
    });

    expect(userBadge.id).toBeInstanceOf(UserBadgeId);
    expect(userBadge.user_id.id).toBe("550e8400-e29b-41d4-a716-446655440003");
    expect(userBadge.badge_type.value).toBe(BadgeTypeEnum.INICIANTE_MUSICAL);
    expect(userBadge.progress).toBe(0);
    expect(userBadge.is_unlocked).toBe(false);
    expect(userBadge.created_at).toBeInstanceOf(Date);
  });

  test("should create user badge with constructor", () => {
    const userBadge = new UserBadge({
      id: UserBadgeId.create(),
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      badge_type: BadgeTypeEnum.APOIADOR,
      progress: 50,
      is_unlocked: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    expect(userBadge).toBeInstanceOf(UserBadge);
    expect(userBadge.id).toBeInstanceOf(UserBadgeId);
    expect(userBadge.user_id.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(userBadge.badge_type.value).toBe(BadgeTypeEnum.APOIADOR);
    expect(userBadge.progress).toBe(50);
    expect(userBadge.is_unlocked).toBe(false);
    expect(userBadge.created_at).toBeInstanceOf(Date);
  });

  test("constructor with all props", () => {
    const createdAt = new Date();
    const updatedAt = new Date();
    const userBadge = new UserBadge({
      id: UserBadgeId.create(),
      user_id: "550e8400-e29b-41d4-a716-446655440001",
      badge_type: BadgeTypeEnum.APOIADOR,
      progress: 50,
      is_unlocked: true,
      unlocked_at: createdAt,
      created_at: createdAt,
      updated_at: updatedAt,
    });

    expect(userBadge.id).toBeInstanceOf(UserBadgeId);
    expect(userBadge.user_id.id).toBe("550e8400-e29b-41d4-a716-446655440001");
    expect(userBadge.badge_type.value).toBe(BadgeTypeEnum.APOIADOR);
    expect(userBadge.progress).toBe(50);
    expect(userBadge.is_unlocked).toBe(true);
    expect(userBadge.unlocked_at).toBe(createdAt);
    expect(userBadge.created_at).toBe(createdAt);
    expect(userBadge.updated_at).toBe(updatedAt);
  });

  test("should create user badge with create method", () => {
    const userBadge = UserBadge.create({
      user_id: "550e8400-e29b-41d4-a716-446655440002",
      badge_type: BadgeTypeEnum.MECENAS,
      progress: 25,
      is_unlocked: false,
    });

    expect(userBadge).toBeInstanceOf(UserBadge);
    expect(userBadge.id).toBeInstanceOf(UserBadgeId);
    expect(userBadge.user_id.id).toBe("550e8400-e29b-41d4-a716-446655440002");
    expect(userBadge.badge_type.value).toBe(BadgeTypeEnum.MECENAS);
    expect(userBadge.progress).toBe(25);
    expect(userBadge.is_unlocked).toBe(false);
    expect(userBadge.created_at).toBeInstanceOf(Date);
    userBadge.validate();
  });

  test("should unlock badge when progress is sufficient", () => {
    const userBadge = UserBadge.fake().aUserBadge().build();
    userBadge.updateProgress(userBadge.badge_type.getRequiredPoints());

    expect(userBadge.is_unlocked).toBe(true);
    expect(userBadge.unlocked_at).toBeInstanceOf(Date);
  });

  test("should not unlock badge when progress is insufficient", () => {
    const userBadge = UserBadge.fake().aUserBadge().build();
    userBadge.updateProgress(10); // Assuming this is less than required

    expect(userBadge.is_unlocked).toBe(false);
    expect(userBadge.unlocked_at).toBeNull();
  });

  test("should return entity_id", () => {
    const userBadge = UserBadge.fake().aUserBadge().build();
    expect(userBadge.entity_id).toBe(userBadge.id);
  });

  test("should return json", () => {
    const userBadge = UserBadge.fake().aUserBadge().build();
    const json = userBadge.toJSON();

    expect(json).toMatchObject({
      id: userBadge.id.id,
      user_id: userBadge.user_id.id,
      badge_type: userBadge.badge_type.value,
      progress: userBadge.progress,
      is_unlocked: userBadge.is_unlocked,
      unlocked_at: userBadge.unlocked_at,
      progress_percentage: userBadge.getProgressPercentage(),
      remaining_points: userBadge.getRemainingPoints(),
      description: userBadge.getBadgeDescription(),
      created_at: userBadge.created_at,
      updated_at: userBadge.updated_at,
    });
  });

  test("should use fake builder", () => {
    const userBadge = UserBadge.fake().aUserBadge().build();

    expect(userBadge).toBeInstanceOf(UserBadge);
    expect(userBadge.id).toBeInstanceOf(UserBadgeId);
    expect(userBadge.user_id).toBeTruthy();
    expect(Object.values(BadgeTypeEnum)).toContain(userBadge.badge_type.value);
    expect(userBadge.created_at).toBeInstanceOf(Date);
    expect(typeof userBadge.is_unlocked).toBe("boolean");
  });

  test("should use fake builder with unlocked state", () => {
    const userBadge = UserBadge.fake().aUserBadge().active().build();
    expect(userBadge.is_unlocked).toBe(true);
    expect(userBadge.unlocked_at).toBeInstanceOf(Date);
  });

  test("should use fake builder with locked state", () => {
    const userBadge = UserBadge.fake().aUserBadge().inactive().build();
    expect(userBadge.is_unlocked).toBe(false);
    expect(userBadge.unlocked_at).toBeNull();
  });
});

describe("UserBadge Unit Tests with validator", () => {
  test("should throw EntityValidationError with invalid user_id", () => {
    expect(() => {
      UserBadge.create({
        user_id: "",
        badge_type: BadgeTypeEnum.FIRST_TIP,
      });
    }).toThrow(EntityValidationError);
  });

  test("should throw EntityValidationError with invalid badge_type", () => {
    expect(() => {
      UserBadge.create({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        badge_type: "INVALID_TYPE" as BadgeTypeEnum,
      });
    }).toThrow(EntityValidationError);
  });

  test("should validate successfully with valid data", () => {
    expect(() => {
      UserBadge.create({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        badge_type: BadgeTypeEnum.INICIANTE_MUSICAL,
      });
    }).not.toThrow();
  });
});
