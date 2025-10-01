import { Audience, AudienceId } from "../../../domain/audience.aggregate";
import { Email } from "../../../../shared/domain/value-objects/email.vo";
import { Phone } from "../../../../shared/domain/value-objects/phone.vo";
import { AudienceModel } from "./audience-model";
import { AudiencePreferences } from "../../../../shared/domain/value-objects/audience-preferences.vo";

export type AudienceModelProps = AudienceModel;

export class AudienceModelMapper {
  static toModel(entity: Audience): AudienceModelProps {
    const model = {
      id: entity.id.id,
      email: entity.email.value,
      name: entity.name,
      nickname: entity.nickname,
      avatar: entity.avatar,
      phone: entity.phone?.value || null,
      points: entity.points.total,
      monthly_points: entity.points.monthly,
      level: entity.level.level,
      favorite_genres: entity.preferences.favoriteGenres,
      favorite_artists: entity.preferences.favoriteArtists,
      preferred_languages: entity.preferences.preferredLanguages,
      location: null, // TODO: Implementar location no aggregate
      social_links: null, // TODO: Implementar social_links no aggregate
      notification_settings: entity.preferences.notificationSettings,
      privacy_settings: entity.preferences.privacySettings,
      discovery_settings: entity.preferences.musicDiscoverySettings,
      badges: entity.badges,
      is_active: entity.is_active,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };

    // Remove propriedades undefined para evitar problemas no Prisma
    Object.keys(model).forEach((key) => {
      if (model[key as keyof typeof model] === undefined) {
        delete model[key as keyof typeof model];
      }
    });

    return model;
  }

  static toEntity(model: AudienceModel): Audience {
    const preferences = new AudiencePreferences({
      favoriteGenres: model.favorite_genres || [],
      favoriteArtists: model.favorite_artists || [],
      preferredLanguages: model.preferred_languages || ["pt-BR"],
      notificationSettings: {
        pushNotifications: true,
        emailNotifications: true,
        smsNotifications: false,
        musicRequestNotifications: true,
        tipNotifications: true,
        eventNotifications: true,
        rankingNotifications: true,
        ...(model.notification_settings || {}),
      },
      privacySettings: {
        profileVisibility: "public",
        showRealName: true,
        showLocation: false,
        showFavoriteGenres: true,
        showFavoriteArtists: true,
        showTipHistory: false,
        showRanking: true,
        ...(model.privacy_settings || {}),
      },
      musicDiscoverySettings: {
        enableSmartSuggestions: true,
        discoverySensitivity: "medium",
        includeNewGenres: true,
        includeInternationalMusic: true,
        maxSuggestionsPerSession: 10,
        ...(model.discovery_settings || {}),
      },
    });

    return new Audience({
      id: new AudienceId(model.id),
      email: model.email,
      name: model.name,
      nickname: model.nickname,
      avatar: model.avatar,
      phone: model.phone,
      points: { total: model.points, monthly: model.monthly_points },
      level: model.level,
      preferences,
      badges: model.badges || [],
      is_active: model.is_active,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }
}
