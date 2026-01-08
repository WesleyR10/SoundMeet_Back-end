import { Audience } from "../../../domain/audience.aggregate";

export type AudienceOutput = {
  id: string;
  email: string;
  name: string;
  nickname: string | null;
  avatar: string | null;
  phone: string | null;
  points: {
    total: number;
    monthly: number;
    last_updated: Date;
  };
  level: {
    level: number;
    name: string;
    min_points: number;
    max_points: number;
    benefits: string[];
  };
  preferences: {
    favorite_genres: string[];
    favorite_artists: string[];
    favorite_instruments: string[];
    preferred_languages: string[];
    notification_settings: any;
    privacy_settings: any;
    music_discovery_settings: any;
  };
  notification_settings: any;
  privacy_settings: any;
  discovery_settings: any;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  display_name: string;
  current_level: number;
  level_name: string;
  points_to_next_level: number;
  max_requests_per_event: number;
  has_vip_access: boolean;
  can_access_exclusive_content: boolean;
  is_profile_complete: boolean;
  is_highly_engaged: boolean;
  is_new_user: boolean;
};

export class AudienceOutputMapper {
  static toOutput(entity: Audience): AudienceOutput {
    const { audience_id, ...otherProps } = entity.toJSON();
    return {
      id: audience_id,
      ...otherProps,
      favorite_genres: entity.favorite_genres,
      favorite_artists: entity.favorite_artists,
      favorite_instruments: entity.favorite_instruments,
      notification_settings: entity.preferences.notificationSettings,
      privacy_settings: entity.preferences.privacySettings,
      discovery_settings: entity.preferences.musicDiscoverySettings,
      display_name: entity.displayName,
      current_level: entity.currentLevel,
      level_name: entity.levelName,
      points_to_next_level: entity.pointsToNextLevel,
      max_requests_per_event: entity.maxRequestsPerEvent,
      has_vip_access: entity.hasVipAccess,
      can_access_exclusive_content: entity.canAccessExclusiveContent,
      is_profile_complete: entity.isProfileComplete,
      is_highly_engaged: entity.isHighlyEngaged,
      is_new_user: entity.isNewUser,
    } as AudienceOutput;
  }
}
