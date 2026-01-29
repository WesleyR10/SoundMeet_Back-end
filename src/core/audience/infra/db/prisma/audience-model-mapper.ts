import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { AudiencePreferences } from "../../../../shared/domain/value-objects/audience-preferences.vo";
import { Audience, AudienceId } from "../../../domain/audience.aggregate";
import { AudienceModel } from "./audience-model";

export type AudienceModelProps = AudienceModel;

export class AudienceModelMapper {
  static toModel(entity: Audience): AudienceModelProps {
    const model = {
      id: entity.audience_id.id,
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
      favorite_instruments: entity.preferences.favoriteInstruments,
      preferred_languages: entity.preferences.preferredLanguages,
      location: entity.preferences.location
        ? {
            latitude: entity.preferences.location.latitude,
            longitude: entity.preferences.location.longitude,
            city: entity.preferences.location.city,
            state: entity.preferences.location.state,
          }
        : null,
      social_links: entity.preferences.socialLinks
        ? {
            instagram: entity.preferences.socialLinks.instagram,
            twitter: entity.preferences.socialLinks.twitter,
            facebook: entity.preferences.socialLinks.facebook,
            youtube: entity.preferences.socialLinks.youtube,
            spotify: entity.preferences.socialLinks.spotify,
          }
        : null,
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
      favoriteInstruments: model.favorite_instruments || [],
      preferredLanguages: model.preferred_languages || ["pt-BR"],
      location: model.location
        ? {
            latitude: (model.location as any).latitude,
            longitude: (model.location as any).longitude,
            city: (model.location as any).city,
            state: (model.location as any).state,
          }
        : undefined,
      socialLinks: model.social_links
        ? {
            instagram: (model.social_links as any).instagram,
            twitter: (model.social_links as any).twitter,
            facebook: (model.social_links as any).facebook,
            youtube: (model.social_links as any).youtube,
            spotify: (model.social_links as any).spotify,
          }
        : undefined,
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

    const entity = new Audience({
      audience_id: new AudienceId(model.id),
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

    entity.validate();
    if (entity.notification.hasErrors()) {
      throw new LoadEntityError(entity.notification.toJSON());
    }

    return entity;
  }
}
