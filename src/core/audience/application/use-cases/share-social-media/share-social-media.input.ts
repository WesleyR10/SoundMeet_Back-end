import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
} from "class-validator";

export enum SocialMediaPlatform {
  FACEBOOK = "facebook",
  INSTAGRAM = "instagram",
  TWITTER = "twitter",
  WHATSAPP = "whatsapp",
  TELEGRAM = "telegram",
}

export class ShareSocialMediaInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  audience_id: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  request_id: string;

  @IsEnum(SocialMediaPlatform)
  @IsNotEmpty()
  platform: SocialMediaPlatform;

  @IsString()
  @IsOptional()
  message?: string;
}
