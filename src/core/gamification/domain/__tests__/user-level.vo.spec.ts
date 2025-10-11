import { UserLevel } from "../value-objects/user-level.vo";

describe("UserLevel Unit Tests", () => {
  test("should create UserLevel with constructor", () => {
    const userLevel = new UserLevel({
      level: 1,
      name: "Novato",
      minPoints: 0,
      maxPoints: 99,
      benefits: ["Acesso básico ao app"],
    });

    expect(userLevel.level).toBe(1);
    expect(userLevel.name).toBe("Novato");
    expect(userLevel.minPoints).toBe(0);
    expect(userLevel.maxPoints).toBe(99);
    expect(userLevel.benefits).toEqual(["Acesso básico ao app"]);
  });

  test("should create level 1 (Novato)", () => {
    const level = UserLevel.level1();
    expect(level.level).toBe(1);
    expect(level.name).toBe("Novato");
    expect(level.minPoints).toBe(0);
    expect(level.maxPoints).toBe(99);
    expect(level.benefits).toContain("Acesso básico ao app");
  });

  test("should create level 2 (Fã)", () => {
    const level = UserLevel.level2();
    expect(level.level).toBe(2);
    expect(level.name).toBe("Fã");
    expect(level.minPoints).toBe(100);
    expect(level.maxPoints).toBe(299);
    expect(level.benefits).toContain("Desconto de 5% em gorjetas");
  });

  test("should create level 3 (Apoiador)", () => {
    const level = UserLevel.level3();
    expect(level.level).toBe(3);
    expect(level.name).toBe("Apoiador");
    expect(level.minPoints).toBe(300);
    expect(level.maxPoints).toBe(599);
    expect(level.benefits).toContain("Desconto de 10% em gorjetas");
  });

  test("should create level 4 (VIP)", () => {
    const level = UserLevel.level4();
    expect(level.level).toBe(4);
    expect(level.name).toBe("VIP");
    expect(level.minPoints).toBe(600);
    expect(level.maxPoints).toBe(999);
    expect(level.benefits).toContain("Acesso prioritário a eventos");
  });

  test("should create level 5 (Lenda)", () => {
    const level = UserLevel.level5();
    expect(level.level).toBe(5);
    expect(level.name).toBe("Lenda");
    expect(level.minPoints).toBe(1000);
    expect(level.maxPoints).toBe(Number.MAX_SAFE_INTEGER);
    expect(level.benefits).toContain("Todos os benefícios anteriores");
  });

  test("should get level by points", () => {
    expect(UserLevel.getLevelByPoints(0).level).toBe(1);
    expect(UserLevel.getLevelByPoints(50).level).toBe(1);
    expect(UserLevel.getLevelByPoints(99).level).toBe(1);
    expect(UserLevel.getLevelByPoints(100).level).toBe(2);
    expect(UserLevel.getLevelByPoints(250).level).toBe(2);
    expect(UserLevel.getLevelByPoints(299).level).toBe(2);
    expect(UserLevel.getLevelByPoints(300).level).toBe(3);
    expect(UserLevel.getLevelByPoints(500).level).toBe(3);
    expect(UserLevel.getLevelByPoints(599).level).toBe(3);
    expect(UserLevel.getLevelByPoints(600).level).toBe(4);
    expect(UserLevel.getLevelByPoints(800).level).toBe(4);
    expect(UserLevel.getLevelByPoints(999).level).toBe(4);
    expect(UserLevel.getLevelByPoints(1000).level).toBe(5);
    expect(UserLevel.getLevelByPoints(5000).level).toBe(5);
  });

  test("should check if is max level", () => {
    expect(UserLevel.level1().isMaxLevel()).toBe(false);
    expect(UserLevel.level2().isMaxLevel()).toBe(false);
    expect(UserLevel.level3().isMaxLevel()).toBe(false);
    expect(UserLevel.level4().isMaxLevel()).toBe(false);
    expect(UserLevel.level5().isMaxLevel()).toBe(true);
  });

  test("should get next level", () => {
    expect(UserLevel.level1().getNextLevel()?.level).toBe(2);
    expect(UserLevel.level2().getNextLevel()?.level).toBe(3);
    expect(UserLevel.level3().getNextLevel()?.level).toBe(4);
    expect(UserLevel.level4().getNextLevel()?.level).toBe(5);
    expect(UserLevel.level5().getNextLevel()).toBeNull();
  });

  test("should calculate progress to next level", () => {
    const level1 = UserLevel.level1();
    expect(level1.getProgressToNextLevel(0)).toBe(0);
    expect(level1.getProgressToNextLevel(50)).toBe(50);
    expect(level1.getProgressToNextLevel(99)).toBe(99);

    const level2 = UserLevel.level2();
    expect(level2.getProgressToNextLevel(100)).toBe(0);
    expect(level2.getProgressToNextLevel(200)).toBe(50);
    expect(level2.getProgressToNextLevel(299)).toBe(99.5);

    const level5 = UserLevel.level5();
    expect(level5.getProgressToNextLevel(1000)).toBe(100);
    expect(level5.getProgressToNextLevel(5000)).toBe(100);
  });

  test("should throw error for invalid level", () => {
    expect(() => {
      UserLevel.getLevelByPoints(-1);
    }).toThrow("Points cannot be negative");
  });

  test("should have all levels with correct order", () => {
    const levels = [
      UserLevel.level1(),
      UserLevel.level2(),
      UserLevel.level3(),
      UserLevel.level4(),
      UserLevel.level5(),
    ];

    for (let i = 0; i < levels.length - 1; i++) {
      expect(levels[i].level).toBeLessThan(levels[i + 1].level);
      expect(levels[i].maxPoints).toBeLessThan(levels[i + 1].minPoints);
    }
  });
});
