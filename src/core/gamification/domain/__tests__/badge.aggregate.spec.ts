import { EntityValidationError } from "../../../shared/domain/validators/validation.error";
import { Badge, BadgeId } from "../badge.aggregate";

describe("Badge Unit Tests without validator", () => {
  beforeEach(() => {
    Badge.prototype.validate = jest
      .fn()
      .mockImplementation(Badge.prototype.validate);
  });

  test("constructor of badge", () => {
    const badge = new Badge({
      name: "Iniciante Musical",
      description: "Primeira interação com o app",
      icon: "🎵",
      category: "engagement",
      requirement: { scans: 1 },
      points: 0,
      rarity: "common",
    });

    expect(badge.id).toBeInstanceOf(BadgeId);
    expect(badge.name).toBe("Iniciante Musical");
    expect(badge.description).toBe("Primeira interação com o app");
    expect(badge.icon).toBe("🎵");
    expect(badge.category).toBe("engagement");
    expect(badge.requirement).toEqual({ scans: 1 });
    expect(badge.points).toBe(0);
    expect(badge.rarity).toBe("common");
    expect(badge.is_active).toBe(true);
    expect(badge.created_at).toBeInstanceOf(Date);
    expect(badge.updated_at).toBeInstanceOf(Date);
  });

  test("constructor with all props", () => {
    const createdAt = new Date();
    const updatedAt = new Date();
    const badge = new Badge({
      id: new BadgeId("550e8400-e29b-41d4-a716-446655440002"),
      name: "Super Fã",
      description: "Fã dedicado com muitas interações",
      icon: "⭐",
      category: "support",
      requirement: { tips: 10, requests: 50 },
      points: 500,
      rarity: "legendary",
      is_active: false,
      created_at: createdAt,
      updated_at: updatedAt,
    });

    expect(badge.id.id).toBe("550e8400-e29b-41d4-a716-446655440002");
    expect(badge.name).toBe("Super Fã");
    expect(badge.description).toBe("Fã dedicado com muitas interações");
    expect(badge.icon).toBe("⭐");
    expect(badge.category).toBe("support");
    expect(badge.requirement).toEqual({ tips: 10, requests: 50 });
    expect(badge.points).toBe(500);
    expect(badge.rarity).toBe("legendary");
    expect(badge.is_active).toBe(false);
    expect(badge.created_at).toBe(createdAt);
    expect(badge.updated_at).toBe(updatedAt);
  });

  test("id field", () => {
    const badge = new Badge({
      name: "Test Badge",
      description: "Test description",
      icon: "🎵",
      category: "engagement",
      requirement: { scans: 1 },
      points: 0,
      rarity: "common",
    });
    expect(badge.id).toBeInstanceOf(BadgeId);
    expect(badge.entity_id).toBeInstanceOf(BadgeId);
    expect(badge.entity_id).toBe(badge.id);
  });

  describe("create command", () => {
    test("should create a badge", () => {
      const badge = Badge.create({
        name: "Explorador",
        description: "Primeira exploração do app",
        icon: "🔍",
        category: "discovery",
        requirement: { first_scan: true },
      });

      expect(badge.id).toBeInstanceOf(BadgeId);
      expect(badge.name).toBe("Explorador");
      expect(badge.description).toBe("Primeira exploração do app");
      expect(badge.icon).toBe("🔍");
      expect(badge.category).toBe("discovery");
      expect(badge.requirement).toEqual({ first_scan: true });
      expect(badge.points).toBe(0);
      expect(badge.rarity).toBe("common");
      expect(badge.is_active).toBe(true);
      expect(Badge.prototype.validate).toHaveBeenCalledTimes(1);
    });

    test("should create a badge with optional props", () => {
      const badge = Badge.create({
        name: "Mecenas",
        description: "Grande apoiador dos músicos",
        icon: "💰",
        category: "support",
        requirement: { total_tips: 1000 },
        points: 1000,
        rarity: "epic",
        is_active: false,
      });

      expect(badge.points).toBe(1000);
      expect(badge.rarity).toBe("epic");
      expect(badge.is_active).toBe(false);
    });
  });

  describe("business methods", () => {
    let badge: Badge;

    beforeEach(() => {
      badge = new Badge({
        name: "Test Badge",
        description: "Test description",
        icon: "🎵",
        category: "engagement",
        requirement: { scans: 1 },
        points: 0,
        rarity: "common",
      });
    });

    test("changeName", () => {
      const oldUpdatedAt = badge.updated_at;
      badge.changeName("New Badge Name");
      expect(badge.name).toBe("New Badge Name");
      expect(badge.updated_at).not.toBe(oldUpdatedAt);
      expect(Badge.prototype.validate).toHaveBeenCalledWith(["name"]);
    });

    test("changeDescription", () => {
      const oldUpdatedAt = badge.updated_at;
      badge.changeDescription("New description");
      expect(badge.description).toBe("New description");
      expect(badge.updated_at).not.toBe(oldUpdatedAt);
      expect(Badge.prototype.validate).toHaveBeenCalledWith(["description"]);
    });

    test("changeIcon", () => {
      const oldUpdatedAt = badge.updated_at;
      badge.changeIcon("🎸");
      expect(badge.icon).toBe("🎸");
      expect(badge.updated_at).not.toBe(oldUpdatedAt);
      expect(Badge.prototype.validate).toHaveBeenCalledWith(["icon"]);
    });

    test("updateRequirement", () => {
      const oldUpdatedAt = badge.updated_at;
      const newRequirement = { scans: 5, requests: 2 };
      badge.updateRequirement(newRequirement);
      expect(badge.requirement).toEqual(newRequirement);
      expect(badge.updated_at).not.toBe(oldUpdatedAt);
      expect(Badge.prototype.validate).toHaveBeenCalledWith(["requirement"]);
    });

    test("updatePoints", () => {
      const oldUpdatedAt = badge.updated_at;
      badge.updatePoints(100);
      expect(badge.points).toBe(100);
      expect(badge.updated_at).not.toBe(oldUpdatedAt);
      expect(Badge.prototype.validate).toHaveBeenCalledWith(["points"]);
    });

    test("changeRarity", () => {
      const oldUpdatedAt = badge.updated_at;
      badge.changeRarity("rare");
      expect(badge.rarity).toBe("rare");
      expect(badge.updated_at).not.toBe(oldUpdatedAt);
      expect(Badge.prototype.validate).toHaveBeenCalledWith(["rarity"]);
    });

    test("activate", () => {
      badge.deactivate();
      const oldUpdatedAt = badge.updated_at;
      badge.activate();
      expect(badge.is_active).toBe(true);
      expect(badge.updated_at).not.toBe(oldUpdatedAt);
    });

    test("deactivate", () => {
      const oldUpdatedAt = badge.updated_at;
      badge.deactivate();
      expect(badge.is_active).toBe(false);
      expect(badge.updated_at).not.toBe(oldUpdatedAt);
    });
  });

  describe("computed properties", () => {
    test("isRare should return true for rare, epic and legendary badges", () => {
      const commonBadge = new Badge({
        name: "Common",
        description: "Common badge",
        icon: "🎵",
        category: "engagement",
        requirement: {},
        points: 0,
        rarity: "common",
      });
      expect(commonBadge.isRare).toBe(false);

      const rareBadge = new Badge({
        name: "Rare",
        description: "Rare badge",
        icon: "🎵",
        category: "engagement",
        requirement: {},
        points: 100,
        rarity: "rare",
      });
      expect(rareBadge.isRare).toBe(true);

      const epicBadge = new Badge({
        name: "Epic",
        description: "Epic badge",
        icon: "🎵",
        category: "engagement",
        requirement: {},
        points: 500,
        rarity: "epic",
      });
      expect(epicBadge.isRare).toBe(true);

      const legendaryBadge = new Badge({
        name: "Legendary",
        description: "Legendary badge",
        icon: "🎵",
        category: "engagement",
        requirement: {},
        points: 1000,
        rarity: "legendary",
      });
      expect(legendaryBadge.isRare).toBe(true);
    });

    test("isLegendary should return true only for legendary badges", () => {
      const commonBadge = new Badge({
        name: "Common",
        description: "Common badge",
        icon: "🎵",
        category: "engagement",
        requirement: {},
        points: 0,
        rarity: "common",
      });
      expect(commonBadge.isLegendary).toBe(false);

      const legendaryBadge = new Badge({
        name: "Legendary",
        description: "Legendary badge",
        icon: "🎵",
        category: "engagement",
        requirement: {},
        points: 1000,
        rarity: "legendary",
      });
      expect(legendaryBadge.isLegendary).toBe(true);
    });
  });

  test("toJSON", () => {
    const badge = new Badge({
      name: "Test Badge",
      description: "Test description",
      icon: "🎵",
      category: "engagement",
      requirement: { scans: 1 },
      points: 50,
      rarity: "rare",
    });

    const json = badge.toJSON();
    expect(json).toEqual({
      id: badge.id.id,
      name: "Test Badge",
      description: "Test description",
      icon: "🎵",
      category: "engagement",
      requirement: { scans: 1 },
      points: 50,
      rarity: "rare",
      is_active: true,
      created_at: badge.created_at,
      updated_at: badge.updated_at,
    });
  });
});

describe("Badge Unit Tests with validator", () => {
  describe("create command", () => {
    test("should create a badge with valid data", () => {
      const badge = Badge.create({
        name: "Iniciante Musical",
        description: "Primeira interação com o app",
        icon: "🎵",
        category: "engagement",
        requirement: { scans: 1 },
      });

      expect(badge.id).toBeInstanceOf(BadgeId);
      expect(badge.name).toBe("Iniciante Musical");
    });

    test("should include errors with invalid name", () => {
      const badge = Badge.create({
        name: "",
        description: "Test description",
        icon: "🎵",
        category: "engagement",
        requirement: { scans: 1 },
      });
      expect(badge.notification.hasErrors()).toBe(true);
    });

    test("should include errors with invalid description", () => {
      const badge = Badge.create({
        name: "Test Badge",
        description: "",
        icon: "🎵",
        category: "engagement",
        requirement: { scans: 1 },
      });
      expect(badge.notification.hasErrors()).toBe(true);
    });

    test("should include errors with invalid category", () => {
      const badge = Badge.create({
        name: "Test Badge",
        description: "Test description",
        icon: "🎵",
        category: "invalid" as any,
        requirement: { scans: 1 },
      });
      expect(badge.notification.hasErrors()).toBe(true);
    });
  });

  describe("business methods validation", () => {
    let badge: Badge;

    beforeEach(() => {
      badge = Badge.create({
        name: "Test Badge",
        description: "Test description",
        icon: "🎵",
        category: "engagement",
        requirement: { scans: 1 },
      });
    });

    test("changeName should include errors with invalid name", () => {
      badge.changeName("");
      expect(badge.notification.hasErrors()).toBe(true);
    });

    test("changeDescription should include errors with invalid description", () => {
      badge.changeDescription("");
      expect(badge.notification.hasErrors()).toBe(true);
    });

    test("updatePoints should include errors with negative points", () => {
      badge.updatePoints(-1);
      expect(badge.notification.hasErrors()).toBe(true);
    });
  });
});
