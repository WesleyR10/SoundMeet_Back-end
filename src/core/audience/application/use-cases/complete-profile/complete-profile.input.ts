import {
  IsNotEmpty,
  IsString,
  IsUuid,
  IsOptional,
  IsArray,
  IsObject,
} from "class-validator";

export class CompleteProfileInput {
  @IsString()
  @IsNotEmpty()
  @IsUuid()
  audience_id: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  nickname?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsArray()
  @IsOptional()
  favorite_genres?: string[];

  @IsArray()
  @IsOptional()
  favorite_artists?: string[];

  @IsObject()
  @IsOptional()
  notification_settings?: {
    email_notifications?: boolean;
    push_notifications?: boolean;
    sms_notifications?: boolean;
    marketing_emails?: boolean;
  };

  @IsObject()
  @IsOptional()
  privacy_settings?: {
    profile_visibility?: "public" | "private" | "friends";
    show_activity?: boolean;
    show_favorites?: boolean;
    allow_friend_requests?: boolean;
  };

  @IsObject()
  @IsOptional()
  discovery_settings?: {
    discoverable_by_email?: boolean;
    discoverable_by_phone?: boolean;
    show_in_suggestions?: boolean;
    location_based_suggestions?: boolean;
  };
}
