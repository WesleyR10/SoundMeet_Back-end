import { Badge } from "../../../../domain/badge.aggregate";
import { BadgeModelMapper, BadgePrismaModel } from "../badge-model-mapper";

describe("BadgeModelMapper", () => {
  describe("toModel", () => {
    it("should convert entity to model with all properties", () => {
      const badge = Badge.fake()
        .aBadge()
        .withName("First Like")
        .withDescription("Received your first like")
        .withIcon("👍")
        .withCategory("engagement")
        .withRequirement({ type: "likes", value: 1 })
        .withPoints(10)
        .withRarity("common")
        .activate()
        .build();

      const model = BadgeModelMapper.toModel(badge);

      expect(model).toEqual({
        id: badge.badge_id.id,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        category: badge.category,
        requirement: badge.requirement,
        points: badge.points,
        rarity: badge.rarity,
        is_active: badge.is_active,
        created_at: badge.created_at,
        updated_at: badge.updated_at,
      });
    });

    it("should convert entity to model with minimal properties", () => {
      const badge = Badge.fake()
        .aBadge()
        .withName("Basic Badge")
        .withDescription("A basic badge")
        .withIcon("🏆")
        .withCategory("engagement")
        .withRequirement({ type: "task", value: "complete_basic" })
        .withPoints(5)
        .withRarity("common")
        .deactivate()
        .build();

      const model = BadgeModelMapper.toModel(badge);

      expect(model).toEqual({
        id: badge.badge_id.id,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        category: badge.category,
        requirement: badge.requirement,
        points: badge.points,
        rarity: badge.rarity,
        is_active: badge.is_active,
        created_at: badge.created_at,
        updated_at: badge.updated_at,
      });
    });
  });

  describe("toEntity", () => {
    it("should convert model to entity with all properties", () => {
      const model: BadgePrismaModel = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Master Musician",
        description: "Achieved mastery in music",
        icon: "🎵",
        category: "achievement",
        requirement: { type: "performances", value: 100 },
        points: 500,
        rarity: "legendary",
        is_active: true,
        created_at: new Date("2024-01-01T00:00:00.000Z"),
      };

      const entity = BadgeModelMapper.toEntity(model);

      expect(entity.badge_id.id).toBe(model.id);
      expect(entity.name).toBe(model.name);
      expect(entity.description).toBe(model.description);
      expect(entity.icon).toBe(model.icon);
      expect(entity.category).toBe(model.category);
      expect(entity.requirement).toBe(model.requirement);
      expect(entity.points).toBe(model.points);
      expect(entity.rarity).toBe(model.rarity);
      expect(entity.is_active).toBe(model.is_active);
      expect(entity.created_at).toEqual(model.created_at);
    });

    it("should convert model to entity with inactive badge", () => {
      const model: BadgePrismaModel = {
        id: "456e7890-e89b-12d3-a456-426614174001",
        name: "Inactive Badge",
        description: "This badge is inactive",
        icon: "❌",
        category: "discovery",
        requirement: { type: "unavailable", value: null },
        points: 0,
        rarity: "common",
        is_active: false,
        created_at: new Date("2023-01-01T00:00:00.000Z"),
      };

      const entity = BadgeModelMapper.toEntity(model);

      expect(entity.badge_id.id).toBe(model.id);
      expect(entity.name).toBe(model.name);
      expect(entity.description).toBe(model.description);
      expect(entity.icon).toBe(model.icon);
      expect(entity.category).toBe(model.category);
      expect(entity.requirement).toBe(model.requirement);
      expect(entity.points).toBe(model.points);
      expect(entity.rarity).toBe(model.rarity);
      expect(entity.is_active).toBe(model.is_active);
      expect(entity.created_at).toEqual(model.created_at);
    });
  });

  describe("bidirectional conversion", () => {
    it("should maintain data integrity in both directions", () => {
      const originalBadge = Badge.fake()
        .aBadge()
        .withName("Test Badge")
        .withDescription("Test description")
        .withIcon("🧪")
        .withCategory("social")
        .withRequirement({ type: "test", value: "requirement" })
        .withPoints(25)
        .withRarity("rare")
        .activate()
        .build();

      const model = BadgeModelMapper.toModel(originalBadge);
      const convertedBadge = BadgeModelMapper.toEntity(model);

      expect(convertedBadge.badge_id.id).toBe(originalBadge.badge_id.id);
      expect(convertedBadge.name).toBe(originalBadge.name);
      expect(convertedBadge.description).toBe(originalBadge.description);
      expect(convertedBadge.icon).toBe(originalBadge.icon);
      expect(convertedBadge.category).toBe(originalBadge.category);
      expect(convertedBadge.requirement).toBe(originalBadge.requirement);
      expect(convertedBadge.points).toBe(originalBadge.points);
      expect(convertedBadge.rarity).toBe(originalBadge.rarity);
      expect(convertedBadge.is_active).toBe(originalBadge.is_active);
      expect(convertedBadge.created_at).toEqual(originalBadge.created_at);
    });
  });
});
