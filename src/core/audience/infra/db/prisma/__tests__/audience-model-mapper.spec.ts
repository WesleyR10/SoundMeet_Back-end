import { Audience, AudienceId } from "../../../../domain/audience.aggregate";
import { Email } from "../../../../../shared/domain/value-objects/email.vo";
import { Phone } from "../../../../../shared/domain/value-objects/phone.vo";
import { AudienceFakeBuilder } from "../../../../domain/audience-fake.builder";
import {
  AudienceModelMapper,
  AudienceModelProps,
} from "../audience-model-mapper";

describe("AudienceModelMapper", () => {
  describe("toModel", () => {
    it("should convert entity to model with all properties", () => {
      const audience = AudienceFakeBuilder.anAudience()
        .withName("John Doe")
        .withNickname("Johnny")
        .withEmail("john@example.com")
        .withAvatar("avatar.jpg")
        .withPhone("+5511999999999")
        .withTotalPoints(1000)
        .withCurrentLevel(5)
        .withBadges(["Iniciante", "Sugestor"])
        .withFavoriteGenres(["Rock", "Pop"])
        .withFavoriteArtists(["Beatles", "Queen"])
        .activate()
        .build();

      const model = AudienceModelMapper.toModel(audience);

      expect(model).toEqual({
        id: audience.id.id,
        email: audience.email.value,
        name: audience.name,
        nickname: audience.nickname,
        avatar: audience.avatar,
        phone: audience.phone?.value,
        points: audience.points.total,
        monthly_points: audience.points.monthly,
        level: audience.level.level,
        badges: audience.badges,
        favorite_genres: audience.favorite_genres,
        favorite_artists: audience.favorite_artists,
        preferred_languages: audience.preferences.preferredLanguages,
        notification_settings: audience.notification_settings,
        privacy_settings: audience.privacy_settings,
        discovery_settings: audience.discovery_settings,
        location: null, // TODO: Implementar no aggregate
        social_links: null, // TODO: Implementar no aggregate
        is_active: audience.is_active,
        created_at: audience.created_at,
        updated_at: audience.updated_at,
      });
    });

    it("should convert entity to model with minimal properties", () => {
      const audience = AudienceFakeBuilder.anAudience()
        .withName("Jane Doe")
        .withEmail("jane@example.com")
        .build();

      const model = AudienceModelMapper.toModel(audience);

      expect(model.id).toBe(audience.id.id);
      expect(model.email).toBe(audience.email.value);
      expect(model.name).toBe(audience.name);
      expect(model.location).toBeNull();
      expect(model.social_links).toBeNull();
      expect(model.is_active).toBe(audience.is_active);
      expect(model.created_at).toBe(audience.created_at);
      expect(model.updated_at).toBe(audience.updated_at);
    });
  });

  describe("toEntity", () => {
    it("should convert model to entity with all properties", () => {
      const model: AudienceModelProps = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        email: "john@example.com",
        name: "John Doe",
        nickname: "Johnny",
        avatar: "avatar.jpg",
        phone: "+5511999999999",
        points: 1000,
        monthly_points: 500,
        level: 5,
        badges: ["Iniciante", "Sugestor"],
        favorite_genres: ["Rock", "Pop"],
        favorite_artists: ["Beatles", "Queen"],
        preferred_languages: ["pt-BR", "en-US"],
        notification_settings: { email: true, push: true },
        privacy_settings: { profile_visible: true },
        discovery_settings: { show_location: false },
        location: null,
        social_links: null,
        is_active: true,
        created_at: new Date("2023-01-01"),
        updated_at: new Date("2023-01-02"),
      };

      const entity = AudienceModelMapper.toEntity(model);

      expect(entity.id.id).toBe(model.id);
      expect(entity.email.value).toBe(model.email);
      expect(entity.name).toBe(model.name);
      expect(entity.nickname).toBe(model.nickname);
      expect(entity.avatar).toBe(model.avatar);
      expect(entity.phone?.value).toBe(model.phone);
      expect(entity.points.total).toBe(model.points);
      expect(entity.points.monthly).toBe(model.monthly_points);
      expect(entity.level.level).toBe(model.level);
      expect(entity.badges).toEqual(model.badges);
      expect(entity.favorite_genres).toEqual(model.favorite_genres);
      expect(entity.favorite_artists).toEqual(model.favorite_artists);
      expect(entity.preferences.preferredLanguages).toEqual(
        model.preferred_languages,
      );
      expect(entity.preferences.notificationSettings).toMatchObject(
        model.notification_settings,
      );
      expect(entity.preferences.privacySettings).toMatchObject(
        model.privacy_settings,
      );
      expect(entity.preferences.musicDiscoverySettings).toMatchObject(
        model.discovery_settings,
      );
      expect(entity.is_active).toBe(model.is_active);
      expect(entity.created_at).toEqual(model.created_at);
      expect(entity.updated_at).toEqual(model.updated_at);
    });

    it("should convert model to entity with minimal properties", () => {
      const model: AudienceModelProps = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        email: "jane@example.com",
        name: "Jane Doe",
        nickname: null,
        avatar: null,
        phone: null,
        points: 0,
        monthly_points: 0,
        level: 1,
        badges: [],
        favorite_genres: [],
        favorite_artists: [],
        preferred_languages: [],
        notification_settings: {},
        privacy_settings: {},
        discovery_settings: {},
        location: null,
        social_links: null,
        is_active: true,
        created_at: new Date("2023-01-01"),
        updated_at: new Date("2023-01-01"),
      };

      const entity = AudienceModelMapper.toEntity(model);

      expect(entity.id.id).toBe(model.id);
      expect(entity.email.value).toBe(model.email);
      expect(entity.name).toBe(model.name);
      expect(entity.nickname).toBeNull();
      expect(entity.avatar).toBeNull();
      expect(entity.phone).toBeNull();
      expect(entity.points.total).toBe(0);
      expect(entity.points.monthly).toBe(0);
      expect(entity.level.level).toBe(1);
      expect(entity.is_active).toBe(true);
    });

    it("should handle invalid email gracefully", () => {
      const model: AudienceModelProps = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        email: "invalid-email",
        name: "John Doe",
        nickname: null,
        avatar: null,
        phone: null,
        points: 0,
        monthly_points: 0,
        level: 1,
        badges: [],
        favorite_genres: [],
        favorite_artists: [],
        preferred_languages: [],
        notification_settings: {},
        privacy_settings: {},
        discovery_settings: {},
        location: null,
        social_links: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      expect(() => AudienceModelMapper.toEntity(model)).toThrow();
    });

    it("should handle invalid phone gracefully", () => {
      const model: AudienceModelProps = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        email: "john@example.com",
        name: "John Doe",
        nickname: null,
        avatar: null,
        phone: "invalid-phone",
        points: 0,
        monthly_points: 0,
        level: 1,
        badges: [],
        favorite_genres: [],
        favorite_artists: [],
        preferred_languages: [],
        notification_settings: {},
        privacy_settings: {},
        discovery_settings: {},
        location: null,
        social_links: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      expect(() => AudienceModelMapper.toEntity(model)).toThrow();
    });
  });
});
