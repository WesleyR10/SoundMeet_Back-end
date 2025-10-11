import { UserPoints, UserPointsId } from "../user-points.aggregate";
import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { UserLevel } from "../value-objects/user-level.vo";

describe("UserPoints Unit Tests without validator", () => {
  beforeEach(() => {
    UserPoints.prototype.validate = jest
      .fn()
      .mockImplementation(UserPoints.prototype.validate);
  });

  test("constructor of user points", () => {
    const userPoints = new UserPoints({
      user_id: new Uuid("550e8400-e29b-41d4-a716-446655440000"),
      total_points: 100,
      current_level: 2,
    });

    expect(userPoints.id).toBeInstanceOf(UserPointsId);
    expect(userPoints.user_id).toBeInstanceOf(Uuid);
    expect(userPoints.user_id.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(userPoints.total_points).toBe(100);
    expect(userPoints.current_level).toBe(2);
    expect(userPoints.is_active).toBe(true);
    expect(userPoints.created_at).toBeInstanceOf(Date);
    expect(userPoints.updated_at).toBeInstanceOf(Date);
  });

  test("constructor with all props", () => {
    const createdAt = new Date();
    const updatedAt = new Date();
    const userPoints = new UserPoints({
      id: new UserPointsId("550e8400-e29b-41d4-a716-446655440002"),
      user_id: new Uuid("550e8400-e29b-41d4-a716-446655440001"),
      total_points: 250,
      current_level: 5,
      is_active: false,
      created_at: createdAt,
      updated_at: updatedAt,
    });

    expect(userPoints.id.id).toBe("550e8400-e29b-41d4-a716-446655440002");
    expect(userPoints.user_id).toBeInstanceOf(Uuid);
    expect(userPoints.user_id.id).toBe("550e8400-e29b-41d4-a716-446655440001");
    expect(userPoints.total_points).toBe(250);
    expect(userPoints.current_level).toBe(5);
    expect(userPoints.is_active).toBe(false);
    expect(userPoints.created_at).toBe(createdAt);
    expect(userPoints.updated_at).toBe(updatedAt);
  });

  test("should create user points with create method", () => {
    const userPoints = UserPoints.create({
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      total_points: 50,
      current_level: 1,
    });

    expect(userPoints.id).toBeInstanceOf(UserPointsId);
    expect(userPoints.user_id).toBeInstanceOf(Uuid);
    expect(userPoints.user_id.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(userPoints.total_points).toBe(50);
    expect(userPoints.current_level).toBe(1);
    expect(userPoints.is_active).toBe(true);
    expect(userPoints.validate).toHaveBeenCalledTimes(1);
  });

  test("should add points", () => {
    const userPoints = UserPoints.fake()
      .aUserPoints()
      .withTotalPoints(100)
      .build();

    userPoints.addPoints(50);
    expect(userPoints.total_points).toBe(150);
    expect(userPoints.updated_at).toBeInstanceOf(Date);
    expect(userPoints.validate).toHaveBeenCalledWith(["total_points"]);
  });

  test("should subtract points", () => {
    const userPoints = UserPoints.fake()
      .aUserPoints()
      .withTotalPoints(100)
      .build();

    userPoints.subtractPoints(30);
    expect(userPoints.total_points).toBe(70);
    expect(userPoints.updated_at).toBeInstanceOf(Date);
    expect(userPoints.validate).toHaveBeenCalledWith(["total_points"]);
  });

  test("should not subtract more points than available", () => {
    const userPoints = UserPoints.fake()
      .aUserPoints()
      .withTotalPoints(50)
      .build();

    userPoints.subtractPoints(100);
    expect(userPoints.total_points).toBe(0);
  });

  test("should update level", () => {
    const userPoints = UserPoints.fake().aUserPoints().build();

    userPoints.updateLevel(3);
    expect(userPoints.current_level).toBe(3);
    expect(userPoints.updated_at).toBeInstanceOf(Date);
    expect(userPoints.validate).toHaveBeenCalledWith(["current_level"]);
  });

  test("should activate user points", () => {
    const userPoints = UserPoints.fake().aUserPoints().inactive().build();

    userPoints.activate();
    expect(userPoints.is_active).toBe(true);
    expect(userPoints.updated_at).toBeInstanceOf(Date);
  });

  test("should deactivate user points", () => {
    const userPoints = UserPoints.fake().aUserPoints().active().build();

    userPoints.deactivate();
    expect(userPoints.is_active).toBe(false);
    expect(userPoints.updated_at).toBeInstanceOf(Date);
  });

  test("should get user level info", () => {
    const userPoints = UserPoints.fake()
      .aUserPoints()
      .withTotalPoints(300)
      .build();

    const levelInfo = userPoints.getUserLevel();
    expect(levelInfo).toBeInstanceOf(UserLevel);
    expect(levelInfo.level).toBe(3);
  });

  test("should check if level up is needed", () => {
    const userPoints = UserPoints.fake()
      .aUserPoints()
      .withTotalPoints(200)
      .withCurrentLevel(1)
      .build();

    const needsLevelUp = userPoints.needsLevelUp();
    expect(needsLevelUp).toBe(true);
  });

  test("should return entity_id", () => {
    const userPoints = UserPoints.fake().aUserPoints().build();
    expect(userPoints.entity_id).toBe(userPoints.id);
  });

  test("should return json", () => {
    const userPoints = UserPoints.fake().aUserPoints().build();
    const json = userPoints.toJSON();

    expect(json).toMatchObject({
      id: userPoints.id.id,
      user_id: userPoints.user_id.id,
      total_points: userPoints.total_points,
      total_scans: userPoints.total_scans,
      total_requests: userPoints.total_requests,
      total_tips: userPoints.total_tips,
      total_social_shares: userPoints.total_social_shares,
      current_level: userPoints.current_level,
      is_active: userPoints.is_active,
      created_at: userPoints.created_at,
      updated_at: userPoints.updated_at,
    });
  });

  test("should use fake builder", () => {
    const userPoints = UserPoints.fake().aUserPoints().build();

    expect(userPoints).toBeInstanceOf(UserPoints);
    expect(userPoints.id).toBeInstanceOf(UserPointsId);
    expect(userPoints.user_id).toBeInstanceOf(Uuid);
    expect(userPoints.total_points).toBeGreaterThanOrEqual(0);
    expect(userPoints.current_level).toBeGreaterThanOrEqual(1);
    expect(typeof userPoints.is_active).toBe("boolean");
  });

  test("should use fake builder with specific values", () => {
    const userPoints = UserPoints.fake()
      .aUserPoints()
      .withTotalPoints(500)
      .withCurrentLevel(10)
      .active()
      .build();

    expect(userPoints.total_points).toBe(500);
    expect(userPoints.current_level).toBe(10);
    expect(userPoints.is_active).toBe(true);
  });
});

describe("UserPoints Unit Tests with validator", () => {
  test("should have validation errors with invalid user_id", () => {
    // Testamos com um UUID válido mas depois modificamos diretamente o campo
    const userPoints = UserPoints.create({
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      total_points: 100,
      current_level: 2,
    });

    // Modificamos o user_id para null para testar a validação
    (userPoints as any).user_id = null;
    userPoints.validate(["user_id"]);
    expect(userPoints.notification.hasErrors()).toBe(true);
  });

  test("should have validation errors with negative total_points", () => {
    const userPoints = UserPoints.create({
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      total_points: -10,
      current_level: 2,
    });
    userPoints.validate(["total_points"]);
    expect(userPoints.notification.hasErrors()).toBe(true);
  });

  test("should have validation errors with invalid current_level", () => {
    const userPoints = UserPoints.create({
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      total_points: 100,
      current_level: 0,
    });
    userPoints.validate(["current_level"]);
    expect(userPoints.notification.hasErrors()).toBe(true);
  });

  test("should validate successfully with valid data", () => {
    expect(() => {
      UserPoints.create({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        total_points: 100,
        current_level: 1,
      });
    }).not.toThrow();
  });
});
