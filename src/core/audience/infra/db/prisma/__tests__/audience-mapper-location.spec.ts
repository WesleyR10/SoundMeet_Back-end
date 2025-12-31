import { PrismaClient } from "@prisma/client";

import { AudiencePreferences } from "../../../../../shared/domain/value-objects/audience-preferences.vo";
import { Audience } from "../../../../domain/audience.aggregate";
import { AudienceModelMapper } from "../audience-model-mapper";
import { AudiencePrismaRepository } from "../audience-prisma.repository";

describe("AudiencePrismaRepository - Mapper Integration", () => {
  let repository: AudiencePrismaRepository;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = {
      audience: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    } as any;
    repository = new AudiencePrismaRepository(prisma);
  });

  describe("Location and Social Links Mapping", () => {
    it("should correctly map location and social links to model", async () => {
      const audience = new Audience({
        email: "test@example.com",
        name: "Test User",
        preferences: new AudiencePreferences({
          favoriteGenres: ["Rock"],
          favoriteArtists: ["Artist 1"],
          favoriteInstruments: ["Guitar"],
          preferredLanguages: ["pt-BR"],
          location: {
            latitude: -23.5505,
            longitude: -46.6333,
            city: "São Paulo",
            state: "SP",
          },
          socialLinks: {
            instagram: "@testuser",
            spotify: "spotify:user:test",
          },
          notificationSettings: {
            pushNotifications: true,
            emailNotifications: true,
            smsNotifications: false,
            musicRequestNotifications: true,
            tipNotifications: true,
            eventNotifications: true,
            rankingNotifications: true,
          },
          privacySettings: {
            profileVisibility: "public",
            showRealName: true,
            showLocation: true,
            showFavoriteGenres: true,
            showFavoriteArtists: true,
            showTipHistory: false,
            showRanking: true,
          },
          musicDiscoverySettings: {
            enableSmartSuggestions: true,
            discoverySensitivity: "medium",
            includeNewGenres: true,
            includeInternationalMusic: true,
            maxSuggestionsPerSession: 10,
          },
        }),
      });

      const model = AudienceModelMapper.toModel(audience);

      expect(model.location).toEqual({
        latitude: -23.5505,
        longitude: -46.6333,
        city: "São Paulo",
        state: "SP",
      });
      expect(model.social_links).toEqual({
        instagram: "@testuser",
        spotify: "spotify:user:test",
        twitter: undefined,
        facebook: undefined,
        youtube: undefined,
      });
    });

    it("should correctly map location and social links from model to entity", async () => {
      const model = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        email: "test@example.com",
        name: "Test User",
        points: 0,
        monthly_points: 0,
        level: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
        location: {
          latitude: -23.5505,
          longitude: -46.6333,
          city: "São Paulo",
          state: "SP",
        },
        social_links: {
          instagram: "@testuser",
          spotify: "spotify:user:test",
        },
        favorite_genres: ["Rock"],
        favorite_artists: ["Artist 1"],
        favorite_instruments: ["Guitar"],
        preferred_languages: ["pt-BR"],
        notification_settings: {},
        privacy_settings: {},
        discovery_settings: {},
      };

      const entity = AudienceModelMapper.toEntity(model as any);

      expect(entity.preferences.location).toEqual({
        latitude: -23.5505,
        longitude: -46.6333,
        city: "São Paulo",
        state: "SP",
      });
      expect(entity.preferences.socialLinks).toEqual({
        instagram: "@testuser",
        spotify: "spotify:user:test",
        twitter: undefined,
        facebook: undefined,
        youtube: undefined,
      });
    });

    it("should handle null location and social links", async () => {
      const audience = new Audience({
        email: "test@example.com",
        name: "Test User",
        preferences: new AudiencePreferences({
          favoriteGenres: [],
          favoriteArtists: [],
          favoriteInstruments: [],
          preferredLanguages: ["pt-BR"],
          location: null,
          socialLinks: null,
          notificationSettings: {
            pushNotifications: true,
            emailNotifications: true,
            smsNotifications: false,
            musicRequestNotifications: true,
            tipNotifications: true,
            eventNotifications: true,
            rankingNotifications: true,
          },
          privacySettings: {
            profileVisibility: "public",
            showRealName: true,
            showLocation: false,
            showFavoriteGenres: true,
            showFavoriteArtists: true,
            showTipHistory: false,
            showRanking: true,
          },
          musicDiscoverySettings: {
            enableSmartSuggestions: true,
            discoverySensitivity: "medium",
            includeNewGenres: true,
            includeInternationalMusic: true,
            maxSuggestionsPerSession: 10,
          },
        }),
      });

      const model = AudienceModelMapper.toModel(audience);

      expect(model.location).toBeNull();
      expect(model.social_links).toBeNull();
    });
  });
});
