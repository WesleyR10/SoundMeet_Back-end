import { Transform } from "class-transformer";

import { AudienceOutput } from "../../core/audience/application/use-cases/common/audience-output";
import { ListAudiencesOutput } from "../../core/audience/application/use-cases/list-audiences/list-audiences.use-case";
import { MakeMusicRequestOutput } from "../../core/audience/application/use-cases/make-music-request/make-music-request.use-case";
import { ScanQROutput } from "../../core/audience/application/use-cases/scan-qr/scan-qr.use-case";
import { SendTipOutput } from "../../core/audience/application/use-cases/send-tip/send-tip.use-case";
import { CollectionPresenter } from "../shared-module/collection.presenter";

export class AudiencePresenter {
  id: string;
  email: string;
  name: string;
  nickname: string | null;
  avatar: string | null;
  phone: string | null;
  badges?: string[];
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
  favorite_genres?: string[];
  favorite_artists?: string[];
  favorite_instruments?: string[];
  is_active: boolean;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
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

  constructor(output: AudienceOutput) {
    this.id = output.id;
    this.email = output.email;
    this.name = output.name;
    this.nickname = output.nickname;
    this.avatar = output.avatar;
    this.phone = output.phone;
    this.badges = (output as any).badges;
    this.points = output.points;
    this.level = output.level;
    this.preferences = output.preferences;
    this.notification_settings = output.notification_settings;
    this.privacy_settings = output.privacy_settings;
    this.discovery_settings = output.discovery_settings;
    this.favorite_genres = (output as any).favorite_genres;
    this.favorite_artists = (output as any).favorite_artists;
    this.favorite_instruments = (output as any).favorite_instruments;
    this.is_active = output.is_active;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
    this.display_name = output.display_name;
    this.current_level = output.current_level;
    this.level_name = output.level_name;
    this.points_to_next_level = output.points_to_next_level;
    this.max_requests_per_event = output.max_requests_per_event;
    this.has_vip_access = output.has_vip_access;
    this.can_access_exclusive_content = output.can_access_exclusive_content;
    this.is_profile_complete = output.is_profile_complete;
    this.is_highly_engaged = output.is_highly_engaged;
    this.is_new_user = output.is_new_user;
  }
}

export class AudienceCollectionPresenter extends CollectionPresenter {
  data: AudiencePresenter[];

  constructor(output: ListAudiencesOutput) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new AudiencePresenter(i));
  }
}

export class ScanQRPresenter {
  audience: AudiencePresenter;
  points_earned: any;
  new_badges: string[];
  new_level: number | undefined;
  scan_metadata: {
    qr_code: string;
    musician_id?: string;
    establishment_id?: string;
    event_id?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
    scanned_at: Date;
  };

  constructor(output: ScanQROutput) {
    this.audience = new AudiencePresenter(output.audience);
    this.points_earned = output.points_earned.toJSON();
    this.new_badges = output.new_badges;
    this.new_level = output.new_level;
    this.scan_metadata = output.scan_metadata;
  }
}

export class MakeMusicRequestPresenter {
  audience: AudiencePresenter;
  points_earned: number;
  new_badges: string[];
  new_level: any;
  request_metadata: {
    musician_id: string;
    song_title: string;
    artist_name: string;
    genre?: string;
    difficulty?: string;
    event_id?: string;
    establishment_id?: string;
    message?: string;
    /**
     * Destaque pago do pedido.
     *
     * 🔴 Substituiu `is_priority`, que era ecoado do input e nunca persistido:
     * a API respondia "prioridade: sim" para um pedido que nascia comum. Aqui
     * o valor vem do pedido realmente criado.
     */
    boost?: {
      amount: number;
      dedication: string | null;
      status: string;
      is_boosting: boolean;
    };
    requested_at: Date;
    status: "pending" | "accepted" | "rejected";
  };

  constructor(output: MakeMusicRequestOutput) {
    this.audience = new AudiencePresenter(output.audience);
    this.points_earned = output.points_earned;
    this.new_badges = output.new_badges;
    this.new_level = output.new_level;
    this.request_metadata = output.request_metadata;
  }
}

export class SendTipPresenter {
  audience: AudiencePresenter;
  points_earned: number;
  new_badges: string[];
  new_level: number | undefined;
  tip_metadata: {
    musician_id: string;
    amount: number;
    message?: string;
    payment_method: string;
    establishment_id?: string;
    event_id?: string;
    metadata?: Record<string, any>;
    sent_at: Date;
    status: "sent" | "pending" | "failed" | "success";
  };

  constructor(output: SendTipOutput) {
    this.audience = new AudiencePresenter(output.audience);
    this.points_earned = output.points_earned;
    this.new_badges = output.new_badges;
    this.new_level = output.new_level;
    this.tip_metadata = output.tip_metadata;
  }
}
