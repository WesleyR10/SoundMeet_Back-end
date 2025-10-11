import { ValueObject } from "../../../shared/domain/value-object";

// Base metadata interface
export interface BaseInteractionMetadata {
  timestamp?: string;
  source?: string;
}

// Specific metadata interfaces for each interaction type
export interface QrScanMetadata extends BaseInteractionMetadata {
  establishment_name?: string;
  establishment_id?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface TipMetadata extends BaseInteractionMetadata {
  amount: number;
  currency?: string;
  message?: string;
  establishment_name?: string;
}

export interface MusicRequestMetadata extends BaseInteractionMetadata {
  song_title: string;
  artist_name: string;
  message?: string;
  establishment_name?: string;
}

export interface SocialShareMetadata extends BaseInteractionMetadata {
  platform: string; // "instagram", "facebook", "twitter", etc.
  content_type: string; // "profile", "event", "song", etc.
  shared_content_id?: string;
}

export interface FollowMetadata extends BaseInteractionMetadata {
  followed_user_type: string; // "musician", "band", "establishment"
  followed_user_id: string;
}

export interface BadgeUnlockMetadata extends BaseInteractionMetadata {
  badge_id: string;
  badge_name: string;
  badge_type: string;
  requirements_met: Record<string, any>;
}

export interface LevelUpMetadata extends BaseInteractionMetadata {
  previous_level: number;
  new_level: number;
  points_required: number;
  total_points: number;
}

// Union type for all possible metadata
export type InteractionMetadata = 
  | QrScanMetadata
  | TipMetadata
  | MusicRequestMetadata
  | SocialShareMetadata
  | FollowMetadata
  | BadgeUnlockMetadata
  | LevelUpMetadata
  | null;

// Type guard functions
export class InteractionMetadataValidator {
  static isQrScanMetadata(metadata: any): metadata is QrScanMetadata {
    return metadata && typeof metadata === 'object';
  }

  static isTipMetadata(metadata: any): metadata is TipMetadata {
    return metadata && typeof metadata === 'object' && typeof metadata.amount === 'number';
  }

  static isMusicRequestMetadata(metadata: any): metadata is MusicRequestMetadata {
    return metadata && typeof metadata === 'object' && 
           typeof metadata.song_title === 'string' && 
           typeof metadata.artist_name === 'string';
  }

  static isSocialShareMetadata(metadata: any): metadata is SocialShareMetadata {
    return metadata && typeof metadata === 'object' && 
           typeof metadata.platform === 'string' && 
           typeof metadata.content_type === 'string';
  }

  static isFollowMetadata(metadata: any): metadata is FollowMetadata {
    return metadata && typeof metadata === 'object' && 
           typeof metadata.followed_user_type === 'string' && 
           typeof metadata.followed_user_id === 'string';
  }

  static isBadgeUnlockMetadata(metadata: any): metadata is BadgeUnlockMetadata {
    return metadata && typeof metadata === 'object' && 
           typeof metadata.badge_id === 'string' && 
           typeof metadata.badge_name === 'string';
  }

  static isLevelUpMetadata(metadata: any): metadata is LevelUpMetadata {
    return metadata && typeof metadata === 'object' && 
           typeof metadata.previous_level === 'number' && 
           typeof metadata.new_level === 'number';
  }

  static validateMetadataForInteractionType(
    interactionType: string, 
    metadata: any
  ): boolean {
    switch (interactionType) {
      case 'qr_scan':
        return this.isQrScanMetadata(metadata);
      case 'tip':
        return this.isTipMetadata(metadata);
      case 'music_request':
        return this.isMusicRequestMetadata(metadata);
      case 'social_share':
        return this.isSocialShareMetadata(metadata);
      case 'follow':
        return this.isFollowMetadata(metadata);
      case 'badge_unlock':
        return this.isBadgeUnlockMetadata(metadata);
      case 'level_up':
        return this.isLevelUpMetadata(metadata);
      default:
        return metadata === null || metadata === undefined;
    }
  }
}